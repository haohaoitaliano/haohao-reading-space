import { Header } from "@/components/Header";
import { MeetingManager } from "@/components/MeetingManager";
import { requireAdmin } from "@/lib/auth";
import { getAdminMeetingData } from "@/lib/teacher-operations-data";

export default async function TeacherMeetingsPage() {
  await requireAdmin();
  const result = await getAdminMeetingData();
  return <main className="app-shell"><section className="screen with-top">
    <Header backHref="/teacher" subtitle="外部会议链接" title="每周线上会议" />
    <section className="hero"><p className="kicker">Weekly Meetings</p><h1>安排每周共读见面。</h1><p>这里只管理会议资料，不在站内提供直播。</p></section>
    {result.error ? <p className="notice" role="alert">会议暂时无法读取。</p> : <MeetingManager camps={result.camps} meetings={result.meetings} />}
  </section></main>;
}
