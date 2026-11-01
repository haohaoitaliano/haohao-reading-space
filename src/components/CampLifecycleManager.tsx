"use client";

import { Archive, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { permanentlyDeleteCamp, updateCampStatus } from "@/app/teacher/camp-actions";
import { formatUnlockDateTime } from "@/lib/course-schedule";
import type { ManagedCamp } from "@/lib/teacher-operations-data";

export function CampLifecycleManager({ camps }: { camps: ManagedCamp[] }) {
  const router = useRouter();
  const [busyCampId, setBusyCampId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function setStatus(campId: string, status: "active" | "archived") {
    setBusyCampId(campId);
    setMessage("");
    setError("");
    const result = await updateCampStatus({ campId, status });
    if (result.success) {
      setMessage(result.message);
      router.refresh();
    } else {
      setError(result.message);
    }
    setBusyCampId("");
  }

  async function deleteCamp(camp: ManagedCamp) {
    const confirmed = window.confirm(
      `确定永久删除「${camp.name}」吗？删除后，该训练营及其课程、邀请码、会议和历史数据将无法恢复。`,
    );
    if (!confirmed) return;
    setBusyCampId(camp.id);
    setMessage("");
    setError("");
    const result = await permanentlyDeleteCamp(camp.id);
    if (result.success) {
      setMessage(result.message);
      router.refresh();
    } else {
      setError(result.message);
    }
    setBusyCampId("");
  }

  return (
    <div className="stack">
      {error ? <p className="notice" role="alert">{error}</p> : null}
      {message ? <p className="success-notice" role="status">{message}</p> : null}
      {camps.map((camp) => {
        const isBusy = busyCampId === camp.id;
        return (
          <article className="item-card stack" key={camp.id}>
            <div className="row start">
              <div>
                <p className="kicker">{camp.slug}</p>
                <h3>{camp.name}</h3>
                <p style={{ margin: 0 }}>{camp.timezone} · 人数上限 {camp.maxStudents}</p>
                <p style={{ margin: 0 }}>开始：{formatUnlockDateTime(camp.startsAt, camp.timezone)}</p>
                <p style={{ margin: 0 }}>结束：{camp.endsAt ? formatUnlockDateTime(camp.endsAt, camp.timezone) : "未设置"}</p>
              </div>
              <span className={`pill ${camp.status === "active" ? "olive" : "muted"}`}>
                {camp.status === "active" ? "开放中" : camp.status === "draft" ? "草稿" : "已停用"}
              </span>
            </div>
            <div className="grid-two">
              <div className="metric"><strong>{camp.counts.courses}</strong><span>课程</span></div>
              <div className="metric"><strong>{camp.counts.members}</strong><span>成员</span></div>
              <div className="metric"><strong>{camp.counts.invites}</strong><span>邀请码</span></div>
              <div className="metric"><strong>{camp.counts.submissions}</strong><span>提交</span></div>
            </div>
            {camp.counts.meetings ? <p className="notice">包含 {camp.counts.meetings} 场线上会议。</p> : null}
            {camp.description ? <p className="camp-description">{camp.description}</p> : null}
            <Link className="button ghost full" href={`/teacher/camps/${camp.id}/edit`}>
              <Pencil size={18} /> 编辑训练营信息
            </Link>
            {camp.status === "active" ? (
              <button className="button secondary full" disabled={isBusy} onClick={() => setStatus(camp.id, "archived")} type="button">
                <Archive size={18} /> 停用训练营
              </button>
            ) : (
              <button className="button full" disabled={isBusy} onClick={() => setStatus(camp.id, "active")} type="button">
                <RotateCcw size={18} /> 重新启用
              </button>
            )}
            <button className="button ghost full" disabled={isBusy || camp.counts.members > 0} onClick={() => deleteCamp(camp)} type="button">
              <Trash2 size={18} /> 永久删除
            </button>
            <p className="notice">成员数为 0 时可永久删除。删除后，该训练营及其课程、邀请码、会议和历史数据将无法恢复。</p>
            {camp.counts.members > 0 ? <p className="notice">请先移除所有成员后再永久删除训练营。</p> : null}
          </article>
        );
      })}
      {!camps.length ? <p className="notice">当前还没有训练营。</p> : null}
      <Link className="button full" href="/teacher/camps/new">新建训练营</Link>
    </div>
  );
}
