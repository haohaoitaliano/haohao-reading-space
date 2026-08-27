"use client";

import { useState } from "react";
import type { CloudSubmission, SubmissionComment } from "@/lib/circle-submission";
import {
  countCommentCharacters,
  normalizeSubmissionComment,
  SUBMISSION_COMMENT_MAX_LENGTH,
  validateSubmissionComment,
} from "@/lib/submission-interaction";

type ApiMessage = { message?: string };

async function readJson<T>(response: Response) {
  return response.json().catch(() => ({})) as Promise<T & ApiMessage>;
}

export function SubmissionInteractions({ submission }: { submission: CloudSubmission }) {
  const [encouragementCount, setEncouragementCount] = useState(submission.encouragementCount);
  const [hasEncouraged, setHasEncouraged] = useState(submission.hasEncouraged);
  const [encouragementBusy, setEncouragementBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(submission.comments);
  const [content, setContent] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState("");
  const [message, setMessage] = useState("");
  const characterCount = countCommentCharacters(content);
  const validationError = validateSubmissionComment(content);

  async function toggleEncouragement() {
    if (encouragementBusy || submission.isOwn) return;
    const previousCount = encouragementCount;
    const previousState = hasEncouraged;
    const nextState = !previousState;
    setEncouragementBusy(true);
    setMessage("");
    setHasEncouraged(nextState);
    setEncouragementCount(Math.max(0, previousCount + (nextState ? 1 : -1)));

    try {
      const response = await fetch(
        `/api/student/submissions/${encodeURIComponent(submission.id)}/encouragement`,
        { method: nextState ? "POST" : "DELETE" },
      );
      const result = await readJson<{ count?: number; encouraged?: boolean }>(response);
      if (!response.ok) throw new Error(result.message || "操作失败，请稍后重试。");
      if (typeof result.count === "number") setEncouragementCount(result.count);
      if (typeof result.encouraged === "boolean") setHasEncouraged(result.encouraged);
    } catch (error) {
      setEncouragementCount(previousCount);
      setHasEncouraged(previousState);
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    } finally {
      setEncouragementBusy(false);
    }
  }

  async function sendComment() {
    if (commentBusy || validationError) return;
    const trimmedContent = normalizeSubmissionComment(content);
    const temporaryId = `temporary-${Date.now()}`;
    const optimisticComment: SubmissionComment = {
      id: temporaryId,
      authorName: "我",
      content: trimmedContent,
      createdAt: new Date().toISOString(),
      isOwn: true,
    };
    setCommentBusy(true);
    setMessage("");
    setContent("");
    setComments((current) => [...current, optimisticComment]);

    try {
      const response = await fetch(
        `/api/student/submissions/${encodeURIComponent(submission.id)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmedContent }),
        },
      );
      const result = await readJson<{ comment?: SubmissionComment }>(response);
      if (!response.ok || !result.comment) {
        throw new Error(result.message || "评论发送失败，请稍后重试。");
      }
      setComments((current) => current.map((comment) => (
        comment.id === temporaryId ? result.comment! : comment
      )));
    } catch (error) {
      setComments((current) => current.filter((comment) => comment.id !== temporaryId));
      setContent(trimmedContent);
      setMessage(error instanceof Error ? error.message : "评论发送失败，请稍后重试。");
    } finally {
      setCommentBusy(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (deletingCommentId || commentId.startsWith("temporary-")) return;
    const previousComments = comments;
    setDeletingCommentId(commentId);
    setMessage("");
    setComments((current) => current.filter((comment) => comment.id !== commentId));

    try {
      const response = await fetch(
        `/api/student/submissions/${encodeURIComponent(submission.id)}/comments/${encodeURIComponent(commentId)}`,
        { method: "DELETE" },
      );
      const result = await readJson<Record<string, never>>(response);
      if (!response.ok) throw new Error(result.message || "删除评论失败，请稍后重试。");
    } catch (error) {
      setComments(previousComments);
      setMessage(error instanceof Error ? error.message : "删除评论失败，请稍后重试。");
    } finally {
      setDeletingCommentId("");
    }
  }

  return (
    <section className="submission-interactions" aria-label="鼓励和评论">
      <div className="submission-interaction-actions">
        {submission.isOwn ? (
          <span className="submission-interaction-static">👏 鼓励 {encouragementCount}</span>
        ) : (
          <button
            aria-pressed={hasEncouraged}
            className="submission-interaction-button"
            disabled={encouragementBusy}
            onClick={() => void toggleEncouragement()}
            type="button"
          >
            👏 {hasEncouraged ? "已鼓励" : "鼓励"} {encouragementCount}
          </button>
        )}
        <button
          aria-expanded={commentsOpen}
          className="submission-interaction-button"
          onClick={() => setCommentsOpen((current) => !current)}
          type="button"
        >
          💬 评论 {comments.length}
        </button>
      </div>

      {commentsOpen ? (
        <div className="submission-comments">
          {comments.length > 0 ? (
            <div className="submission-comment-list">
              {comments.map((comment) => (
                <div className="submission-comment" key={comment.id}>
                  <div>
                    <strong>{comment.authorName}</strong>
                    <p>{comment.content}</p>
                  </div>
                  {comment.isOwn ? (
                    <button
                      className="submission-comment-delete"
                      disabled={deletingCommentId === comment.id || comment.id.startsWith("temporary-")}
                      onClick={() => void deleteComment(comment.id)}
                      type="button"
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <label className="submission-comment-composer">
            <span className="sr-only">写评论</span>
            <textarea
              disabled={commentBusy}
              onChange={(event) => setContent(event.target.value)}
              placeholder="写下你的鼓励……"
              rows={2}
              value={content}
            />
            <span className={characterCount > SUBMISSION_COMMENT_MAX_LENGTH ? "comment-count over-limit" : "comment-count"}>
              {characterCount} / {SUBMISSION_COMMENT_MAX_LENGTH}
            </span>
          </label>
          <button
            className="button secondary submission-comment-send"
            disabled={commentBusy || Boolean(validationError)}
            onClick={() => void sendComment()}
            type="button"
          >
            {commentBusy ? "发送中…" : "发送"}
          </button>
        </div>
      ) : null}
      {message ? <p className="submission-interaction-message" role="alert">{message}</p> : null}
    </section>
  );
}
