import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { decodeStudentMessageCursor, getStudentMessagePage } from "@/lib/student-message-data";

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.status !== "active" || auth.profile.role !== "student") return failure("请先登录。", 401);
  const cursor = decodeStudentMessageCursor(request.nextUrl.searchParams.get("cursor"));
  if (cursor === undefined) return failure("分页位置无效，请刷新后重试。", 400);
  const result = await getStudentMessagePage(auth.profile.id, cursor);
  if (result.state !== "ok") return failure("消息暂时无法读取，请稍后重试。", 500);
  return NextResponse.json({ success: true, messages: result.messages, nextCursor: result.nextCursor });
}
