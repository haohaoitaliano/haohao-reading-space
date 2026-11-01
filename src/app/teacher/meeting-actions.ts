"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getMeetingConnectionError } from "@/lib/meeting-details";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MeetingActionResult = { success: boolean; message: string };

export async function saveWeeklyMeeting(input: {
  id: string | null;
  campId: string;
  title: string;
  scheduledAtLocal: string;
  meetingUrl: string;
  meetingNumber: string;
  description: string;
}): Promise<MeetingActionResult> {
  await requireAdmin();
  if (!input.title.trim()) return { success: false, message: "请输入会议标题。" };
  if (!input.scheduledAtLocal) return { success: false, message: "请选择会议时间。" };
  const connectionError = getMeetingConnectionError(input.meetingUrl, input.meetingNumber);
  if (connectionError) return { success: false, message: connectionError };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_weekly_meeting_admin", {
    target_meeting_id: input.id,
    target_camp_id: input.campId,
    meeting_title: input.title.trim(),
    local_scheduled_at: input.scheduledAtLocal,
    target_meeting_url: input.meetingUrl.trim() || null,
    meeting_description: input.description.trim(),
    target_meeting_number: input.meetingNumber.trim() || null,
  });
  if (error) return { success: false, message: "会议保存失败，请稍后重试。" };
  revalidatePath("/teacher/meetings");
  revalidatePath("/weekly");
  return { success: true, message: input.id ? "会议修改成功。" : "会议创建成功。" };
}

export async function deleteWeeklyMeeting(meetingId: string): Promise<MeetingActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("weekly_meetings").delete().eq("id", meetingId);
  if (error) return { success: false, message: "会议删除失败，请稍后重试。" };
  revalidatePath("/teacher/meetings");
  revalidatePath("/weekly");
  return { success: true, message: "会议已删除。" };
}
