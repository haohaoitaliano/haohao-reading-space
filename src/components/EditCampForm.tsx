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
  const [courseUnlockSchedule, setCourseUnlockSchedule] = useState(camp.courseUnlockSchedule);
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
      courseUnlockSchedule,
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
    <label className="field">课程自动解锁方式
      <select
        onChange={(event) => setCourseUnlockSchedule(event.target.value as typeof courseUnlockSchedule)}
        value={courseUnlockSchedule}
      >
        <option value="daily">每天解锁一节</option>
        <option value="weekdays">仅周一至周五解锁一节</option>
      </select>
    </label>
    <p className="notice">Giorno 0 入营后立即解锁，不计入自动排期。工作日模式遇到周末会顺延到下周一，已解锁课程周末仍可访问。</p>
    <p className="notice">修改开始时间或自动解锁方式，会重新计算自动解锁课程的开放时间；手动解锁课程不受影响。</p>
    <p className="notice">结束时间仅用于展示，不会自动停用训练营，也不会限制学生提交作业。</p>
    {error ? <p className="notice" role="alert">{error}</p> : null}
    {message ? <p className="success-notice" role="status">{message}</p> : null}
    <button className="button full" disabled={saving} onClick={save} type="button">
      <Save size={18} /> {saving ? "正在保存..." : "保存训练营信息"}
    </button>
  </section>;
}
