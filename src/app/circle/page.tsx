import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { CircleFeed } from "@/components/CircleFeed";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getCampCirclePage } from "@/lib/circle-page-data";
import { getActiveCampForUser } from "@/lib/cloud-course-data";
import { getCampCompletedAssignmentCount } from "@/lib/cloud-submission-data";

type CirclePageProps = {
  searchParams: Promise<{ submission?: string; comment?: string }>;
};

export default async function CirclePage({ searchParams }: CirclePageProps) {
  const { profile } = await requireAuthenticatedUser();
  const params = await searchParams;
  const focusedSubmissionId = typeof params.submission === "string" ? params.submission : "";
  const focusedCommentId = typeof params.comment === "string" ? params.comment : "";
  const campResult = await getActiveCampForUser(profile.id);
  const [pageResult, countResult] = campResult.state === "ok"
    ? await Promise.all([
      getCampCirclePage(campResult.camp.id, profile.id),
      getCampCompletedAssignmentCount(campResult.camp.id),
    ])
    : [
      { cards: [], nextCursor: null, error: campResult.state === "database_error" },
      { count: 0, error: campResult.state === "database_error" },
    ];

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
        {countResult.error ? <p className="notice" role="alert">累计作业数暂时无法读取。</p> : null}
        {campResult.state === "ok" ? (
          <CircleFeed
            campId={campResult.camp.id}
            focusedSubmissionId={focusedSubmissionId}
            focusCommentId={focusedCommentId}
            initialCards={pageResult.cards}
            initialError={pageResult.error}
            initialNextCursor={pageResult.nextCursor}
          />
        ) : (
          <div className="stack">
          {campResult.state === "no_selected_camp" ? <p className="notice">请先在<Link href="/spaces">我的学习空间</Link>选择当前训练营。</p> : null}
          {campResult.state === "no_membership" ? <p className="notice">尚未加入训练营。</p> : null}
          {campResult.state === "database_error" ? <p className="notice" role="alert">作业圈暂时无法读取，请稍后重试。</p> : null}
          </div>
        )}
      </section>
    </AppFrame>
  );
}
