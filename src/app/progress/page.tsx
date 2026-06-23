import { BookOpenCheck, CalendarDays, ChartNoAxesColumnIncreasing, Mic2 } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getStudentCourseList } from "@/lib/cloud-course-data";
import { progress } from "@/lib/mock-data";

export default async function ProgressPage() {
  const { profile } = await requireAuthenticatedUser();
  const courseResult = await getStudentCourseList(profile.id);
  const total = courseResult.courses.length;
  const unlocked = courseResult.courses.filter((course) => course.isUnlocked).length;
  const completion = total ? Math.round((unlocked / total) * 100) : 0;

  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="学习进度" subtitle={`${profile.display_name} · ${courseResult.camp?.name ?? "共读训练营"}`} />
        <div className="hero">
          <p className="kicker">Progresso</p>
          <h1>{profile.display_name}，当前已解锁 {unlocked} 节云端课程。</h1>
          <p>课程总数和解锁进度来自 Supabase；录音统计暂时保留本地原型数据。</p>
        </div>

        {courseResult.state === "database_error" ? <p className="notice" role="alert">课程数据库暂时不可用。</p> : null}
        {courseResult.state === "empty" ? <p className="notice">训练营暂时没有课程。</p> : null}

        <section className="quiet-card stack">
          <div className="row"><h2>本期共读进度</h2><ChartNoAxesColumnIncreasing color="var(--olive)" /></div>
          <div className="progress-bar"><span style={{ "--value": `${completion}%` } as React.CSSProperties} /></div>
          <p style={{ margin: 0 }}>{completion}% · 已解锁 {unlocked} / {total} 节</p>
        </section>

        <section className="grid-two" style={{ marginTop: 14 }}>
          <div className="metric"><BookOpenCheck /><strong>{unlocked}</strong><span>已经解锁</span></div>
          <div className="metric"><Mic2 /><strong>{progress.submitted}</strong><span>提交录音</span></div>
          <div className="metric"><CalendarDays /><strong>{total}</strong><span>云端课程</span></div>
          <div className="metric"><ChartNoAxesColumnIncreasing /><strong>{progress.resubmitted}</strong><span>重新提交</span></div>
        </section>

        <Link className="button secondary full" href="/profile" style={{ marginTop: 14 }}>查看个人资料</Link>
      </section>
    </AppFrame>
  );
}
