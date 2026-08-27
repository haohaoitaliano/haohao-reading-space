"use server";

import { cookies } from "next/headers";
import { ACTIVE_CAMP_COOKIE, getActiveCampCookieOptions } from "@/lib/active-camp-cookie";
import { requireAuthenticatedUser } from "@/lib/auth";
import {
  getCampInviteMessage,
  isCampInviteSuccess,
  redeemCampInvite,
  type CampInviteResultCode,
} from "@/lib/camp-invite";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type JoinCampFormState = {
  status: "idle" | "success" | "error";
  message: string;
  resultCode?: CampInviteResultCode;
  campName?: string | null;
};

export async function joinCampAction(
  _: JoinCampFormState,
  formData: FormData,
): Promise<JoinCampFormState> {
  const { profile } = await requireAuthenticatedUser();
  if (profile.role !== "student") {
    return { status: "error", message: "请使用学生账号加入训练营。" };
  }

  const invitationCode = String(formData.get("invitationCode") ?? "").trim();
  if (!invitationCode) {
    return { status: "error", message: "请输入训练营邀请码" };
  }

  const result = await redeemCampInvite(await createSupabaseServerClient(), invitationCode);
  if (!isCampInviteSuccess(result.resultCode)) {
    return { status: "error", message: getCampInviteMessage(result.resultCode), resultCode: result.resultCode };
  }

  if (result.campId) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_CAMP_COOKIE, result.campId, getActiveCampCookieOptions());
  }

  return {
    status: "success",
    message: result.resultCode === "already_joined" ? "你已经加入这个训练营了。" : "成功加入训练营。",
    resultCode: result.resultCode,
    campName: result.campName,
  };
}
