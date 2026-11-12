"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isIdentityLabel } from "@/lib/identity-label";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type IdentityLabelState = { error?: string; success?: string };

export async function saveIdentityLabel(_: IdentityLabelState, formData: FormData): Promise<IdentityLabelState> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const identityLabel = String(formData.get("identityLabel") ?? "");
  if (!userId || !isIdentityLabel(identityLabel)) return { error: "身份标签无效。" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_user_identity_label", {
    target_user_id: userId,
    target_identity_label: identityLabel,
  });
  if (error) return { error: "身份标签保存失败，请确认已应用数据库 migration。" };
  revalidatePath("/teacher/submissions");
  revalidatePath("/teacher/progress");
  revalidatePath("/circle");
  return { success: "身份标签已保存；系统权限未改变。" };
}
