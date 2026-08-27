import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeSubmissionComment,
  validateSubmissionComment,
} from "@/lib/submission-interaction";
import { getPublicSubmissionInteractionContext } from "@/lib/submission-interaction-server";

type RouteProps = { params: Promise<{ id: string }> };
type CommentRow = {
  id: string;
  author_display_name: string;
  content: string;
  created_at: string;
};

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getPublicSubmissionInteractionContext(id);
  if (context.state === "unauthenticated") return failure("请先登录。", 401);
  if (context.state !== "ok") return failure("该录音不存在或不开放评论。", 403);

  const body = await request.json().catch(() => null) as { content?: unknown } | null;
  const rawContent = typeof body?.content === "string" ? body.content : "";
  const validationError = validateSubmissionComment(rawContent);
  if (validationError) return failure(validationError, 400);
  const content = normalizeSubmissionComment(rawContent);

  const { data, error } = await context.supabase
    .from("submission_comments")
    .insert({
      submission_id: context.submission.id,
      user_id: context.auth.profile.id,
      content,
    })
    .select("id, author_display_name, content, created_at")
    .single<CommentRow>();
  if (error || !data) return failure("评论发送失败，请稍后重试。", 500);

  return NextResponse.json({
    success: true,
    comment: {
      id: data.id,
      authorName: data.author_display_name.trim() || "同学",
      content: data.content,
      createdAt: data.created_at,
      isOwn: true,
    },
  });
}
