import "server-only";

import { isCourseUnlocked, type CloudCourseStatus, type CloudVocabularyItem } from "./cloud-course";
import { createSupabaseServerClient } from "./supabase/server";

export type CloudCamp = {
  id: string;
  name: string;
  slug: string;
};

export type CloudCourseSummary = {
  id: string;
  campId: string;
  dayNumber: number;
  italianTitle: string;
  chineseTitle: string;
  unlockAt: string | null;
  status: CloudCourseStatus;
  isUnlocked: boolean;
};

export type CloudCourseDetail = CloudCourseSummary & {
  description: string;
  readingText: string;
  reflectionPromptZh: string;
  reflectionPromptIt: string;
  vocabulary: CloudVocabularyItem[];
};

type CourseRow = {
  id: string;
  camp_id: string;
  day_number: number;
  italian_title: string;
  chinese_title: string | null;
  unlock_at: string | null;
  status: CloudCourseStatus;
};

function mapSummary(row: CourseRow): CloudCourseSummary {
  return {
    id: row.id,
    campId: row.camp_id,
    dayNumber: row.day_number,
    italianTitle: row.italian_title,
    chineseTitle: row.chinese_title ?? "",
    unlockAt: row.unlock_at,
    status: row.status,
    isUnlocked: isCourseUnlocked(row.unlock_at),
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
    .select("id, name, slug")
    .eq("id", membership.camp_id)
    .eq("status", "active")
    .maybeSingle<CloudCamp>();

  if (campError) return { state: "database_error" as const, camp: null };
  if (!camp) return { state: "no_membership" as const, camp: null };
  return { state: "ok" as const, camp };
}

export async function getStudentCourseList(userId: string) {
  const campResult = await getActiveCampForUser(userId);
  if (campResult.state !== "ok") return { ...campResult, courses: [] as CloudCourseSummary[] };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, camp_id, day_number, italian_title, chinese_title, unlock_at, status")
    .eq("camp_id", campResult.camp.id)
    .order("day_number", { ascending: true });

  if (error) return { state: "database_error" as const, camp: campResult.camp, courses: [] };
  return {
    state: data?.length ? "ok" as const : "empty" as const,
    camp: campResult.camp,
    courses: (data as CourseRow[] | null)?.map(mapSummary) ?? [],
  };
}

export async function getStudentCourseByDay(userId: string, dayNumber: number) {
  const campResult = await getActiveCampForUser(userId);
  if (campResult.state !== "ok") return { state: campResult.state, camp: null, course: null };

  const supabase = await createSupabaseServerClient();
  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .select("id, camp_id, day_number, italian_title, chinese_title, unlock_at, status")
    .eq("camp_id", campResult.camp.id)
    .eq("day_number", dayNumber)
    .maybeSingle<CourseRow>();

  if (courseError) return { state: "database_error" as const, camp: campResult.camp, course: null };
  if (!courseRow) return { state: "not_found" as const, camp: campResult.camp, course: null };

  const summary = mapSummary(courseRow);
  if (!summary.isUnlocked) {
    return { state: "locked" as const, camp: campResult.camp, course: summary };
  }

  const [{ data: content, error: contentError }, { data: vocabulary, error: vocabularyError }] =
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
    ]);

  if (contentError || vocabularyError || !content) {
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
  };

  return { state: "ok" as const, camp: campResult.camp, course: detail };
}

export async function getAdminCourseList() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, camp_id, day_number, italian_title, chinese_title, unlock_at, status")
    .order("day_number", { ascending: true });

  return {
    error: Boolean(error),
    courses: (data as CourseRow[] | null)?.map(mapSummary) ?? [],
  };
}

export async function getAdminCourse(courseId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("courses")
    .select("id, camp_id, day_number, italian_title, chinese_title, unlock_at, status")
    .eq("id", courseId)
    .maybeSingle<CourseRow>();

  if (error || !row) return null;
  const summary = mapSummary(row);
  const [{ data: content }, { data: vocabulary }] = await Promise.all([
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
  } satisfies CloudCourseDetail;
}

export async function getAdminCampOptions() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("camps")
    .select("id, name, slug")
    .order("created_at", { ascending: true });
  return (data ?? []) as CloudCamp[];
}
