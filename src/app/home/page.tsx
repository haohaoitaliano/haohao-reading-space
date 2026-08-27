import { ArrowRight, CalendarCheck, Headphones, Mic2 } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getCourseRouteId } from "@/lib/cloud-course";
import {
  getPublicCampSubmissions,
} from "@/lib/cloud-submission-data";
import { getStudentCampProgress } from "@/lib/student-camp-progress";

export default async function HomePage() {
  const { profile } = await requireAuthenticatedUser();
  const {
    courseResult: result,
    submissionResult: ownSubmissionResult,
    stats,
  } = await getStudentCampProgress(profile.id);
  const today = result.courses.filter((course) => course.isUnlocked).at(-1) ?? null;
  const publicSubmissionResult = result.state === "ok" && result.camp
    ? await getPublicCampSubmissions(result.camp.id, profile.id, 2)
    : { submissions: [], error: result.state === "database_error" };
  const todaySubmitted = today
    ? ownSubmissionResult.submissions.some((submission) => submission.courseId === today.id)
    : false;

  return (
    <AppFrame active="home">
      <section className="screen with-top">
        <Header
          title="共读空间"
          subtitle={`Buongiorno, ${profile.display_name}${result.camp ? ` · ${result.camp.name}` : ""}`}
        />

        {result.state === "database_error" ? (
          <section className="notice" role="alert">课程数据库暂时不可用，请稍后刷新。</section>
        ) : null}
        {result.state === "no_membership" ? (
          <section className="notice">尚未加入训练营，请先前往加入训练营页面。</section>
        ) : null}
        {result.state === "no_selected_camp" ? (
          <section className="notice">请先在<Link href="/spaces">我的学习空间</Link>选择当前训练营。</section>
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
          {today ? (
            <Link
              className="metric metric-link"
              href={`/courses/${getCourseRouteId(today.dayNumber)}`}
              aria-label="查看今天的任务"
            >
              <CalendarCheck size={20} color="var(--olive)" />
              <strong>{ownSubmissionResult.error ? "—" : stats.pendingTasks}</strong>
              <span>待完成任务</span>
            </Link>
          ) : (
            <div className="metric">
              <CalendarCheck size={20} color="var(--olive)" />
              <strong>{ownSubmissionResult.error ? "—" : stats.pendingTasks}</strong>
              <span>待完成任务</span>
            </div>
          )}
          <div className="metric">
            <Mic2 size={20} color="var(--accent)" />
            <strong>{ownSubmissionResult.error ? "—" : stats.completedOutputs}</strong>
            <span>已完成输出</span>
          </div>
        </section>

        <section className="quiet-card stack">
          <div className="row">
            <div><p className="kicker">今日任务</p><h2>听、读、录、交流</h2></div>
            <Headphones color="var(--sky)" />
          </div>
          <p style={{ margin: 0 }}>听示范、阅读文本、完成录音，并和同学交流。</p>
          {today ? (
            <p style={{ margin: 0 }}>
              今日录音：{ownSubmissionResult.error
                ? "状态暂时无法读取"
                : todaySubmitted ? "已提交" : "未提交"}
            </p>
          ) : null}
        </section>

        <section style={{ marginTop: 18 }}>
          <div className="row"><h2>同学新作业</h2><Link className="pill sky" href="/circle">查看全部</Link></div>
          <div className="stack">
            {publicSubmissionResult.submissions.map((submission) => (
              <CloudSubmissionCard key={submission.id} submission={submission} />
            ))}
            {!publicSubmissionResult.error && publicSubmissionResult.submissions.length === 0 ? (
              <p className="notice">当前训练营暂时没有同学公开录音。</p>
            ) : null}
            {publicSubmissionResult.error ? (
              <p className="notice" role="alert">同学作业暂时无法读取，请稍后重试。</p>
            ) : null}
          </div>
        </section>
      </section>
    </AppFrame>
  );
}
