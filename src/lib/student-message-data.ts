import "server-only";

import { cache } from "react";
import { getActiveCampForUser } from "./cloud-course-data";
import {
  buildStudentMessages,
  type StudentMessageCommentRow,
  type StudentMessageTarget,
} from "./student-message";
import { createSupabaseServerClient } from "./supabase/server";
import { getVisibleIdentityLabels } from "./identity-label-data";
import {
  STUDENT_MESSAGE_PAGE_SIZE,
  selectStudentMessagePage,
  type StudentMessageCursor,
} from "./student-message-feed";

type WorkRow = {
  id: string;
  user_id: string;
  student_display_name: string;
  courses: { day_number: number; italian_title: string } | null;
};

const workSelection = "id, user_id, student_display_name, courses(day_number, italian_title)";
const commentSelection = "id, submission_id, assignment_submission_id, user_id, author_display_name, author_role, content, parent_comment_id, audio_storage_path, image_storage_path, created_at";
const CURSOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILTER_CHUNK_SIZE = 40;

function chunks<T>(values: T[]) {
  return Array.from({ length: Math.ceil(values.length / FILTER_CHUNK_SIZE) }, (_, index) => (
    values.slice(index * FILTER_CHUNK_SIZE, (index + 1) * FILTER_CHUNK_SIZE)
  ));
}

export function encodeStudentMessageCursor(cursor: StudentMessageCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeStudentMessageCursor(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<StudentMessageCursor>;
    if (
      typeof parsed.createdAt !== "string"
      || !Number.isFinite(Date.parse(parsed.createdAt))
      || typeof parsed.id !== "string"
      || !CURSOR_ID_PATTERN.test(parsed.id)
    ) return undefined;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return undefined;
  }
}

function applyMessageCursor<T extends { or: (filter: string) => T }>(query: T, cursor: StudentMessageCursor | null) {
  if (!cursor) return query;
  return query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
}

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

  const commentResults = await Promise.all(chunks(targetIds).map((chunkIds) => supabase
    .from("submission_comments")
    .select(commentSelection)
    .or(`submission_id.in.(${chunkIds.join(",")}),assignment_submission_id.in.(${chunkIds.join(",")})`)));
  if (commentResults.some((result) => result.error)) {
    return { state: "database_error" as const, camp: campResult.camp, messages: [], unreadCount: 0 };
  }

  const readResult = await supabase
    .from("submission_comment_reads")
    .select("comment_id")
    .eq("user_id", userId);
  if (readResult.error) {
    return { state: "database_error" as const, camp: campResult.camp, messages: [], unreadCount: 0 };
  }

  const commentsById = new Map<string, StudentMessageCommentRow>();
  for (const result of commentResults) {
    for (const comment of (result.data ?? []) as unknown as StudentMessageCommentRow[]) commentsById.set(comment.id, comment);
  }
  const comments = [...commentsById.values()];
  const identityLabels = await getVisibleIdentityLabels(comments.map((comment) => comment.user_id));
  const messages = buildStudentMessages({
    comments: comments.map((comment) => ({ ...comment, identity_label: identityLabels.get(comment.user_id) })),
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

export async function getStudentMessagePage(userId: string, cursor: StudentMessageCursor | null = null) {
  const campResult = await getActiveCampForUser(userId);
  if (campResult.state !== "ok") {
    return { state: campResult.state, camp: campResult.camp ?? null, messages: [], nextCursor: null } as const;
  }

  const supabase = await createSupabaseServerClient();
  const [submissionResult, assignmentResult] = await Promise.all([
    supabase.from("student_submissions").select(workSelection).eq("camp_id", campResult.camp.id),
    supabase.from("student_assignment_submissions").select(workSelection).eq("camp_id", campResult.camp.id),
  ]);
  if (submissionResult.error || assignmentResult.error) {
    return { state: "database_error" as const, camp: campResult.camp, messages: [], nextCursor: null };
  }

  const targetsById = new Map<string, StudentMessageTarget>();
  for (const row of (submissionResult.data ?? []) as unknown as WorkRow[]) targetsById.set(row.id, toTarget(row));
  for (const row of (assignmentResult.data ?? []) as unknown as WorkRow[]) targetsById.set(row.id, toTarget(row));
  const targets = [...targetsById.values()];
  const ownTargetIds = targets.filter((target) => target.userId === userId).map((target) => target.id);
  const allTargetIds = targets.map((target) => target.id);

  const ownCommentResults = await Promise.all(chunks(allTargetIds).map((targetIds) => supabase
    .from("submission_comments")
    .select(commentSelection)
    .eq("user_id", userId)
    .or(`submission_id.in.(${targetIds.join(",")}),assignment_submission_id.in.(${targetIds.join(",")})`)));
  if (ownCommentResults.some((result) => result.error)) {
    return { state: "database_error" as const, camp: campResult.camp, messages: [], nextCursor: null };
  }
  const ownComments = ownCommentResults.flatMap((result) => (
    (result.data ?? []) as unknown as StudentMessageCommentRow[]
  ));
  const ownCommentIds = ownComments.map((comment) => comment.id);
  const candidateLimit = STUDENT_MESSAGE_PAGE_SIZE + 1;

  const ownWorkQueries = chunks(ownTargetIds).map((targetIds) => {
    let query = supabase
      .from("submission_comments")
      .select(commentSelection)
      .neq("user_id", userId)
      .or(`submission_id.in.(${targetIds.join(",")}),assignment_submission_id.in.(${targetIds.join(",")})`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(candidateLimit);
    query = applyMessageCursor(query, cursor);
    return query;
  });
  const replyQueries = chunks(ownCommentIds).map((commentIds) => {
    let query = supabase
      .from("submission_comments")
      .select(commentSelection)
      .neq("user_id", userId)
      .in("parent_comment_id", commentIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(candidateLimit);
    query = applyMessageCursor(query, cursor);
    return query;
  });
  const candidateResults = await Promise.all([...ownWorkQueries, ...replyQueries]);
  if (candidateResults.some((result) => result.error)) {
    return { state: "database_error" as const, camp: campResult.camp, messages: [], nextCursor: null };
  }

  const candidatesById = new Map<string, StudentMessageCommentRow>();
  for (const result of candidateResults) {
    for (const row of (result.data ?? []) as unknown as StudentMessageCommentRow[]) {
      const targetId = row.assignment_submission_id ?? row.submission_id;
      if (targetId && targetsById.has(targetId)) candidatesById.set(row.id, row);
    }
  }
  const candidates = [...candidatesById.values()];
  const readResult = candidates.length
    ? await supabase.from("submission_comment_reads").select("comment_id").eq("user_id", userId).in("comment_id", candidates.map((row) => row.id))
    : { data: [], error: null };
  if (readResult.error) {
    return { state: "database_error" as const, camp: campResult.camp, messages: [], nextCursor: null };
  }
  const identityLabels = await getVisibleIdentityLabels(candidates.map((comment) => comment.user_id));
  const messages = buildStudentMessages({
    comments: [
      ...candidates.map((comment) => ({ ...comment, identity_label: identityLabels.get(comment.user_id) })),
      ...ownComments,
    ],
    targets,
    readCommentIds: new Set((readResult.data ?? []).map((row) => row.comment_id as string)),
    currentUserId: userId,
  });
  const { page, hasMore } = selectStudentMessagePage(messages);
  const lastMessage = page.at(-1);
  return {
    state: "ok" as const,
    camp: campResult.camp,
    messages: page,
    nextCursor: hasMore && lastMessage ? encodeStudentMessageCursor({ createdAt: lastMessage.createdAt, id: lastMessage.id }) : null,
  };
}
