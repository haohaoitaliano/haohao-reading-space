import "server-only";

import {
  CIRCLE_PAGE_SIZE,
  selectCirclePageCandidates,
  type CircleCandidate,
  type CircleCard,
  type CircleCursor,
} from "./circle-feed";
import { getCampCircleSubmissions } from "./cloud-submission-data";
import { getCampUnifiedAssignments } from "./photo-submission-data";
import { createSupabaseServerClient } from "./supabase/server";

const CURSOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeCircleCursor(cursor: CircleCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCircleCursor(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<CircleCursor>;
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

function applyCursor<T extends {
  or: (filter: string) => T;
}>(query: T, cursor: CircleCursor | null) {
  if (!cursor) return query;
  return query.or(
    `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  );
}

export async function getCampCirclePage(
  campId: string,
  currentUserId: string,
  cursor: CircleCursor | null = null,
) {
  const supabase = await createSupabaseServerClient();
  const candidateLimit = CIRCLE_PAGE_SIZE + 1;
  let recordingQuery = supabase
    .from("student_submissions")
    .select("id, created_at")
    .eq("camp_id", campId)
    .or(`visibility.eq.public,user_id.eq.${currentUserId}`)
    .is("assignment_submission_id", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(candidateLimit);
  let assignmentQuery = supabase
    .from("student_assignment_submissions")
    .select("id, created_at")
    .eq("camp_id", campId)
    .or(`visibility.eq.public,user_id.eq.${currentUserId}`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(candidateLimit);
  recordingQuery = applyCursor(recordingQuery, cursor);
  assignmentQuery = applyCursor(assignmentQuery, cursor);

  const [recordingCandidates, assignmentCandidates] = await Promise.all([
    recordingQuery,
    assignmentQuery,
  ]);
  if (recordingCandidates.error || assignmentCandidates.error) {
    return { cards: [] as CircleCard[], nextCursor: null, error: true };
  }

  const candidates: CircleCandidate[] = [
    ...(recordingCandidates.data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      source: "recording" as const,
    })),
    ...(assignmentCandidates.data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      source: "assignment" as const,
    })),
  ];
  const { page, hasMore } = selectCirclePageCandidates(candidates);
  const pageIds = page.map((candidate) => candidate.id);
  if (pageIds.length === 0) {
    return { cards: [] as CircleCard[], nextCursor: null, error: false };
  }

  const [recordingResult, assignmentResult] = await Promise.all([
    getCampCircleSubmissions(campId, currentUserId, pageIds),
    getCampUnifiedAssignments(campId, currentUserId, pageIds),
  ]);
  if (recordingResult.error || assignmentResult.error) {
    return { cards: [] as CircleCard[], nextCursor: null, error: true };
  }

  const recordingsById = new Map(recordingResult.submissions.map((submission) => [submission.id, submission]));
  const assignmentsById = new Map(assignmentResult.assignments.map((assignment) => [assignment.assignmentId, assignment]));
  const cards = page.flatMap((candidate) => {
    const assignment = assignmentsById.get(candidate.id);
    const recording = recordingsById.get(candidate.id);
    if (recording) {
      return [{
        submission: assignment
          ? { ...recording, version: assignment.version, createdAt: assignment.createdAt }
          : recording,
        ...(assignment ? { assignment } : {}),
      }];
    }
    if (!assignment) return [];
    return [{
      assignment,
      submission: {
        id: assignment.assignmentId,
        courseId: assignment.courseId,
        dayNumber: assignment.dayNumber,
        courseTitle: assignment.courseTitle,
        studentName: assignment.studentName,
        identityLabel: assignment.identityLabel,
        durationSeconds: 0,
        targetDurationSeconds: null,
        visibility: assignment.visibility,
        version: assignment.version,
        createdAt: assignment.createdAt,
        audioUrl: "",
        isOwn: assignment.isOwn,
        encouragementCount: 0,
        hasEncouraged: false,
        commentCount: assignment.commentCount,
        comments: [],
      },
    }];
  });
  const lastCandidate = page.at(-1);
  return {
    cards,
    nextCursor: hasMore && lastCandidate ? encodeCircleCursor(lastCandidate) : null,
    error: false,
  };
}
