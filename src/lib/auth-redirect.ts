type AppRole = "student" | "admin";

function getSafeInternalPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return null;

  const pathname = value.split(/[?#]/, 1)[0];
  if (pathname === "/login" || pathname.startsWith("/auth/")) return null;
  return value;
}

export function buildMagicLinkRedirect(origin: string, next: string | null) {
  const callbackUrl = new URL("/auth/callback", origin);
  const safeNext = getSafeInternalPath(next);
  if (safeNext) callbackUrl.searchParams.set("next", safeNext);
  return callbackUrl.toString();
}

export function getSafePostLoginPath(next: string | null, role: AppRole) {
  const safeNext = getSafeInternalPath(next);
  if (!safeNext) return null;

  const pathname = safeNext.split(/[?#]/, 1)[0];
  if (role !== "admin" && pathname.startsWith("/teacher")) return null;
  return safeNext;
}
