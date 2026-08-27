export type SubmissionVisibility = "public" | "teacher_only";

export type SubmissionPresentationRow = {
  id: string;
  campId: string;
  courseId: string;
  userId: string;
  dayNumber: number;
  courseTitle: string;
  studentName: string;
  durationSeconds: number;
  visibility: SubmissionVisibility;
  version: number;
  createdAt: string;
};

export type CloudSubmission = {
  id: string;
  courseId: string;
  dayNumber: number;
  courseTitle: string;
  studentName: string;
  durationSeconds: number;
  visibility: SubmissionVisibility;
  version: number;
  createdAt: string;
  audioUrl: string;
  isOwn?: boolean;
};

export function toCloudSubmission(
  row: SubmissionPresentationRow,
  currentUserId?: string,
): CloudSubmission {
  return {
    id: row.id,
    courseId: row.courseId,
    dayNumber: row.dayNumber,
    courseTitle: row.courseTitle,
    studentName: row.studentName.trim() || "同学",
    durationSeconds: row.durationSeconds,
    visibility: row.visibility,
    version: row.version,
    createdAt: row.createdAt,
    audioUrl: `/api/student/submissions/${encodeURIComponent(row.id)}/audio`,
    ...(currentUserId ? { isOwn: row.userId === currentUserId } : {}),
  };
}

export function buildCircleSubmissions(
  rows: SubmissionPresentationRow[],
  activeCampId: string,
  currentUserId?: string,
) {
  return rows
    .filter((row) => (
      row.campId === activeCampId
      && (row.visibility === "public" || row.userId === currentUserId)
    ))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map((row) => toCloudSubmission(row, currentUserId));
}
