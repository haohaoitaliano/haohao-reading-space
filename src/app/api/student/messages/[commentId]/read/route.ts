import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getStudentMessages } from "@/lib/student-message-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ commentId: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(_: Request, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.status !== "active" || auth.profile.role !== "student") {
    return failure("请先以学生身份登录。", 401);
  }

  const { commentId } = await params;
  const messageResult = await getStudentMessages(auth.profile.id);
  if (messageResult.state !== "ok") return failure("当前训练营或消息不可用。", 403);
  const message = messageResult.messages.find((item) => item.id === commentId);
  if (!message) {
    return failure("该消息不存在或无权读取。", 403);
  }
  const unreadCount = Math.max(0, messageResult.unreadCount - (message.isRead ? 0 : 1));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("submission_comment_reads").insert({
    comment_id: commentId,
    user_id: auth.profile.id,
  });

  if (error?.code === "23505") return NextResponse.json({ success: true, unreadCount });
  if (error?.code === "42501") return failure("该消息不存在或无权读取。", 403);
  if (error) return failure("已读状态暂时无法保存。", 500);
  return NextResponse.json({ success: true, unreadCount });
}
