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
type OwnedSubmission = { id: string; camp_id: string; user_id: string; storage_path: string };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

async function getOwnedSubmission(id: string) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.role !== "student") return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("student_submissions")
    .select("id, camp_id, user_id, storage_path")
    .eq("id", id)
    .eq("user_id", auth.profile.id)
    .maybeSingle<OwnedSubmission>();
  return data ? { auth, supabase, submission: data } : null;
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
  await context.supabase.storage.from(STUDENT_RECORDING_BUCKET).remove([context.submission.storage_path]);
  return NextResponse.json({ success: true, message: "录音已替换。" });
}

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getOwnedSubmission(id);
  if (!context) return failure("录音不存在或无权删除。", 403);
  const { error: storageError } = await context.supabase.storage
    .from(STUDENT_RECORDING_BUCKET)
    .remove([context.submission.storage_path]);
  if (storageError) return failure("录音删除失败，请稍后重试。", 500);
  const { error: metadataError } = await context.supabase
    .from("student_submissions")
    .delete()
    .eq("id", id);
  if (metadataError) return failure("提交记录删除失败，请稍后重试。", 500);
  return NextResponse.json({ success: true, message: "录音已删除。" });
}
