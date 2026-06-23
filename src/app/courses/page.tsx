import { AppFrame } from "@/components/AppFrame";
import { CourseCard } from "@/components/CourseCard";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getStudentCourseList } from "@/lib/cloud-course-data";

export default async function CoursesPage() {
  const { profile } = await requireAuthenticatedUser();
  const result = await getStudentCourseList(profile.id);

  return (
    <AppFrame active="courses">
      <section className="screen with-top">
        <Header title="共读课程" subtitle={result.camp?.name ?? "云端课程"} />
        <div className="hero">
          <p className="kicker">Corso di lettura</p>
          <h1>每天读一点，也听见自己的变化。</h1>
          <p>课程文字与解锁时间来自云端；未解锁课程只显示标题和开放时间。</p>
        </div>

        {result.state === "database_error" ? <p className="notice" role="alert">课程数据库暂时不可用。</p> : null}
        {result.state === "no_membership" ? <p className="notice">尚未加入训练营。</p> : null}
        {result.state === "empty" ? <p className="notice">训练营还没有已发布课程。</p> : null}
        <div className="stack">
          {result.courses.map((course) => <CourseCard course={course} key={course.id} />)}
        </div>
      </section>
    </AppFrame>
  );
}
