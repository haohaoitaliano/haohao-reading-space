import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import {
  buildStudentRecordingPath,
  getStudentRecordingExtension,
  normalizeStudentRecordingMimeType,
  STUDENT_RECORDING_BUCKET,
  validateManualStudentRecordingFile,
  validateStudentRecordingFile,
} from "@/lib/student-recording";
import { getCurrentLearningSpace } from "@/lib/learning-space";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dispatchStudentRecordingTranscode } from "@/lib/student-transcode-dispatch";

type RouteProps = { params: Promise<{ id: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.role !== "student" || auth.profile.status !== "active") {
    return failure("请先以学生身份登录。", 401);
  }
  const { id: courseId } = await params;
  const campResult = await getCurrentLearningSpace(auth.profile.id);
  if (campResult.state === "no_selected_camp") return failure("请先选择当前训练营。", 403);
  if (campResult.state === "no_membership") return failure("请先加入训练营。", 403);
  if (campResult.state !== "ok") return failure("训练营信息暂时无法读取，请稍后重试。", 503);

  const supabase = await createSupabaseServerClient();
  const { data: course } = await supabase
    .rpc("get_course_schedule", { target_camp_id: campResult.camp.id })
    .eq("id", courseId)
    .maybeSingle<{ id: string; camp_id: string; max_duration_seconds?: number }>();
  if (!course) return failure("课程不存在、尚未发布或还未解锁。", 403);
  if (course.camp_id !== campResult.camp.id) return failure("请切换到该课程所属训练营后再提交。", 403);
  const { data: assignment } = await supabase
    .from("course_contents")
    .select("recording_assignment_enabled")
    .eq("course_id", course.id)
    .maybeSingle<{ recording_assignment_enabled: boolean }>();
  if (!assignment?.recording_assignment_enabled) return failure("本课没有开启录音作业。", 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("无法读取录音，请重新录制。", 400);
  }
  const audio = formData.get("audio");
  if (!(audio instanceof File)) return failure("请先完成录音。", 400);
  const source = formData.get("source");
  if (source !== "browser_recording" && source !== "manual_upload") {
    return failure("无法确认录音来源，请重新选择或录制。", 400);
  }
  const validationError = source === "manual_upload"
    ? validateManualStudentRecordingFile(audio)
    : validateStudentRecordingFile(audio);
  if (validationError) return failure(validationError, 400);
  const visibility = formData.get("visibility");
  if (visibility !== "public" && visibility !== "teacher_only") {
    return failure("请选择录音公开范围。", 400);
  }
  const duration = Number(formData.get("durationSeconds"));
  if (!Number.isFinite(duration) || duration < 0 || duration > 7200) {
    return failure("录音时长无效，请重新录制。", 400);
  }
  const maxDurationSeconds = Number.isInteger(course.max_duration_seconds)
    && Number(course.max_duration_seconds) > 0
    ? Number(course.max_duration_seconds)
    : 120;
  if (duration > maxDurationSeconds) {
    return failure(`音频超过本任务最大时长 ${maxDurationSeconds} 秒，请重新录制或选择其他文件。`, 400);
  }

  const submissionId = crypto.randomUUID();
  const extension = getStudentRecordingExtension(audio.name, audio.type);
  const mimeType = normalizeStudentRecordingMimeType(audio.type)
    || (extension === "mp3" ? "audio/mpeg" : "audio/mp4");
  const storagePath = buildStudentRecordingPath(course.camp_id, auth.profile.id, submissionId, extension);
  const { error: uploadError } = await supabase.storage
    .from(STUDENT_RECORDING_BUCKET)
    .upload(storagePath, audio, { contentType: mimeType, upsert: false });
  if (uploadError) return failure("录音上传失败，请稍后重试。", 500);

  const { data: submission, error: metadataError } = await supabase
    .from("student_submissions")
    .insert({
      id: submissionId,
      camp_id: course.camp_id,
      course_id: course.id,
      user_id: auth.profile.id,
      storage_path: storagePath,
      file_name: audio.name.slice(0, 255),
      mime_type: mimeType,
      size_bytes: audio.size,
      duration_seconds: duration,
      visibility,
    })
    .select("id, version, transcode_status")
    .single<{ id: string; version: number; transcode_status: string }>();
  if (metadataError || !submission) {
    await supabase.storage.from(STUDENT_RECORDING_BUCKET).remove([storagePath]);
    return failure("提交记录保存失败，请稍后重试。", 500);
  }

  if (submission.transcode_status === "pending") {
    await dispatchStudentRecordingTranscode(submission.id);
  }

  return NextResponse.json({
    success: true,
    submissionId: submission.id,
    version: submission.version,
    transcodeStatus: submission.transcode_status,
  });
}
