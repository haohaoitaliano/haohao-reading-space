import { NextResponse, type NextRequest } from "next/server";
import { getPublicSubmissionInteractionContext } from "@/lib/submission-interaction-server";

type RouteProps = { params: Promise<{ id: string; commentId: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const { id, commentId } = await params;
  const context = await getPublicSubmissionInteractionContext(id);
  if (context.state === "unauthenticated") return failure("请先登录。", 401);
  if (context.state !== "ok") return failure("该录音不存在或不开放评论。", 403);

  const { data, error } = await context.supabase
    .from("submission_comments")
    .delete()
    .eq("id", commentId)
    .eq("submission_id", context.submission.id)
    .eq("user_id", context.auth.profile.id)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) return failure("删除评论失败，请稍后重试。", 500);
  if (!data) return failure("评论不存在或无权删除。", 403);
  return NextResponse.json({ success: true });
}
