import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { getCurrentLearningSpace } from "@/lib/learning-space";
import {
  buildStudentPhotoPath,
  getStudentPhotoExtension,
  getStudentPhotoMimeType,
  hasStudentPhotoSignature,
  STUDENT_PHOTO_BUCKET,
  STUDENT_PHOTO_MAX_COUNT,
  validateStudentPhotoFile,
} from "@/lib/student-photo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.role !== "student" || auth.profile.status !== "active") {
    return failure("请先以学生身份登录。", 401);
  }
  const { id: courseId } = await params;
  const campResult = await getCurrentLearningSpace(auth.profile.id);
  if (campResult.state === "no_selected_camp") return failure("请先选择当前训练营。", 403);
  if (campResult.state === "no_membership") return failure("请先加入训练营。", 403);
  if (campResult.state !== "ok") return failure("训练营信息暂时无法读取，请稍后重试。", 503);

  const supabase = await createSupabaseServerClient();
  const { data: course } = await supabase
    .rpc("get_course_schedule", { target_camp_id: campResult.camp.id })
    .eq("id", courseId)
    .maybeSingle<{ id: string; camp_id: string; day_number: number }>();
  if (!course || course.camp_id !== campResult.camp.id) {
    return failure("课程不存在、尚未发布或还未解锁。", 403);
  }
  const { data: assignment } = await supabase
    .from("course_contents")
    .select("photo_assignment_enabled")
    .eq("course_id", course.id)
    .maybeSingle<{ photo_assignment_enabled: boolean }>();
  if (!assignment?.photo_assignment_enabled) return failure("本课没有开启照片作业。", 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("无法读取照片，请重新选择。", 400);
  }
  const photos = formData.getAll("photos").filter((item): item is File => item instanceof File);
  if (photos.length < 1 || photos.length > STUDENT_PHOTO_MAX_COUNT) {
    return failure("每次请选择 1 至 3 张照片。", 400);
  }
  for (const photo of photos) {
    const validationError = validateStudentPhotoFile(photo);
    if (validationError) return failure(validationError, 400);
    const mimeType = getStudentPhotoMimeType(photo);
    if (!mimeType || !(await hasStudentPhotoSignature(photo, mimeType))) {
      return failure(`${photo.name || "所选文件"}的内容不是有效照片。`, 400);
    }
  }

  const submissionId = crypto.randomUUID();
  const uploadedPaths: string[] = [];
  const photoRows: Array<{
    id: string;
    submission_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    position: number;
  }> = [];

  for (const [index, photo] of photos.entries()) {
    const photoId = crypto.randomUUID();
    const mimeType = getStudentPhotoMimeType(photo);
    if (!mimeType) {
      await supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(uploadedPaths);
      return failure("照片格式无法识别，请重新选择。", 400);
    }
    const storagePath = buildStudentPhotoPath({
      campId: course.camp_id,
      userId: auth.profile.id,
      courseId: course.id,
      submissionId,
      photoId,
      extension: getStudentPhotoExtension(photo),
    });
    const { error: uploadError } = await supabase.storage
      .from(STUDENT_PHOTO_BUCKET)
      .upload(storagePath, photo, { contentType: mimeType, upsert: false });
    if (uploadError) {
      if (uploadedPaths.length) await supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(uploadedPaths);
      return failure(`第 ${index + 1} 张照片上传失败；已尝试清理本次文件，请重试。`, 500);
    }
    uploadedPaths.push(storagePath);
    photoRows.push({
      id: photoId,
      submission_id: submissionId,
      storage_path: storagePath,
      file_name: photo.name.slice(0, 255),
      mime_type: mimeType,
      size_bytes: photo.size,
      position: index + 1,
    });
  }

  const { data: submission, error: submissionError } = await supabase
    .from("student_photo_submissions")
    .insert({
      id: submissionId,
      camp_id: course.camp_id,
      course_id: course.id,
      user_id: auth.profile.id,
    })
    .select("id, version, created_at")
    .single<{ id: string; version: number; created_at: string }>();
  if (submissionError || !submission) {
    await supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(uploadedPaths);
    return failure("照片提交记录保存失败；已尝试清理上传文件，请重试。", 500);
  }

  const { error: photoMetadataError } = await supabase.from("student_submission_photos").insert(photoRows);
  if (photoMetadataError) {
    await supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(uploadedPaths);
    await supabase.from("student_photo_submissions").delete().eq("id", submission.id);
    return failure("照片信息保存失败；已尝试清理本次提交，请重试。", 500);
  }

  revalidatePath(`/courses/giorno-${course.day_number}`);
  revalidatePath("/home");
  revalidatePath("/progress");
  revalidatePath("/teacher/submissions");
  revalidatePath("/teacher/progress");
  return NextResponse.json({
    success: true,
    message: `照片作业提交成功（第 ${submission.version} 次）。`,
    submissionId: submission.id,
    version: submission.version,
  });
}
