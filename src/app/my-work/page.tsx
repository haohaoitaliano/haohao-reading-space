import { Eye } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getOwnCloudSubmissions } from "@/lib/cloud-submission-data";

export default async function MyWorkPage() {
  const { profile } = await requireAuthenticatedUser();
  const result = await getOwnCloudSubmissions(profile.id);

  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="我的作业" subtitle={`${profile.display_name} · 云端录音与 AI 反馈`} />
        <div className="hero">
          <p className="kicker">I miei compiti</p>
          <h1>回看每一次提交和修改。</h1>
          <p>这里展示你的云端录音、公开状态和提交版本。</p>
        </div>
        <div className="stack">
          {result.submissions.map((submission) => (
            <section className="stack" key={submission.id}>
              <CloudSubmissionCard manageable submission={submission} />
              <Link className="button secondary full" href={`/ai-feedback?submissionId=${submission.id}`}>
                <Eye size={18} />查看 AI 反馈
              </Link>
            </section>
          ))}
          {!result.error && result.submissions.length === 0 ? (
            <section className="quiet-card">
              <h2>还没有提交记录</h2>
              <p>完成一次跟读录音后，不同版本会按时间显示在这里。</p>
              <Link className="button full" href="/courses">去录制今日作业</Link>
            </section>
          ) : null}
          {result.error ? <p className="notice" role="alert">云端作业暂时无法读取，请稍后重试。</p> : null}
        </div>
      </section>
    </AppFrame>
  );
}
