"use client";

import { Download, LockKeyhole, RefreshCw, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CloudSubmission } from "@/lib/cloud-submission-data";
import type { CloudPhotoSubmission } from "@/lib/photo-submission-data";
import { formatFileSize } from "@/lib/audio-file";
import { formatRecordingDuration } from "@/lib/recording-utils";
import { SubmissionInteractions } from "./SubmissionInteractions";

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

export function CloudSubmissionCard({
  submission,
  manageable = false,
  showInteractions = false,
  assignmentId,
  photos = [],
}: {
  submission: CloudSubmission;
  manageable?: boolean;
  showInteractions?: boolean;
  assignmentId?: string;
  photos?: CloudPhotoSubmission["photos"];
}) {
  const router = useRouter();
  const hasAudio = Boolean(submission.audioUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] = useState(hasAudio);
  const [audioProcessing, setAudioProcessing] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioReloadKey, setAudioReloadKey] = useState(0);
  const audioRequestRef = useRef(0);
  const audioRefreshAttemptsRef = useRef(0);
  const isPublic = submission.visibility === "public";

  useEffect(() => {
    if (!hasAudio) return;
    audioRefreshAttemptsRef.current = 0;
    let pollTimeoutId: number | undefined;
    let fetchTimeoutId: number | undefined;
    let controller: AbortController | undefined;

    async function loadAudioUrl() {
      const requestId = ++audioRequestRef.current;
      controller = new AbortController();
      fetchTimeoutId = window.setTimeout(() => controller?.abort(), 10_000);
      let continueProcessing = false;
      setAudioLoading(true);
      setAudioError(false);

      try {
        const response = await fetch(submission.audioUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json() as {
          url?: string;
          status?: "processing" | "retrying";
          retryAfterSeconds?: number;
        };
        if (response.status === 202 && (result.status === "processing" || result.status === "retrying")) {
          continueProcessing = true;
          if (audioRequestRef.current === requestId) {
            setAudioUrl("");
            setAudioProcessing(true);
            const retryAfterMs = Math.max(1_000, Number(result.retryAfterSeconds || 3) * 1_000);
            pollTimeoutId = window.setTimeout(() => void loadAudioUrl(), retryAfterMs);
          }
          return;
        }
        if (!response.ok || !result.url) throw new Error("signed audio URL unavailable");
        if (audioRequestRef.current === requestId) {
          setAudioProcessing(false);
          setAudioUrl(result.url);
        }
      } catch {
        if (audioRequestRef.current === requestId) {
          setAudioProcessing(false);
          setAudioError(true);
        }
      } finally {
        if (fetchTimeoutId) window.clearTimeout(fetchTimeoutId);
        if (audioRequestRef.current === requestId) setAudioLoading(continueProcessing);
      }
    }

    const initialTimeoutId = window.setTimeout(() => void loadAudioUrl(), 0);
    return () => {
      window.clearTimeout(initialTimeoutId);
      if (pollTimeoutId) window.clearTimeout(pollTimeoutId);
      if (fetchTimeoutId) window.clearTimeout(fetchTimeoutId);
      controller?.abort();
      audioRequestRef.current += 1;
    };
  }, [audioReloadKey, hasAudio, submission.audioUrl]);

  function handleAudioError() {
    if (audioRefreshAttemptsRef.current === 0) {
      audioRefreshAttemptsRef.current = 1;
      setAudioError(false);
      setAudioUrl("");
      setAudioLoading(true);
      setAudioReloadKey((value) => value + 1);
      return;
    }
    setAudioError(true);
  }

  async function deleteSubmission() {
    if (!window.confirm(
      "确定删除这次提交吗？\n删除后，这次录音和提交记录将无法恢复。\n删除此次提交后，与它相关的评论和鼓励也会一并删除。",
    )) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(assignmentId
      ? `/api/student/assignment-submissions/${assignmentId}`
      : `/api/student/submissions/${submission.id}`, { method: "DELETE" });
    const result = await response.json() as { message?: string };
    setBusy(false);
    setMessage(result.message ?? (response.ok ? "此次提交已删除。" : "删除失败，请重试。"));
    if (response.ok) router.refresh();
  }

  return (
    <article className="item-card local-submission-card">
      <div className="row start">
        <div className="avatar">{submission.studentName.charAt(0) || "读"}</div>
        <div className="submission-card-main">
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <strong>{submission.studentName}</strong>
            {submission.isOwn ? <span className="pill muted">我的作业</span> : null}
          </div>
          <p className="submission-course" lang="it">
            Giorno {submission.dayNumber} · {submission.courseTitle}
          </p>
          <p className="submission-meta">
            第 {submission.version} 次提交 · {formatSubmittedAt(submission.createdAt)}
            {hasAudio ? ` · ${Math.round(submission.durationSeconds)} 秒` : ""}
            {hasAudio && submission.targetDurationSeconds && submission.durationSeconds <= submission.targetDurationSeconds ? " 🎯" : ""}
          </p>
          {hasAudio ? <audio
            aria-busy={audioLoading}
            controls
            onError={audioUrl ? handleAudioError : undefined}
            onLoadedMetadata={() => {
              audioRefreshAttemptsRef.current = 0;
              setAudioProcessing(false);
              setAudioError(false);
            }}
            preload="metadata"
            src={audioUrl || undefined}
          >
            当前浏览器不支持音频播放。
          </audio> : null}
          {hasAudio && audioProcessing ? (
            <p className="submission-audio-status" role="status">正在处理录音…完成后会自动显示播放器。</p>
          ) : audioLoading && !audioUrl ? (
            <p className="submission-audio-status" role="status">正在准备播放器…</p>
          ) : null}
          {hasAudio && audioError ? (
            <div className="notice submission-audio-error" role="alert">
              <span>录音暂时无法播放，请重试；若仍失败，当前设备可能不支持此录音格式。</span>
              <button className="button ghost" onClick={() => {
                audioRefreshAttemptsRef.current = 0;
                setAudioError(false);
                setAudioUrl("");
                setAudioLoading(true);
                setAudioReloadKey((value) => value + 1);
              }} type="button">
                <RefreshCw size={16} />重新获取
              </button>
            </div>
          ) : null}
          {photos.length ? (
            <div className="photo-grid" style={{ marginTop: 12 }}>
              {photos.map((photo) => (
                <figure key={photo.id}>
                  <a href={photo.signedUrl} rel="noreferrer" target="_blank">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={`${submission.studentName}的作业照片 ${photo.position}`} src={photo.signedUrl} />
                  </a>
                  <figcaption>
                    <span>{photo.fileName} · {formatFileSize(photo.sizeBytes)}</span>
                    <a aria-label={`下载 ${photo.fileName}`} href={photo.downloadUrl}><Download size={15} /></a>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          <div className="row" style={{ marginTop: 8 }}>
            <span className={`pill ${isPublic ? "sky" : "muted"}`}>
              {isPublic ? <Users size={13} /> : <LockKeyhole size={13} />}
              {isPublic ? "训练营内公开" : "仅老师可见"}
            </span>
            {hasAudio ? <span style={{ color: "var(--muted)", fontSize: 13 }}>
              {formatRecordingDuration(submission.durationSeconds)}
            </span> : <span style={{ color: "var(--muted)", fontSize: 13 }}>{photos.length} 张照片</span>}
          </div>
          {manageable ? (
            <button className="button ghost full" disabled={busy} onClick={() => void deleteSubmission()} style={{ marginTop: 10 }} type="button">
              <Trash2 size={17} />删除此次提交
            </button>
          ) : null}
          {showInteractions && isPublic && hasAudio ? <SubmissionInteractions submission={submission} /> : null}
          {message ? <p className="notice" role="status">{message}</p> : null}
        </div>
      </div>
    </article>
  );
}
