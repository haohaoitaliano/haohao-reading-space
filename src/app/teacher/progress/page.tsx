import { cookies } from "next/headers";
import { Header } from "@/components/Header";
import { TeacherLearningProgress } from "@/components/TeacherLearningProgress";
import { ACTIVE_CAMP_COOKIE } from "@/lib/active-camp-cookie";
import { requireAdmin } from "@/lib/auth";
import { getAdminLearningProgress } from "@/lib/teacher-operations-data";

export default async function TeacherProgressPage({ searchParams }: {
  searchParams: Promise<{ camp?: string }>;
}) {
  await requireAdmin();
  const [query, cookieStore, result] = await Promise.all([
    searchParams,
    cookies(),
    getAdminLearningProgress(),
  ]);
  const requestedCampId = query.camp ?? cookieStore.get(ACTIVE_CAMP_COOKIE)?.value;
  const initialCampId = result.camps.some(({ camp }) => camp.id === requestedCampId)
    ? requestedCampId!
    : (result.camps[0]?.camp.id ?? "");
  return <main className="app-shell"><section className="screen with-top">
    <Header backHref="/teacher" subtitle="已发布且已解锁课程" title="学习完成情况" />
    {result.error ? <p className="notice" role="alert">学习完成情况暂时无法读取。</p> : null}
    {!result.error ? <TeacherLearningProgress camps={result.camps} initialCampId={initialCampId} /> : null}
  </section></main>;
}
