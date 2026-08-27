export const SUBMISSION_COMMENT_MAX_LENGTH = 100;

export function countCommentCharacters(value: string) {
  return Array.from(value).length;
}

export function normalizeSubmissionComment(value: string) {
  return value.trim();
}

export function validateSubmissionComment(value: string) {
  const normalized = normalizeSubmissionComment(value);
  if (!normalized) return "评论不能为空。";
  if (countCommentCharacters(normalized) > SUBMISSION_COMMENT_MAX_LENGTH) {
    return `评论最多 ${SUBMISSION_COMMENT_MAX_LENGTH} 字。`;
  }
  return null;
}
