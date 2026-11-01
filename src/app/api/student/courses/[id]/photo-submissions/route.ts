import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    success: false,
    message: "旧版照片上传入口已停用，请刷新课程页面后重新提交。已选择的照片不会被自动删除。",
  }, { status: 410 });
}
