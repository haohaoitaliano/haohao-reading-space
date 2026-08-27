import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getActiveCampForUser } from "@/lib/cloud-course-data";
import { getCampCircleSubmissions } from "@/lib/cloud-submission-data";

export default async function CirclePage() {
  const { profile } = await requireAuthenticatedUser();
  const campResult = await getActiveCampForUser(profile.id);
  const result = campResult.state === "ok"
    ? await getCampCircleSubmissions(campResult.camp.id, profile.id)
    : { submissions: [], error: campResult.state === "database_error" };

  return (
    <AppFrame active="circle">
      <section className="screen with-top">
        <Header title="同学作业圈" subtitle={campResult.camp?.name ?? "只展示同班公开录音"} />
        <div className="hero">
          <p className="kicker">Compagni di lettura</p>
          <h1>听见同学，也听见自己的进步。</h1>
          <p>这里展示同一期训练营的公开录音，以及你自己的全部提交。</p>
        </div>
        <div className="stack">
          {result.submissions.map((submission) => (
            <CloudSubmissionCard key={submission.id} showInteractions submission={submission} />
          ))}
          {campResult.state === "no_selected_camp" ? <p className="notice">请先在<Link href="/spaces">我的学习空间</Link>选择当前训练营。</p> : null}
          {campResult.state === "no_membership" ? <p className="notice">尚未加入训练营。</p> : null}
          {!result.error && result.submissions.length === 0 ? <p className="notice">当前训练营暂时没有可见录音。</p> : null}
          {result.error ? <p className="notice" role="alert">作业圈暂时无法读取，请稍后重试。</p> : null}
        </div>
      </section>
    </AppFrame>
  );
}
