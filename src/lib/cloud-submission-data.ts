import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STUDENT_RECORDING_BUCKET,
  STUDENT_RECORDING_SIGNED_URL_SECONDS,
} from "./student-recording";
import { createSupabaseServerClient } from "./supabase/server";

export type CloudSubmission = {
  id: string;
  courseId: string;
  dayNumber: number;
  courseTitle: string;
  studentId: string;
  studentName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  visibility: "public" | "teacher_only";
  version: number;
  createdAt: string;
  signedUrl: string;
};

type SubmissionRow = {
  id: string;
  course_id: string;
  user_id: string;
  student_display_name: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
  visibility: "public" | "teacher_only";
  version: number;
  created_at: string;
  courses: { day_number: number; italian_title: string } | null;
};

async function mapRows(supabase: SupabaseClient, rows: SubmissionRow[]) {
  return Promise.all(rows.map(async (row) => {
    const { data } = await supabase.storage
      .from(STUDENT_RECORDING_BUCKET)
      .createSignedUrl(row.storage_path, STUDENT_RECORDING_SIGNED_URL_SECONDS);
    return {
      id: row.id,
      courseId: row.course_id,
      dayNumber: row.courses?.day_number ?? 0,
      courseTitle: row.courses?.italian_title ?? "课程",
      studentId: row.user_id,
      studentName: row.student_display_name.trim() || "同学",
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      durationSeconds: Number(row.duration_seconds),
      visibility: row.visibility,
      version: row.version,
      createdAt: row.created_at,
      signedUrl: data?.signedUrl ?? "",
    } satisfies CloudSubmission;
  }));
}

const selection = "id, course_id, user_id, student_display_name, storage_path, file_name, mime_type, size_bytes, duration_seconds, visibility, version, created_at, courses(day_number, italian_title)";

export async function getOwnCloudSubmissions(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_submissions")
    .select(selection)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { submissions: [] as CloudSubmission[], error: true };
  return { submissions: await mapRows(supabase, (data ?? []) as unknown as SubmissionRow[]), error: false };
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
  return { submissions: await mapRows(supabase, (data ?? []) as unknown as SubmissionRow[]), error: false };
}

export async function getAdminCloudSubmissions() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_submissions")
    .select(selection)
    .order("created_at", { ascending: false });
  if (error) return { submissions: [] as CloudSubmission[], error: true };
  return { submissions: await mapRows(supabase, (data ?? []) as unknown as SubmissionRow[]), error: false };
}
