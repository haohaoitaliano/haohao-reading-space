export const SUBMISSION_COMMENT_MAX_LENGTH = 1000;

export function countCommentCharacters(value: string) {
  return Array.from(value).length;
}

export function normalizeSubmissionComment(value: string) {
  return value.trim();
}

export function validateSubmissionComment(value: string, hasAttachment = false) {
  const normalized = normalizeSubmissionComment(value);
  if (!normalized && !hasAttachment) return "请填写文字，或添加录音/照片。";
  if (countCommentCharacters(normalized) > SUBMISSION_COMMENT_MAX_LENGTH) {
    return `评论最多 ${SUBMISSION_COMMENT_MAX_LENGTH} 字。`;
  }
  return null;
}
