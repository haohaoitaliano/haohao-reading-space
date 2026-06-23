"use client";

import { LockKeyhole, Users } from "lucide-react";
import { useEffect, useMemo } from "react";
import { getCourse } from "@/lib/mock-data";
import { formatRecordingDuration } from "@/lib/recording-utils";
import type { LocalSubmission } from "@/lib/submission-store";

function formatSubmittedAt(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function LocalSubmissionCard({ submission }: { submission: LocalSubmission }) {
  const course = getCourse(submission.courseId);
  const isPublic = submission.visibility === "public";
  const audioUrl = useMemo(() => URL.createObjectURL(submission.audioBlob), [submission.audioBlob]);

  useEffect(() => {
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  return (
    <article className="item-card local-submission-card">
      <div className="row start">
        <div className="avatar">{submission.studentNickname.charAt(0) || "读"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{submission.studentNickname}</strong>
          <p style={{ margin: "2px 0 8px", fontSize: 13 }}>
            Giorno {course.day} · {formatSubmittedAt(submission.createdAt)} · 第 {submission.version} 版
          </p>
          {audioUrl ? (
            <audio controls preload="metadata" src={audioUrl} style={{ width: "100%" }}>
              当前浏览器不支持音频播放。
            </audio>
          ) : null}
          <div className="row" style={{ marginTop: 8 }}>
            <span className={`pill ${isPublic ? "sky" : "muted"}`}>
              {isPublic ? <Users size={13} /> : <LockKeyhole size={13} />}
              {isPublic ? "公开录音" : "仅老师可见"}
            </span>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              {formatRecordingDuration(submission.duration)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
