import "server-only";

import { getStudentCourseList } from "./cloud-course-data";
import { getOwnCloudSubmissions } from "./cloud-submission-data";
import { buildStudentCampStats } from "./learning-progress";

export async function getStudentCampProgress(userId: string) {
  const courseResult = await getStudentCourseList(userId);
  const submissionResult = courseResult.camp
    ? await getOwnCloudSubmissions(userId, courseResult.camp.id)
    : { submissions: [], error: courseResult.state === "database_error" };
  const stats = buildStudentCampStats({
    courses: courseResult.courses,
    submissions: submissionResult.submissions,
  });

  return { courseResult, submissionResult, stats };
}
