import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { canAccessTeacherRoutes } from "@/lib/auth-policy";
import {
  buildCoursePdfPath,
  COURSE_PDF_BUCKET,
  COURSE_PDF_SIGNED_URL_SECONDS,
  hasCoursePdfSignature,
  validateCoursePdfFile,
} from "@/lib/course-pdf";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || !canAccessTeacherRoutes(auth.profile)) return failure("无权限上传 PDF。", 403);
  const { id: courseId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, camp_id, day_number")
    .eq("id", courseId)
    .maybeSingle<{ id: string; camp_id: string; day_number: number }>();
  if (!course) return failure("课程不存在。", 404);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("无法读取 PDF 文件。", 400);
  }
  const file = formData.get("pdf");
  if (!(file instanceof File)) return failure("请选择 PDF 文件。", 400);
  const validationError = validateCoursePdfFile(file);
  if (validationError) return failure(validationError, 400);
  if (!(await hasCoursePdfSignature(file))) return failure("文件内容不是有效的 PDF。", 400);

  const pdfId = crypto.randomUUID();
  const storagePath = buildCoursePdfPath(course.camp_id, course.id, pdfId);
  const { data: lastPdf } = await supabase
    .from("course_pdfs")
    .select("position")
    .eq("course_id", course.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();
  const position = (lastPdf?.position ?? 0) + 1;

  const { error: uploadError } = await supabase.storage
    .from(COURSE_PDF_BUCKET)
    .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) return failure("PDF 上传失败，请稍后重试。", 500);

  const { data: pdf, error: metadataError } = await supabase.from("course_pdfs").insert({
    id: pdfId,
    course_id: course.id,
    storage_path: storagePath,
    file_name: file.name.slice(0, 255),
    mime_type: "application/pdf",
    size_bytes: file.size,
    position,
    updated_by: auth.profile.id,
  }).select("id, file_name, size_bytes, position, updated_at").single<{
    id: string;
    file_name: string;
    size_bytes: number;
    position: number;
    updated_at: string;
  }>();
  if (metadataError || !pdf) {
    await supabase.storage.from(COURSE_PDF_BUCKET).remove([storagePath]);
    return failure("PDF 信息保存失败；已尝试清理上传文件，请重试。", 500);
  }

  const [signed, download] = await Promise.all([
    supabase.storage.from(COURSE_PDF_BUCKET).createSignedUrl(storagePath, COURSE_PDF_SIGNED_URL_SECONDS),
    supabase.storage.from(COURSE_PDF_BUCKET).createSignedUrl(
      storagePath,
      COURSE_PDF_SIGNED_URL_SECONDS,
      { download: pdf.file_name },
    ),
  ]);
  revalidatePath(`/teacher/courses/${course.id}/edit`);
  revalidatePath(`/courses/giorno-${course.day_number}`);
  return NextResponse.json({
    success: true,
    message: "PDF 上传成功。",
    pdf: {
      id: pdf.id,
      fileName: pdf.file_name,
      sizeBytes: pdf.size_bytes,
      position: pdf.position,
      updatedAt: pdf.updated_at,
      signedUrl: signed.data?.signedUrl ?? "",
      downloadUrl: download.data?.signedUrl ?? signed.data?.signedUrl ?? "",
    },
  });
}
