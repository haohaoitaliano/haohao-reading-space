"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InviteActionResult = { success: boolean; message: string };

export async function createCampInvite(input: {
  campId: string;
  code: string;
  maxUses: number;
  expiresAtLocal: string;
}): Promise<InviteActionResult> {
  await requireAdmin();
  const code = input.code.trim().toUpperCase();
  if (code.length < 6) return { success: false, message: "邀请码至少需要 6 个字符。" };
  if (!Number.isInteger(input.maxUses) || input.maxUses < 1) {
    return { success: false, message: "使用次数必须大于 0。" };
  }
  if (!input.expiresAtLocal) return { success: false, message: "请选择邀请码有效期。" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_camp_invite_admin", {
    target_camp_id: input.campId,
    invite_code: code,
    invite_max_uses: input.maxUses,
    local_expires_at: input.expiresAtLocal,
  });
  if (error) return { success: false, message: "邀请码创建失败，请确认代码没有重复。" };
  revalidatePath("/teacher/invites");
  return { success: true, message: "邀请码已创建，数据库仅保存哈希。" };
}

export async function disableCampInvite(inviteId: string): Promise<InviteActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("camp_invites")
    .update({ is_active: false })
    .eq("id", inviteId);
  if (error) return { success: false, message: "邀请码停用失败，请稍后重试。" };
  revalidatePath("/teacher/invites");
  return { success: true, message: "邀请码已停用。" };
}
