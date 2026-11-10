import { CalendarDays, ExternalLink } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { MeetingNumber } from "@/components/MeetingNumber";
import { requireAuthenticatedUser } from "@/lib/auth";
import { formatUnlockDateTime } from "@/lib/course-schedule";
import { getMeetingStatus, getMeetingStatusLabel, splitMeetingDescription } from "@/lib/meeting-details";
import { getStudentMeetingData } from "@/lib/teacher-operations-data";

export default async function WeeklyPage() {
  const { profile } = await requireAuthenticatedUser();
  const result = await getStudentMeetingData(profile.id);
  return <AppFrame active="weekly"><section className="screen with-top">
    <Header subtitle={result.camp?.name ?? "共读训练营"} title="一起开口说意大利语！" />
    <div className="hero"><p className="kicker">Incontri online</p><h1>一起复习、练习口语，在轻松的交流中大胆开口说意大利语。</h1><p>我们将通过腾讯会议或 VooV Meeting 进行线上见面。请提前安装对应软件，做好开口练习的准备！</p></div>
    {result.state === "database_error" ? <p className="notice" role="alert">会议信息暂时无法读取。</p> : null}
    {result.state === "no_selected_camp" ? <p className="notice">请先在<a href="/spaces">我的学习空间</a>选择当前训练营。</p> : null}
    {result.state === "no_membership" ? <p className="notice">尚未加入训练营。</p> : null}
    {result.state === "ok" && !result.meetings.length ? <p className="notice">老师还没有安排线上会议。</p> : null}
    <div className="stack">{result.meetings.map((meeting) => {
      const status = getMeetingStatus(meeting.scheduledAt, result.now);
      return <article className="quiet-card stack" key={meeting.id}>
      <div className="row start"><div><p className="kicker">Meeting</p><h2>{meeting.title}</h2></div><CalendarDays color="var(--sky)" /></div>
      <span className={`pill ${status === "upcoming" ? "sky" : "muted"}`}>{getMeetingStatusLabel(status)}</span>
      <p>{formatUnlockDateTime(meeting.scheduledAt, meeting.timezone)}（{meeting.timezone}）</p>
      {meeting.description ? <p className="meeting-description">{splitMeetingDescription(meeting.description).map((part, index) => part.type === "link"
        ? <a href={part.value} key={`${part.value}-${index}`} rel="noreferrer" target="_blank">{part.value}</a>
        : part.value)}</p> : null}
      {meeting.meetingNumber ? <MeetingNumber value={meeting.meetingNumber} /> : null}
      {meeting.meetingUrl ? <a className="button full" href={meeting.meetingUrl} rel="noreferrer" target="_blank"><ExternalLink size={18} /> 加入会议</a> : null}
    </article>})}</div>
  </section></AppFrame>;
}
