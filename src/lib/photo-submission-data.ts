import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { STUDENT_PHOTO_BUCKET, STUDENT_PHOTO_SIGNED_URL_SECONDS } from "./student-photo";
import { createSupabaseServerClient } from "./supabase/server";

type PhotoRow = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  position: number;
};

type PhotoSubmissionRow = {
  id: string;
  camp_id: string;
  course_id: string;
  user_id: string;
  student_display_name: string;
  version: number;
  created_at: string;
  courses: { day_number: number; italian_title: string } | null;
  student_submission_photos: PhotoRow[];
};

type UnifiedAssignmentRow = {
  id: string;
  camp_id: string;
  course_id: string;
  user_id: string;
  student_display_name: string;
  version: number;
  visibility: "public" | "teacher_only";
  has_recording: boolean;
  created_at: string;
  courses: { day_number: number; italian_title: string } | null;
  student_photo_submissions:
    | { student_submission_photos: PhotoRow[] }
    | Array<{ student_submission_photos: PhotoRow[] }>
    | null;
};

export type CloudPhotoSubmission = {
  id: string;
  campId: string;
  courseId: string;
  userId: string;
  studentName: string;
  dayNumber: number;
  courseTitle: string;
  version: number;
  createdAt: string;
  isOwn: boolean;
  photos: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    position: number;
    signedUrl: string;
    downloadUrl: string;
  }>;
};

export type CloudUnifiedAssignment = CloudPhotoSubmission & {
  assignmentId: string;
  hasRecording: boolean;
  visibility: "public" | "teacher_only";
};

const selection = "id, camp_id, course_id, user_id, student_display_name, version, created_at, courses(day_number, italian_title), student_submission_photos(id, storage_path, file_name, mime_type, size_bytes, position)";

async function mapSubmission(supabase: SupabaseClient, row: PhotoSubmissionRow, currentUserId?: string) {
  const photos = await Promise.all(
    [...row.student_submission_photos]
      .sort((left, right) => left.position - right.position)
      .map(async (photo) => {
        const [inlineResult, downloadResult] = await Promise.all([
          supabase.storage.from(STUDENT_PHOTO_BUCKET).createSignedUrl(photo.storage_path, STUDENT_PHOTO_SIGNED_URL_SECONDS),
          supabase.storage.from(STUDENT_PHOTO_BUCKET).createSignedUrl(
            photo.storage_path,
            STUDENT_PHOTO_SIGNED_URL_SECONDS,
            { download: photo.file_name },
          ),
        ]);
        if (inlineResult.error || !inlineResult.data?.signedUrl) return null;
        return {
          id: photo.id,
          fileName: photo.file_name,
          mimeType: photo.mime_type,
          sizeBytes: photo.size_bytes,
          position: photo.position,
          signedUrl: inlineResult.data.signedUrl,
          downloadUrl: downloadResult.data?.signedUrl ?? inlineResult.data.signedUrl,
        };
      }),
  );
  return {
    id: row.id,
    campId: row.camp_id,
    courseId: row.course_id,
    userId: row.user_id,
    studentName: row.student_display_name,
    dayNumber: row.courses?.day_number ?? 0,
    courseTitle: row.courses?.italian_title ?? "课程",
    version: row.version,
    createdAt: row.created_at,
    isOwn: row.user_id === currentUserId,
    photos: photos.filter((photo): photo is NonNullable<typeof photo> => Boolean(photo)),
  } satisfies CloudPhotoSubmission;
}

async function mapUnifiedAssignment(supabase: SupabaseClient, row: UnifiedAssignmentRow, currentUserId?: string) {
  const photoSubmission = Array.isArray(row.student_photo_submissions)
    ? row.student_photo_submissions[0]
    : row.student_photo_submissions;
  const mapped = await mapSubmission(supabase, {
    id: row.id,
    camp_id: row.camp_id,
    course_id: row.course_id,
    user_id: row.user_id,
    student_display_name: row.student_display_name,
    version: row.version,
    created_at: row.created_at,
    courses: row.courses,
    student_submission_photos: photoSubmission?.student_submission_photos ?? [],
  }, currentUserId);
  return {
    ...mapped,
    assignmentId: row.id,
    hasRecording: row.has_recording,
    visibility: row.visibility,
  } satisfies CloudUnifiedAssignment;
}

export async function getOwnPhotoSubmissions(userId: string, campId: string, courseId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_photo_submissions")
    .select(selection)
    .eq("user_id", userId)
    .eq("camp_id", campId)
    .is("assignment_submission_id", null)
    .order("created_at", { ascending: false });
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) return { submissions: [] as CloudPhotoSubmission[], error: true };
  return {
    submissions: await Promise.all(((data ?? []) as unknown as PhotoSubmissionRow[]).map((row) => mapSubmission(supabase, row, userId))),
    error: false,
  };
}

export async function getAdminPhotoSubmissions() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_photo_submissions")
    .select(selection)
    .is("assignment_submission_id", null)
    .order("created_at", { ascending: false });
  if (error) return { submissions: [] as CloudPhotoSubmission[], error: true };
  return {
    submissions: await Promise.all(((data ?? []) as unknown as PhotoSubmissionRow[]).map((row) => mapSubmission(supabase, row))),
    error: false,
  };
}


const unifiedSelection = "id, camp_id, course_id, user_id, student_display_name, version, visibility, has_recording, created_at, courses(day_number, italian_title), student_photo_submissions(student_submission_photos(id, storage_path, file_name, mime_type, size_bytes, position))";

export async function getCampUnifiedAssignments(campId: string, currentUserId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_assignment_submissions")
    .select(unifiedSelection)
    .eq("camp_id", campId)
    .or(`visibility.eq.public,user_id.eq.${currentUserId}`)
    .order("created_at", { ascending: false });
  if (error) return { assignments: [] as CloudUnifiedAssignment[], error: true };
  return {
    assignments: await Promise.all(((data ?? []) as unknown as UnifiedAssignmentRow[]).map((row) => mapUnifiedAssignment(supabase, row, currentUserId))),
    error: false,
  };
}

export async function getOwnUnifiedAssignments(userId: string, campId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_assignment_submissions")
    .select(unifiedSelection)
    .eq("camp_id", campId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { assignments: [] as CloudUnifiedAssignment[], error: true };
  return {
    assignments: await Promise.all(((data ?? []) as unknown as UnifiedAssignmentRow[]).map((row) => mapUnifiedAssignment(supabase, row, userId))),
    error: false,
  };
}

export async function getAdminUnifiedAssignments() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_assignment_submissions")
    .select(unifiedSelection)
    .order("created_at", { ascending: false });
  if (error) return { assignments: [] as CloudUnifiedAssignment[], error: true };
  return {
    assignments: await Promise.all(((data ?? []) as unknown as UnifiedAssignmentRow[]).map((row) => mapUnifiedAssignment(supabase, row))),
    error: false,
  };
}
