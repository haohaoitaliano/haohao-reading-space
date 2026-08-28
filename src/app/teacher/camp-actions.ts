"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { normalizeCampTimeZone } from "@/lib/course-schedule";
import { COURSE_AUDIO_BUCKET } from "@/lib/course-audio";
import { COURSE_VIDEO_BUCKET } from "@/lib/course-video";
import { STUDENT_RECORDING_BUCKET } from "@/lib/student-recording";
import { getCampMemberCount } from "@/lib/teacher-operations-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CampScheduleActionResult = { success: boolean; message: string };

export async function createCamp(input: {
  name: string;
  slug: string;
  timezone: string;
  startsAtLocal: string;
  maxStudents: number;
  status: "draft" | "active" | "archived";
}): Promise<CampScheduleActionResult & { campId?: string }> {
  await requireAdmin();
  if (!input.name.trim()) return { success: false, message: "请输入训练营名称。" };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug.trim())) {
    return { success: false, message: "slug 只能使用小写字母、数字和连字符。" };
  }
  if (!input.startsAtLocal) return { success: false, message: "请选择训练营开始时间。" };
  if (!Number.isInteger(input.maxStudents) || input.maxStudents < 1) {
    return { success: false, message: "人数上限必须大于 0。" };
  }
  if (normalizeCampTimeZone(input.timezone) !== input.timezone) {
    return { success: false, message: "训练营时区不正确。" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_camp_admin", {
    camp_name: input.name.trim(),
    camp_slug: input.slug.trim(),
    camp_timezone: input.timezone,
    local_starts_at: input.startsAtLocal,
    student_limit: input.maxStudents,
    camp_status: input.status,
  });
  if (error || typeof data !== "string") {
    return { success: false, message: "训练营创建失败，请检查 slug 是否已被使用。" };
  }
  revalidatePath("/teacher");
  return { success: true, message: "训练营创建成功。", campId: data };
}

export async function updateCampSchedule(input: {
  campId: string;
  startsAtLocal: string;
  timezone: string;
}): Promise<CampScheduleActionResult> {
  await requireAdmin();
  if (!input.startsAtLocal) return { success: false, message: "请选择训练营开始时间。" };
  if (normalizeCampTimeZone(input.timezone) !== input.timezone) {
    return { success: false, message: "训练营时区不正确。" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_camp_schedule", {
    target_camp_id: input.campId,
    local_starts_at: input.startsAtLocal,
    target_timezone: input.timezone,
  });
  if (error) return { success: false, message: "训练营排期保存失败，请稍后重试。" };

  revalidatePath("/teacher");
  revalidatePath("/home");
  revalidatePath("/courses");
  revalidatePath("/progress");
  return { success: true, message: "训练营排期已保存。" };
}

function revalidateCampViews() {
  revalidatePath("/teacher");
  revalidatePath("/teacher/camps");
  revalidatePath("/join-camp");
  revalidatePath("/home");
  revalidatePath("/courses");
  revalidatePath("/circle");
  revalidatePath("/weekly");
}

async function removeStoragePaths(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  bucket: string,
  paths: string[],
) {
  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    let failed = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await supabase.storage.from(bucket).remove(chunk);
      failed = Boolean(error);
      if (!failed) break;
    }
    if (failed) return false;
  }
  return true;
}

export async function updateCampStatus(input: {
  campId: string;
  status: "active" | "archived";
}): Promise<CampScheduleActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("camps")
    .update({ status: input.status })
    .eq("id", input.campId);
  if (error) return { success: false, message: "训练营状态更新失败，请稍后重试。" };
  revalidateCampViews();
  return { success: true, message: input.status === "active" ? "训练营已重新启用。" : "训练营已停用。" };
}

export async function permanentlyDeleteCamp(campId: string): Promise<CampScheduleActionResult> {
  await requireAdmin();
  const memberCount = await getCampMemberCount(campId);
  if (memberCount === null) return { success: false, message: "无法确认训练营成员数，请稍后重试。" };
  if (memberCount > 0) {
    return { success: false, message: "请先移除所有成员后再永久删除训练营。" };
  }

  const supabase = await createSupabaseServerClient();
  const [coursesResult, submissionsResult] = await Promise.all([
    supabase.from("courses").select("id").eq("camp_id", campId),
    supabase
      .from("student_submissions")
      .select("storage_path, playback_storage_path")
      .eq("camp_id", campId),
  ]);
  if (coursesResult.error || submissionsResult.error) {
    return { success: false, message: "无法确认训练营关联文件，请稍后重试。" };
  }

  const courseIds = (coursesResult.data ?? []).map((course) => course.id);
  const [audioResult, videoResult] = courseIds.length
    ? await Promise.all([
        supabase.from("course_audio").select("storage_path").in("course_id", courseIds),
        supabase.from("course_videos").select("storage_path").in("course_id", courseIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (audioResult.error || videoResult.error) {
    return { success: false, message: "无法确认训练营课程文件，请稍后重试。" };
  }

  const { data: deletedCamp, error: deleteError } = await supabase
    .from("camps")
    .delete()
    .eq("id", campId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (deleteError || !deletedCamp) {
    return { success: false, message: "训练营删除失败。请确认所有成员已移除后重试。" };
  }

  const storageGroups = [
    {
      bucket: COURSE_AUDIO_BUCKET,
      paths: (audioResult.data ?? []).map((row) => row.storage_path),
    },
    {
      bucket: COURSE_VIDEO_BUCKET,
      paths: (videoResult.data ?? []).map((row) => row.storage_path),
    },
    {
      bucket: STUDENT_RECORDING_BUCKET,
      paths: (submissionsResult.data ?? []).flatMap((row) =>
        [row.storage_path, row.playback_storage_path].filter((path): path is string => Boolean(path)),
      ),
    },
  ];

  for (const group of storageGroups) {
    if (!(await removeStoragePaths(supabase, group.bucket, group.paths))) {
      revalidateCampViews();
      return { success: false, message: "训练营数据已删除，但部分关联文件清理失败，请联系管理员继续清理。" };
    }
  }

  revalidateCampViews();
  return { success: true, message: "训练营已永久删除。" };
}
