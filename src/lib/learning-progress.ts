export type ProgressCourse = {
  id: string;
  dayNumber: number;
  title: string;
  status: "draft" | "published" | "archived";
  effectiveUnlockAt: string | null;
};

export type ProgressMember = { userId: string; displayName: string };
export type ProgressSubmission = { userId: string; courseId: string };

export function buildLearningProgress(input: {
  now?: Date;
  members: ProgressMember[];
  courses: ProgressCourse[];
  submissions: ProgressSubmission[];
}) {
  const now = input.now ?? new Date();
  const availableCourses = input.courses
    .filter((course) => {
      if (course.status !== "published" || !course.effectiveUnlockAt) return false;
      const unlockTime = new Date(course.effectiveUnlockAt).getTime();
      return Number.isFinite(unlockTime) && unlockTime <= now.getTime();
    })
    .sort((left, right) => left.dayNumber - right.dayNumber);

  const submissionsByUser = new Map<string, Set<string>>();
  for (const submission of input.submissions) {
    const courseIds = submissionsByUser.get(submission.userId) ?? new Set<string>();
    courseIds.add(submission.courseId);
    submissionsByUser.set(submission.userId, courseIds);
  }

  return input.members.map((member) => {
    const submittedIds = submissionsByUser.get(member.userId) ?? new Set<string>();
    const submittedCourses = availableCourses.filter((course) => submittedIds.has(course.id));
    const missingCourses = availableCourses.filter((course) => !submittedIds.has(course.id));
    return {
      ...member,
      submittedCount: submittedCourses.length,
      availableCount: availableCourses.length,
      submittedCourses,
      missingCourses,
    };
  });
}
