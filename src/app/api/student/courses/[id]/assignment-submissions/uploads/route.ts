import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getCurrentLearningSpace } from "@/lib/learning-space";
import {
  buildStudentPhotoPath,
  getStudentPhotoExtension,
  getStudentPhotoMimeType,
  STUDENT_PHOTO_BUCKET,
  STUDENT_PHOTO_MAX_COUNT,
  validateStudentPhotoFile,
} from "@/lib/student-photo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string }> };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    .maybeSingle<{ id: string; camp_id: string }>();
  if (!course || course.camp_id !== campResult.camp.id) {
    return failure("课程不存在、尚未发布或还未解锁。", 403);
  }
  const { data: requirements } = await supabase
    .from("course_contents")
    .select("photo_assignment_enabled")
    .eq("course_id", course.id)
    .maybeSingle<{ photo_assignment_enabled: boolean }>();
  if (!requirements?.photo_assignment_enabled) return failure("本课不需要照片作业。", 403);

  let body: {
    assignmentId?: string;
    photos?: Array<{ id?: string; fileName?: string; mimeType?: string; size?: number }>;
  };
  try {
    body = await request.json();
  } catch {
    return failure("无法读取照片上传信息，请重试。", 400);
  }
  const assignmentId = String(body.assignmentId ?? "");
  if (!uuidPattern.test(assignmentId)) return failure("提交标识无效，请刷新页面后重试。", 400);
  const photos = Array.isArray(body.photos) ? body.photos : [];
  if (photos.length < 1 || photos.length > STUDENT_PHOTO_MAX_COUNT) return failure("请先选择 1 至 3 张照片。", 400);

  const { data: existing } = await supabase
    .from("student_assignment_submissions")
    .select("id")
    .eq("id", assignmentId)
    .eq("user_id", auth.profile.id)
    .maybeSingle<{ id: string }>();
  if (existing) return failure("这次作业已经提交，请刷新页面查看。", 409);

  const prepared: Array<{
    id: string;
    fileName: string;
    size: number;
    upload: { bucket: string; path: string; token: string; mimeType: string };
  }> = [];
  for (const photo of photos) {
    const photoId = String(photo.id ?? "");
    if (!uuidPattern.test(photoId) || prepared.some((item) => item.id === photoId)) {
      return failure("照片提交标识无效，请重新选择照片。", 400);
    }
    const file = {
      name: String(photo.fileName ?? ""),
      type: String(photo.mimeType ?? ""),
      size: Number(photo.size),
    };
    const validationError = validateStudentPhotoFile(file);
    if (validationError) return failure(validationError, 400);
    const mimeType = getStudentPhotoMimeType(file);
    if (!mimeType) return failure(`${file.name || "所选文件"}格式无法识别。`, 400);
    const path = buildStudentPhotoPath({
      campId: course.camp_id,
      userId: auth.profile.id,
      courseId: course.id,
      submissionId: assignmentId,
      photoId: crypto.randomUUID(),
      extension: getStudentPhotoExtension(file),
    });
    prepared.push({
      id: photoId,
      fileName: file.name.slice(0, 255),
      size: file.size,
      upload: { bucket: STUDENT_PHOTO_BUCKET, path, token: "", mimeType },
    });
  }

  for (const item of prepared) {
    const { data, error } = await supabase.storage.from(STUDENT_PHOTO_BUCKET).createSignedUploadUrl(item.upload.path);
    if (error || !data?.token) {
      return failure("无法创建照片上传授权，请确认 Storage bucket 和大小限制配置。", 500);
    }
    item.upload.token = data.token;
  }
  return NextResponse.json({ success: true, photos: prepared });
}
