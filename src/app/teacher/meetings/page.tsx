import { Header } from "@/components/Header";
import { MeetingManager } from "@/components/MeetingManager";
import { requireAdmin } from "@/lib/auth";
import { getAdminMeetingData } from "@/lib/teacher-operations-data";

export default async function TeacherMeetingsPage() {
  await requireAdmin();
  const result = await getAdminMeetingData();
  return <main className="app-shell"><section className="screen with-top">
    <Header backHref="/teacher" subtitle="外部会议链接" title="线上见面" />
    {result.error ? <p className="notice" role="alert">会议信息暂时无法读取。</p> : <MeetingManager camps={result.camps} meetings={result.meetings} now={result.now} />}
  </section></main>;
}
