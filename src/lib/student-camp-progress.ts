import "server-only";

import { getStudentCourseList } from "./cloud-course-data";
import { getOwnCloudSubmissions } from "./cloud-submission-data";
import { getOwnPhotoSubmissions, getOwnUnifiedAssignments } from "./photo-submission-data";
import { buildStudentCampStats } from "./learning-progress";
import { getRomeDayBounds } from "./student-applause";
import { createSupabaseServerClient } from "./supabase/server";

async function getStudentApplauseStats(userId: string, campId: string) {
  const supabase = await createSupabaseServerClient();
  const { start, end } = getRomeDayBounds();
  const selection = "id, student_submissions!inner(id)";
  const baseQuery = () => supabase
    .from("submission_encouragements")
    .select(selection, { count: "exact", head: true })
    .eq("student_submissions.user_id", userId)
    .eq("student_submissions.camp_id", campId);
  const [totalResult, todayResult] = await Promise.all([
    baseQuery(),
    baseQuery().gte("created_at", start).lt("created_at", end),
  ]);

  return {
    total: totalResult.count ?? 0,
    today: todayResult.count ?? 0,
    error: Boolean(totalResult.error || todayResult.error),
  };
}

export async function getStudentCampProgress(userId: string) {
  const courseResult = await getStudentCourseList(userId);
  const [submissionResult, photoSubmissionResult, unifiedResult, applauseResult] = courseResult.camp
    ? await Promise.all([
      getOwnCloudSubmissions(userId, courseResult.camp.id),
      getOwnPhotoSubmissions(userId, courseResult.camp.id),
      getOwnUnifiedAssignments(userId, courseResult.camp.id),
      getStudentApplauseStats(userId, courseResult.camp.id),
    ])
    : [
      { submissions: [], error: courseResult.state === "database_error" },
      { submissions: [], error: courseResult.state === "database_error" },
      { assignments: [], error: courseResult.state === "database_error" },
      { total: 0, today: 0, error: courseResult.state === "database_error" },
    ];
  const stats = buildStudentCampStats({
    courses: courseResult.courses,
    recordingSubmissions: submissionResult.submissions.filter((submission) => (
      !unifiedResult.assignments.some((assignment) => assignment.assignmentId === submission.id)
    )),
    photoSubmissions: photoSubmissionResult.submissions,
    unifiedAssignments: unifiedResult.assignments.map((assignment) => ({
      courseId: assignment.courseId,
      version: assignment.version,
      hasRecording: assignment.hasRecording,
      photoCount: assignment.photos.length,
    })),
  });

  return {
    courseResult,
    submissionResult,
    photoSubmissionResult,
    unifiedResult,
    applauseResult,
    submissionError: submissionResult.error || photoSubmissionResult.error || unifiedResult.error,
    stats,
  };
}
