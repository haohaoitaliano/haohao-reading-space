import { NextResponse, type NextRequest } from "next/server";
import { SUBMISSION_COMMENT_MEDIA_BUCKET } from "@/lib/submission-comment-media";
import { getSubmissionInteractionContext } from "@/lib/submission-interaction-server";

type RouteProps = { params: Promise<{ id: string; commentId: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const { id, commentId } = await params;
  const context = await getSubmissionInteractionContext(id);
  if (context.state === "unauthenticated") return failure("请先登录。", 401);
  if (context.state !== "ok") return failure("该作业不存在或无权删除评论。", 403);

  const { count } = await context.supabase.from("submission_comments")
    .select("id", { count: "exact", head: true })
    .eq("parent_comment_id", commentId);
  if ((count ?? 0) > 0) return failure("已有回复的评论不能删除。", 409);

  let existingQuery = context.supabase.from("submission_comments")
    .select("audio_storage_path, audio_playback_storage_path, image_storage_path")
    .eq("id", commentId)
    .eq("user_id", context.auth.profile.id);
  existingQuery = context.targetColumn === "assignment_submission_id"
    ? existingQuery.or(`assignment_submission_id.eq.${context.target.id},submission_id.eq.${context.target.id}`)
    : existingQuery.eq("submission_id", context.target.id);
  const { data: existing } = await existingQuery
    .maybeSingle<{
      audio_storage_path: string | null;
      audio_playback_storage_path: string | null;
      image_storage_path: string | null;
    }>();
  if (!existing) return failure("评论不存在或无权删除。", 403);

  let deleteQuery = context.supabase
    .from("submission_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", context.auth.profile.id);
  deleteQuery = context.targetColumn === "assignment_submission_id"
    ? deleteQuery.or(`assignment_submission_id.eq.${context.target.id},submission_id.eq.${context.target.id}`)
    : deleteQuery.eq("submission_id", context.target.id);
  const { data, error } = await deleteQuery
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) return failure("删除评论失败，请稍后重试。", 500);
  if (!data) return failure("评论不存在或无权删除。", 403);
  const paths = [existing.audio_storage_path, existing.audio_playback_storage_path, existing.image_storage_path]
    .filter((path): path is string => Boolean(path));
  if (paths.length) await context.supabase.storage.from(SUBMISSION_COMMENT_MEDIA_BUCKET).remove(paths);
  return NextResponse.json({ success: true });
}
