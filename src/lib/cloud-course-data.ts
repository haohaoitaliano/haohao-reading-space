import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCourseUnlocked,
  type CloudCourseStatus,
  type CloudCourseUnlockMode,
  type CloudVocabularyItem,
} from "./cloud-course";
import { COURSE_AUDIO_BUCKET, COURSE_AUDIO_SIGNED_URL_SECONDS } from "./course-audio";
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
};

export type CloudCourseDetail = CloudCourseSummary & {
  description: string;
  readingText: string;
  reflectionPromptZh: string;
  reflectionPromptIt: string;
  vocabulary: CloudVocabularyItem[];
  audio: CloudCourseAudio | null;
};

export type CloudCourseAudio = {
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
};

function mapSummary(row: CourseScheduleRow): CloudCourseSummary {
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
  };
}

export async function getActiveCampForUser(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: membership, error: membershipError } = await supabase
    .from("camp_members")
    .select("camp_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ camp_id: string }>();

  if (membershipError) return { state: "database_error" as const, camp: null };
  if (!membership) return { state: "no_membership" as const, camp: null };

  const { data: camp, error: campError } = await supabase
    .from("camps")
    .select("id, name, slug, starts_at, timezone")
    .eq("id", membership.camp_id)
    .eq("status", "active")
    .maybeSingle<{ id: string; name: string; slug: string; starts_at: string | null; timezone: string }>();

  if (campError) return { state: "database_error" as const, camp: null };
  if (!camp) return { state: "no_membership" as const, camp: null };
  return {
    state: "ok" as const,
    camp: { id: camp.id, name: camp.name, slug: camp.slug, startsAt: camp.starts_at, timezone: camp.timezone, status: "active" },
  };
}

export async function getStudentCourseList(userId: string) {
  const campResult = await getActiveCampForUser(userId);
  if (campResult.state !== "ok") return { ...campResult, courses: [] as CloudCourseSummary[] };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("get_course_schedule", { target_camp_id: campResult.camp.id })
    .order("day_number", { ascending: true });

  if (error) return { state: "database_error" as const, camp: campResult.camp, courses: [] };
  return {
    state: data?.length ? "ok" as const : "empty" as const,
    camp: campResult.camp,
    courses: (data as CourseScheduleRow[] | null)?.map(mapSummary) ?? [],
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

  const summary = mapSummary(courseRow);
  if (!summary.isUnlocked) {
    return { state: "locked" as const, camp: campResult.camp, course: summary };
  }

  const [
    { data: content, error: contentError },
    { data: vocabulary, error: vocabularyError },
    { data: audioRow, error: audioError },
  ] =
    await Promise.all([
      supabase
        .from("course_contents")
        .select("description, reading_text, reflection_prompt_zh, reflection_prompt_it")
        .eq("course_id", summary.id)
        .maybeSingle<{
          description: string | null;
          reading_text: string;
          reflection_prompt_zh: string | null;
          reflection_prompt_it: string | null;
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
    ]);

  if (contentError || vocabularyError || audioError || !content) {
    return { state: "database_error" as const, camp: campResult.camp, course: null };
  }

  const detail: CloudCourseDetail = {
    ...summary,
    description: content.description ?? "",
    readingText: content.reading_text,
    reflectionPromptZh: content.reflection_prompt_zh ?? "",
    reflectionPromptIt: content.reflection_prompt_it ?? "",
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
  };

  return { state: "ok" as const, camp: campResult.camp, course: detail };
}

export async function getAdminCourseList() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("get_course_schedule", { target_camp_id: null })
    .order("day_number", { ascending: true });

  return {
    error: Boolean(error),
    courses: (data as CourseScheduleRow[] | null)?.map(mapSummary) ?? [],
  };
}

export async function getAdminCourse(courseId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .rpc("get_course_schedule", { target_camp_id: null })
    .eq("id", courseId)
    .maybeSingle<CourseScheduleRow>();

  if (error || !row) return null;
  const summary = mapSummary(row);
  const [{ data: content }, { data: vocabulary }, { data: audioRow }] = await Promise.all([
    supabase
      .from("course_contents")
      .select("description, reading_text, reflection_prompt_zh, reflection_prompt_it")
      .eq("course_id", courseId)
      .maybeSingle<{
        description: string | null;
        reading_text: string;
        reflection_prompt_zh: string | null;
        reflection_prompt_it: string | null;
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
  ]);

  return {
    ...summary,
    description: content?.description ?? "",
    readingText: content?.reading_text ?? "",
    reflectionPromptZh: content?.reflection_prompt_zh ?? "",
    reflectionPromptIt: content?.reflection_prompt_it ?? "",
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
