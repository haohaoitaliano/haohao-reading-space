"use client";

import { AppFrame } from "@/components/AppFrame";
import { AssignmentCard } from "@/components/AssignmentCard";
import { Header } from "@/components/Header";
import { LocalSubmissionCard } from "@/components/LocalSubmissionCard";
import { assignments } from "@/lib/mock-data";
import { isSubmissionVisibleInCircle } from "@/lib/submission-store";
import { useLocalSubmissions } from "@/lib/use-local-submissions";

export default function CirclePage() {
  const publicAssignments = assignments.filter((assignment) => assignment.visibility === "public");
  const { submissions, loading, error } = useLocalSubmissions();
  const localPublicAssignments = submissions.filter(isSubmissionVisibleInCircle);

  return (
    <AppFrame active="circle">
      <section className="screen with-top">
        <Header title="同学作业圈" subtitle="只展示同班公开录音" />
        <div className="hero">
          <p className="kicker">Compagni di lettura</p>
          <h1>听见同学，也听见自己的进步。</h1>
          <p>公开录音可以被同班同学收听、点赞和评论；仅老师可见录音不会出现在作业圈。</p>
        </div>
        <div className="stack">
          {publicAssignments.map((assignment) => (
            <AssignmentCard assignment={assignment} key={assignment.id} />
          ))}
          {localPublicAssignments.map((submission) => (
            <LocalSubmissionCard key={submission.submissionId} submission={submission} />
          ))}
          {loading ? <p className="notice">正在读取本地公开作业...</p> : null}
          {error ? <p className="notice" role="alert">{error}</p> : null}
        </div>
      </section>
    </AppFrame>
  );
}
