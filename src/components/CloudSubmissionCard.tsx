"use client";

import { LockKeyhole, RefreshCw, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CloudSubmission } from "@/lib/cloud-submission-data";
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
}: {
  submission: CloudSubmission;
  manageable?: boolean;
  showInteractions?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] = useState(true);
  const [audioProcessing, setAudioProcessing] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioReloadKey, setAudioReloadKey] = useState(0);
  const audioRequestRef = useRef(0);
  const audioRefreshAttemptsRef = useRef(0);
  const isPublic = submission.visibility === "public";

  useEffect(() => {
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
  }, [audioReloadKey, submission.audioUrl]);

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
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <strong>{submission.studentName}</strong>
            {submission.isOwn ? <span className="pill muted">我的作业</span> : null}
          </div>
          <p className="submission-course" lang="it">
            Giorno {submission.dayNumber} · {submission.courseTitle}
          </p>
          <p className="submission-meta">
            {formatSubmittedAt(submission.createdAt)} · 第 {submission.version} 版
          </p>
          <audio
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
          </audio>
          {audioProcessing ? (
            <p className="submission-audio-status" role="status">正在处理录音…完成后会自动显示播放器。</p>
          ) : audioLoading && !audioUrl ? (
            <p className="submission-audio-status" role="status">正在准备播放器…</p>
          ) : null}
          {audioError ? (
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
          {showInteractions && isPublic ? <SubmissionInteractions submission={submission} /> : null}
          {message ? <p className="notice" role="status">{message}</p> : null}
        </div>
      </div>
    </article>
  );
}
