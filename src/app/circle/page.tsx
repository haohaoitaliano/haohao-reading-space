import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getActiveCampForUser } from "@/lib/cloud-course-data";
import { getCampCircleSubmissions, getCampCompletedAssignmentCount } from "@/lib/cloud-submission-data";
import { getCampUnifiedAssignments } from "@/lib/photo-submission-data";

type CirclePageProps = {
  searchParams: Promise<{ submission?: string; comment?: string }>;
};

export default async function CirclePage({ searchParams }: CirclePageProps) {
  const { profile } = await requireAuthenticatedUser();
  const params = await searchParams;
  const focusedSubmissionId = typeof params.submission === "string" ? params.submission : "";
  const focusedCommentId = typeof params.comment === "string" ? params.comment : "";
  const campResult = await getActiveCampForUser(profile.id);
  const [result, unifiedResult, countResult] = campResult.state === "ok"
    ? await Promise.all([
      getCampCircleSubmissions(campResult.camp.id, profile.id),
      getCampUnifiedAssignments(campResult.camp.id, profile.id),
      getCampCompletedAssignmentCount(campResult.camp.id),
    ])
    : [
      { submissions: [], error: campResult.state === "database_error" },
      { assignments: [], error: campResult.state === "database_error" },
      { count: 0, error: campResult.state === "database_error" },
    ];
  const assignmentsById = new Map(unifiedResult.assignments.map((assignment) => [assignment.assignmentId, assignment]));
  const cards = [
    ...result.submissions.map((submission) => {
      const assignment = assignmentsById.get(submission.id);
      return {
        submission: assignment ? { ...submission, version: assignment.version, createdAt: assignment.createdAt } : submission,
        assignment,
      };
    }),
    ...unifiedResult.assignments.filter((assignment) => !assignment.hasRecording).map((assignment) => ({
      assignment,
      submission: {
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
        isOwn: assignment.isOwn,
        encouragementCount: 0,
        hasEncouraged: false,
        commentCount: assignment.commentCount,
        comments: [],
      },
    })),
  ].sort((left, right) => Date.parse(right.submission.createdAt) - Date.parse(left.submission.createdAt));

  return (
    <AppFrame active="circle">
      <section className="screen with-top">
        <Header title="同学作业圈" />
        <div className="hero circle-hero">
          <p className="kicker">Compagni di lettura</p>
          <h1>Passo dopo passo 👣，每一次表达都是一小步的进步。</h1>
          {!countResult.error ? (
            <p className="circle-total">到今天为止，我们一起输出了 <strong>{countResult.count}</strong> 份作业 👏</p>
          ) : null}
        </div>
        <div className="stack">
          {cards.map(({ submission, assignment }) => (
            <CloudSubmissionCard
              assignmentId={assignment?.assignmentId}
              focusCommentId={submission.id === focusedSubmissionId ? focusedCommentId : undefined}
              key={assignment?.assignmentId ?? submission.id}
              photos={assignment?.photos}
              showInteractions
              submission={submission}
            />
          ))}
          {campResult.state === "no_selected_camp" ? <p className="notice">请先在<Link href="/spaces">我的学习空间</Link>选择当前训练营。</p> : null}
          {campResult.state === "no_membership" ? <p className="notice">尚未加入训练营。</p> : null}
          {!result.error && !unifiedResult.error && cards.length === 0 ? <p className="notice">当前训练营暂时没有可见作业。</p> : null}
          {result.error || unifiedResult.error || countResult.error ? <p className="notice" role="alert">作业圈暂时无法读取，请稍后重试。</p> : null}
        </div>
      </section>
    </AppFrame>
  );
}
