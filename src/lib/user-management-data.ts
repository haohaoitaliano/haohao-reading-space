import "server-only";

import { getAdminCloudSubmissions } from "./cloud-submission-data";
import type { IdentityLabel } from "./identity-label";
import { getAdminPhotoSubmissions, getAdminUnifiedAssignments } from "./photo-submission-data";
import { createSupabaseServerClient } from "./supabase/server";

type AdminUserRow = {
  id: string;
  display_name: string;
  email: string;
  system_role: "student" | "admin";
  status: "active" | "disabled";
  identity_label: IdentityLabel;
  camp_id: string | null;
  camp_name: string | null;
  membership_status: "active" | "removed" | null;
};

export type ManagedUser = {
  id: string;
  displayName: string;
  email: string;
  systemRole: "student" | "admin";
  status: "active" | "disabled";
  identityLabel: IdentityLabel;
  camps: Array<{ id: string; name: string; active: boolean }>;
};

export async function getAdminUsers() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_admin_users");
  if (error) {
    console.error("get_admin_users RPC failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { users: [] as ManagedUser[], error: true };
  }
  const users = new Map<string, ManagedUser>();
  for (const row of (data ?? []) as AdminUserRow[]) {
    const user = users.get(row.id) ?? {
      id: row.id,
      displayName: row.display_name.trim() || "同学",
      email: row.email,
      systemRole: row.system_role,
      status: row.status,
      identityLabel: row.identity_label,
      camps: [],
    };
    if (row.camp_id && row.camp_name) {
      user.camps.push({ id: row.camp_id, name: row.camp_name, active: row.membership_status === "active" });
    }
    users.set(row.id, user);
  }
  return { users: [...users.values()], error: false };
}

export async function getAdminUserAssignments(userId: string, campId: string) {
  const [recordings, legacyPhotos, unified] = await Promise.all([
    getAdminCloudSubmissions({ userId, campId }),
    getAdminPhotoSubmissions({ userId, campId }),
    getAdminUnifiedAssignments({ userId, campId }),
  ]);
  return { recordings, legacyPhotos, unified };
}

export async function getAdminUserAssignmentCount(userId: string) {
  const supabase = await createSupabaseServerClient();
  const [unified, recordings, photos] = await Promise.all([
    supabase.from("student_assignment_submissions").select("course_id").eq("user_id", userId),
    supabase.from("student_submissions").select("course_id").eq("user_id", userId),
    supabase.from("student_photo_submissions").select("course_id").eq("user_id", userId),
  ]);
  if (unified.error || recordings.error || photos.error) return { count: 0, error: true };
  const courseIds = new Set([
    ...(unified.data ?? []).map((row) => row.course_id as string),
    ...(recordings.data ?? []).map((row) => row.course_id as string),
    ...(photos.data ?? []).map((row) => row.course_id as string),
  ]);
  return { count: courseIds.size, error: false };
}
