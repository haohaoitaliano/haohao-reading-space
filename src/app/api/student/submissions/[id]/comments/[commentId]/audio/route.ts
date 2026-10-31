import { NextResponse, type NextRequest } from "next/server";
import {
  SUBMISSION_COMMENT_MEDIA_BUCKET,
  SUBMISSION_COMMENT_SIGNED_URL_SECONDS,
} from "@/lib/submission-comment-media";
import { getSubmissionInteractionContext } from "@/lib/submission-interaction-server";

type RouteProps = { params: Promise<{ id: string; commentId: string }> };

export async function GET(_: NextRequest, { params }: RouteProps) {
  const { id, commentId } = await params;
  const context = await getSubmissionInteractionContext(id);
  if (context.state !== "ok") return NextResponse.json({ message: "录音不存在或无权播放。" }, { status: context.state === "unauthenticated" ? 401 : 404 });
  let commentQuery = context.supabase.from("submission_comments")
    .select("audio_storage_path, audio_mime_type, audio_playback_storage_path, audio_playback_mime_type, audio_transcode_status")
    .eq("id", commentId);
  commentQuery = context.targetColumn === "assignment_submission_id"
    ? commentQuery.or(`assignment_submission_id.eq.${context.target.id},submission_id.eq.${context.target.id}`)
    : commentQuery.eq("submission_id", context.target.id);
  const { data } = await commentQuery
    .maybeSingle<{
      audio_storage_path: string | null;
      audio_mime_type: string | null;
      audio_playback_storage_path: string | null;
      audio_playback_mime_type: string | null;
      audio_transcode_status: string | null;
    }>();
  if (!data?.audio_storage_path) return NextResponse.json({ message: "录音不存在或无权播放。" }, { status: 404 });
  const playbackReady = data.audio_transcode_status === "ready"
    && data.audio_playback_mime_type === "audio/mp4"
    && Boolean(data.audio_playback_storage_path);
  if ((data.audio_mime_type === "audio/webm" || data.audio_mime_type === "audio/ogg") && !playbackReady) {
    return NextResponse.json({ status: data.audio_transcode_status === "failed" ? "retrying" : "processing", retryAfterSeconds: 3 }, {
      status: 202,
      headers: { "Cache-Control": "private, no-store", "Retry-After": "3" },
    });
  }
  const path = playbackReady ? data.audio_playback_storage_path! : data.audio_storage_path;
  const { data: signed, error } = await context.supabase.storage.from(SUBMISSION_COMMENT_MEDIA_BUCKET)
    .createSignedUrl(path, SUBMISSION_COMMENT_SIGNED_URL_SECONDS);
  if (error || !signed?.signedUrl) return NextResponse.json({ message: "录音暂时无法播放。" }, { status: 503 });
  return NextResponse.json({ url: signed.signedUrl, expiresIn: SUBMISSION_COMMENT_SIGNED_URL_SECONDS }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
