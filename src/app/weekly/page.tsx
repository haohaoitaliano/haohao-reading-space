import { CalendarDays, ExternalLink } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { formatUnlockDateTime } from "@/lib/course-schedule";
import { getStudentMeetingData } from "@/lib/teacher-operations-data";

export default async function WeeklyPage() {
  const { profile } = await requireAuthenticatedUser();
  const result = await getStudentMeetingData(profile.id);
  return <AppFrame active="weekly"><section className="screen with-top">
    <Header subtitle={result.camp?.name ?? "共读训练营"} title="每周线上见面" />
    <div className="hero"><p className="kicker">Incontro settimanale</p><h1>一起读，也一起聊聊。</h1><p>会议使用外部链接，时间统一按训练营时区显示。</p></div>
    {result.state === "database_error" ? <p className="notice" role="alert">会议信息暂时无法读取。</p> : null}
    {result.state === "ok" && !result.meetings.length ? <p className="notice">老师还没有安排线上会议。</p> : null}
    <div className="stack">{result.meetings.map((meeting) => <article className="quiet-card stack" key={meeting.id}>
      <div className="row start"><div><p className="kicker">Weekly Meeting</p><h2>{meeting.title}</h2></div><CalendarDays color="var(--sky)" /></div>
      <p>{formatUnlockDateTime(meeting.scheduledAt, meeting.timezone)}（{meeting.timezone}）</p>
      {meeting.description ? <p>{meeting.description}</p> : null}
      <a className="button full" href={meeting.meetingUrl} rel="noreferrer" target="_blank"><ExternalLink size={18} /> 打开会议链接</a>
    </article>)}</div>
  </section></AppFrame>;
}
