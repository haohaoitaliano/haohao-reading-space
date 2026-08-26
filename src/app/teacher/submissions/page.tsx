import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { requireAdmin } from "@/lib/auth";
import { getAdminCloudSubmissions } from "@/lib/cloud-submission-data";

export default async function TeacherSubmissionsPage() {
  await requireAdmin();
  const result = await getAdminCloudSubmissions();

  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="学生提交记录" subtitle="云端录音" backHref="/teacher" />
        <section className="hero">
          <p className="kicker">Submissions</p>
          <h1>查看学生录音。</h1>
          <p>这里显示学生提交到云端的录音，包括公开和仅老师可见的提交。</p>
        </section>

        <section className="quiet-card stack">
          <div className="row"><h2>提交记录</h2><span className="pill sky">云端</span></div>
          {result.submissions.map((submission) => (
            <CloudSubmissionCard key={submission.id} submission={submission} />
          ))}
          {!result.error && result.submissions.length === 0 ? <p className="notice">还没有学生提交录音。</p> : null}
          {result.error ? <p className="notice" role="alert">学生提交暂时无法读取。</p> : null}
        </section>
      </section>
    </main>
  );
}
