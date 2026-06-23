import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafePostLoginPath } from "@/lib/auth-redirect";
import { getPostLoginPath, type AuthProfile } from "@/lib/auth-policy";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

type CallbackFailure = "missing_configuration" | "missing_code" | "exchange_failed" | "missing_user" | "profile_failed";

function callbackError(request: NextRequest, reason: CallbackFailure, details?: unknown) {
  console.error("[auth/callback] Magic Link callback failed", { reason, details });
  const errorUrl = new URL("/auth/error", request.url);
  errorUrl.searchParams.set("reason", reason);
  return NextResponse.redirect(errorUrl);
}

function redirectWithCookies(request: NextRequest, pathname: string, cookieResponse: NextResponse) {
  const response = NextResponse.redirect(new URL(pathname, request.url));
  cookieResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!isSupabaseConfigured()) return callbackError(request, "missing_configuration");
  if (!code) return callbackError(request, "missing_code");

  const cookieResponse = NextResponse.next();
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieResponse.cookies.set(name, value, options);
        });
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return callbackError(request, "exchange_failed", {
      code: error.code,
      name: error.name,
      status: error.status,
    });
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return callbackError(request, "missing_user");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role, status")
    .eq("id", userId)
    .single<AuthProfile>();

  if (profileError || !profile) {
    return callbackError(request, "profile_failed", {
      code: profileError?.code,
    });
  }

  const next = requestUrl.searchParams.get("next");
  const destination = profile.status === "active"
    ? getSafePostLoginPath(next, profile.role) ?? getPostLoginPath(profile.role)
    : "/forbidden";
  return redirectWithCookies(request, destination, cookieResponse);
}
