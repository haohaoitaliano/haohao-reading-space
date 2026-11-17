import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { canAccessTeacherRoutes } from "@/lib/auth-policy";
import {
  buildCourseReadingImagePath,
  courseReadingImageExtension,
  COURSE_READING_IMAGE_BUCKET,
  COURSE_READING_IMAGE_SIGNED_URL_SECONDS,
  getCourseReadingImageMimeType,
  hasCourseReadingImageSignature,
  validateCourseReadingImage,
} from "@/lib/course-reading";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: Request, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || !canAccessTeacherRoutes(auth.profile)) return failure("无权限上传阅读配图。", 403);
  const { id: courseId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: course } = await supabase.from("courses").select("id, camp_id").eq("id", courseId).maybeSingle<{ id: string; camp_id: string }>();
  if (!course) return failure("课程不存在。", 404);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");
  if (!(file instanceof File)) return failure("请选择图片。", 400);
  const validationError = validateCourseReadingImage(file);
  if (validationError) return failure(validationError, 400);
  const mimeType = getCourseReadingImageMimeType(file);
  if (!mimeType) return failure("图片格式不支持。", 400);
  if (!(await hasCourseReadingImageSignature(file, mimeType))) return failure("文件内容不是有效的图片。", 400);
  const width = Number(formData?.get("width"));
  const height = Number(formData?.get("height"));
  const imageId = crypto.randomUUID();
  const storagePath = buildCourseReadingImagePath(course.camp_id, course.id, imageId, courseReadingImageExtension(mimeType));
  const { error: uploadError } = await supabase.storage.from(COURSE_READING_IMAGE_BUCKET)
    .upload(storagePath, file, { contentType: mimeType, upsert: false });
  if (uploadError) return failure("图片上传失败，请稍后重试。", 500);

  const { data: image, error: metadataError } = await supabase.from("course_reading_images").insert({
    id: imageId,
    course_id: course.id,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: mimeType,
    size_bytes: file.size,
    width: Number.isInteger(width) && width > 0 ? width : null,
    height: Number.isInteger(height) && height > 0 ? height : null,
    updated_by: auth.profile.id,
  }).select("id, file_name, mime_type, size_bytes, width, height").single();
  if (metadataError || !image) {
    await supabase.storage.from(COURSE_READING_IMAGE_BUCKET).remove([storagePath]);
    return failure("图片信息保存失败，请重试。", 500);
  }
  const { data: signed } = await supabase.storage.from(COURSE_READING_IMAGE_BUCKET)
    .createSignedUrl(storagePath, COURSE_READING_IMAGE_SIGNED_URL_SECONDS);
  return NextResponse.json({
    success: true,
    message: "图片已插入，请保存课程以保留图文顺序。",
    image: { id: image.id, fileName: image.file_name, mimeType: image.mime_type, sizeBytes: image.size_bytes, width: image.width, height: image.height, signedUrl: signed?.signedUrl ?? "" },
  });
}
