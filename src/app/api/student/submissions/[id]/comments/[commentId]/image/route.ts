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
  if (context.state !== "ok") return NextResponse.json({ message: "照片不存在或无权查看。" }, { status: context.state === "unauthenticated" ? 401 : 404 });
  let commentQuery = context.supabase.from("submission_comments")
    .select("image_storage_path")
    .eq("id", commentId);
  commentQuery = context.targetColumn === "assignment_submission_id"
    ? commentQuery.or(`assignment_submission_id.eq.${context.target.id},submission_id.eq.${context.target.id}`)
    : commentQuery.eq("submission_id", context.target.id);
  const { data } = await commentQuery
    .maybeSingle<{ image_storage_path: string | null }>();
  if (!data?.image_storage_path) return NextResponse.json({ message: "照片不存在或无权查看。" }, { status: 404 });
  const { data: signed, error } = await context.supabase.storage.from(SUBMISSION_COMMENT_MEDIA_BUCKET)
    .createSignedUrl(data.image_storage_path, SUBMISSION_COMMENT_SIGNED_URL_SECONDS);
  if (error || !signed?.signedUrl) return NextResponse.json({ message: "照片暂时无法显示。" }, { status: 503 });
  const response = NextResponse.redirect(signed.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
