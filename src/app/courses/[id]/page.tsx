import { Lock } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { StudentCourseDetail } from "@/components/StudentCourseDetail";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getStudentCourseDayLabel, parseCourseDay } from "@/lib/cloud-course";
import { getStudentCourseByDay } from "@/lib/cloud-course-data";
import { getOwnPhotoSubmissions } from "@/lib/photo-submission-data";
import { formatUnlockDateTime } from "@/lib/course-schedule";

type CoursePageProps = { params: Promise<{ id: string }> };

export default async function CoursePage({ params }: CoursePageProps) {
  const { profile } = await requireAuthenticatedUser();
  const { id } = await params;
  const dayNumber = parseCourseDay(id);
  const result = dayNumber !== null
    ? await getStudentCourseByDay(profile.id, dayNumber)
    : { state: "not_found" as const, course: null };

  if (result.state === "locked" && result.course) {
    return (
      <AppFrame active="courses">
        <section className="screen with-top">
          <Header title={getStudentCourseDayLabel(result.course.dayNumber)} subtitle={result.course.chineseTitle} backHref="/courses" />
          <section className="hero">
            <Lock color="var(--accent)" size={38} />
            <p className="kicker" style={{ marginTop: 14 }}>课程未解锁</p>
            <h1>{result.course.italianTitle}</h1>
            <p>{result.course.chineseTitle}</p>
          </section>
          <p className="notice">解锁时间：{formatUnlockDateTime(result.course.unlockAt, result.course.timezone)}（{result.course.timezone}）。正文、感想引导和词汇将在解锁后显示。</p>
        </section>
      </AppFrame>
    );
  }

  if (result.state !== "ok" || !result.course) {
    const message = result.state === "database_error"
      ? "课程数据库暂时不可用，请稍后重试。"
      : result.state === "no_membership"
        ? "你尚未加入训练营。"
        : result.state === "no_selected_camp"
          ? "请先选择当前学习空间。"
        : "课程不存在或仍是草稿。";
    return (
      <AppFrame active="courses">
        <section className="screen with-top">
          <Header title="课程" backHref="/courses" />
          <section className="notice" role="alert">{message}</section>
          {result.state === "no_selected_camp" ? <Link className="button full" href="/spaces">前往我的学习空间</Link> : null}
          <Link className="button secondary full" href="/courses">返回课程列表</Link>
        </section>
      </AppFrame>
    );
  }

  const photoResult = result.camp
    ? await getOwnPhotoSubmissions(profile.id, result.camp.id, result.course.id)
    : { submissions: [], error: false };
  return (
    <AppFrame active="courses">
      <StudentCourseDetail
        course={result.course}
        latestPhotoSubmission={result.latestPhotoSubmission}
        latestSubmission={result.latestSubmission}
        photoSubmissions={photoResult.submissions}
      />
    </AppFrame>
  );
}
