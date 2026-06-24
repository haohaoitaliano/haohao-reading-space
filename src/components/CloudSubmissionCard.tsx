"use client";

import { LockKeyhole, RefreshCw, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CloudSubmission } from "@/lib/cloud-submission-data";
import { formatRecordingDuration } from "@/lib/recording-utils";

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
}: {
  submission: CloudSubmission;
  manageable?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [audioError, setAudioError] = useState(false);
  const isPublic = submission.visibility === "public";

  async function replaceAudio(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    const formData = new FormData();
    formData.set("audio", file);
    formData.set("durationSeconds", String(submission.durationSeconds));
    const response = await fetch(`/api/student/submissions/${submission.id}/audio`, {
      method: "PUT",
      body: formData,
    });
    const result = await response.json() as { message?: string };
    setBusy(false);
    setMessage(result.message ?? (response.ok ? "录音已替换。" : "替换失败，请重试。"));
    if (response.ok) router.refresh();
  }

  async function deleteSubmission() {
    if (!window.confirm("确定删除这次提交吗？此操作无法撤销。")) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/student/submissions/${submission.id}/audio`, { method: "DELETE" });
    const result = await response.json() as { message?: string };
    setBusy(false);
    setMessage(result.message ?? (response.ok ? "录音已删除。" : "删除失败，请重试。"));
    if (response.ok) router.refresh();
  }

  return (
    <article className="item-card local-submission-card">
      <div className="row start">
        <div className="avatar">{submission.studentName.charAt(0) || "读"}</div>
        <div className="submission-card-main">
          <strong>{submission.studentName}</strong>
          <p className="submission-course" lang="it">
            Giorno {submission.dayNumber} · {submission.courseTitle}
          </p>
          <p className="submission-meta">
            {formatSubmittedAt(submission.createdAt)} · 第 {submission.version} 版
          </p>
          <audio
            controls
            onError={() => setAudioError(true)}
            onLoadedMetadata={() => setAudioError(false)}
            preload="metadata"
            src={submission.audioUrl}
          >
            当前浏览器不支持音频播放。
          </audio>
          {audioError ? (
            <div className="notice submission-audio-error" role="alert">
              <span>录音暂时无法播放，播放凭证可能已失效。</span>
              <button className="button ghost" onClick={() => window.location.reload()} type="button">
                <RefreshCw size={16} />刷新页面
              </button>
            </div>
          ) : null}
          <div className="row" style={{ marginTop: 8 }}>
            <span className={`pill ${isPublic ? "sky" : "muted"}`}>
              {isPublic ? <Users size={13} /> : <LockKeyhole size={13} />}
              {isPublic ? "公开录音" : "仅老师可见"}
            </span>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              {formatRecordingDuration(submission.durationSeconds)}
            </span>
          </div>
          {manageable ? (
            <div className="grid-two" style={{ marginTop: 10 }}>
              <input
                accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,audio/ogg"
                hidden
                onChange={(event) => void replaceAudio(event.target.files?.[0])}
                ref={inputRef}
                type="file"
              />
              <button className="button secondary" disabled={busy} onClick={() => inputRef.current?.click()} type="button">
                <RefreshCw size={17} />替换
              </button>
              <button className="button ghost" disabled={busy} onClick={() => void deleteSubmission()} type="button">
                <Trash2 size={17} />删除
              </button>
            </div>
          ) : null}
          {message ? <p className="notice" role="status">{message}</p> : null}
        </div>
      </div>
    </article>
  );
}
