import { AppFrame } from "@/components/AppFrame";
import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getActiveCampForUser } from "@/lib/cloud-course-data";
import { getPublicCampSubmissions } from "@/lib/cloud-submission-data";

export default async function CirclePage() {
  const { profile } = await requireAuthenticatedUser();
  const campResult = await getActiveCampForUser(profile.id);
  const result = campResult.state === "ok"
    ? await getPublicCampSubmissions(campResult.camp.id, profile.id)
    : { submissions: [], error: true };

  return (
    <AppFrame active="circle">
      <section className="screen with-top">
        <Header title="同学作业圈" subtitle="只展示同班公开录音" />
        <div className="hero">
          <p className="kicker">Compagni di lettura</p>
          <h1>听见同学，也听见自己的进步。</h1>
          <p>这里只展示同一期训练营成员选择公开的云端录音。</p>
        </div>
        <div className="stack">
          {result.submissions.map((submission) => (
            <CloudSubmissionCard key={submission.id} submission={submission} />
          ))}
          {!result.error && result.submissions.length === 0 ? <p className="notice">暂时没有同学公开录音。</p> : null}
          {result.error ? <p className="notice" role="alert">作业圈暂时无法读取，请稍后重试。</p> : null}
        </div>
      </section>
    </AppFrame>
  );
}
