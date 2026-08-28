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
  user_id: string;
  student_display_name: string;
  duration_seconds: number;
  visibility: "public" | "teacher_only";
  version: number;
  created_at: string;
  courses: {
    day_number: number;
    italian_title: string;
  } | null;
};

type EncouragementRow = {
  submission_id: string;
  user_id: string;
};

type CommentRow = {
  id: string;
  submission_id: string;
  user_id: string;
  author_display_name: string;
  content: string;
  created_at: string;
};

function mapRow(row: SubmissionRow, targetDurations = new Map<string, number | null>()): SubmissionPresentationRow {
  return {
    id: row.id,
    campId: row.camp_id,
    courseId: row.course_id,
    userId: row.user_id,
    dayNumber: row.courses?.day_number ?? 0,
    courseTitle: row.courses?.italian_title ?? "课程",
    studentName: row.student_display_name,
    durationSeconds: Number(row.duration_seconds),
    targetDurationSeconds: targetDurations.get(row.course_id) ?? null,
    visibility: row.visibility,
    version: row.version,
    createdAt: row.created_at,
  };
}

const selection = "id, camp_id, course_id, user_id, student_display_name, duration_seconds, visibility, version, created_at, courses(day_number, italian_title)";

async function getTargetDurations(campId: string | null) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_course_schedule", { target_camp_id: campId });
  return new Map(
    ((data ?? []) as Array<{ id: string; target_duration_seconds?: number | null }>).map((course) => [
      course.id,
      Number.isInteger(course.target_duration_seconds) && Number(course.target_duration_seconds) > 0
        ? Number(course.target_duration_seconds)
        : null,
    ]),
  );
}

export async function getOwnCloudSubmissions(userId: string, campId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, targetDurations] = await Promise.all([
    supabase
      .from("student_submissions")
      .select(selection)
      .eq("user_id", userId)
      .eq("camp_id", campId)
      .order("created_at", { ascending: false }),
    getTargetDurations(campId),
  ]);
  if (error) return { submissions: [] as CloudSubmission[], error: true };
  return {
    submissions: ((data ?? []) as unknown as SubmissionRow[])
      .map((row) => mapRow(row, targetDurations))
      .map((row) => toCloudSubmission(row, userId)),
    error: false,
  };
}

export async function getPublicCampSubmissions(
  campId: string,
  currentUserId: string,
  limit?: number,
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_submissions")
    .select(selection)
    .eq("camp_id", campId)
    .eq("visibility", "public")
    .neq("user_id", currentUserId)
    .order("created_at", { ascending: false });

  if (limit !== undefined) {
    query = query.limit(Math.max(1, Math.min(100, Math.trunc(limit))));
  }

  const [{ data, error }, targetDurations] = await Promise.all([query, getTargetDurations(campId)]);
  if (error) return { submissions: [] as CloudSubmission[], error: true };
  return {
    submissions: buildCircleSubmissions(
      ((data ?? []) as unknown as SubmissionRow[]).map((row) => mapRow(row, targetDurations)),
      campId,
    ),
    error: false,
  };
}

export async function getCampCircleSubmissions(campId: string, currentUserId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, targetDurations] = await Promise.all([
    supabase
      .from("student_submissions")
      .select(selection)
      .eq("camp_id", campId)
      .or(`visibility.eq.public,user_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false }),
    getTargetDurations(campId),
  ]);

  if (error) return { submissions: [] as CloudSubmission[], error: true };
  const submissions = buildCircleSubmissions(
    ((data ?? []) as unknown as SubmissionRow[]).map((row) => mapRow(row, targetDurations)),
    campId,
    currentUserId,
  );
  const publicSubmissionIds = submissions
    .filter((submission) => submission.visibility === "public")
    .map((submission) => submission.id);

  if (publicSubmissionIds.length === 0) {
    return { submissions, error: false };
  }

  const [encouragementResult, commentResult] = await Promise.all([
    supabase
      .from("submission_encouragements")
      .select("submission_id, user_id")
      .in("submission_id", publicSubmissionIds),
    supabase
      .from("submission_comments")
      .select("id, submission_id, user_id, author_display_name, content, created_at")
      .in("submission_id", publicSubmissionIds)
      .order("created_at", { ascending: true }),
  ]);

  if (encouragementResult.error || commentResult.error) {
    return { submissions: [] as CloudSubmission[], error: true };
  }

  const encouragements = (encouragementResult.data ?? []) as EncouragementRow[];
  const comments = (commentResult.data ?? []) as CommentRow[];
  const encouragementsBySubmission = new Map<string, EncouragementRow[]>();
  const commentsBySubmission = new Map<string, CommentRow[]>();

  for (const encouragement of encouragements) {
    const current = encouragementsBySubmission.get(encouragement.submission_id) ?? [];
    current.push(encouragement);
    encouragementsBySubmission.set(encouragement.submission_id, current);
  }
  for (const comment of comments) {
    const current = commentsBySubmission.get(comment.submission_id) ?? [];
    current.push(comment);
    commentsBySubmission.set(comment.submission_id, current);
  }

  return {
    submissions: submissions.map((submission) => {
      const submissionEncouragements = encouragementsBySubmission.get(submission.id) ?? [];
      const submissionComments = commentsBySubmission.get(submission.id) ?? [];
      return {
        ...submission,
        encouragementCount: submissionEncouragements.length,
        hasEncouraged: submissionEncouragements.some((item) => item.user_id === currentUserId),
        commentCount: submissionComments.length,
        comments: submissionComments.map((comment) => ({
          id: comment.id,
          authorName: comment.author_display_name.trim() || "同学",
          content: comment.content,
          createdAt: comment.created_at,
          isOwn: comment.user_id === currentUserId,
        })),
      };
    }),
    error: false,
  };
}

export async function getAdminCloudSubmissions() {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, targetDurations] = await Promise.all([
    supabase
      .from("student_submissions")
      .select(selection)
      .order("created_at", { ascending: false }),
    getTargetDurations(null),
  ]);
  if (error) return { submissions: [] as CloudSubmission[], error: true };
  return {
    submissions: ((data ?? []) as unknown as SubmissionRow[])
      .map((row) => mapRow(row, targetDurations))
      .map((row) => toCloudSubmission(row)),
    error: false,
  };
}
