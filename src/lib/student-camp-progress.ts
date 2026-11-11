import "server-only";

import { getStudentCourseList } from "./cloud-course-data";
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

async function getOwnPhotoSubmissionSummaries(userId: string, campId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_photo_submissions")
    .select("course_id, version")
    .eq("user_id", userId)
    .eq("camp_id", campId)
    .is("assignment_submission_id", null);
  return {
    submissions: (data ?? []).map((row) => ({ courseId: row.course_id, version: row.version })),
    error: Boolean(error),
  };
}

async function getOwnRecordingSubmissionSummaries(userId: string, campId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_submissions")
    .select("id, course_id, version")
    .eq("user_id", userId)
    .eq("camp_id", campId);
  return {
    submissions: (data ?? []).map((row) => ({
      id: row.id,
      courseId: row.course_id,
      version: row.version,
    })),
    error: Boolean(error),
  };
}

async function getOwnUnifiedAssignmentSummaries(userId: string, campId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_assignment_submissions")
    .select("id, course_id, version, has_recording, photo_count")
    .eq("user_id", userId)
    .eq("camp_id", campId);
  return {
    assignments: (data ?? []).map((row) => ({
      assignmentId: row.id,
      courseId: row.course_id,
      version: row.version,
      hasRecording: row.has_recording,
      photoCount: row.photo_count,
    })),
    error: Boolean(error),
  };
}

export async function getStudentCampProgress(userId: string) {
  const courseResult = await getStudentCourseList(userId);
  const [submissionResult, photoSubmissionResult, unifiedResult, applauseResult] = courseResult.camp
    ? await Promise.all([
      getOwnRecordingSubmissionSummaries(userId, courseResult.camp.id),
      getOwnPhotoSubmissionSummaries(userId, courseResult.camp.id),
      getOwnUnifiedAssignmentSummaries(userId, courseResult.camp.id),
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
      photoCount: assignment.photoCount,
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
