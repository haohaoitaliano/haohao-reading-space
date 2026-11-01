"use client";

import { Reply, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CloudSubmission, SubmissionComment } from "@/lib/circle-submission";
import {
  countCommentCharacters,
  SUBMISSION_COMMENT_MAX_LENGTH,
  validateSubmissionComment,
} from "@/lib/submission-interaction";
import {
  SubmissionCommentMediaPicker,
  type PreparedCommentAudio,
} from "./SubmissionCommentMediaPicker";
import { useStudentMessageUnread } from "./StudentMessageUnread";

type ApiMessage = { message?: string };

async function readJson<T>(response: Response) {
  return response.json().catch(() => ({})) as Promise<T & ApiMessage>;
}

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function CommentAudioPlayer({ endpoint }: { endpoint: string }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"loading" | "processing" | "ready" | "error">("loading");
  useEffect(() => {
    let stopped = false;
    let timeoutId: number | undefined;
    async function load() {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const result = await readJson<{ url?: string; retryAfterSeconds?: number }>(response);
        if (stopped) return;
        if (response.status === 202) {
          setState("processing");
          timeoutId = window.setTimeout(() => void load(), Math.max(1000, (result.retryAfterSeconds ?? 3) * 1000));
          return;
        }
        if (!response.ok || !result.url) throw new Error();
        setUrl(result.url);
        setState("ready");
      } catch {
        if (!stopped) setState("error");
      }
    }
    void load();
    return () => { stopped = true; if (timeoutId) window.clearTimeout(timeoutId); };
  }, [endpoint]);
  if (state === "processing") return <p className="comment-media-status">录音正在转换为兼容格式…</p>;
  if (state === "error") return <p className="comment-media-status" role="alert">录音暂时无法播放，请稍后重试。</p>;
  return <audio aria-busy={state === "loading"} controls preload="metadata" src={url || undefined} />;
}

function uploadComment(endpoint: string, formData: FormData, onProgress: (progress: number) => void) {
  return new Promise<{ response: Response; result: { comment?: SubmissionComment; message?: string } }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("网络连接中断，附件仍保留，可以重试。"));
    xhr.onload = () => {
      const headers = new Headers();
      const response = new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText, headers });
      let result: { comment?: SubmissionComment; message?: string } = {};
      try { result = JSON.parse(xhr.responseText) as typeof result; } catch { /* handled by caller */ }
      resolve({ response, result });
    };
    xhr.send(formData);
  });
}

