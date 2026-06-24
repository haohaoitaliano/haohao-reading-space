"use client";

import { CalendarPlus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteWeeklyMeeting, saveWeeklyMeeting } from "@/app/teacher/meeting-actions";
import type { CloudCamp } from "@/lib/cloud-course-data";
import { formatDateTimeLocalInZone } from "@/lib/course-schedule";
import type { WeeklyMeeting } from "@/lib/teacher-operations-data";

function MeetingEditor({ camps, meeting }: { camps: CloudCamp[]; meeting?: WeeklyMeeting }) {
  const router = useRouter();
  const initialCamp = camps.find((camp) => camp.id === meeting?.campId) ?? camps[0];
  const [campId, setCampId] = useState(initialCamp?.id ?? "");
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [scheduledAtLocal, setScheduledAtLocal] = useState(
    meeting ? formatDateTimeLocalInZone(meeting.scheduledAt, meeting.timezone) : "",
  );
  const [meetingUrl, setMeetingUrl] = useState(meeting?.meetingUrl ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setBusy(true); setMessage(""); setError("");
    const result = await saveWeeklyMeeting({ id: meeting?.id ?? null, campId, title, scheduledAtLocal, meetingUrl, description });
    if (result.success) { setMessage(result.message); router.refresh(); }
    else setError(result.message);
    setBusy(false);
  }
  async function remove() {
    if (!meeting) return;
    setBusy(true); setMessage(""); setError("");
    const result = await deleteWeeklyMeeting(meeting.id);
    if (result.success) router.refresh(); else setError(result.message);
    setBusy(false);
  }

  return (
    <article className={meeting ? "item-card stack" : "quiet-card stack"}>
      <div className="row start"><div><p className="kicker">{meeting ? meeting.campName : "New Meeting"}</p><h2>{meeting ? "编辑会议" : "创建会议"}</h2></div><CalendarPlus color="var(--sky)" /></div>
      <label className="field">训练营
        <select onChange={(event) => setCampId(event.target.value)} value={campId}>{camps.map((camp) => <option key={camp.id} value={camp.id}>{camp.name}</option>)}</select>
      </label>
      <label className="field">会议标题<input onChange={(event) => setTitle(event.target.value)} value={title} /></label>
      <label className="field">会议时间（训练营当地时间）<input onChange={(event) => setScheduledAtLocal(event.target.value)} type="datetime-local" value={scheduledAtLocal} /></label>
      <label className="field">会议链接<input inputMode="url" onChange={(event) => setMeetingUrl(event.target.value)} placeholder="https://..." value={meetingUrl} /></label>
      <label className="field">说明<textarea onChange={(event) => setDescription(event.target.value)} rows={4} value={description} /></label>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      {message ? <p className="success-notice" role="status">{message}</p> : null}
      <button className="button full" disabled={busy || !camps.length} onClick={save} type="button"><Save size={18} /> {busy ? "处理中..." : "保存会议"}</button>
      {meeting ? <button className="button secondary full" disabled={busy} onClick={remove} type="button"><Trash2 size={18} /> 删除会议</button> : null}
    </article>
  );
}

export function MeetingManager({ camps, meetings }: { camps: CloudCamp[]; meetings: WeeklyMeeting[] }) {
  return <div className="stack"><MeetingEditor camps={camps} />{meetings.map((meeting) => <MeetingEditor camps={camps} key={meeting.id} meeting={meeting} />)}</div>;
}
