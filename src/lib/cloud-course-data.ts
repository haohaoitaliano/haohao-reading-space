import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCourseUnlocked,
  type CloudCourseStatus,
  type CloudCourseUnlockMode,
  type CloudVocabularyItem,
} from "./cloud-course";
import { COURSE_AUDIO_BUCKET, COURSE_AUDIO_SIGNED_URL_SECONDS } from "./course-audio";
import { COURSE_VIDEO_BUCKET, COURSE_VIDEO_SIGNED_URL_SECONDS } from "./course-video";
import { COURSE_PDF_BUCKET, COURSE_PDF_SIGNED_URL_SECONDS } from "./course-pdf";
import { getCurrentLearningSpace } from "./learning-space";
import { createSupabaseServerClient } from "./supabase/server";

export type CloudCamp = {
  id: string;
  name: string;
  slug: string;
  startsAt: string | null;
  timezone: string;
  status: "draft" | "active" | "archived";
};

export type CloudCourseSummary = {
  id: string;
  campId: string;
  dayNumber: number;
  italianTitle: string;
  chineseTitle: string;
  unlockAt: string | null;
  unlockOverrideAt: string | null;
  automaticUnlockAt: string | null;
  unlockMode: CloudCourseUnlockMode;
  timezone: string;
  status: CloudCourseStatus;
  isUnlocked: boolean;
  maxDurationSeconds: number;
  targetDurationSeconds: number | null;
  recordingAssignmentEnabled: boolean;
  photoAssignmentEnabled: boolean;
};

export type CloudCourseDetail = CloudCourseSummary & {
  description: string;
  readingText: string;
  reflectionPromptZh: string;
  reflectionPromptIt: string;
  vocabulary: CloudVocabularyItem[];
  audio: CloudCourseAudio | null;
  videos: CloudCourseVideo[];
  video: CloudCourseVideo | null;
  pdfs: CloudCoursePdf[];
  submissionCount: number;
};

export type StudentCourseSubmissionSummary = {
  version: number;
  durationSeconds: number;
  createdAt: string;
};

export type CloudCourseAudio = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  updatedAt: string;
  signedUrl: string;
};

export type CloudCourseVideo = {
  id: string;
  position: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  updatedAt: string;
  signedUrl: string;
};

export type CloudCoursePdf = {
  id: string;
  fileName: string;
  sizeBytes: number;
  position: number;
  updatedAt: string;
  signedUrl: string;
  downloadUrl: string;
};

export type CloudCourseMediaItem = {
  id: string;
  kind: "audio" | "video";
  courseId: string;
  dayNumber: number;
  courseTitle: string;
  courseChineseTitle: string;
  campId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  updatedAt: string;
  signedUrl: string;
};

type CourseAudioRow = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  updated_at: string;
};

type CourseVideoRow = {
  id: string;
  position: number;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  updated_at: string;
};

type CoursePdfRow = {
  id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  position: number;
  updated_at: string;
};

type CourseAssignmentRow = {
  course_id: string;
  recording_assignment_enabled: boolean;
  photo_assignment_enabled: boolean;
};

