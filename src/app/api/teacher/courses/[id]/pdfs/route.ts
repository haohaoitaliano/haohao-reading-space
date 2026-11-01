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
import { verifyStorageObject } from "@/lib/storage-object-verification";
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

  let body: {
    action?: string;
    pdfId?: string;
    path?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
  };
  try {
    body = await request.json();
  } catch {
    return failure("无法读取 PDF 上传信息。", 400);
  }
  const file = {
    name: String(body.fileName ?? ""),
    size: Number(body.size),
    type: String(body.mimeType ?? ""),
  };
  const validationError = validateCoursePdfFile(file);
  if (validationError) return failure(validationError, 400);

  if (body.action === "prepare") {
    const pdfId = crypto.randomUUID();
    const storagePath = buildCoursePdfPath(course.camp_id, course.id, pdfId);
    const { data, error } = await supabase.storage.from(COURSE_PDF_BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data?.token) return failure("无法创建 PDF 上传授权，请确认 Storage bucket 和大小限制配置。", 500);
    return NextResponse.json({
      success: true,
      pdfId,
      upload: {
        bucket: COURSE_PDF_BUCKET,
        path: storagePath,
        token: data.token,
        mimeType: "application/pdf",
      },
    });
  }

  const pdfId = String(body.pdfId ?? "");
  if (body.action !== "complete" || !/^[0-9a-f-]{36}$/i.test(pdfId) || !body.path) {
    return failure("PDF 上传步骤无效，请重新上传。", 400);
  }
  const storagePath = buildCoursePdfPath(course.camp_id, course.id, pdfId);
  if (body.path !== storagePath) return failure("PDF 上传路径与当前课程不一致。", 403);
  const verification = await verifyStorageObject(supabase, COURSE_PDF_BUCKET, storagePath, {
    size: file.size,
    mimeType: "application/pdf",
  });
  if (!verification.object) return failure(verification.error || "无法核对云端 PDF。", 400);
  if (!(await hasCoursePdfSignature(new Blob([verification.object.firstBytes])))) {
    await supabase.storage.from(COURSE_PDF_BUCKET).remove([storagePath]);
    return failure("云端文件内容不是有效的 PDF，请重新选择文件。", 400);
  }

  const { data: existingPdf } = await supabase
    .from("course_pdfs")
    .select("id, file_name, size_bytes, position, updated_at")
    .eq("id", pdfId)
    .eq("course_id", course.id)
    .maybeSingle<{
      id: string;
      file_name: string;
      size_bytes: number;
      position: number;
      updated_at: string;
    }>();
  if (existingPdf) {
    const signedUrl = await supabase.storage.from(COURSE_PDF_BUCKET).createSignedUrl(storagePath, COURSE_PDF_SIGNED_URL_SECONDS);
    return NextResponse.json({
      success: true,
      message: "PDF 已上传。",
      pdf: {
        id: existingPdf.id,
        fileName: existingPdf.file_name,
        sizeBytes: existingPdf.size_bytes,
        position: existingPdf.position,
        updatedAt: existingPdf.updated_at,
        signedUrl: signedUrl.data?.signedUrl ?? "",
        downloadUrl: signedUrl.data?.signedUrl ?? "",
      },
    });
  }

  const { data: lastPdf } = await supabase
    .from("course_pdfs")
    .select("position")
    .eq("course_id", course.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();
  const position = (lastPdf?.position ?? 0) + 1;

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
