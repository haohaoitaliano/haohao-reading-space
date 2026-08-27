import "server-only";

import { cookies } from "next/headers";
import { ACTIVE_CAMP_COOKIE } from "./active-camp-cookie";
import { createSupabaseServerClient } from "./supabase/server";

export type LearningSpaceCamp = {
  id: string;
  name: string;
  slug: string;
  startsAt: string | null;
  timezone: string;
  status: "active";
  joinedAt: string;
};

type CampMembershipRow = {
  camp_id: string;
  joined_at: string;
  camps: {
    id: string;
    name: string;
    slug: string;
    starts_at: string | null;
    timezone: string;
    status: "draft" | "active" | "archived";
  } | null;
};

export async function getStudentLearningSpaces(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("camp_members")
    .select("camp_id, joined_at, camps(id, name, slug, starts_at, timezone, status)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) return { state: "database_error" as const, spaces: [] as LearningSpaceCamp[] };

  const spaces = ((data ?? []) as unknown as CampMembershipRow[])
    .map((row) => row.camps ? {
      id: row.camps.id,
      name: row.camps.name,
      slug: row.camps.slug,
      startsAt: row.camps.starts_at,
      timezone: row.camps.timezone,
      status: row.camps.status,
      joinedAt: row.joined_at,
    } : null)
    .filter((camp): camp is LearningSpaceCamp => Boolean(camp && camp.status === "active"));

  return { state: spaces.length ? "ok" as const : "no_membership" as const, spaces };
}

export async function getCurrentLearningSpace(userId: string) {
  const result = await getStudentLearningSpaces(userId);
  if (result.state !== "ok") {
    return { state: result.state, camp: null, spaces: result.spaces };
  }

  const cookieStore = await cookies();
  const selectedCampId = cookieStore.get(ACTIVE_CAMP_COOKIE)?.value ?? null;
  if (selectedCampId) {
    const selected = result.spaces.find((camp) => camp.id === selectedCampId);
    if (selected) return { state: "ok" as const, camp: selected, spaces: result.spaces };
    return { state: "no_selected_camp" as const, camp: null, spaces: result.spaces };
  }

  if (result.spaces.length === 1) {
    return { state: "ok" as const, camp: result.spaces[0], spaces: result.spaces };
  }

  return { state: "no_selected_camp" as const, camp: null, spaces: result.spaces };
}
