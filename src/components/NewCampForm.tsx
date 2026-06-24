"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { createCamp } from "@/app/teacher/camp-actions";

export function NewCampForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("Europe/Rome");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [maxStudents, setMaxStudents] = useState(20);
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    const result = await createCamp({ name, slug, timezone, startsAtLocal, maxStudents, status });
    if (result.success) window.location.assign("/teacher");
    else setError(result.message);
    setSaving(false);
  }

  return (
    <section className="quiet-card stack">
      <label className="field">训练营名称
        <input onChange={(event) => setName(event.target.value)} placeholder="好好意语共读空间 · 新一期" value={name} />
      </label>
      <label className="field">slug
        <input autoCapitalize="none" onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="reading-camp-02" value={slug} />
      </label>
      <label className="field">训练营时区
        <select onChange={(event) => setTimezone(event.target.value)} value={timezone}>
          <option value="Europe/Rome">Europe/Rome</option>
          <option value="Asia/Shanghai">Asia/Shanghai</option>
          <option value="UTC">UTC</option>
        </select>
      </label>
      <label className="field">开始时间（训练营当地时间）
        <input onChange={(event) => setStartsAtLocal(event.target.value)} type="datetime-local" value={startsAtLocal} />
      </label>
      <label className="field">人数上限
        <input min={1} onChange={(event) => setMaxStudents(Number(event.target.value))} type="number" value={maxStudents} />
      </label>
      <label className="field">状态
        <select onChange={(event) => setStatus(event.target.value as typeof status)} value={status}>
          <option value="draft">草稿</option><option value="active">开放</option><option value="archived">已归档</option>
        </select>
      </label>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      <button className="button full" disabled={saving} onClick={submit} type="button">
        <Plus size={18} /> {saving ? "正在创建..." : "创建训练营"}
      </button>
    </section>
  );
}
