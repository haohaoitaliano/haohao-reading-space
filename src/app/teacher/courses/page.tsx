import { Plus } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { TeacherCourseCampFilter } from "@/components/TeacherCourseCampFilter";
import { requireAdmin } from "@/lib/auth";
import { filterCoursesForCamp, selectCourseCamp } from "@/lib/cloud-course";
import { getAdminCampOptions, getAdminCourseList } from "@/lib/cloud-course-data";
import { formatUnlockDateTime } from "@/lib/course-schedule";

export default async function TeacherCoursesPage({ searchParams }: {
  searchParams: Promise<{ camp?: string; intent?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const [courseResult, camps] = await Promise.all([getAdminCourseList(), getAdminCampOptions()]);
  const selectedCamp = selectCourseCamp(camps, query.camp);
  const visibleCourses = selectedCamp ? filterCoursesForCamp(courseResult.courses, selectedCamp.id) : [];
  const isMediaIntent = query.intent === "media";

  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="课程管理" subtitle="云端课程内容" backHref="/teacher" />
        <section className="hero">
          <p className="kicker">Cloud Courses</p>
          <h1>管理每节课程。</h1>
          <p>按训练营筛选课程，进入具体课程后可编辑文字内容、示范音频和示范视频。</p>
        </section>

        {isMediaIntent ? (
          <p className="notice">请先选择具体课程，进入编辑页后上传或替换示范音频、示范视频。</p>
        ) : null}

        <section className="stack">
          <div className="row">
            <div>
              <p className="kicker">Courses</p>
              <h2>课程列表</h2>
            </div>
            <Link className="button" href={selectedCamp ? `/teacher/courses/new?camp=${selectedCamp.id}` : "/teacher/courses/new"}><Plus size={18} /> 新建课程</Link>
          </div>

          {selectedCamp ? <TeacherCourseCampFilter camps={camps} selectedCampId={selectedCamp.id} /> : null}
          {courseResult.error ? <p className="notice" role="alert">课程数据库暂时不可用。</p> : null}
          {!courseResult.error && selectedCamp && !visibleCourses.length ? <p className="notice">{selectedCamp.name} 当前没有课程。</p> : null}
          {!courseResult.error && !selectedCamp ? <p className="notice">请先创建训练营。</p> : null}

          {visibleCourses.map((course) => (
            <Link href={`/teacher/courses/${course.id}/edit`} key={course.id}>
              <article className="item-card">
                <div className="row start">
                  <div>
                    <p className="kicker">{selectedCamp?.name} · Giorno {course.dayNumber}</p>
                    <h3>{course.italianTitle}</h3>
                    <p style={{ margin: 0 }}>{course.chineseTitle} · {formatUnlockDateTime(course.unlockAt, course.timezone)}</p>
                  </div>
                  <span className={`pill ${course.status === "published" ? "olive" : "muted"}`}>
                    {course.status === "published" ? "已发布" : course.status === "draft" ? "草稿" : "已归档"}
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
