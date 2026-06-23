import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedRouteRedirect, type AuthProfile } from "@/lib/auth-policy";
import { getSupabaseConfig, isSupabaseConfigured } from "./config";

const publicPaths = new Set(["/", "/login", "/register", "/auth/callback", "/auth/error", "/forbidden"]);

function copyUrl(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return url;
}

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  if (!isSupabaseConfigured()) {
    if (!publicPaths.has(pathname)) {
      const url = copyUrl(request, "/login");
      url.searchParams.set("setup", "missing");
      return NextResponse.redirect(url);
    }
    return response;
  }

  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (error || !userId) {
    if (!publicPaths.has(pathname)) {
      const loginUrl = copyUrl(request, "/login");
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, status")
    .eq("id", userId)
    .maybeSingle<AuthProfile>();

  if (!profile) {
    return pathname === "/forbidden"
      ? response
      : NextResponse.redirect(copyUrl(request, "/forbidden"));
  }

  const roleRedirect = getAuthenticatedRouteRedirect(pathname, profile);
  if (roleRedirect) return NextResponse.redirect(copyUrl(request, roleRedirect));

  return response;
}
