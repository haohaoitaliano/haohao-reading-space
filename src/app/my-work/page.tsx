"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { useAuthProfile } from "@/components/AuthProfileProvider";
import { Header } from "@/components/Header";
import { LocalSubmissionCard } from "@/components/LocalSubmissionCard";
import { useLocalSubmissions } from "@/lib/use-local-submissions";

export default function MyWorkPage() {
  const profile = useAuthProfile();
  const nickname = profile?.display_name ?? "同学";
  const { submissions, loading, error } = useLocalSubmissions();
  const myAssignments = submissions.filter((submission) => submission.studentId === profile?.id);

  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="我的作业" subtitle={`${nickname} · 历史录音与 AI 反馈`} />
        <div className="hero">
          <p className="kicker">I miei compiti</p>
          <h1>回看每一次提交和修改。</h1>
          <p>这里展示录音的公开状态、提交版本和 AI 分析结果。</p>
        </div>
        <div className="stack">
          {myAssignments.map((submission) => (
            <section className="stack" key={submission.submissionId}>
              <LocalSubmissionCard submission={submission} />
              <Link className="button secondary full" href="/ai-feedback">
                <Eye size={18} />
                查看 AI 反馈
              </Link>
            </section>
          ))}
          {!loading && !error && myAssignments.length === 0 ? (
            <section className="quiet-card">
              <h2>还没有提交记录</h2>
              <p>完成一次跟读录音后，不同版本会按时间显示在这里。</p>
              <Link className="button full" href="/courses/giorno-4">去录制今日作业</Link>
            </section>
          ) : null}
          {loading ? <p className="notice">正在读取本地作业...</p> : null}
          {error ? <p className="notice" role="alert">{error}</p> : null}
        </div>
      </section>
    </AppFrame>
  );
}
