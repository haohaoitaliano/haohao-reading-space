import { ArrowRight, CalendarCheck, Mic2 } from "lucide-react";
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
import { getStudentMessages } from "@/lib/student-message-data";

export default async function HomePage() {
  const { profile } = await requireAuthenticatedUser();
  const messagePromise = getStudentMessages(profile.id);
  const {
    courseResult: result,
    submissionError,
    stats,
  } = await getStudentCampProgress(profile.id);
  const today = result.courses.filter((course) => course.isUnlocked).at(-1) ?? null;
  const [publicSubmissionResult, messageResult] = await Promise.all([
    result.state === "ok" && result.camp
      ? getPublicCampSubmissions(result.camp.id, profile.id, 2)
      : Promise.resolve({ submissions: [], error: result.state === "database_error" }),
    messagePromise,
  ]);
  const hasUnreadReplyOnOtherWork = messageResult.state === "ok"
    && messageResult.messages.some((message) => !message.isRead && message.isReplyOnOtherWork);

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
              <strong>{submissionError ? "—" : stats.pendingTasks}</strong>
              <span>待完成任务</span>
            </Link>
          ) : (
            <div className="metric">
              <CalendarCheck size={20} color="var(--olive)" />
              <strong>{submissionError ? "—" : stats.pendingTasks}</strong>
              <span>待完成任务</span>
            </div>
          )}
          <div className="metric">
            <Mic2 size={20} color="var(--accent)" />
            <strong>{submissionError ? "—" : stats.completedOutputs}</strong>
            <span>已完成输出</span>
          </div>
        </section>

        {messageResult.state === "ok" && messageResult.unreadCount > 0 ? (
          <Link className="quiet-card message-home-alert" href="/messages">
            <span aria-hidden="true" className="message-dot" />
            <span className="message-home-alert-copy">
              <strong>{hasUnreadReplyOnOtherWork ? "你收到了" : "你的作业收到了"} {messageResult.unreadCount} 条新{hasUnreadReplyOnOtherWork ? "消息" : "评论"}！</strong>
              <small>快来看看，及时改进，别忘了回复哦！</small>
            </span>
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        ) : null}

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
