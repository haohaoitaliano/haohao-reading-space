import "server-only";

import { getStudentCourseList } from "./cloud-course-data";
import { getOwnCloudSubmissions } from "./cloud-submission-data";
import { getOwnPhotoSubmissions, getOwnUnifiedAssignments } from "./photo-submission-data";
import { buildStudentCampStats } from "./learning-progress";

export async function getStudentCampProgress(userId: string) {
  const courseResult = await getStudentCourseList(userId);
  const [submissionResult, photoSubmissionResult, unifiedResult] = courseResult.camp
    ? await Promise.all([
      getOwnCloudSubmissions(userId, courseResult.camp.id),
      getOwnPhotoSubmissions(userId, courseResult.camp.id),
      getOwnUnifiedAssignments(userId, courseResult.camp.id),
    ])
    : [
      { submissions: [], error: courseResult.state === "database_error" },
      { submissions: [], error: courseResult.state === "database_error" },
      { assignments: [], error: courseResult.state === "database_error" },
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
    submissionError: submissionResult.error || photoSubmissionResult.error || unifiedResult.error,
    stats,
  };
}
