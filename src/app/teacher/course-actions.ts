"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { validateCourseEditorInput, type CourseEditorInput } from "@/lib/cloud-course";
import { COURSE_AUDIO_BUCKET } from "@/lib/course-audio";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CourseActionResult = { success: boolean; message: string; courseId?: string };

function databaseFailure(): CourseActionResult {
  return { success: false, message: "保存失败，请稍后重试。" };
}

function revalidateCourseViews(courseId?: string) {
  revalidatePath("/home");
  revalidatePath("/courses");
  revalidatePath("/progress");
  revalidatePath("/teacher");
  revalidatePath("/teacher/camps");
  if (courseId) revalidatePath(`/teacher/courses/${courseId}/edit`);
}

async function replaceVocabulary(
  courseId: string,
  vocabulary: CourseEditorInput["vocabulary"],
) {
  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from("course_vocabulary")
    .delete()
    .eq("course_id", courseId);
  if (deleteError) return false;
  if (!vocabulary.length) return true;

  const { error: insertError } = await supabase.from("course_vocabulary").insert(
    vocabulary.map((item) => ({
      course_id: courseId,
      position: item.position,
      word: item.word.trim(),
      meaning_zh: item.meaningZh.trim() || null,
    })),
  );
  return !insertError;
}

export async function updateCloudCourse(
  courseId: string,
  input: CourseEditorInput,
): Promise<CourseActionResult> {
  const { profile } = await requireAdmin();
  const validationError = validateCourseEditorInput(input);
  if (validationError) return { success: false, message: validationError };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .maybeSingle();
  if (!existing) return { success: false, message: "课程不存在。" };

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      day_number: input.dayNumber,
      italian_title: input.italianTitle.trim(),
      chinese_title: input.chineseTitle.trim() || null,
      status: input.status,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);
  if (courseError) return databaseFailure();

  const { error: contentError } = await supabase.from("course_contents").upsert({
    course_id: courseId,
    description: input.description.trim() || null,
    reading_text: input.readingText.trim(),
    reflection_prompt_zh: input.reflectionPromptZh.trim() || null,
    reflection_prompt_it: input.reflectionPromptIt.trim() || null,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (contentError || !(await replaceVocabulary(courseId, input.vocabulary))) return databaseFailure();

  const { error: scheduleError } = await supabase.rpc("set_course_unlock_schedule", {
    target_course_id: courseId,
    target_mode: input.unlockMode,
    local_unlock_at: input.unlockMode === "manual" ? input.unlockAtLocal : null,
  });
  if (scheduleError) return databaseFailure();

  revalidateCourseViews(courseId);
  return { success: true, message: "保存成功。", courseId };
}

async function updateCourseStatus(
  courseId: string,
  input: { status: "archived" | "published" },
) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("courses")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", courseId);
  if (error) return databaseFailure();
  revalidateCourseViews(courseId);
  return {
    success: true,
    message: input.status === "archived" ? "课程已归档。" : "课程已重新启用。",
    courseId,
  } satisfies CourseActionResult;
}

export async function archiveCloudCourse(courseId: string): Promise<CourseActionResult> {
  return updateCourseStatus(courseId, { status: "archived" });
}

export async function reactivateCloudCourse(courseId: string): Promise<CourseActionResult> {
  return updateCourseStatus(courseId, { status: "published" });
}

export async function permanentlyDeleteCloudCourse(courseId: string): Promise<CourseActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("student_submissions")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  if (countError) return { success: false, message: "无法确认课程提交记录，请稍后重试。" };
  if ((count ?? 0) > 0) {
    return { success: false, message: "课程已有学生提交，不能永久删除；请使用归档。" };
  }

  const { data: audio } = await supabase
    .from("course_audio")
    .select("storage_path")
    .eq("course_id", courseId)
    .maybeSingle<{ storage_path: string }>();
  if (audio?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(COURSE_AUDIO_BUCKET)
      .remove([audio.storage_path]);
    if (storageError) return { success: false, message: "示范音频文件删除失败，请稍后重试。" };
  }

  const { error: deleteError } = await supabase.from("courses").delete().eq("id", courseId);
  if (deleteError) return { success: false, message: "课程删除失败；已有学生提交的课程只能归档。" };
  revalidateCourseViews();
  return { success: true, message: "课程已永久删除。" };
}

export async function createCloudCourse(
  campId: string,
  input: CourseEditorInput,
): Promise<CourseActionResult> {
  const { profile } = await requireAdmin();
  const validationError = validateCourseEditorInput(input);
  if (validationError) return { success: false, message: validationError };

  const supabase = await createSupabaseServerClient();
  const { data: camp } = await supabase.from("camps").select("id").eq("id", campId).maybeSingle();
  if (!camp) return { success: false, message: "训练营不存在或无权限。" };

  const { data: duplicate } = await supabase
    .from("courses")
    .select("id")
    .eq("camp_id", camp.id)
    .eq("day_number", input.dayNumber)
    .maybeSingle();
  if (duplicate) {
    return { success: false, message: `该训练营中已存在 Giorno ${input.dayNumber}。` };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      camp_id: camp.id,
      day_number: input.dayNumber,
      italian_title: input.italianTitle.trim(),
      chinese_title: input.chineseTitle.trim() || null,
      status: input.status,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (courseError || !course) return databaseFailure();

  const { error: contentError } = await supabase.from("course_contents").insert({
    course_id: course.id,
    description: input.description.trim() || null,
    reading_text: input.readingText.trim(),
    reflection_prompt_zh: input.reflectionPromptZh.trim() || null,
    reflection_prompt_it: input.reflectionPromptIt.trim() || null,
    updated_by: profile.id,
  });

  const { error: scheduleError } = await supabase.rpc("set_course_unlock_schedule", {
    target_course_id: course.id,
    target_mode: input.unlockMode,
    local_unlock_at: input.unlockMode === "manual" ? input.unlockAtLocal : null,
  });

  if (contentError || scheduleError || !(await replaceVocabulary(course.id, input.vocabulary))) {
    await supabase.from("courses").delete().eq("id", course.id);
    return databaseFailure();
  }

  revalidateCourseViews(course.id);
  return { success: true, message: "课程创建成功。", courseId: course.id };
}