export function SubmissionInteractions({
  submission,
  showEncouragement = true,
  focusCommentId,
}: {
  submission: CloudSubmission;
  showEncouragement?: boolean;
  focusCommentId?: string;
}) {
  const endpoint = `/api/student/submissions/${encodeURIComponent(submission.id)}/comments`;
  const { setUnreadCount } = useStudentMessageUnread();
  const [encouragementCount, setEncouragementCount] = useState(submission.encouragementCount);
  const [hasEncouraged, setHasEncouraged] = useState(submission.hasEncouraged);
  const [encouragementBusy, setEncouragementBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(Boolean(focusCommentId));
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [comments, setComments] = useState(submission.comments);
  const [commentCount, setCommentCount] = useState(submission.commentCount);
  const [content, setContent] = useState("");
  const [audio, setAudio] = useState<PreparedCommentAudio | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<SubmissionComment | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pickerKey, setPickerKey] = useState(0);
  const [deletingCommentId, setDeletingCommentId] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [message, setMessage] = useState("");
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const focusedCommentHandledRef = useRef(false);
  const focusedCommentLoadStartedRef = useRef(false);
  const characterCount = countCommentCharacters(content);
  const validationError = validateSubmissionComment(content, Boolean(audio || image));

  const loadComments = useCallback(async () => {
    setMessage("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await readJson<{ comments?: SubmissionComment[] }>(response);
      if (!response.ok || !result.comments) throw new Error(result.message || "评论暂时无法读取。");
      setComments(result.comments);
      setCommentCount(result.comments.length);
      setCommentsLoaded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "评论暂时无法读取。");
    }
  }, [endpoint]);

  useEffect(() => {
    if (!focusCommentId || focusedCommentLoadStartedRef.current) return;
    focusedCommentLoadStartedRef.current = true;
    void loadComments();
  }, [focusCommentId, loadComments]);

  useEffect(() => {
    if (!commentsLoaded || !focusCommentId || focusedCommentHandledRef.current) return;
    if (!comments.some((comment) => comment.id === focusCommentId)) return;

    const frameId = window.requestAnimationFrame(() => {
      const element = document.getElementById(`comment-${focusCommentId}`);
      if (!element) return;
      focusedCommentHandledRef.current = true;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus({ preventScroll: true });
      void fetch(`/api/student/messages/${encodeURIComponent(focusCommentId)}/read`, { method: "POST" })
        .then(async (response) => {
          if (!response.ok) return;
          const result = await readJson<{ unreadCount?: number }>(response);
          if (typeof result.unreadCount === "number") setUnreadCount(result.unreadCount);
        })
        .catch(() => undefined);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [comments, commentsLoaded, focusCommentId, setUnreadCount]);

  async function toggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && !commentsLoaded) await loadComments();
  }

  function startReply(comment: SubmissionComment) {
    setReplyTo(comment);
    window.requestAnimationFrame(() => {
      const input = commentInputRef.current;
      if (!input) return;
      const revealInput = () => commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus({ preventScroll: true });
      revealInput();
      window.setTimeout(revealInput, 320);
    });
  }

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
      const response = await fetch(`/api/student/submissions/${encodeURIComponent(submission.id)}/encouragement`, { method: nextState ? "POST" : "DELETE" });
      const result = await readJson<{ count?: number; encouraged?: boolean }>(response);
      if (!response.ok) throw new Error(result.message || "操作失败，请稍后重试。");
      if (typeof result.count === "number") setEncouragementCount(result.count);
      if (typeof result.encouraged === "boolean") setHasEncouraged(result.encouraged);
    } catch (error) {
      setEncouragementCount(previousCount);
      setHasEncouraged(previousState);
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    } finally { setEncouragementBusy(false); }
  }

  async function sendComment() {
    if (commentBusy || validationError) return;
    const formData = new FormData();
    formData.set("content", content);
    if (replyTo) formData.set("parentCommentId", replyTo.id);
    if (audio) {
      formData.set("audio", audio.file, audio.file.name);
      formData.set("audioSource", audio.source);
      formData.set("audioDurationSeconds", String(audio.durationSeconds));
    }
    if (image) formData.set("image", image, image.name);
    setCommentBusy(true);
    setUploadProgress(0);
    setMessage("");
    try {
      const { response, result } = await uploadComment(endpoint, formData, setUploadProgress);
      if (!response.ok || !result.comment) throw new Error(result.message || "评论发送失败，附件仍保留，可以重试。");
      setComments((current) => [...current, result.comment!]);
      setCommentCount((current) => current + 1);
      setContent("");
      setAudio(null);
      setImage(null);
      setReplyTo(null);
      setPickerKey((value) => value + 1);
      setCommentsLoaded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "评论发送失败，附件仍保留，可以重试。");
    } finally {
      setCommentBusy(false);
      setUploadProgress(0);
    }
  }

  async function deleteComment(commentId: string) {
    if (deletingCommentId) return;
    setDeletingCommentId(commentId);
    setMessage("");
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(commentId)}`, { method: "DELETE" });
      const result = await readJson<Record<string, never>>(response);
      if (!response.ok) throw new Error(result.message || "删除评论失败，请稍后重试。");
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setCommentCount((current) => Math.max(0, current - 1));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除评论失败，请稍后重试。");
    } finally { setDeletingCommentId(""); }
  }

  return (
    <section className="submission-interactions" aria-label="作业评论">
      <div className="submission-interaction-actions">
        {!showEncouragement ? null : submission.isOwn ? <span className="submission-interaction-static">👏 鼓励 {encouragementCount}</span> : (
          <button aria-pressed={hasEncouraged} className="submission-interaction-button" disabled={encouragementBusy} onClick={() => void toggleEncouragement()} type="button">👏 {hasEncouraged ? "已鼓励" : "鼓励"} {encouragementCount}</button>
        )}
        <button aria-expanded={commentsOpen} className="submission-interaction-button" onClick={() => void toggleComments()} type="button">💬 评论 {commentCount}</button>
      </div>

      {commentsOpen ? <div className="submission-comments">
        {comments.length ? <div className="submission-comment-list">{comments.map((comment) => (
          <article className={`submission-comment ${comment.parentCommentId ? "is-reply" : ""}${comment.id === focusCommentId ? " is-focused" : ""}`} id={`comment-${comment.id}`} key={comment.id} tabIndex={comment.id === focusCommentId ? -1 : undefined}>
            <header><strong>{comment.authorName}</strong>{comment.authorRole === "admin" ? <span className="pill olive">管理员</span> : null}<time dateTime={comment.createdAt}>{formatCommentTime(comment.createdAt)}</time></header>
            {comment.replyToAuthorName ? <p className="comment-reply-target">回复 {comment.replyToAuthorName}</p> : null}
            {comment.content ? <p className="comment-content">{comment.content}</p> : null}
            {comment.audioUrl ? <CommentAudioPlayer endpoint={comment.audioUrl} /> : null}
            {comment.imageUrl ? <button className="comment-image-button" onClick={() => setLightboxUrl(comment.imageUrl!)} type="button">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`${comment.authorName}发送的照片`} src={comment.imageUrl} />
            </button> : null}
            <footer><button className="submission-comment-reply" onClick={() => startReply(comment)} type="button"><Reply size={14} />回复</button>{comment.isOwn ? <button className="submission-comment-delete" disabled={deletingCommentId === comment.id} onClick={() => void deleteComment(comment.id)} type="button">删除</button> : null}</footer>
          </article>
        ))}</div> : <p className="notice">还没有评论，可以发送第一条。</p>}

        {replyTo ? <div className="comment-replying"><span>回复 {replyTo.authorName}</span><button aria-label="取消回复" onClick={() => setReplyTo(null)} type="button"><X size={16} /></button></div> : null}
        <label className="submission-comment-composer"><span className="sr-only">写评论</span><textarea disabled={commentBusy} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.preventDefault(); }} placeholder={replyTo ? `回复 ${replyTo.authorName}…` : "写下批改、鼓励或问题……"} ref={commentInputRef} rows={3} value={content} /><span className={characterCount > SUBMISSION_COMMENT_MAX_LENGTH ? "comment-count over-limit" : "comment-count"}>{characterCount} / {SUBMISSION_COMMENT_MAX_LENGTH}</span></label>
        <SubmissionCommentMediaPicker disabled={commentBusy} key={pickerKey} onAudioChange={setAudio} onImageChange={setImage} />
        {commentBusy && (audio || image) ? <div className="comment-upload-progress" role="status"><span style={{ width: `${uploadProgress}%` }} /><b>上传 {uploadProgress}%</b></div> : null}
        <button className="button secondary submission-comment-send" disabled={commentBusy || Boolean(validationError)} onClick={() => void sendComment()} type="button">{commentBusy ? "发送中…" : "发送评论"}</button>
      </div> : null}
      {message ? <p className="submission-interaction-message" role="alert">{message}</p> : null}
      {lightboxUrl ? <div aria-label="照片预览" aria-modal="true" className="comment-lightbox" onClick={() => setLightboxUrl("")} role="dialog">
        <button aria-label="关闭照片预览" onClick={() => setLightboxUrl("")} type="button"><X size={24} /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="放大的评论照片" onClick={(event) => event.stopPropagation()} src={lightboxUrl} />
      </div> : null}
    </section>
  );
}
