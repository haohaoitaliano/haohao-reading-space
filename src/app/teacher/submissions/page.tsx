import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { PhotoSubmissionCard } from "@/components/PhotoSubmissionCard";
import { requireAdmin } from "@/lib/auth";
import { getAdminCloudSubmissions } from "@/lib/cloud-submission-data";
import { getAdminPhotoSubmissions, getAdminUnifiedAssignments } from "@/lib/photo-submission-data";

export default async function TeacherSubmissionsPage() {
  await requireAdmin();
  const [result, photoResult, unifiedResult] = await Promise.all([
    getAdminCloudSubmissions(),
    getAdminPhotoSubmissions(),
    getAdminUnifiedAssignments(),
  ]);
  const unifiedById = new Map(unifiedResult.assignments.map((assignment) => [assignment.assignmentId, assignment]));

  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="学生提交记录" subtitle="录音与照片" backHref="/teacher" />
        <section className="hero">
          <p className="kicker">Submissions</p>
          <h1>查看学生作业。</h1>
          <p>同一次提交的录音与照片合并展示；旧版独立提交继续保留。</p>
        </section>

        <section className="quiet-card stack" style={{ marginTop: 18 }}>
          <div className="row"><h2>旧版照片作业历史</h2><span className="pill muted">历史</span></div>
          {photoResult.submissions.map((submission) => (
            <PhotoSubmissionCard key={submission.id} submission={submission} />
          ))}
          {!photoResult.error && photoResult.submissions.length === 0 ? <p className="notice">还没有学生提交照片作业。</p> : null}
          {photoResult.error ? <p className="notice" role="alert">照片提交暂时无法读取。</p> : null}
        </section>

        <section className="quiet-card stack">
          <div className="row"><h2>提交记录</h2><span className="pill sky">云端</span></div>
          {result.submissions.map((submission) => {
            const assignment = unifiedById.get(submission.id);
            return <CloudSubmissionCard
              assignmentId={assignment?.assignmentId}
              key={submission.id}
              photos={assignment?.photos}
              showInteractions
              submission={assignment ? { ...submission, version: assignment.version, createdAt: assignment.createdAt } : submission}
            />;
          })}
          {unifiedResult.assignments.filter((assignment) => !assignment.hasRecording).map((assignment) => (
            <CloudSubmissionCard
              assignmentId={assignment.assignmentId}
              key={assignment.assignmentId}
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
                encouragementCount: 0,
                hasEncouraged: false,
                commentCount: 0,
                comments: [],
              }}
            />
          ))}
          {!result.error && result.submissions.length === 0 ? <p className="notice">还没有学生提交录音。</p> : null}
          {result.error ? <p className="notice" role="alert">学生提交暂时无法读取。</p> : null}
          {unifiedResult.error ? <p className="notice" role="alert">统一作业暂时无法读取。</p> : null}
        </section>
      </section>
    </main>
  );
}
