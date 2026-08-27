import { BookOpenCheck, ChartNoAxesColumnIncreasing, Mic2, Repeat2 } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getStudentCourseList } from "@/lib/cloud-course-data";
import { getOwnCloudSubmissions } from "@/lib/cloud-submission-data";
import { buildStudentCampStats } from "@/lib/learning-progress";

export default async function ProgressPage() {
  const { profile } = await requireAuthenticatedUser();
  const courseResult = await getStudentCourseList(profile.id);
  const submissionResult = courseResult.camp
    ? await getOwnCloudSubmissions(profile.id, courseResult.camp.id)
    : { submissions: [], error: courseResult.state === "database_error" };
  const stats = buildStudentCampStats({
    courses: courseResult.courses,
    submissions: submissionResult.submissions,
  });
  const value = (number: number) => submissionResult.error ? "—" : number;

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
        {submissionResult.error ? <p className="notice" role="alert">提交记录暂时无法读取。</p> : null}

        <section className="quiet-card stack">
          <div className="row"><h2>已开放任务完成情况</h2><ChartNoAxesColumnIncreasing color="var(--olive)" /></div>
          <div className="progress-bar"><span style={{ "--value": `${stats.completionPercent}%` } as React.CSSProperties} /></div>
          <p style={{ margin: 0 }}>
            {submissionResult.error
              ? "提交记录暂时无法读取"
              : `${stats.completionPercent}% · 已完成 ${stats.completedTasks} / ${stats.openedTasks} 个已开放任务`}
          </p>
        </section>

        <section className="grid-two" style={{ marginTop: 14 }}>
          <div className="metric"><BookOpenCheck /><strong>{value(stats.pendingTasks)}</strong><span>待完成任务</span></div>
          <div className="metric"><ChartNoAxesColumnIncreasing /><strong>{value(stats.completedTasks)}</strong><span>已完成任务</span></div>
          <div className="metric"><Mic2 /><strong>{value(stats.completedOutputs)}</strong><span>已完成输出</span></div>
          <div className="metric"><Repeat2 /><strong>{value(stats.resubmissions)}</strong><span>重新提交</span></div>
        </section>

        <Link className="button secondary full" href="/profile" style={{ marginTop: 14 }}>查看个人资料</Link>
      </section>
    </AppFrame>
  );
}
