import { ChartNoAxesColumnIncreasing } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { StudentApplauseCard } from "@/components/StudentApplauseCard";
import { StudentMessageEntry } from "@/components/StudentMessageUnread";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getStudentCampProgress } from "@/lib/student-camp-progress";

export default async function ProgressPage() {
  const { profile } = await requireAuthenticatedUser();
  const { courseResult, submissionError, stats, applauseResult } = await getStudentCampProgress(profile.id);

  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="学习进度" subtitle={`${profile.display_name} · ${courseResult.camp?.name ?? "共读训练营"}`} />
        <div className="hero">
          <p className="kicker">Progresso</p>
          <h1>{profile.display_name}，查看本期真实学习进度。</h1>
          <p>任务和输出只统计当前训练营中的真实课程与提交。</p>
        </div>

        {courseResult.state === "database_error" ? <p className="notice" role="alert">课程数据库暂时不可用。</p> : null}
        {courseResult.state === "no_selected_camp" ? <p className="notice">请先在<Link href="/spaces">我的学习空间</Link>选择当前训练营。</p> : null}
        {courseResult.state === "no_membership" ? <p className="notice">尚未加入训练营。</p> : null}
        {courseResult.state === "empty" ? <p className="notice">训练营暂时没有课程。</p> : null}
        {submissionError ? <p className="notice" role="alert">提交记录暂时无法读取。</p> : null}

        <section className="quiet-card stack">
          <div className="row"><h2>已开放任务完成情况</h2><ChartNoAxesColumnIncreasing color="var(--olive)" /></div>
          <div className="progress-bar"><span style={{ "--value": `${stats.completionPercent}%` } as React.CSSProperties} /></div>
          <p style={{ margin: 0 }}>
            {submissionError
              ? "提交记录暂时无法读取"
              : `${stats.completionPercent}% · 已完成 ${stats.completedTasks} / ${stats.openedTasks} 个已开放任务`}
          </p>
        </section>

        <StudentMessageEntry />

        <div style={{ marginTop: 14 }}>
          <StudentApplauseCard
            id="applause"
            total={applauseResult.total}
            today={applauseResult.today}
            unavailable={applauseResult.error}
          />
        </div>

        <Link className="button secondary full" href="/profile" style={{ marginTop: 14 }}>查看个人资料</Link>
      </section>
    </AppFrame>
  );
}