async function createSignedCourseAudio(supabase: SupabaseClient, row: CourseAudioRow | null) {
  if (!row) return null;
  const { data, error } = await supabase.storage
    .from(COURSE_AUDIO_BUCKET)
    .createSignedUrl(row.storage_path, COURSE_AUDIO_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return {
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    durationSeconds: row.duration_seconds,
    updatedAt: row.updated_at,
    signedUrl: data.signedUrl,
  } satisfies CloudCourseAudio;
}

async function createSignedCourseVideo(supabase: SupabaseClient, row: CourseVideoRow) {
  const { data, error } = await supabase.storage
    .from(COURSE_VIDEO_BUCKET)
    .createSignedUrl(row.storage_path, COURSE_VIDEO_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return {
    id: row.id,
    position: row.position,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    durationSeconds: row.duration_seconds,
    updatedAt: row.updated_at,
    signedUrl: data.signedUrl,
  } satisfies CloudCourseVideo;
}

async function createSignedCourseVideos(supabase: SupabaseClient, rows: CourseVideoRow[] | null) {
  return (await Promise.all((rows ?? []).map((row) => createSignedCourseVideo(supabase, row))))
    .filter((video): video is CloudCourseVideo => Boolean(video));
}

async function createSignedCoursePdf(supabase: SupabaseClient, row: CoursePdfRow) {
  const [inlineResult, downloadResult] = await Promise.all([
    supabase.storage.from(COURSE_PDF_BUCKET).createSignedUrl(row.storage_path, COURSE_PDF_SIGNED_URL_SECONDS),
    supabase.storage.from(COURSE_PDF_BUCKET).createSignedUrl(
      row.storage_path,
      COURSE_PDF_SIGNED_URL_SECONDS,
      { download: row.file_name },
    ),
  ]);
  if (inlineResult.error || !inlineResult.data?.signedUrl) return null;
  return {
    id: row.id,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    position: row.position,
    updatedAt: row.updated_at,
    signedUrl: inlineResult.data.signedUrl,
    downloadUrl: downloadResult.data?.signedUrl ?? inlineResult.data.signedUrl,
  } satisfies CloudCoursePdf;
}

type CourseScheduleRow = {
  id: string;
  camp_id: string;
  day_number: number;
  italian_title: string;
  chinese_title: string | null;
  unlock_at: string | null;
  unlock_mode: CloudCourseUnlockMode;
  automatic_unlock_at: string | null;
  effective_unlock_at: string | null;
  camp_timezone: string;
  camp_starts_at: string | null;
  status: CloudCourseStatus;
  max_duration_seconds: number;
  target_duration_seconds: number | null;
};

function mapSummary(row: CourseScheduleRow, assignment?: CourseAssignmentRow): CloudCourseSummary {
  return {
    id: row.id,
    campId: row.camp_id,
    dayNumber: row.day_number,
    italianTitle: row.italian_title,
    chineseTitle: row.chinese_title ?? "",
    unlockAt: row.effective_unlock_at,
    unlockOverrideAt: row.unlock_at,
    automaticUnlockAt: row.automatic_unlock_at,
    unlockMode: row.unlock_mode,
    timezone: row.camp_timezone,
    status: row.status,
    isUnlocked: isCourseUnlocked(row.effective_unlock_at),
    maxDurationSeconds: Number.isInteger(row.max_duration_seconds) && row.max_duration_seconds > 0
      ? row.max_duration_seconds
      : 120,
    targetDurationSeconds: Number.isInteger(row.target_duration_seconds) && row.target_duration_seconds! > 0
      ? row.target_duration_seconds
      : null,
    recordingAssignmentEnabled: assignment?.recording_assignment_enabled ?? true,
    photoAssignmentEnabled: assignment?.photo_assignment_enabled ?? false,
  };
}

async function getAssignmentMap(supabase: SupabaseClient, courseIds: string[]) {
  if (!courseIds.length) return new Map<string, CourseAssignmentRow>();
  const { data, error } = await supabase
    .from("course_contents")
    .select("course_id, recording_assignment_enabled, photo_assignment_enabled")
    .in("course_id", courseIds);
  if (error) return null;
  return new Map(((data ?? []) as CourseAssignmentRow[]).map((row) => [row.course_id, row]));
}

export async function getActiveCampForUser(userId: string) {
  const result = await getCurrentLearningSpace(userId);
  if (result.state !== "ok") return { state: result.state, camp: null };
  return { state: "ok" as const, camp: result.camp };
}

export async function getStudentCourseList(userId: string) {
  const campResult = await getActiveCampForUser(userId);
  if (campResult.state !== "ok") return { ...campResult, courses: [] as CloudCourseSummary[] };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("get_course_schedule", { target_camp_id: campResult.camp.id })
    .order("day_number", { ascending: true });

  if (error) return { state: "database_error" as const, camp: campResult.camp, courses: [] };
  const rows = (data as CourseScheduleRow[] | null) ?? [];
  const assignments = await getAssignmentMap(supabase, rows.map((row) => row.id));
  if (!assignments) return { state: "database_error" as const, camp: campResult.camp, courses: [] };
  return {
    state: data?.length ? "ok" as const : "empty" as const,
    camp: campResult.camp,
    courses: rows.map((row) => mapSummary(row, assignments.get(row.id))),
  };
}

export async function getStudentCourseByDay(userId: string, dayNumber: number) {
  const campResult = await getActiveCampForUser(userId);
  if (campResult.state !== "ok") return { state: campResult.state, camp: null, course: null };

  const supabase = await createSupabaseServerClient();
  const { data: courseRow, error: courseError } = await supabase
    .rpc("get_course_schedule", { target_camp_id: campResult.camp.id })
    .eq("day_number", dayNumber)
    .maybeSingle<CourseScheduleRow>();

  if (courseError) return { state: "database_error" as const, camp: campResult.camp, course: null };
  if (!courseRow) return { state: "not_found" as const, camp: campResult.camp, course: null };

  const assignments = await getAssignmentMap(supabase, [courseRow.id]);
  if (!assignments) return { state: "database_error" as const, camp: campResult.camp, course: null };
  const summary = mapSummary(courseRow, assignments.get(courseRow.id));
  if (!summary.isUnlocked) {
    return { state: "locked" as const, camp: campResult.camp, course: summary };
  }

  const [
    { data: content, error: contentError },
    { data: vocabulary, error: vocabularyError },
    { data: audioRow, error: audioError },
    { data: videoRows, error: videoError },
    { data: pdfRows, error: pdfError },
    { data: latestSubmissionRow, error: latestSubmissionError },
    { data: latestPhotoSubmissionRow, error: latestPhotoSubmissionError },
  ] =
    await Promise.all([
      supabase
        .from("course_contents")
        .select("description, reading_text, reflection_prompt_zh, reflection_prompt_it, recording_assignment_enabled, photo_assignment_enabled")
        .eq("course_id", summary.id)
        .maybeSingle<{
          description: string | null;
          reading_text: string | null;
          reflection_prompt_zh: string | null;
          reflection_prompt_it: string | null;
          recording_assignment_enabled: boolean;
          photo_assignment_enabled: boolean;
        }>(),
      supabase
        .from("course_vocabulary")
        .select("id, position, word, meaning_zh")
        .eq("course_id", summary.id)
        .order("position", { ascending: true }),
      supabase
        .from("course_audio")
        .select("storage_path, file_name, mime_type, size_bytes, duration_seconds, updated_at")
        .eq("course_id", summary.id)
        .maybeSingle<CourseAudioRow>(),
      supabase
        .from("course_videos")
        .select("id, position, storage_path, file_name, mime_type, size_bytes, duration_seconds, updated_at")
        .eq("course_id", summary.id)
        .order("position", { ascending: true }),
      supabase
        .from("course_pdfs")
        .select("id, storage_path, file_name, size_bytes, position, updated_at")
        .eq("course_id", summary.id)
        .order("position", { ascending: true }),
      supabase
        .from("student_submissions")
        .select("version, duration_seconds, created_at")
        .eq("user_id", userId)
        .eq("camp_id", campResult.camp.id)
        .eq("course_id", summary.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle<{
          version: number;
          duration_seconds: number;
          created_at: string;
        }>(),
      supabase
        .from("student_photo_submissions")
        .select("version, created_at")
        .eq("user_id", userId)
        .eq("camp_id", campResult.camp.id)
        .eq("course_id", summary.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle<{ version: number; created_at: string }>(),
    ]);

  if (contentError || vocabularyError || audioError || videoError || pdfError || latestSubmissionError || latestPhotoSubmissionError || !content) {
    return { state: "database_error" as const, camp: campResult.camp, course: null };
  }

  const videos = await createSignedCourseVideos(supabase, videoRows as CourseVideoRow[] | null);
  const detail: CloudCourseDetail = {
    ...summary,
    description: content.description ?? "",
    readingText: content.reading_text ?? "",
    reflectionPromptZh: content.reflection_prompt_zh ?? "",
    reflectionPromptIt: content.reflection_prompt_it ?? "",
    recordingAssignmentEnabled: content.recording_assignment_enabled,
    photoAssignmentEnabled: content.photo_assignment_enabled,
    vocabulary: ((vocabulary ?? []) as Array<{
      id: string;
      position: number;
      word: string;
      meaning_zh: string | null;
    }>).map((item) => ({
      id: item.id,
      position: item.position,
      word: item.word,
      meaningZh: item.meaning_zh ?? "",
    })),
    audio: await createSignedCourseAudio(supabase, audioRow),
    videos,
    video: videos[0] ?? null,
    pdfs: (await Promise.all(((pdfRows ?? []) as CoursePdfRow[]).map((row) => createSignedCoursePdf(supabase, row))))
      .filter((pdf): pdf is CloudCoursePdf => Boolean(pdf)),
    submissionCount: 0,
  };

  return {
    state: "ok" as const,
    camp: campResult.camp,
    course: detail,
    latestSubmission: latestSubmissionRow ? {
      version: latestSubmissionRow.version,
      durationSeconds: Number(latestSubmissionRow.duration_seconds),
      createdAt: latestSubmissionRow.created_at,
    } satisfies StudentCourseSubmissionSummary : null,
    latestPhotoSubmission: latestPhotoSubmissionRow ? {
      version: latestPhotoSubmissionRow.version,
      createdAt: latestPhotoSubmissionRow.created_at,
    } : null,
  };
}

export async function getAdminCourseList() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("get_course_schedule", { target_camp_id: null })
    .order("day_number", { ascending: true });

  if (error) return { error: true, courses: [] as CloudCourseSummary[] };
  const rows = (data as CourseScheduleRow[] | null) ?? [];
  const assignments = await getAssignmentMap(supabase, rows.map((row) => row.id));
  return {
    error: !assignments,
    courses: assignments ? rows.map((row) => mapSummary(row, assignments.get(row.id))) : [],
  };
}

export async function getAdminCourse(courseId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .rpc("get_course_schedule", { target_camp_id: null })
    .eq("id", courseId)
    .maybeSingle<CourseScheduleRow>();

  if (error || !row) return null;
  const assignments = await getAssignmentMap(supabase, [row.id]);
  if (!assignments) return null;
  const summary = mapSummary(row, assignments.get(row.id));
  const [
    { data: content },
    { data: vocabulary },
    { data: audioRow },
    { data: videoRows },
    { data: pdfRows },
    submissionResult,
    photoSubmissionResult,
  ] = await Promise.all([
    supabase
      .from("course_contents")
      .select("description, reading_text, reflection_prompt_zh, reflection_prompt_it, recording_assignment_enabled, photo_assignment_enabled")
      .eq("course_id", courseId)
      .maybeSingle<{
        description: string | null;
        reading_text: string | null;
        reflection_prompt_zh: string | null;
        reflection_prompt_it: string | null;
        recording_assignment_enabled: boolean;
        photo_assignment_enabled: boolean;
      }>(),
    supabase
      .from("course_vocabulary")
      .select("id, position, word, meaning_zh")
      .eq("course_id", courseId)
      .order("position", { ascending: true }),
    supabase
      .from("course_audio")
      .select("storage_path, file_name, mime_type, size_bytes, duration_seconds, updated_at")
      .eq("course_id", courseId)
      .maybeSingle<CourseAudioRow>(),
    supabase
      .from("course_videos")
      .select("id, position, storage_path, file_name, mime_type, size_bytes, duration_seconds, updated_at")
      .eq("course_id", courseId)
      .order("position", { ascending: true }),
    supabase
      .from("course_pdfs")
      .select("id, storage_path, file_name, size_bytes, position, updated_at")
      .eq("course_id", courseId)
      .order("position", { ascending: true }),
    supabase
      .from("student_submissions")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId),
    supabase
      .from("student_photo_submissions")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId),
  ]);

  const videos = await createSignedCourseVideos(supabase, videoRows as CourseVideoRow[] | null);
  return {
    ...summary,
    description: content?.description ?? "",
    readingText: content?.reading_text ?? "",
    reflectionPromptZh: content?.reflection_prompt_zh ?? "",
    reflectionPromptIt: content?.reflection_prompt_it ?? "",
    recordingAssignmentEnabled: content?.recording_assignment_enabled ?? true,
    photoAssignmentEnabled: content?.photo_assignment_enabled ?? false,
    vocabulary: ((vocabulary ?? []) as Array<{
      id: string;
      position: number;
      word: string;
      meaning_zh: string | null;
    }>).map((item) => ({
      id: item.id,
      position: item.position,
      word: item.word,
      meaningZh: item.meaning_zh ?? "",
    })),
    audio: await createSignedCourseAudio(supabase, audioRow),
    videos,
    video: videos[0] ?? null,
    pdfs: (await Promise.all(((pdfRows ?? []) as CoursePdfRow[]).map((pdf) => createSignedCoursePdf(supabase, pdf))))
      .filter((pdf): pdf is CloudCoursePdf => Boolean(pdf)),
    submissionCount: (submissionResult.count ?? 0) + (photoSubmissionResult.count ?? 0),
  } satisfies CloudCourseDetail;
}

export async function getAdminCampOptions() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("camps")
    .select("id, name, slug, starts_at, timezone, status")
    .order("created_at", { ascending: true });
  return ((data ?? []) as Array<{
    id: string; name: string; slug: string; starts_at: string | null; timezone: string;
    status: "draft" | "active" | "archived";
  }>).map((camp) => ({
    id: camp.id,
    name: camp.name,
    slug: camp.slug,
    startsAt: camp.starts_at,
    timezone: camp.timezone,
    status: camp.status,
  }));
}

