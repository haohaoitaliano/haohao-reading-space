import { ArrowRight, CalendarCheck, Headphones, Mic2 } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { AssignmentCard } from "@/components/AssignmentCard";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getCourseRouteId } from "@/lib/cloud-course";
import { getStudentCourseList } from "@/lib/cloud-course-data";
import { assignments, currentStudentId, progress } from "@/lib/mock-data";

export default async function HomePage() {
  const { profile } = await requireAuthenticatedUser();
  const result = await getStudentCourseList(profile.id);
  const today = result.courses.filter((course) => course.isUnlocked).at(-1) ?? null;
  const publicAssignments = assignments.filter(
    (assignment) => assignment.visibility === "public" && assignment.studentId !== currentStudentId,
  );

  return (
    <AppFrame active="home">
      <section className="screen with-top">
        <Header title="共读空间" subtitle={`Buongiorno, ${profile.display_name}`} />

        {result.state === "database_error" ? (
          <section className="notice" role="alert">课程数据库暂时不可用，请稍后刷新。</section>
        ) : null}
        {result.state === "no_membership" ? (
          <section className="notice">尚未加入训练营，请先前往加入训练营页面。</section>
        ) : null}
        {result.state === "empty" ? (
          <section className="hero">
            <p className="kicker">Corso di lettura</p>
            <h1>训练营暂时还没有课程。</h1>
            <p>老师发布课程后，会在这里按天显示。</p>
          </section>
        ) : null}
        {today ? (
          <section className="hero">
            <p className="kicker">当前已解锁 · Giorno {today.dayNumber}</p>
            <h1>{today.italianTitle}</h1>
            <p>{today.chineseTitle}</p>
            <Link className="button" href={`/courses/${getCourseRouteId(today.dayNumber)}`}>
              进入今日阅读 <ArrowRight size={18} />
            </Link>
          </section>
        ) : result.state === "ok" ? (
          <section className="notice">课程尚未解锁，请查看课程列表中的开放时间。</section>
        ) : null}

        <section className="grid-two" style={{ marginBottom: 14 }}>
          <div className="metric">
            <CalendarCheck size={20} color="var(--olive)" />
            <strong>{result.courses.filter((course) => course.isUnlocked).length}</strong>
            <span>已解锁课程</span>
          </div>
          <div className="metric">
            <Mic2 size={20} color="var(--accent)" />
            <strong>{progress.streak}</strong>
            <span>连续学习</span>
          </div>
        </section>

        <section className="quiet-card stack">
          <div className="row">
            <div><p className="kicker">今日任务</p><h2>听、读、录、交流</h2></div>
            <Headphones color="var(--sky)" />
          </div>
          <div className="progress-bar" aria-label="今日任务进度">
            <span style={{ "--value": "66%" } as React.CSSProperties} />
          </div>
          <p style={{ margin: 0 }}>录音和作业进度当前仍使用本地原型数据。</p>
        </section>

        <section style={{ marginTop: 18 }}>
          <div className="row"><h2>同学新作业</h2><Link className="pill sky" href="/circle">查看全部</Link></div>
          <div className="stack">
            {publicAssignments.slice(0, 2).map((assignment) => (
              <AssignmentCard assignment={assignment} key={assignment.id} compact />
            ))}
          </div>
        </section>
      </section>
    </AppFrame>
  );
}
