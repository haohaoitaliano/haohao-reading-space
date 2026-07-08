"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { normalizeCampTimeZone } from "@/lib/course-schedule";
import { getCampUsageCounts } from "@/lib/teacher-operations-data";
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
  const counts = await getCampUsageCounts(campId);
  if (!counts) return { success: false, message: "无法确认训练营是否为空，请稍后重试。" };
  const total = counts.courses + counts.members + counts.meetings + counts.invites + counts.submissions;
  if (total > 0) {
    return { success: false, message: "只有空训练营才能永久删除。请先确认没有课程、成员、会议、邀请码和提交记录。" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("camps").delete().eq("id", campId);
  if (error) return { success: false, message: "训练营删除失败，请确认它仍为空。" };
  revalidateCampViews();
  return { success: true, message: "训练营已永久删除。" };
}
