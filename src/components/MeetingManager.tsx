"use client";

import { CalendarDays, CalendarPlus, ExternalLink, Pencil, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteWeeklyMeeting, saveWeeklyMeeting } from "@/app/teacher/meeting-actions";
import { MeetingNumber } from "@/components/MeetingNumber";
import type { CloudCamp } from "@/lib/cloud-course-data";
import { formatDateTimeLocalInZone, formatUnlockDateTime } from "@/lib/course-schedule";
import { getMeetingStatus, getMeetingStatusLabel, splitMeetingDescription } from "@/lib/meeting-details";
import type { WeeklyMeeting } from "@/lib/teacher-operations-data";

function MeetingEditor({ camps, meeting, onCancel }: {
  camps: CloudCamp[];
  meeting?: WeeklyMeeting;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const initialCamp = camps.find((camp) => camp.id === meeting?.campId) ?? camps[0];
  const [campId, setCampId] = useState(initialCamp?.id ?? "");
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [scheduledAtLocal, setScheduledAtLocal] = useState(
    meeting ? formatDateTimeLocalInZone(meeting.scheduledAt, meeting.timezone) : "",
  );
  const [meetingUrl, setMeetingUrl] = useState(meeting?.meetingUrl ?? "");
  const [meetingNumber, setMeetingNumber] = useState(meeting?.meetingNumber ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setBusy(true); setMessage(""); setError("");
    const result = await saveWeeklyMeeting({ id: meeting?.id ?? null, campId, title, scheduledAtLocal, meetingUrl, meetingNumber, description });
    if (result.success) {
      setMessage(result.message);
      if (!meeting) {
        setTitle("");
        setScheduledAtLocal("");
        setMeetingUrl("");
        setMeetingNumber("");
        setDescription("");
      }
      router.refresh();
    } else setError(result.message);
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
      <div className="row start"><div><p className="kicker">{meeting ? meeting.campName : "New Meeting"}</p><h2>{meeting ? `正在编辑：${meeting.title}` : "新建线上见面"}</h2></div><CalendarPlus color="var(--sky)" /></div>
      <label className="field">训练营
        <select onChange={(event) => setCampId(event.target.value)} value={campId}>{camps.map((camp) => <option key={camp.id} value={camp.id}>{camp.name}</option>)}</select>
      </label>
      <label className="field">会议标题<input onChange={(event) => setTitle(event.target.value)} value={title} /></label>
      <label className="field">会议时间（训练营当地时间）<input onChange={(event) => setScheduledAtLocal(event.target.value)} type="datetime-local" value={scheduledAtLocal} /></label>
      <label className="field">会议链接（选填）<input inputMode="url" onChange={(event) => setMeetingUrl(event.target.value)} placeholder="https://..." value={meetingUrl} /></label>
      <label className="field">腾讯会议 / VOOV 会议号（选填）<input onChange={(event) => setMeetingNumber(event.target.value)} value={meetingNumber} /></label>
      <label className="field">说明<textarea onChange={(event) => setDescription(event.target.value)} rows={4} value={description} /></label>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      {message ? <p className="success-notice" role="status">{message}</p> : null}
      <button className="button full" disabled={busy || !camps.length} onClick={save} type="button"><Save size={18} /> {busy ? "处理中..." : meeting ? "保存本场修改" : "创建线上见面"}</button>
      {onCancel ? <button className="button ghost full" disabled={busy} onClick={onCancel} type="button"><X size={18} /> 取消编辑</button> : null}
      {meeting ? <button className="button secondary full" disabled={busy} onClick={remove} type="button"><Trash2 size={18} /> 删除会议</button> : null}
    </article>
  );
}

function ManagedMeetingCard({ camps, meeting, now }: {
  camps: CloudCamp[];
  meeting: WeeklyMeeting;
  now: number;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) return <MeetingEditor camps={camps} meeting={meeting} onCancel={() => setEditing(false)} />;

  const status = getMeetingStatus(meeting.scheduledAt, now);
  return <article className="item-card stack">
    <div className="row start">
      <div><p className="kicker">Meeting · {meeting.campName}</p><h2>{meeting.title}</h2></div>
      <CalendarDays color="var(--sky)" />
    </div>
    <span className={`pill ${status === "upcoming" ? "sky" : "muted"}`}>{getMeetingStatusLabel(status)}</span>
    <p>{formatUnlockDateTime(meeting.scheduledAt, meeting.timezone)}（{meeting.timezone}）</p>
    {meeting.description ? <p className="meeting-description">{splitMeetingDescription(meeting.description).map((part, index) => part.type === "link"
      ? <a href={part.value} key={`${part.value}-${index}`} rel="noreferrer" target="_blank">{part.value}</a>
      : part.value)}</p> : null}
    {meeting.meetingNumber ? <MeetingNumber value={meeting.meetingNumber} /> : null}
    {meeting.meetingUrl ? <a className="button secondary full" href={meeting.meetingUrl} rel="noreferrer" target="_blank"><ExternalLink size={18} /> 加入会议</a> : null}
    <button className="button ghost full" onClick={() => setEditing(true)} type="button"><Pencil size={18} /> 编辑这场线上见面</button>
  </article>;
}

export function MeetingManager({ camps, meetings, now }: {
  camps: CloudCamp[];
  meetings: WeeklyMeeting[];
  now: number;
}) {
  return <div className="stack">
    <MeetingEditor camps={camps} />
    {meetings.length ? meetings.map((meeting) => <ManagedMeetingCard camps={camps} key={meeting.id} meeting={meeting} now={now} />) : <p className="notice">还没有创建线上见面。</p>}
  </div>;
}
