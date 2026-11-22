import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { decodeCircleCursor, getCampCirclePage } from "@/lib/circle-page-data";
import { getActiveCampForUser } from "@/lib/cloud-course-data";

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.status !== "active" || auth.profile.role !== "student") {
    return failure("请先登录。", 401);
  }
  const campResult = await getActiveCampForUser(auth.profile.id);
  if (campResult.state !== "ok") return failure("当前训练营暂时无法读取。", 403);
  const cursor = decodeCircleCursor(request.nextUrl.searchParams.get("cursor"));
  if (cursor === undefined) return failure("分页位置无效，请刷新后重试。", 400);
  const result = await getCampCirclePage(campResult.camp.id, auth.profile.id, cursor);
  if (result.error) return failure("作业圈暂时无法读取，请稍后重试。", 500);
  return NextResponse.json({
    success: true,
    cards: result.cards,
    nextCursor: result.nextCursor,
  });
}
