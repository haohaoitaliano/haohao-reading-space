import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import {
  STUDENT_RECORDING_BUCKET,
  STUDENT_RECORDING_SIGNED_URL_SECONDS,
} from "@/lib/student-recording";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string }> };
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
