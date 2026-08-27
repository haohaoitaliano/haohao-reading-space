import { NextResponse } from "next/server";
import { ACTIVE_CAMP_COOKIE, getExpiredActiveCampCookieOptions } from "@/lib/active-camp-cookie";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ success: true });
  response.cookies.set(ACTIVE_CAMP_COOKIE, "", getExpiredActiveCampCookieOptions());
  return response;
}
