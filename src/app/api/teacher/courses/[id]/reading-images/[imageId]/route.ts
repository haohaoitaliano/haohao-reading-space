import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { canAccessTeacherRoutes } from "@/lib/auth-policy";
import { COURSE_READING_IMAGE_BUCKET } from "@/lib/course-reading";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string; imageId: string }> };

export async function DELETE(_: Request, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || !canAccessTeacherRoutes(auth.profile)) return NextResponse.json({ success: false, message: "无权限删除图片。" }, { status: 403 });
  const { id, imageId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: image } = await supabase.from("course_reading_images").select("storage_path").eq("id", imageId).eq("course_id", id).maybeSingle<{ storage_path: string }>();
  if (!image) return NextResponse.json({ success: true, message: "图片已不存在。" });
  const { error: storageError } = await supabase.storage.from(COURSE_READING_IMAGE_BUCKET).remove([image.storage_path]);
  if (storageError) return NextResponse.json({ success: false, message: "图片文件删除失败。" }, { status: 500 });
  const { error } = await supabase.from("course_reading_images").delete().eq("id", imageId).eq("course_id", id);
  return error
    ? NextResponse.json({ success: false, message: "图片记录删除失败。" }, { status: 500 })
    : NextResponse.json({ success: true, message: "图片已删除。" });
}
