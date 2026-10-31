export type ProgressCourse = {
  id: string;
  dayNumber: number;
  title: string;
  status: "draft" | "published" | "archived";
  effectiveUnlockAt: string | null;
  recordingAssignmentEnabled: boolean;
  photoAssignmentEnabled: boolean;
};

export type ProgressMember = { userId: string; displayName: string };
export type ProgressSubmission = { userId: string; courseId: string; kind: "recording" | "photo" };

export type StudentCampStats = {
  openedTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completedOutputs: number;
  resubmissions: number;
  completionPercent: number;
};

export function getTodayTaskStatus(input: {
  hasTask: boolean;
  recordingRequired: boolean;
  photoRequired: boolean;
  hasRecordingSubmission: boolean;
  hasPhotoSubmission: boolean;
  submissionError: boolean;
}) {
  if (!input.hasTask) return "今日暂无任务";
  if (input.submissionError) return "状态暂时无法读取";
  if (!input.recordingRequired && !input.photoRequired) return "无需提交作业";
  return isCourseAssignmentComplete({
    recordingAssignmentEnabled: input.recordingRequired,
    photoAssignmentEnabled: input.photoRequired,
  }, input.hasRecordingSubmission, input.hasPhotoSubmission) ? "已完成" : "待完成";
}

export function isCourseAssignmentComplete(
  course: { recordingAssignmentEnabled: boolean; photoAssignmentEnabled: boolean },
  hasRecordingSubmission: boolean,
  hasPhotoSubmission: boolean,
) {
  return (!course.recordingAssignmentEnabled || hasRecordingSubmission)
    && (!course.photoAssignmentEnabled || hasPhotoSubmission);
}

export function buildStudentCampStats(input: {
  courses: Array<{
    id: string;
    isUnlocked: boolean;
    recordingAssignmentEnabled: boolean;
    photoAssignmentEnabled: boolean;
  }>;
  recordingSubmissions: Array<{ courseId: string; version: number }>;
  photoSubmissions: Array<{ courseId: string; version: number }>;
  unifiedAssignments?: Array<{ courseId: string; version: number; hasRecording: boolean; photoCount: number }>;
}): StudentCampStats {
  const unifiedAssignments = input.unifiedAssignments ?? [];
  const recordingCourseIds = new Set([
    ...input.recordingSubmissions.map((submission) => submission.courseId),
    ...unifiedAssignments.filter((assignment) => assignment.hasRecording).map((assignment) => assignment.courseId),
  ]);
  const photoCourseIds = new Set([
    ...input.photoSubmissions.map((submission) => submission.courseId),
    ...unifiedAssignments.filter((assignment) => assignment.photoCount > 0).map((assignment) => assignment.courseId),
  ]);
  const openedCourses = input.courses.filter((course) =>
    course.isUnlocked && (course.recordingAssignmentEnabled || course.photoAssignmentEnabled)
  );
  const completedTasks = openedCourses.filter((course) => isCourseAssignmentComplete(
    course,
    recordingCourseIds.has(course.id),
    photoCourseIds.has(course.id),
  )).length;
  const openedTasks = openedCourses.length;
  const legacySubmissions = [...input.recordingSubmissions, ...input.photoSubmissions];

  return {
    openedTasks,
    completedTasks,
    pendingTasks: Math.max(0, openedTasks - completedTasks),
    completedOutputs: legacySubmissions.length + unifiedAssignments.length,
    resubmissions: legacySubmissions.filter((submission) => submission.version >= 2).length
      + unifiedAssignments.filter((submission) => submission.version >= 2).length,
    completionPercent: openedTasks ? Math.round((completedTasks / openedTasks) * 100) : 0,
  };
}

export function buildLearningProgress(input: {
  now?: Date;
  members: ProgressMember[];
  courses: ProgressCourse[];
  submissions: ProgressSubmission[];
}) {
  const now = input.now ?? new Date();
  const availableCourses = input.courses
    .filter((course) => {
      if (!course.recordingAssignmentEnabled && !course.photoAssignmentEnabled) return false;
      if (course.status !== "published" || !course.effectiveUnlockAt) return false;
      const unlockTime = new Date(course.effectiveUnlockAt).getTime();
      return Number.isFinite(unlockTime) && unlockTime <= now.getTime();
    })
    .sort((left, right) => left.dayNumber - right.dayNumber);

  const recordingByUser = new Map<string, Set<string>>();
  const photosByUser = new Map<string, Set<string>>();
  for (const submission of input.submissions) {
    const target = submission.kind === "recording" ? recordingByUser : photosByUser;
    const courseIds = target.get(submission.userId) ?? new Set<string>();
    courseIds.add(submission.courseId);
    target.set(submission.userId, courseIds);
  }

  return input.members.map((member) => {
    const recordings = recordingByUser.get(member.userId) ?? new Set<string>();
    const photos = photosByUser.get(member.userId) ?? new Set<string>();
    const submittedCourses = availableCourses.filter((course) => isCourseAssignmentComplete(
      course,
      recordings.has(course.id),
      photos.has(course.id),
    ));
    const missingCourses = availableCourses.filter((course) => !isCourseAssignmentComplete(
      course,
      recordings.has(course.id),
      photos.has(course.id),
    ));
    return {
      ...member,
      submittedCount: submittedCourses.length,
      availableCount: availableCourses.length,
      submittedCourses,
      missingCourses,
    };
  });
}
