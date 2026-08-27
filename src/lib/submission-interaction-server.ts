import "server-only";

import { getAuthContext } from "./auth";
import { getActiveCampForUser } from "./cloud-course-data";
import { createSupabaseServerClient } from "./supabase/server";

type PublicSubmissionRow = {
  id: string;
  camp_id: string;
  user_id: string;
  visibility: "public";
};

export async function getPublicSubmissionInteractionContext(submissionId: string) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.status !== "active" || auth.profile.role !== "student") {
    return { state: "unauthenticated" as const };
  }

  const campResult = await getActiveCampForUser(auth.profile.id);
  if (campResult.state !== "ok") return { state: "unavailable" as const };

  const supabase = await createSupabaseServerClient();
  const { data: submission, error } = await supabase
    .from("student_submissions")
    .select("id, camp_id, user_id, visibility")
    .eq("id", submissionId)
    .eq("camp_id", campResult.camp.id)
    .eq("visibility", "public")
    .maybeSingle<PublicSubmissionRow>();

  if (error || !submission) return { state: "not_found" as const };
  return {
    state: "ok" as const,
    auth,
    submission,
    supabase,
  };
}
