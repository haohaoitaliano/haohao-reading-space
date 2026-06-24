"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { validateCourseEditorInput, type CourseEditorInput } from "@/lib/cloud-course";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CourseActionResult = { success: boolean; message: string; courseId?: string };

function databaseFailure(): CourseActionResult {
  return { success: false, message: "保存失败，请稍后重试。" };
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

  revalidatePath("/home");
  revalidatePath("/courses");
  revalidatePath("/progress");
  revalidatePath("/teacher");
  revalidatePath(`/teacher/courses/${courseId}/edit`);
  return { success: true, message: "保存成功。", courseId };
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

  revalidatePath("/teacher");
  revalidatePath("/courses");
  return { success: true, message: "课程创建成功。", courseId: course.id };
}
