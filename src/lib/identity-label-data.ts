import "server-only";

import type { IdentityLabel } from "./identity-label";
import { createSupabaseServerClient } from "./supabase/server";

export async function getVisibleIdentityLabels(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map<string, IdentityLabel>();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_visible_identity_labels", { target_user_ids: ids });
  return new Map(((data ?? []) as Array<{ user_id: string; identity_label: IdentityLabel }>).map((row) => [row.user_id, row.identity_label]));
}
