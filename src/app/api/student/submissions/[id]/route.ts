import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { STUDENT_RECORDING_BUCKET } from "@/lib/student-recording";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = { params: Promise<{ id: string }> };

type OwnedSubmission = {
  id: string;
  storage_path: string;
  playback_storage_path: string | null;
};

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.role !== "student" || auth.profile.status !== "active") {
    return failure("请先以学生身份登录。", 401);
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: submission } = await supabase
    .from("student_submissions")
    .select("id, storage_path, playback_storage_path")
    .eq("id", id)
    .eq("user_id", auth.profile.id)
    .maybeSingle<OwnedSubmission>();
  if (!submission) return failure("此次提交不存在或无权删除。", 403);

  const paths = [submission.storage_path, submission.playback_storage_path]
    .filter((path): path is string => Boolean(path));
  const { error: storageError } = await supabase.storage
    .from(STUDENT_RECORDING_BUCKET)
    .remove(paths);
  if (storageError) return failure("录音文件删除失败，请稍后重试。", 500);

  const { error: metadataError } = await supabase
    .from("student_submissions")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.profile.id);
  if (metadataError) return failure("提交记录删除失败，请稍后重试。", 500);

  return NextResponse.json({ success: true, message: "此次提交已删除。" });
}