export async function getAdminCourseMediaLibrary() {
  const supabase = await createSupabaseServerClient();
  const [{ data: scheduleData, error: scheduleError }, { data: audioData, error: audioError }, { data: videoData, error: videoError }] =
    await Promise.all([
      supabase.rpc("get_course_schedule", { target_camp_id: null }),
      supabase
        .from("course_audio")
        .select("course_id, storage_path, file_name, mime_type, size_bytes, duration_seconds, updated_at"),
      supabase
        .from("course_videos")
        .select("id, position, course_id, storage_path, file_name, mime_type, size_bytes, duration_seconds, updated_at"),
    ]);

  if (scheduleError || audioError || videoError) {
    return { error: true, items: [] as CloudCourseMediaItem[] };
  }

  const coursesById = new Map(
    ((scheduleData ?? []) as CourseScheduleRow[]).map((row) => [
      row.id,
      {
        campId: row.camp_id,
        courseId: row.id,
        dayNumber: row.day_number,
        courseTitle: row.italian_title,
        courseChineseTitle: row.chinese_title ?? "",
      },
    ]),
  );

  async function mapAudio(row: CourseAudioRow & { course_id: string }): Promise<CloudCourseMediaItem | null> {
    const course = coursesById.get(row.course_id);
    if (!course) return null;
    const signed = await createSignedCourseAudio(supabase, row);
    if (!signed) return null;
    return {
      ...course,
      id: `audio-${row.course_id}`,
      kind: "audio",
      ...signed,
    } satisfies CloudCourseMediaItem;
  }

  async function mapVideo(row: CourseVideoRow & { course_id: string }): Promise<CloudCourseMediaItem | null> {
    const course = coursesById.get(row.course_id);
    if (!course) return null;
    const signed = await createSignedCourseVideo(supabase, row);
    if (!signed) return null;
    return {
      ...course,
      kind: "video",
      ...signed,
      id: `video-${row.id}`,
    } satisfies CloudCourseMediaItem;
  }

  const items = (await Promise.all([
    ...((audioData ?? []) as Array<CourseAudioRow & { course_id: string }>).map(mapAudio),
    ...((videoData ?? []) as Array<CourseVideoRow & { course_id: string }>).map(mapVideo),
  ]))
    .filter((item): item is CloudCourseMediaItem => Boolean(item))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  return { error: false, items };
}
