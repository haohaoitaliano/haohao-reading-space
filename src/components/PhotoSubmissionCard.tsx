"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CloudPhotoSubmission } from "@/lib/photo-submission-data";
import { IDENTITY_LABEL_TEXT } from "@/lib/identity-label";
import { PhotoGallery } from "./PhotoGallery";

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

export function PhotoSubmissionCard({ submission, manageable = false }: {
  submission: CloudPhotoSubmission;
  manageable?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function deleteSubmission() {
    if (!window.confirm("确定删除这次照片作业吗？\n删除后无法恢复，但不会影响其他历史版本。")) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/student/photo-submissions/${submission.id}`, { method: "DELETE" });
    const result = await response.json() as { message?: string };
    setBusy(false);
    setMessage(result.message ?? (response.ok ? "已删除。" : "删除失败，请重试。"));
    if (response.ok) router.refresh();
  }

  return (
    <article className="item-card photo-submission-card">
      <div className="row start">
        <div>
          <strong>{submission.studentName}</strong>
          {submission.identityLabel && submission.identityLabel !== "student" ? <span className="pill olive">{IDENTITY_LABEL_TEXT[submission.identityLabel]}</span> : null}
          <p className="submission-course" lang="it">Giorno {submission.dayNumber} · {submission.courseTitle}</p>
          <p className="submission-meta">第 {submission.version} 次照片提交 · {formatSubmittedAt(submission.createdAt)}</p>
        </div>
        <span className="pill muted">{submission.photos.length} 张</span>
      </div>
      <PhotoGallery ownerName={submission.studentName} photos={submission.photos} />
      {submission.photos.some((photo) => photo.mimeType === "image/heic" || photo.mimeType === "image/heif") ? (
        <p className="notice" style={{ marginBottom: 0 }}>HEIC 是否能直接显示取决于浏览器；无法预览时可使用下载按钮查看原文件。</p>
      ) : null}
      {manageable ? (
        <button className="button ghost full" disabled={busy} onClick={() => void deleteSubmission()} type="button">
          <Trash2 size={17} />{busy ? "正在删除…" : "删除此次照片提交"}
        </button>
      ) : null}
      {message ? <p className="notice" role="status">{message}</p> : null}
    </article>
  );
}
