import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { STUDENT_PHOTO_BUCKET } from "@/lib/student-photo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string }> };

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.role !== "student" || auth.profile.status !== "active") {
    return NextResponse.json({ success: false, message: "请先以学生身份登录。" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: submission } = await supabase
    .from("student_photo_submissions")
    .select("id, course_id, student_submission_photos(storage_path)")
    .eq("id", id)
    .eq("user_id", auth.profile.id)
    .maybeSingle<{
      id: string;
      course_id: string;
      student_submission_photos: Array<{ storage_path: string }>;
    }>();
  if (!submission) {
    return NextResponse.json({ success: false, message: "照片提交不存在或无权管理。" }, { status: 404 });
  }
  const paths = submission.student_submission_photos.map((photo) => photo.storage_path);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(paths);
    if (storageError) {
      return NextResponse.json({ success: false, message: "照片文件删除失败，请稍后重试。" }, { status: 500 });
    }
  }
  const { error } = await supabase.from("student_photo_submissions").delete().eq("id", submission.id);
  if (error) {
    return NextResponse.json({ success: false, message: "照片提交记录删除失败，请稍后重试。" }, { status: 500 });
  }
  revalidatePath("/home");
  revalidatePath("/progress");
  revalidatePath("/teacher/submissions");
  revalidatePath("/teacher/progress");
  return NextResponse.json({ success: true, message: "此次照片提交已删除。" });
}
