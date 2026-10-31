import "server-only";

import { getAuthContext } from "./auth";
import { getActiveCampForUser } from "./cloud-course-data";
import { createSupabaseServerClient } from "./supabase/server";

type InteractionTarget = {
  id: string;
  camp_id: string;
  user_id: string;
  visibility: "public" | "teacher_only";
};

export async function getSubmissionInteractionContext(targetId: string) {
  const auth = await getAuthContext();
  if (!auth || auth.profile.status !== "active") return { state: "unauthenticated" as const };
  if (auth.profile.role !== "admin" && auth.profile.role !== "student") return { state: "unauthenticated" as const };

  const activeCamp = auth.profile.role === "student" ? await getActiveCampForUser(auth.profile.id) : null;
  if (activeCamp && activeCamp.state !== "ok") return { state: "unavailable" as const };

  const supabase = await createSupabaseServerClient();
  let assignmentQuery = supabase
    .from("student_assignment_submissions")
    .select("id, camp_id, user_id, visibility")
    .eq("id", targetId);
  if (activeCamp?.state === "ok") assignmentQuery = assignmentQuery.eq("camp_id", activeCamp.camp.id);
  const { data: assignment } = await assignmentQuery.maybeSingle<InteractionTarget>();
  if (assignment) {
    return {
      state: "ok" as const,
      auth,
      campId: assignment.camp_id,
      target: assignment,
      targetColumn: "assignment_submission_id" as const,
      supabase,
    };
  }

  let submissionQuery = supabase
    .from("student_submissions")
    .select("id, camp_id, user_id, visibility")
    .eq("id", targetId);
  if (activeCamp?.state === "ok") submissionQuery = submissionQuery.eq("camp_id", activeCamp.camp.id);
  const { data: submission, error } = await submissionQuery.maybeSingle<InteractionTarget>();

  if (error || !submission) return { state: "not_found" as const };
  return {
    state: "ok" as const,
    auth,
    campId: submission.camp_id,
    target: submission,
    targetColumn: "submission_id" as const,
    supabase,
  };
}

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
    .maybeSingle<InteractionTarget>();
  if (error || !submission) return { state: "not_found" as const };
  return { state: "ok" as const, auth, submission, supabase };
}
