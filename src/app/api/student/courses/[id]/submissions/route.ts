import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import {
  buildStudentRecordingPath,
  getStudentRecordingExtension,
  normalizeStudentRecordingMimeType,
  STUDENT_RECORDING_BUCKET,
  validateStudentRecordingFile,
} from "@/lib/student-recording";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const supabase = await createSupabaseServerClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, camp_id")
    .eq("id", courseId)
    .maybeSingle<{ id: string; camp_id: string }>();
  if (!course) return failure("课程不存在、尚未发布或还未解锁。", 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("无法读取录音，请重新录制。", 400);
  }
  const audio = formData.get("audio");
  if (!(audio instanceof File)) return failure("请先完成录音。", 400);
  const validationError = validateStudentRecordingFile(audio);
  if (validationError) return failure(validationError, 400);
  const visibility = formData.get("visibility");
  if (visibility !== "public" && visibility !== "teacher_only") {
    return failure("请选择录音公开范围。", 400);
  }
  const duration = Number(formData.get("durationSeconds"));
  if (!Number.isFinite(duration) || duration < 0 || duration > 7200) {
    return failure("录音时长无效，请重新录制。", 400);
  }

  const submissionId = crypto.randomUUID();
  const extension = getStudentRecordingExtension(audio.name, audio.type);
  const mimeType = normalizeStudentRecordingMimeType(audio.type);
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
    .select("id, version")
    .single<{ id: string; version: number }>();
  if (metadataError || !submission) {
    await supabase.storage.from(STUDENT_RECORDING_BUCKET).remove([storagePath]);
    return failure("提交记录保存失败，请稍后重试。", 500);
  }

  return NextResponse.json({ success: true, submissionId: submission.id, version: submission.version });
}
