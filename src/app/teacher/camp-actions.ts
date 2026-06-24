"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { normalizeCampTimeZone } from "@/lib/course-schedule";
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
