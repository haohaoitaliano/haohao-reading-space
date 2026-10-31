import { Eye } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { PhotoSubmissionCard } from "@/components/PhotoSubmissionCard";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getActiveCampForUser } from "@/lib/cloud-course-data";
import { getOwnCloudSubmissions } from "@/lib/cloud-submission-data";
import { ENABLE_AI_FEEDBACK } from "@/lib/features";
import { getOwnPhotoSubmissions, getOwnUnifiedAssignments } from "@/lib/photo-submission-data";

export default async function MyWorkPage() {
  const { profile } = await requireAuthenticatedUser();
  const campResult = await getActiveCampForUser(profile.id);
  const [result, photoResult, unifiedResult] = campResult.state === "ok"
    ? await Promise.all([
      getOwnCloudSubmissions(profile.id, campResult.camp.id),
      getOwnPhotoSubmissions(profile.id, campResult.camp.id),
      getOwnUnifiedAssignments(profile.id, campResult.camp.id),
    ])
    : [
      { submissions: [], error: campResult.state === "database_error" },
      { submissions: [], error: campResult.state === "database_error" },
      { assignments: [], error: campResult.state === "database_error" },
    ];
  const unifiedById = new Map(unifiedResult.assignments.map((assignment) => [assignment.assignmentId, assignment]));

  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="我的作业" subtitle={`${profile.display_name} · ${campResult.camp?.name ?? "云端作业"}`} />
        <div className="hero">
          <p className="kicker">I miei compiti</p>
          <h1>历史提交</h1>
          <p>这里展示当前训练营中仍然保留的每一次录音与照片提交。</p>
        </div>
        <div className="stack">
          {campResult.state === "no_selected_camp" ? (
            <section className="notice">
              请先选择一个学习空间，再查看该训练营的作业。
              <Link href="/spaces"> 前往我的学习空间</Link>
            </section>
          ) : null}
          {campResult.state === "no_membership" ? (
            <section className="notice">
              尚未加入训练营。
              <Link href="/join-camp"> 输入邀请码</Link>
            </section>
          ) : null}
          {result.submissions.map((submission) => {
            const assignment = unifiedById.get(submission.id);
            const displayedSubmission = assignment
              ? { ...submission, version: assignment.version, createdAt: assignment.createdAt }
              : submission;
            return <section className="stack" key={submission.id}>
              <CloudSubmissionCard
                assignmentId={assignment?.assignmentId}
                manageable
                photos={assignment?.photos}
                showInteractions
                submission={displayedSubmission}
              />
              {ENABLE_AI_FEEDBACK ? (
                <Link className="button secondary full" href={`/ai-feedback?submissionId=${submission.id}`}>
                  <Eye size={18} />查看 AI 反馈
                </Link>
              ) : null}
            </section>;
          })}
          {photoResult.submissions.map((submission) => (
            <PhotoSubmissionCard key={submission.id} manageable submission={submission} />
          ))}
          {unifiedResult.assignments.filter((assignment) => !assignment.hasRecording).map((assignment) => (
            <CloudSubmissionCard
              assignmentId={assignment.assignmentId}
              key={assignment.assignmentId}
              manageable
              photos={assignment.photos}
              showInteractions
              submission={{
                id: assignment.assignmentId,
                courseId: assignment.courseId,
                dayNumber: assignment.dayNumber,
                courseTitle: assignment.courseTitle,
                studentName: assignment.studentName,
                durationSeconds: 0,
                targetDurationSeconds: null,
                visibility: assignment.visibility,
                version: assignment.version,
                createdAt: assignment.createdAt,
                audioUrl: "",
                isOwn: true,
                encouragementCount: 0,
                hasEncouraged: false,
                commentCount: 0,
                comments: [],
              }}
            />
          ))}
          {!result.error && !photoResult.error && !unifiedResult.error && result.submissions.length === 0 && photoResult.submissions.length === 0 && unifiedResult.assignments.length === 0 ? (
            <section className="quiet-card">
              <h2>还没有提交记录</h2>
              <p>完成录音或照片作业后，每一次独立提交都会按时间显示在这里。</p>
              <Link className="button full" href="/courses">去完成今日作业</Link>
            </section>
          ) : null}
          {result.error || photoResult.error || unifiedResult.error ? <p className="notice" role="alert">云端作业暂时无法读取，请稍后重试。</p> : null}
        </div>
      </section>
    </AppFrame>
  );
}
