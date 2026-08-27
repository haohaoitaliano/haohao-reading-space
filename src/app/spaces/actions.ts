"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth";
import { ACTIVE_CAMP_COOKIE, getActiveCampCookieOptions } from "@/lib/active-camp-cookie";
import { getStudentLearningSpaces } from "@/lib/learning-space";

export async function selectLearningSpace(formData: FormData) {
  const { profile } = await requireAuthenticatedUser();
  if (profile.role !== "student") redirect("/teacher");

  const campId = String(formData.get("campId") ?? "");
  const result = await getStudentLearningSpaces(profile.id);
  const selected = result.spaces.find((camp) => camp.id === campId);
  if (!selected) redirect("/spaces?error=invalid");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CAMP_COOKIE, selected.id, getActiveCampCookieOptions());
  redirect("/home");
}
