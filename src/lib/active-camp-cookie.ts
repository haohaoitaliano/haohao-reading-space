export const ACTIVE_CAMP_COOKIE = "active_camp_id";

export function getActiveCampCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function getExpiredActiveCampCookieOptions() {
  return {
    ...getActiveCampCookieOptions(),
    maxAge: 0,
  };
}
