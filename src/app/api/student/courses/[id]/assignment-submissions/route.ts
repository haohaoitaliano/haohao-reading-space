import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getCurrentLearningSpace } from "@/lib/learning-space";
import {
  buildStudentPhotoPath,
  getStudentPhotoExtension,
  getStudentPhotoMimeType,
  hasStudentPhotoByteSignature,
  STUDENT_PHOTO_BUCKET,
  STUDENT_PHOTO_MAX_COUNT,
  type StudentPhotoMimeType,
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
import { verifyStorageObject } from "@/lib/storage-object-verification";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dispatchStudentRecordingTranscode } from "@/lib/student-transcode-dispatch";

type RouteProps = { params: Promise<{ id: string }> };
type UploadFileInfo = { fileName?: string; mimeType?: string; size?: number };
type RecordingInfo = UploadFileInfo & { source?: string; durationSeconds?: number };
type PhotoInfo = UploadFileInfo & { id?: string };
type RequestBody = {
  action?: string;
  assignmentId?: string;
  audio?: RecordingInfo | null;
  photos?: PhotoInfo[];
};
type UploadTicket = { bucket: string; path: string; token: string; mimeType: string };
type AssignmentContext = {
  auth: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;
  course: { id: string; camp_id: string; day_number: number; max_duration_seconds?: number };
  requirements: { recording_assignment_enabled: boolean; photo_assignment_enabled: boolean };
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};
type UploadPlan = {
  assignmentId: string;
  audioMetadata: Record<string, string | number> | null;
  audioPath: string;
  photoMetadata: Array<Record<string, string | number>>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function fileInfo(input: UploadFileInfo) {
  return { name: String(input.fileName ?? ""), type: String(input.mimeType ?? ""), size: Number(input.size) };
}

async function getAssignmentContext(courseId: string): Promise<AssignmentContext | NextResponse> {
  const auth = await getAuthContext();
  if (!auth || auth.profile.role !== "student" || auth.profile.status !== "active") {
    return failure("请先以学生身份登录。", 401);
  }
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
  return { auth, course, requirements, supabase };
}

async function findExistingAssignment(context: AssignmentContext, assignmentId: string) {
  return context.supabase
    .from("student_assignment_submissions")
    .select("id, camp_id, course_id, version")
    .eq("id", assignmentId)
    .eq("user_id", context.auth.profile.id)
    .maybeSingle<{ id: string; camp_id: string; course_id: string; version: number }>();
}

function buildUploadPlan(context: AssignmentContext, body: RequestBody): UploadPlan | NextResponse {
  const assignmentId = String(body.assignmentId ?? "");
  if (!uuidPattern.test(assignmentId)) return failure("提交标识无效，请刷新页面后重试。", 400);

  const hasAudio = Boolean(body.audio);
  if (context.requirements.recording_assignment_enabled !== hasAudio) {
    return failure(context.requirements.recording_assignment_enabled ? "请先完成录音。" : "本课不需要录音。", 400);
  }
  const photos = Array.isArray(body.photos) ? body.photos : [];
  if (context.requirements.photo_assignment_enabled && (photos.length < 1 || photos.length > STUDENT_PHOTO_MAX_COUNT)) {
    return failure("请先选择 1 至 3 张照片。", 400);
  }
  if (!context.requirements.photo_assignment_enabled && photos.length) return failure("本课不需要照片作业。", 400);
  const photoIds = photos.map((photo) => String(photo.id ?? ""));
  if (new Set(photoIds).size !== photoIds.length || photoIds.some((id) => !uuidPattern.test(id))) {
    return failure("照片提交标识无效，请重新选择照片。", 400);
  }

  let audioMetadata: Record<string, string | number> | null = null;
  let audioPath = "";
  if (body.audio) {
    const audio = fileInfo(body.audio);
    const source = body.audio.source;
    if (source !== "browser_recording" && source !== "manual_upload") {
      return failure("无法确认录音来源，请重新录制或选择。", 400);
    }
    const validationError = source === "manual_upload"
      ? validateManualStudentRecordingFile(audio)
      : validateStudentRecordingFile(audio);
    if (validationError) return failure(validationError, 400);
    const duration = Number(body.audio.durationSeconds);
    const maxDurationSeconds = Number.isInteger(context.course.max_duration_seconds)
      && Number(context.course.max_duration_seconds) > 0
      ? Number(context.course.max_duration_seconds)
      : 120;
    if (!Number.isFinite(duration) || duration < 0 || duration > maxDurationSeconds) {
      return failure(`录音时长无效或超过 ${maxDurationSeconds} 秒。`, 400);
    }
    const extension = getStudentRecordingExtension(audio.name, audio.type);
    const mimeType = normalizeStudentRecordingMimeType(audio.type)
      || (extension === "mp3" ? "audio/mpeg" : "audio/mp4");
    audioPath = buildStudentRecordingPath(
      context.course.camp_id,
      context.auth.profile.id,
      assignmentId,
      extension,
    );
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
  for (const [index, photoInput] of photos.entries()) {
    const photo = fileInfo(photoInput);
    const validationError = validateStudentPhotoFile(photo);
    if (validationError) return failure(validationError, 400);
    const mimeType = getStudentPhotoMimeType(photo);
    if (!mimeType) return failure(`${photo.name || "所选文件"}不是支持的照片。`, 400);
    photoMetadata.push({
      id: photoIds[index],
      storage_path: buildStudentPhotoPath({
        campId: context.course.camp_id,
        userId: context.auth.profile.id,
        courseId: context.course.id,
        submissionId: assignmentId,
        photoId: photoIds[index],
        extension: getStudentPhotoExtension(photo),
      }),
      file_name: photo.name.slice(0, 255),
      mime_type: mimeType,
      size_bytes: photo.size,
      position: index + 1,
    });
  }
  return { assignmentId, audioMetadata, audioPath, photoMetadata };
}

async function cleanupUploadPlan(context: AssignmentContext, plan: UploadPlan) {
  const audioPaths = plan.audioPath ? [plan.audioPath] : [];
  const photoPaths = plan.photoMetadata.map((photo) => String(photo.storage_path));
  const results = await Promise.all([
    audioPaths.length
      ? context.supabase.storage.from(STUDENT_RECORDING_BUCKET).remove(audioPaths)
      : Promise.resolve({ error: null }),
    photoPaths.length
      ? context.supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(photoPaths)
      : Promise.resolve({ error: null }),
  ]);
  return results.every((result) => !result.error);
}

async function createUploadTicket(
  context: AssignmentContext,
  bucket: string,
  path: string,
  mimeType: string,
): Promise<UploadTicket | null> {
  const { data, error } = await context.supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data?.token) return null;
  return { bucket, path, token: data.token, mimeType };
}

async function verifyUploadedPlan(context: AssignmentContext, plan: UploadPlan) {
  if (plan.audioMetadata) {
    const verification = await verifyStorageObject(context.supabase, STUDENT_RECORDING_BUCKET, plan.audioPath, {
      size: Number(plan.audioMetadata.size_bytes),
      mimeType: String(plan.audioMetadata.mime_type),
    });
    if (!verification.object) return verification.error || "录音上传未完成，请直接重试。";
  }
  for (const [index, photo] of plan.photoMetadata.entries()) {
    const mimeType = String(photo.mime_type) as StudentPhotoMimeType;
    const verification = await verifyStorageObject(
      context.supabase,
      STUDENT_PHOTO_BUCKET,
      String(photo.storage_path),
      { size: Number(photo.size_bytes), mimeType },
    );
    if (!verification.object) return `第 ${index + 1} 张照片：${verification.error || "上传未完成，请直接重试。"}`;
    if (!hasStudentPhotoByteSignature(new Uint8Array(verification.object.firstBytes), mimeType)) {
      return `第 ${index + 1} 张照片内容无效，请重新选择照片。`;
    }
  }
  return null;
}

function revalidateAssignmentViews(course: AssignmentContext["course"]) {
  revalidatePath(`/courses/giorno-${course.day_number}`);
  revalidatePath("/circle");
  revalidatePath("/home");
  revalidatePath("/my-work");
  revalidatePath("/progress");
  revalidatePath("/teacher/submissions");
  revalidatePath("/teacher/progress");
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return failure("无法读取作业上传信息，请直接重试。", 400);
  }
  const { id: courseId } = await params;
  const context = await getAssignmentContext(courseId);
  if (context instanceof NextResponse) return context;
  const plan = buildUploadPlan(context, body);
  if (plan instanceof NextResponse) return plan;

  const { data: existing, error: existingError } = await findExistingAssignment(context, plan.assignmentId);
  if (existingError) return failure("暂时无法检查作业状态，请稍后重试。", 503);
  if (existing) {
    if (existing.camp_id !== context.course.camp_id || existing.course_id !== context.course.id) {
      return failure("本次提交标识已被其他课程使用，请刷新页面后重试。", 409);
    }
    return NextResponse.json({
      success: true,
      completed: true,
      assignmentId: existing.id,
      version: existing.version,
      retryRecovered: true,
    });
  }

  if (body.action === "cleanup") {
    const cleaned = await cleanupUploadPlan(context, plan);
    return NextResponse.json({
      success: cleaned,
      message: cleaned ? "未完成的上传已清理。" : "部分临时文件暂未清理，将在重试时再次清理。",
    }, { status: cleaned ? 200 : 503 });
  }

  if (body.action === "prepare") {
    const cleaned = await cleanupUploadPlan(context, plan);
    if (!cleaned) {
      return failure("无法清理上次未完成的上传，请稍后直接重试。", 503);
    }
    const audioTicket = plan.audioMetadata
      ? await createUploadTicket(
        context,
        STUDENT_RECORDING_BUCKET,
        plan.audioPath,
        String(plan.audioMetadata.mime_type),
      )
      : null;
    if (plan.audioMetadata && !audioTicket) {
      return failure("无法创建录音上传授权，请确认 RLS migration 已执行。", 500);
    }
    const photoTickets: UploadTicket[] = [];
    for (const photo of plan.photoMetadata) {
      const ticket = await createUploadTicket(
        context,
        STUDENT_PHOTO_BUCKET,
        String(photo.storage_path),
        String(photo.mime_type),
      );
      if (!ticket) return failure("无法创建照片上传授权，请直接重试。", 500);
      photoTickets.push(ticket);
    }
    return NextResponse.json({ success: true, completed: false, audio: audioTicket, photos: photoTickets });
  }

  if (body.action !== "complete") return failure("作业上传步骤无效，请直接重试。", 400);
  const verificationError = await verifyUploadedPlan(context, plan);
  if (verificationError) {
    await cleanupUploadPlan(context, plan);
    return failure(`${verificationError}；本次临时文件已清理，可以直接重试。`, 400);
  }

  const { data: completed, error: completionError } = await context.supabase.rpc("complete_student_assignment", {
    target_assignment_id: plan.assignmentId,
    target_camp_id: context.course.camp_id,
    target_course_id: context.course.id,
    audio_metadata: plan.audioMetadata,
    photos_metadata: plan.photoMetadata,
  }).single<{
    assignment_id: string;
    assignment_version: number;
    audio_submission_id: string | null;
    audio_version: number | null;
    photo_submission_id: string | null;
    audio_transcode_status: string | null;
  }>();
  if (completionError || !completed) {
    await cleanupUploadPlan(context, plan);
    return failure("文件已上传，但作业记录保存失败；本次临时文件已清理，请直接重试。", 500);
  }
  if (completed.audio_submission_id && completed.audio_transcode_status === "pending") {
    await dispatchStudentRecordingTranscode(completed.audio_submission_id);
  }
  revalidateAssignmentViews(context.course);
  return NextResponse.json({
    success: true,
    completed: true,
    assignmentId: completed.assignment_id,
    version: completed.assignment_version,
  });
}
