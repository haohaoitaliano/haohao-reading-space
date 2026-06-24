"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { normalizeCampTimeZone } from "@/lib/course-schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CampScheduleActionResult = { success: boolean; message: string };

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
