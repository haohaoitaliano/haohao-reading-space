import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { STUDENT_PHOTO_BUCKET } from "@/lib/student-photo";
import { STUDENT_RECORDING_BUCKET } from "@/lib/student-recording";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string }> };

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.role !== "student" || auth.profile.status !== "active") {
    return NextResponse.json({ success: false, message: "请先以学生身份登录。" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: assignment } = await supabase
    .from("student_assignment_submissions")
    .select("id, student_submissions(storage_path, playback_storage_path), student_photo_submissions(student_submission_photos(storage_path))")
    .eq("id", id)
    .eq("user_id", auth.profile.id)
    .maybeSingle<{
      id: string;
      student_submissions:
        | { storage_path: string; playback_storage_path: string | null }
        | Array<{ storage_path: string; playback_storage_path: string | null }>
        | null;
      student_photo_submissions:
        | { student_submission_photos: Array<{ storage_path: string }> }
        | Array<{ student_submission_photos: Array<{ storage_path: string }> }>
        | null;
    }>();
  if (!assignment) {
    return NextResponse.json({ success: false, message: "此次作业不存在或无权管理。" }, { status: 404 });
  }

  const audioSubmissions = Array.isArray(assignment.student_submissions)
    ? assignment.student_submissions
    : assignment.student_submissions ? [assignment.student_submissions] : [];
  const photoSubmissions = Array.isArray(assignment.student_photo_submissions)
    ? assignment.student_photo_submissions
    : assignment.student_photo_submissions ? [assignment.student_photo_submissions] : [];
  const audioPaths = audioSubmissions.flatMap((submission) => [
    submission.storage_path,
    submission.playback_storage_path,
  ]).filter((path): path is string => Boolean(path));
  const photoPaths = photoSubmissions.flatMap((submission) => (
    submission.student_submission_photos.map((photo) => photo.storage_path)
  ));
  if (audioPaths.length) {
    const { error } = await supabase.storage.from(STUDENT_RECORDING_BUCKET).remove(audioPaths);
    if (error) return NextResponse.json({ success: false, message: "录音文件删除失败，请稍后重试。" }, { status: 500 });
  }
  if (photoPaths.length) {
    const { error } = await supabase.storage.from(STUDENT_PHOTO_BUCKET).remove(photoPaths);
    if (error) return NextResponse.json({ success: false, message: "照片文件删除失败，请稍后重试。" }, { status: 500 });
  }
  const { error } = await supabase.from("student_assignment_submissions").delete().eq("id", assignment.id);
  if (error) return NextResponse.json({ success: false, message: "作业记录删除失败，请稍后重试。" }, { status: 500 });

  for (const path of ["/circle", "/home", "/my-work", "/progress", "/teacher/submissions", "/teacher/progress"]) {
    revalidatePath(path);
  }
  return NextResponse.json({ success: true, message: "此次作业已删除。" });
}
