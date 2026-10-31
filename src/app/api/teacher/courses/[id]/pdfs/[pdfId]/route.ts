import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { canAccessTeacherRoutes } from "@/lib/auth-policy";
import { COURSE_PDF_BUCKET } from "@/lib/course-pdf";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string; pdfId: string }> };

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || !canAccessTeacherRoutes(auth.profile)) {
    return NextResponse.json({ success: false, message: "无权限删除 PDF。" }, { status: 403 });
  }
  const { id: courseId, pdfId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: pdf } = await supabase
    .from("course_pdfs")
    .select("storage_path, courses(day_number)")
    .eq("id", pdfId)
    .eq("course_id", courseId)
    .maybeSingle<{ storage_path: string; courses: { day_number: number } | null }>();
  if (!pdf) return NextResponse.json({ success: true, message: "PDF 已不存在。" });

  const { error: storageError } = await supabase.storage.from(COURSE_PDF_BUCKET).remove([pdf.storage_path]);
  if (storageError) {
    return NextResponse.json({ success: false, message: "PDF 文件删除失败，请稍后重试。" }, { status: 500 });
  }
  const { error: metadataError } = await supabase.from("course_pdfs").delete().eq("id", pdfId).eq("course_id", courseId);
  if (metadataError) {
    return NextResponse.json({ success: false, message: "PDF 记录删除失败，请稍后重试。" }, { status: 500 });
  }
  revalidatePath(`/teacher/courses/${courseId}/edit`);
  if (pdf.courses?.day_number) revalidatePath(`/courses/giorno-${pdf.courses.day_number}`);
  return NextResponse.json({ success: true, message: "PDF 已删除。" });
}
