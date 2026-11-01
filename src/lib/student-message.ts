export type StudentMessageTarget = {
  id: string;
  userId: string;
  studentName: string;
  dayNumber: number;
  courseTitle: string;
};

export type StudentMessageCommentRow = {
  id: string;
  submission_id: string | null;
  assignment_submission_id: string | null;
  user_id: string;
  author_display_name: string;
  author_role: "admin" | "student";
  content: string | null;
  parent_comment_id: string | null;
  audio_storage_path: string | null;
  image_storage_path: string | null;
  created_at: string;
};

export type StudentMessage = {
  id: string;
  targetId: string;
  authorName: string;
  authorRole: "admin" | "student";
  content: string;
  createdAt: string;
  dayNumber: number;
  courseTitle: string;
  workOwnerName: string;
  isRead: boolean;
};

function getMessageContent(row: StudentMessageCommentRow) {
  if (row.content?.trim()) return row.content;
  if (row.audio_storage_path && row.image_storage_path) return "语音和照片评论";
  if (row.audio_storage_path) return "语音评论";
  if (row.image_storage_path) return "照片评论";
  return "评论";
}

export function buildStudentMessages(input: {
  comments: StudentMessageCommentRow[];
  targets: StudentMessageTarget[];
  readCommentIds: Set<string>;
  currentUserId: string;
}) {
  const targetsById = new Map(input.targets.map((target) => [target.id, target]));
  const commentsById = new Map(input.comments.map((comment) => [comment.id, comment]));
  const messages = new Map<string, StudentMessage>();

  for (const comment of input.comments) {
    if (comment.user_id === input.currentUserId) continue;
    const targetId = comment.assignment_submission_id ?? comment.submission_id;
    if (!targetId) continue;
    const target = targetsById.get(targetId);
    if (!target) continue;

    const parent = comment.parent_comment_id
      ? commentsById.get(comment.parent_comment_id)
      : null;
    const commentsOnOwnWork = target.userId === input.currentUserId;
    const repliesToOwnComment = parent?.user_id === input.currentUserId;
    if (!commentsOnOwnWork && !repliesToOwnComment) continue;

    messages.set(comment.id, {
      id: comment.id,
      targetId,
      authorName: comment.author_display_name.trim() || "同学",
      authorRole: comment.author_role,
      content: getMessageContent(comment),
      createdAt: comment.created_at,
      dayNumber: target.dayNumber,
      courseTitle: target.courseTitle,
      workOwnerName: target.studentName,
      isRead: input.readCommentIds.has(comment.id),
    });
  }

  return [...messages.values()].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}
