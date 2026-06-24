import "server-only";

import {
  buildCircleSubmissions,
  toCloudSubmission,
  type CloudSubmission,
  type SubmissionPresentationRow,
} from "./circle-submission";
import { createSupabaseServerClient } from "./supabase/server";

export type { CloudSubmission } from "./circle-submission";

type SubmissionRow = {
  id: string;
  camp_id: string;
  course_id: string;
  student_display_name: string;
  duration_seconds: number;
  visibility: "public" | "teacher_only";
  version: number;
  created_at: string;
  courses: { day_number: number; italian_title: string } | null;
};

function mapRow(row: SubmissionRow): SubmissionPresentationRow {
  return {
    id: row.id,
    campId: row.camp_id,
    courseId: row.course_id,
    dayNumber: row.courses?.day_number ?? 0,
    courseTitle: row.courses?.italian_title ?? "课程",
    studentName: row.student_display_name,
    durationSeconds: Number(row.duration_seconds),
    visibility: row.visibility,
    version: row.version,
    createdAt: row.created_at,
  };
}

const selection = "id, camp_id, course_id, student_display_name, duration_seconds, visibility, version, created_at, courses(day_number, italian_title)";

export async function getOwnCloudSubmissions(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_submissions")
    .select(selection)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { submissions: [] as CloudSubmission[], error: true };
  return {
    submissions: ((data ?? []) as unknown as SubmissionRow[]).map(mapRow).map(toCloudSubmission),
    error: false,
  };
}

export async function getPublicCampSubmissions(campId: string, currentUserId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_submissions")
    .select(selection)
    .eq("camp_id", campId)
    .eq("visibility", "public")
    .neq("user_id", currentUserId)
    .order("created_at", { ascending: false });
  if (error) return { submissions: [] as CloudSubmission[], error: true };
  return {
    submissions: buildCircleSubmissions(
      ((data ?? []) as unknown as SubmissionRow[]).map(mapRow),
      campId,
    ),
    error: false,
  };
}

export async function getAdminCloudSubmissions() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_submissions")
    .select(selection)
    .order("created_at", { ascending: false });
  if (error) return { submissions: [] as CloudSubmission[], error: true };
  return {
    submissions: ((data ?? []) as unknown as SubmissionRow[]).map(mapRow).map(toCloudSubmission),
    error: false,
  };
}
