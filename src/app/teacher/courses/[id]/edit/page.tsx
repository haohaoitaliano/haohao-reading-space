import Link from "next/link";
import { Header } from "@/components/Header";
import { TeacherCourseEditor } from "@/components/TeacherCourseEditor";
import { requireAdmin } from "@/lib/auth";
import { getAdminCourse } from "@/lib/cloud-course-data";
import { updateCloudCourse } from "@/app/teacher/course-actions";

type TeacherCourseEditPageProps = { params: Promise<{ id: string }> };

export default async function TeacherCourseEditPage({ params }: TeacherCourseEditPageProps) {
  await requireAdmin();
  const { id } = await params;
  const course = await getAdminCourse(id);

  if (!course) {
    return <main className="app-shell"><section className="screen"><p className="notice">课程不存在或数据库暂时不可用。</p><Link className="button" href="/teacher">返回老师后台</Link></section></main>;
  }

  const saveAction = updateCloudCourse.bind(null, course.id);
  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="编辑云端课程" subtitle={`Giorno ${course.dayNumber}`} backHref="/teacher" />
        <section className="hero"><p className="kicker">Course Editor</p><h1>{course.italianTitle}</h1><p>{course.chineseTitle} · 学生端刷新后读取最新云端内容。</p></section>
        <TeacherCourseEditor course={course} saveAction={saveAction} />
      </section>
    </main>
  );
}
