"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UpdateNicknameResult = {
  success: boolean;
  message: string;
  displayName?: string;
};

export async function updateNickname(
  _previousState: UpdateNicknameResult,
  formData: FormData,
): Promise<UpdateNicknameResult> {
  const { profile } = await requireAuthenticatedUser();
  if (profile.role !== "student") {
    return { success: false, message: "只有学员可以在这里修改昵称。" };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const characterCount = [...displayName].length;
  if (characterCount < 1 || characterCount > 20) {
    return { success: false, message: "昵称需要为 1–20 个字符。" };
  }

  if (displayName === profile.display_name) {
    return { success: true, message: "昵称没有变化。", displayName };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", profile.id)
    .select("display_name")
    .single<{ display_name: string }>();

  if (error || !data) {
    return { success: false, message: "昵称保存失败，请稍后重试。" };
  }

  for (const path of [
    "/profile",
    "/home",
    "/progress",
    "/my-work",
    "/circle",
    "/messages",
    "/spaces",
    "/teacher/submissions",
    "/teacher/progress",
  ]) {
    revalidatePath(path);
  }

  return { success: true, message: "昵称已更新。", displayName: data.display_name };
}
