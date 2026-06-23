import type { SupabaseClient } from "@supabase/supabase-js";

export type CampInviteResultCode =
  | "joined"
  | "already_joined"
  | "invalid_invite"
  | "invite_expired"
  | "invite_inactive"
  | "invite_full"
  | "camp_full"
  | "camp_inactive"
  | "membership_removed"
  | "not_authenticated"
  | "database_error";

export type CampInviteResult = {
  success: boolean;
  resultCode: CampInviteResultCode;
  campId: string | null;
  campName: string | null;
};

const messages: Record<CampInviteResultCode, string> = {
  joined: "成功加入训练营",
  already_joined: "你已经加入该训练营",
  invalid_invite: "邀请码不存在",
  invite_expired: "邀请码已过期",
  invite_inactive: "邀请码已停用",
  invite_full: "邀请码使用次数已满",
  camp_full: "训练营已满",
  camp_inactive: "训练营未开放",
  membership_removed: "你的训练营成员资格已被移除，请联系管理员",
  not_authenticated: "请先登录后再加入训练营",
  database_error: "网络或数据库错误，请稍后重试",
};

const knownCodes = new Set<CampInviteResultCode>(Object.keys(messages) as CampInviteResultCode[]);

export function getCampInviteMessage(code: CampInviteResultCode) {
  return messages[code];
}

export function isCampInviteSuccess(code: CampInviteResultCode) {
  return code === "joined" || code === "already_joined";
}

export async function redeemCampInvite(
  supabase: SupabaseClient,
  invitationCode: string,
): Promise<CampInviteResult> {
  let data: unknown;
  try {
    const response = await supabase.rpc("redeem_camp_invite", {
      invite_code: invitationCode.trim(),
    });
    if (response.error) {
      return { success: false, resultCode: "database_error", campId: null, campName: null };
    }
    data = response.data;
  } catch {
    return { success: false, resultCode: "database_error", campId: null, campName: null };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const code = row && typeof row === "object" && "result_code" in row
    ? row.result_code
    : null;
  if (typeof code !== "string" || !knownCodes.has(code as CampInviteResultCode)) {
    return { success: false, resultCode: "database_error", campId: null, campName: null };
  }

  return {
    success: "success" in row && Boolean(row.success),
    resultCode: code as CampInviteResultCode,
    campId: "camp_id" in row && typeof row.camp_id === "string" ? row.camp_id : null,
    campName: "camp_name" in row && typeof row.camp_name === "string" ? row.camp_name : null,
  };
}
