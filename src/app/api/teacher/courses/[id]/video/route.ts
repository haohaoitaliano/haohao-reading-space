import { NextResponse, type NextRequest } from "next/server";
import { canAccessTeacherRoutes } from "@/lib/auth-policy";
import { getAuthContext } from "@/lib/auth";
import {
  buildCourseVideoPath,
  COURSE_VIDEO_BUCKET,
  COURSE_VIDEO_SIGNED_URL_SECONDS,
  getCourseVideoExtension,
  getCourseVideoMimeType,
  validateCourseVideoFile,
} from "@/lib/course-video";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string }> };

async function getAdminCourse(courseId: string) {
  const auth = await getAuthContext();
  if (!auth || !canAccessTeacherRoutes(auth.profile)) return { error: "forbidden" as const };

  const supabase = await createSupabaseServerClient();
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, camp_id")
    .eq("id", courseId)
    .maybeSingle<{ id: string; camp_id: string }>();
  if (error || !course) return { error: "not_found" as const };
  return { auth, course, supabase };
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getAdminCourse(id);
  if ("error" in context) {
    return context.error === "forbidden"
      ? errorResponse("无权限上传课程视频。", 403)
      : errorResponse("课程不存在。", 404);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("无法读取上传文件。", 400);
  }

  const file = formData.get("video");
  if (!(file instanceof File)) return errorResponse("请选择视频文件。", 400);
  const validationError = validateCourseVideoFile(file);
  if (validationError) return errorResponse(validationError, 400);

  const durationValue = Number(formData.get("durationSeconds"));
  const durationSeconds = Number.isFinite(durationValue) && durationValue >= 0 && durationValue <= 86400
    ? durationValue
    : null;
  const extension = getCourseVideoExtension(file.name, file.type);
  const mimeType = getCourseVideoMimeType(extension);
  const storagePath = buildCourseVideoPath(
    context.course.camp_id,
    context.course.id,
    extension,
    `${Date.now()}-${crypto.randomUUID()}`,
  );

  const { data: previousVideo } = await context.supabase
    .from("course_videos")
    .select("storage_path")
    .eq("course_id", context.course.id)
    .maybeSingle<{ storage_path: string }>();

  const { error: uploadError } = await context.supabase.storage
    .from(COURSE_VIDEO_BUCKET)
    .upload(storagePath, file, { contentType: mimeType, upsert: false });
  if (uploadError) return errorResponse("视频上传失败，请稍后重试。", 500);

  const { error: metadataError } = await context.supabase.from("course_videos").upsert({
    course_id: context.course.id,
    storage_path: storagePath,
    file_name: file.name.slice(0, 255),
    mime_type: mimeType,
    size_bytes: file.size,
    duration_seconds: durationSeconds,
    updated_by: context.auth.profile.id,
    updated_at: new Date().toISOString(),
  });

  if (metadataError) {
    await context.supabase.storage.from(COURSE_VIDEO_BUCKET).remove([storagePath]);
    return errorResponse("视频信息保存失败，请稍后重试。", 500);
  }

  if (previousVideo?.storage_path && previousVideo.storage_path !== storagePath) {
    await context.supabase.storage.from(COURSE_VIDEO_BUCKET).remove([previousVideo.storage_path]);
  }

  const { data: signed } = await context.supabase.storage
    .from(COURSE_VIDEO_BUCKET)
    .createSignedUrl(storagePath, COURSE_VIDEO_SIGNED_URL_SECONDS);

  return NextResponse.json({
    success: true,
    message: "示范视频上传成功。",
    video: {
      fileName: file.name.slice(0, 255),
      mimeType,
      sizeBytes: file.size,
      durationSeconds,
      updatedAt: new Date().toISOString(),
      signedUrl: signed?.signedUrl ?? "",
    },
  });
}

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getAdminCourse(id);
  if ("error" in context) {
    return context.error === "forbidden"
      ? errorResponse("无权限删除课程视频。", 403)
      : errorResponse("课程不存在。", 404);
  }

  const { data: video } = await context.supabase
    .from("course_videos")
    .select("storage_path")
    .eq("course_id", context.course.id)
    .maybeSingle<{ storage_path: string }>();
  if (!video) return NextResponse.json({ success: true, message: "课程当前没有示范视频。" });

  const { error: storageError } = await context.supabase.storage
    .from(COURSE_VIDEO_BUCKET)
    .remove([video.storage_path]);
  if (storageError) return errorResponse("视频删除失败，请稍后重试。", 500);

  const { error: metadataError } = await context.supabase
    .from("course_videos")
    .delete()
    .eq("course_id", context.course.id);
  if (metadataError) return errorResponse("视频信息删除失败，请稍后重试。", 500);

  return NextResponse.json({ success: true, message: "示范视频已删除。" });
}
