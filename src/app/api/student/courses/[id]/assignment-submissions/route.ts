import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getCurrentLearningSpace } from "@/lib/learning-space";
import {
  buildStudentPhotoPath,
  getStudentPhotoExtension,
  getStudentPhotoMimeType,
  hasStudentPhotoSignature,
  STUDENT_PHOTO_BUCKET,
  STUDENT_PHOTO_MAX_COUNT,
  validateStudentPhotoFile,
} from "@/lib/student-photo";
import {
  buildStudentRecordingPath,
  getStudentRecordingExtension,
  normalizeStudentRecordingMimeType,
  STUDENT_RECORDING_BUCKET,
  validateManualStudentRecordingFile,
  validateStudentRecordingFile,
} from "@/lib/student-recording";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dispatchStudentRecordingTranscode } from "@/lib/student-transcode-dispatch";

type RouteProps = { params: Promise<{ id: string }> };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    .maybeSingle<{ id: string; camp_id: string; day_number: number; max_duration_seconds?: number }>();
  if (!course || course.camp_id !== campResult.camp.id) {
    return failure("课程不存在、尚未发布或还未解锁。", 403);
  }
  const { data: requirements } = await supabase
    .from("course_contents")
    .select("recording_assignment_enabled, photo_assignment_enabled")
    .eq("course_id", course.id)
    .maybeSingle<{ recording_assignment_enabled: boolean; photo_assignment_enabled: boolean }>();
  if (!requirements) return failure("无法读取本课作业要求。", 503);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("无法读取作业材料，请重试。", 400);
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!uuidPattern.test(assignmentId)) return failure("提交标识无效，请刷新页面后重试。", 400);

  const { data: existing } = await supabase
    .from("student_assignment_submissions")
    .select("id, camp_id, course_id, version")
    .eq("id", assignmentId)
    .eq("user_id", auth.profile.id)
    .maybeSingle<{
      id: string;
      camp_id: string;
      course_id: string;
      version: number;
    }>();
  if (existing) {
    if (existing.camp_id !== course.camp_id || existing.course_id !== course.id) {
      return failure("本次提交标识已被其他课程使用，请刷新页面后重试。", 409);
    }
    return NextResponse.json({
      success: true,
      assignmentId: existing.id,
      version: existing.version,
      retryRecovered: true,
    });
  }

  const audio = formData.get("audio");
  const hasAudio = audio instanceof File;
  if (requirements.recording_assignment_enabled !== hasAudio) {
    return failure(requirements.recording_assignment_enabled ? "请先完成录音。" : "本课不需要录音。", 400);
  }

  const photos = formData.getAll("photos").filter((item): item is File => item instanceof File);
  const photoIds = formData.getAll("photoIds").map(String);
  if (requirements.photo_assignment_enabled && (photos.length < 1 || photos.length > STUDENT_PHOTO_MAX_COUNT)) {
    return failure("请先选择 1 至 3 张照片。", 400);
  }
  if (!requirements.photo_assignment_enabled && photos.length) return failure("本课不需要照片作业。", 400);
  if (photos.length !== photoIds.length || new Set(photoIds).size !== photoIds.length || photoIds.some((id) => !uuidPattern.test(id))) {
    return failure("照片提交标识无效，请重新选择照片。", 400);
  }

  let audioMetadata: Record<string, string | number> | null = null;
  let audioPath = "";
  if (hasAudio) {
    const source = formData.get("source");
    if (source !== "browser_recording" && source !== "manual_upload") {
      return failure("无法确认录音来源，请重新录制或选择。", 400);
    }
    const validationError = source === "manual_upload"
      ? validateManualStudentRecordingFile(audio)
      : validateStudentRecordingFile(audio);
    if (validationError) return failure(validationError, 400);
    const duration = Number(formData.get("durationSeconds"));
    const maxDurationSeconds = Number.isInteger(course.max_duration_seconds) && Number(course.max_duration_seconds) > 0
      ? Number(course.max_duration_seconds)
      : 120;
    if (!Number.isFinite(duration) || duration < 0 || duration > maxDurationSeconds) {
      return failure(`录音时长无效或超过 ${maxDurationSeconds} 秒。`, 400);
    }
    const extension = getStudentRecordingExtension(audio.name, audio.type);
    const mimeType = normalizeStudentRecordingMimeType(audio.type)
      || (extension === "mp3" ? "audio/mpeg" : "audio/mp4");
    audioPath = buildStudentRecordingPath(course.camp_id, auth.profile.id, assignmentId, extension);
    audioMetadata = {
      id: assignmentId,
      storage_path: audioPath,
      file_name: audio.name.slice(0, 255),
      mime_type: mimeType,
      size_bytes: audio.size,
      duration_seconds: duration,
    };
  }

  const photoMetadata: Array<Record<string, string | number>> = [];
  for (const [index, photo] of photos.entries()) {
    const validationError = validateStudentPhotoFile(photo);
    if (validationError) return failure(validationError, 400);
    const mimeType = getStudentPhotoMimeType(photo);
    if (!mimeType || !(await hasStudentPhotoSignature(photo, mimeType))) {
      return failure(`${photo.name || "所选文件"}的内容不是有效照片。`, 400);
    }
    const storagePath = buildStudentPhotoPath({
      campId: course.camp_id,
      userId: auth.profile.id,
      courseId: course.id,
      submissionId: assignmentId,
      photoId: photoIds[index],
      extension: getStudentPhotoExtension(photo),
    });
    photoMetadata.push({
      id: photoIds[index],
      storage_path: storagePath,
      file_name: photo.name.slice(0, 255),
      mime_type: mimeType,
      size_bytes: photo.size,
      position: index + 1,
    });
  }

  const intendedAudioPaths = audioPath ? [audioPath] : [];
  const intendedPhotoPaths = photoMetadata.map((photo) => String(photo.storage_path));
  if (intendedAudioPaths.length) await supabase.storage.from(STUDENT_RECORDING_BUCKET).remove(intendedAudioPaths);
  if (intendedPhotoPaths.length) await supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(intendedPhotoPaths);

  const uploadedAudioPaths: string[] = [];
  const uploadedPhotoPaths: string[] = [];
  if (hasAudio && audioMetadata) {
    const { error } = await supabase.storage.from(STUDENT_RECORDING_BUCKET).upload(audioPath, audio, {
      contentType: String(audioMetadata.mime_type),
      upsert: false,
    });
    if (error) return failure("录音上传失败，请保留当前材料后重试。", 500);
    uploadedAudioPaths.push(audioPath);
  }

  for (const [index, photo] of photos.entries()) {
    const metadata = photoMetadata[index];
    const { error } = await supabase.storage.from(STUDENT_PHOTO_BUCKET).upload(String(metadata.storage_path), photo, {
      contentType: String(metadata.mime_type),
      upsert: false,
    });
    if (error) {
      if (uploadedAudioPaths.length) await supabase.storage.from(STUDENT_RECORDING_BUCKET).remove(uploadedAudioPaths);
      if (uploadedPhotoPaths.length) await supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(uploadedPhotoPaths);
      return failure(`第 ${index + 1} 张照片上传失败；已清理本次文件，可以直接重试。`, 500);
    }
    uploadedPhotoPaths.push(String(metadata.storage_path));
  }

  const { data: completed, error: completionError } = await supabase.rpc("complete_student_assignment", {
    target_assignment_id: assignmentId,
    target_camp_id: course.camp_id,
    target_course_id: course.id,
    audio_metadata: audioMetadata,
    photos_metadata: photoMetadata,
  }).single<{
    assignment_id: string;
    assignment_version: number;
    audio_submission_id: string | null;
    audio_version: number | null;
    photo_submission_id: string | null;
    audio_transcode_status: string | null;
  }>();

  if (completionError || !completed) {
    if (uploadedAudioPaths.length) await supabase.storage.from(STUDENT_RECORDING_BUCKET).remove(uploadedAudioPaths);
    if (uploadedPhotoPaths.length) await supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(uploadedPhotoPaths);
    return failure("作业记录保存失败；已清理本次文件，请保留材料后重试。", 500);
  }

  if (completed.audio_submission_id && completed.audio_transcode_status === "pending") {
    await dispatchStudentRecordingTranscode(completed.audio_submission_id);
  }

  revalidatePath(`/courses/giorno-${course.day_number}`);
  revalidatePath("/circle");
  revalidatePath("/home");
  revalidatePath("/my-work");
  revalidatePath("/progress");
  revalidatePath("/teacher/submissions");
  revalidatePath("/teacher/progress");
  return NextResponse.json({
    success: true,
    assignmentId: completed.assignment_id,
    version: completed.assignment_version,
  });
}
