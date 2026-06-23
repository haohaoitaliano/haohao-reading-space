export type AppRole = "student" | "admin";
export type ProfileStatus = "active" | "disabled";

export type AuthProfile = {
  id: string;
  display_name: string;
  role: AppRole;
  status: ProfileStatus;
  email?: string | null;
};

export function getPostLoginPath(role: AppRole) {
  return role === "admin" ? "/teacher" : "/home";
}

const campProtectedPrefixes = [
  "/home",
  "/courses",
  "/circle",
  "/my-work",
  "/my-submissions",
  "/progress",
  "/weekly",
  "/ai-feedback",
];

export function requiresCampMembership(pathname: string) {
  return campProtectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getCampMembershipRedirect(
  pathname: string,
  profile: Pick<AuthProfile, "role" | "status">,
  hasActiveMembership: boolean,
) {
  if (profile.role !== "student" || profile.status !== "active") return null;
  if (pathname === "/join-camp" && hasActiveMembership) return "/home";
  if (requiresCampMembership(pathname) && !hasActiveMembership) return "/join-camp";
  return null;
}

export function canAccessTeacherRoutes(profile: Pick<AuthProfile, "role" | "status"> | null) {
  return profile?.role === "admin" && profile.status === "active";
}

export function getAuthenticatedRouteRedirect(
  pathname: string,
  profile: Pick<AuthProfile, "role" | "status">,
) {
  if (profile.status !== "active") {
    return pathname === "/forbidden" ? null : "/forbidden";
  }
  if (pathname === "/" || pathname === "/login") return getPostLoginPath(profile.role);
  if (pathname.startsWith("/teacher") && !canAccessTeacherRoutes(profile)) return "/forbidden";
  return null;
}

export function getProfileDisplayName(
  profile: Pick<AuthProfile, "display_name"> | null,
  email: string | null,
) {
  const displayName = profile?.display_name.trim();
  if (displayName) return displayName;
  const emailName = email?.split("@")[0]?.trim();
  return emailName || "同学";
}
