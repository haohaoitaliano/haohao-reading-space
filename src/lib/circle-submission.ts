export type SubmissionVisibility = "public" | "teacher_only";

export type SubmissionPresentationRow = {
  id: string;
  campId: string;
  courseId: string;
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
};

export function toCloudSubmission(row: SubmissionPresentationRow): CloudSubmission {
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
  };
}

export function buildCircleSubmissions(
  rows: SubmissionPresentationRow[],
  activeCampId: string,
) {
  return rows
    .filter((row) => row.campId === activeCampId && row.visibility === "public")
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map(toCloudSubmission);
}
