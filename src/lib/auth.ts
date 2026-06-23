import { cache } from "react";
import { redirect } from "next/navigation";
import {
  canAccessTeacherRoutes,
  getProfileDisplayName,
  type AuthProfile,
} from "./auth-policy";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

export type AuthContext = {
  profile: AuthProfile;
  email: string | null;
};

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (error || !userId) return null;

  const email = typeof claims?.email === "string" ? claims.email : null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, status")
    .eq("id", userId)
    .maybeSingle<AuthProfile>();

  if (!profile) return null;
  return {
    email,
    profile: {
      ...profile,
      display_name: getProfileDisplayName(profile, email),
      email,
    },
  };
});

export async function requireAuthenticatedUser() {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (context.profile.status !== "active") redirect("/forbidden");
  return context;
}

export async function requireAdmin() {
  const context = await requireAuthenticatedUser();
  if (!canAccessTeacherRoutes(context.profile)) redirect("/forbidden");
  return context;
}
