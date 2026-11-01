"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateCampInfo } from "@/app/teacher/camp-actions";
import { formatDateTimeLocalInZone } from "@/lib/course-schedule";
import type { ManagedCamp } from "@/lib/teacher-operations-data";

export function EditCampForm({ camp }: { camp: ManagedCamp }) {
  const router = useRouter();
  const [name, setName] = useState(camp.name);
  const [maxStudents, setMaxStudents] = useState(camp.maxStudents);
  const [startsAtLocal, setStartsAtLocal] = useState(formatDateTimeLocalInZone(camp.startsAt, camp.timezone));
  const [endsAtLocal, setEndsAtLocal] = useState(formatDateTimeLocalInZone(camp.endsAt, camp.timezone));
  const [description, setDescription] = useState(camp.description);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    const result = await updateCampInfo({
      campId: camp.id,
      name,
      maxStudents,
      startsAtLocal,
      endsAtLocal,
      description,
    });
    if (result.success) {
      setMessage(result.message);
      router.refresh();
    } else {
      setError(result.message);
    }
    setSaving(false);
  }

  return <section className="quiet-card stack">
    <label className="field">训练营名称
      <input maxLength={120} onChange={(event) => setName(event.target.value)} value={name} />
    </label>
    <label className="field">人数上限
      <input min={1} onChange={(event) => setMaxStudents(Number(event.target.value))} type="number" value={maxStudents} />
    </label>
    <label className="field">开始时间（{camp.timezone}）
      <input onChange={(event) => setStartsAtLocal(event.target.value)} type="datetime-local" value={startsAtLocal} />
    </label>
    <label className="field">结束时间（选填，{camp.timezone}）
      <input min={startsAtLocal || undefined} onChange={(event) => setEndsAtLocal(event.target.value)} type="datetime-local" value={endsAtLocal} />
    </label>
    <label className="field">训练营说明（选填）
      <textarea onChange={(event) => setDescription(event.target.value)} rows={5} value={description} />
    </label>
    <p className="notice">修改开始时间会影响按训练营开始时间自动计算的课程解锁时间；现有解锁算法不会改变。</p>
    <p className="notice">结束时间仅用于展示，不会自动停用训练营，也不会限制学生提交作业。</p>
    {error ? <p className="notice" role="alert">{error}</p> : null}
    {message ? <p className="success-notice" role="status">{message}</p> : null}
    <button className="button full" disabled={saving} onClick={save} type="button">
      <Save size={18} /> {saving ? "正在保存..." : "保存训练营信息"}
    </button>
  </section>;
}
