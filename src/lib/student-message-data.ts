import "server-only";

import { cache } from "react";
import { getActiveCampForUser } from "./cloud-course-data";
import {
  buildStudentMessages,
  type StudentMessageCommentRow,
  type StudentMessageTarget,
} from "./student-message";
import { createSupabaseServerClient } from "./supabase/server";

type WorkRow = {
  id: string;
  user_id: string;
  student_display_name: string;
  courses: { day_number: number; italian_title: string } | null;
};

const workSelection = "id, user_id, student_display_name, courses(day_number, italian_title)";
const commentSelection = "id, submission_id, assignment_submission_id, user_id, author_display_name, author_role, content, parent_comment_id, audio_storage_path, image_storage_path, created_at";

function toTarget(row: WorkRow): StudentMessageTarget {
  return {
    id: row.id,
    userId: row.user_id,
    studentName: row.student_display_name.trim() || "同学",
    dayNumber: row.courses?.day_number ?? 0,
    courseTitle: row.courses?.italian_title ?? "课程",
  };
}

export const getStudentMessages = cache(async (userId: string) => {
  const campResult = await getActiveCampForUser(userId);
  if (campResult.state !== "ok") {
    return {
      state: campResult.state,
      camp: campResult.camp ?? null,
      messages: [],
      unreadCount: 0,
    } as const;
  }

  const supabase = await createSupabaseServerClient();
  const [submissionResult, assignmentResult] = await Promise.all([
    supabase
      .from("student_submissions")
      .select(workSelection)
      .eq("camp_id", campResult.camp.id),
    supabase
      .from("student_assignment_submissions")
      .select(workSelection)
      .eq("camp_id", campResult.camp.id),
  ]);

  if (submissionResult.error || assignmentResult.error) {
    return { state: "database_error" as const, camp: campResult.camp, messages: [], unreadCount: 0 };
  }

  const targetsById = new Map<string, StudentMessageTarget>();
  for (const row of (submissionResult.data ?? []) as unknown as WorkRow[]) {
    targetsById.set(row.id, toTarget(row));
  }
  for (const row of (assignmentResult.data ?? []) as unknown as WorkRow[]) {
    targetsById.set(row.id, toTarget(row));
  }
  const targets = [...targetsById.values()];
  const targetIds = targets.map((target) => target.id);

  const commentResult = targetIds.length
    ? await supabase
      .from("submission_comments")
      .select(commentSelection)
      .or(`submission_id.in.(${targetIds.join(",")}),assignment_submission_id.in.(${targetIds.join(",")})`)
    : { data: [], error: null };
  if (commentResult.error) {
    return { state: "database_error" as const, camp: campResult.camp, messages: [], unreadCount: 0 };
  }

  const readResult = await supabase
    .from("submission_comment_reads")
    .select("comment_id")
    .eq("user_id", userId);
  if (readResult.error) {
    return { state: "database_error" as const, camp: campResult.camp, messages: [], unreadCount: 0 };
  }

  const messages = buildStudentMessages({
    comments: (commentResult.data ?? []) as unknown as StudentMessageCommentRow[],
    targets,
    readCommentIds: new Set((readResult.data ?? []).map((row) => row.comment_id as string)),
    currentUserId: userId,
  });

  return {
    state: "ok" as const,
    camp: campResult.camp,
    messages,
    unreadCount: messages.filter((message) => !message.isRead).length,
  };
});
