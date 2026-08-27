import { NextResponse, type NextRequest } from "next/server";
import { getPublicSubmissionInteractionContext } from "@/lib/submission-interaction-server";

type RouteProps = { params: Promise<{ id: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

async function getCount(
  context: Extract<Awaited<ReturnType<typeof getPublicSubmissionInteractionContext>>, { state: "ok" }>,
) {
  const { count, error } = await context.supabase
    .from("submission_encouragements")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", context.submission.id);
  return error ? null : (count ?? 0);
}

export async function POST(_: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getPublicSubmissionInteractionContext(id);
  if (context.state === "unauthenticated") return failure("请先登录。", 401);
  if (context.state !== "ok") return failure("该录音不存在或不开放鼓励。", 403);
  if (context.submission.user_id === context.auth.profile.id) {
    return failure("不能鼓励自己的录音。", 403);
  }

  const { error } = await context.supabase.from("submission_encouragements").insert({
    submission_id: context.submission.id,
    user_id: context.auth.profile.id,
  });
  if (error && error.code !== "23505") return failure("鼓励失败，请稍后重试。", 500);

  const count = await getCount(context);
  if (count === null) {
    return NextResponse.json({ success: true, count: null, encouraged: true });
  }
  return NextResponse.json({ success: true, count, encouraged: true });
}

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getPublicSubmissionInteractionContext(id);
  if (context.state === "unauthenticated") return failure("请先登录。", 401);
  if (context.state !== "ok") return failure("该录音不存在或不开放鼓励。", 403);

  const { error } = await context.supabase
    .from("submission_encouragements")
    .delete()
    .eq("submission_id", context.submission.id)
    .eq("user_id", context.auth.profile.id);
  if (error) return failure("取消鼓励失败，请稍后重试。", 500);

  const count = await getCount(context);
  if (count === null) {
    return NextResponse.json({ success: true, count: null, encouraged: false });
  }
  return NextResponse.json({ success: true, count, encouraged: false });
}
