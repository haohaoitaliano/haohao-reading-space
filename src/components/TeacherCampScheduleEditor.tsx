"use client";

import { Clock3, Save } from "lucide-react";
import { useState } from "react";
import { updateCampSchedule } from "@/app/teacher/camp-actions";
import type { CloudCamp } from "@/lib/cloud-course-data";
import { formatDateTimeLocalInZone } from "@/lib/course-schedule";

const COMMON_TIME_ZONES = ["Europe/Rome", "Asia/Shanghai", "UTC"];

export function TeacherCampScheduleEditor({ camp }: { camp: CloudCamp }) {
  const [startsAtLocal, setStartsAtLocal] = useState(
    formatDateTimeLocalInZone(camp.startsAt, camp.timezone),
  );
  const [timezone, setTimezone] = useState(camp.timezone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const timeZones = COMMON_TIME_ZONES.includes(camp.timezone)
    ? COMMON_TIME_ZONES
    : [camp.timezone, ...COMMON_TIME_ZONES];

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    const result = await updateCampSchedule({ campId: camp.id, startsAtLocal, timezone });
    if (result.success) setMessage(result.message);
    else setError(result.message);
    setSaving(false);
  }

  return (
    <article className="item-card stack">
      <div className="row start">
        <div><p className="kicker">Camp Schedule</p><h3>{camp.name}</h3></div>
        <Clock3 color="var(--sky)" size={20} />
      </div>
      <label className="field">训练营时区
        <select onChange={(event) => setTimezone(event.target.value)} value={timezone}>
          {timeZones.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="field">Giorno 1 开始时间（当地时间）
        <input onChange={(event) => setStartsAtLocal(event.target.value)} type="datetime-local" value={startsAtLocal} />
      </label>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      {message ? <p className="success-notice" role="status">{message}</p> : null}
      <button className="button full" disabled={saving} onClick={save} type="button">
        <Save size={18} /> {saving ? "正在保存..." : "保存训练营排期"}
      </button>
    </article>
  );
}
