import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import {
  buildStudentRecordingPath,
  getStudentRecordingExtension,
  normalizeStudentRecordingMimeType,
  STUDENT_RECORDING_BUCKET,
  STUDENT_RECORDING_SIGNED_URL_SECONDS,
  validateStudentRecordingFile,
} from "@/lib/student-recording";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dispatchStudentRecordingTranscode } from "@/lib/student-transcode-dispatch";

type RouteProps = { params: Promise<{ id: string }> };
type OwnedSubmission = {
  id: string;
  camp_id: string;
  user_id: string;
  storage_path: string;
  playback_storage_path: string | null;
};
type VisibleSubmission = {
  storage_path: string;
  mime_type: string;
  playback_storage_path: string | null;
  playback_mime_type: string | null;
  transcode_status: string;
};

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

async function getOwnedSubmission(id: string) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.role !== "student") return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("student_submissions")
    .select("id, camp_id, user_id, storage_path, playback_storage_path")
    .eq("id", id)
    .eq("user_id", auth.profile.id)
    .maybeSingle<OwnedSubmission>();
  return data ? { auth, supabase, submission: data } : null;
}

export async function GET(_: NextRequest, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.status !== "active") return failure("请先登录。", 401);

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: submission, error } = await supabase
    .from("student_submissions")
    .select("storage_path, mime_type, playback_storage_path, playback_mime_type, transcode_status")
    .eq("id", id)
    .maybeSingle<VisibleSubmission>();
  if (error || !submission) return failure("录音不存在或无权播放。", 404);

  const playbackReady = submission.transcode_status === "ready"
    && submission.playback_mime_type === "audio/mp4"
    && Boolean(submission.playback_storage_path);
  const needsCompatiblePlayback = submission.mime_type === "audio/webm"
    || submission.mime_type === "audio/ogg";
  if (needsCompatiblePlayback && !playbackReady) {
    const response = NextResponse.json({
      status: submission.transcode_status === "failed" ? "retrying" : "processing",
      retryAfterSeconds: 3,
    }, { status: 202 });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Retry-After", "3");
    return response;
  }
  const audioPath = playbackReady ? submission.playback_storage_path! : submission.storage_path;
  const { data: signed, error: signedError } = await supabase.storage
    .from(STUDENT_RECORDING_BUCKET)
    .createSignedUrl(audioPath, STUDENT_RECORDING_SIGNED_URL_SECONDS);
  if (signedError || !signed?.signedUrl) return failure("录音暂时无法播放，请刷新后重试。", 503);

  const response = NextResponse.json({
    url: signed.signedUrl,
    expiresIn: STUDENT_RECORDING_SIGNED_URL_SECONDS,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function PUT(request: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getOwnedSubmission(id);
  if (!context) return failure("录音不存在或无权替换。", 403);
  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof File)) return failure("请选择替换录音。", 400);
  const validationError = validateStudentRecordingFile(audio);
  if (validationError) return failure(validationError, 400);
  const duration = Number(formData?.get("durationSeconds"));
  const extension = getStudentRecordingExtension(audio.name, audio.type);
  const mimeType = normalizeStudentRecordingMimeType(audio.type);
  const nextPath = buildStudentRecordingPath(
    context.submission.camp_id,
    context.auth.profile.id,
    `${id}-${Date.now()}`,
    extension,
  );
  const { error: uploadError } = await context.supabase.storage
    .from(STUDENT_RECORDING_BUCKET)
    .upload(nextPath, audio, { contentType: mimeType, upsert: false });
  if (uploadError) return failure("替换录音上传失败，请稍后重试。", 500);
  const { error: updateError } = await context.supabase
    .from("student_submissions")
    .update({
      storage_path: nextPath,
      file_name: audio.name.slice(0, 255),
      mime_type: mimeType,
      size_bytes: audio.size,
      duration_seconds: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    })
    .eq("id", id);
  if (updateError) {
    await context.supabase.storage.from(STUDENT_RECORDING_BUCKET).remove([nextPath]);
    return failure("录音替换失败，请稍后重试。", 500);
  }
  await dispatchStudentRecordingTranscode(id);
  const previousPaths = [context.submission.storage_path, context.submission.playback_storage_path]
    .filter((path): path is string => Boolean(path));
  await context.supabase.storage.from(STUDENT_RECORDING_BUCKET).remove(previousPaths);
  return NextResponse.json({ success: true, message: "录音已替换。" });
}

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getOwnedSubmission(id);
  if (!context) return failure("录音不存在或无权删除。", 403);
  const paths = [context.submission.storage_path, context.submission.playback_storage_path]
    .filter((path): path is string => Boolean(path));
  const { error: storageError } = await context.supabase.storage
    .from(STUDENT_RECORDING_BUCKET)
    .remove(paths);
  if (storageError) return failure("录音删除失败，请稍后重试。", 500);
  const { error: metadataError } = await context.supabase
    .from("student_submissions")
    .delete()
    .eq("id", id);
  if (metadataError) return failure("提交记录删除失败，请稍后重试。", 500);
  return NextResponse.json({ success: true, message: "录音已删除。" });
}
