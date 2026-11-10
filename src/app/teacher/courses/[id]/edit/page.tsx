import Link from "next/link";
import { Header } from "@/components/Header";
import { TeacherCourseEditor } from "@/components/TeacherCourseEditor";
import { requireAdmin } from "@/lib/auth";
import { getAdminCourse } from "@/lib/cloud-course-data";
import {
  archiveCloudCourse,
  permanentlyDeleteCloudCourse,
  reactivateCloudCourse,
  updateCloudCourse,
} from "@/app/teacher/course-actions";

type TeacherCourseEditPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ camp?: string }>;
};

export default async function TeacherCourseEditPage({ params, searchParams }: TeacherCourseEditPageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const course = await getAdminCourse(id);

  if (!course) {
    const coursesHref = query.camp
      ? `/teacher/courses?camp=${encodeURIComponent(query.camp)}`
      : "/teacher/courses";
    return <main className="app-shell"><section className="screen"><p className="notice">课程不存在或数据库暂时不可用。</p><Link className="button" href={coursesHref}>返回课程管理</Link></section></main>;
  }

  const saveAction = updateCloudCourse.bind(null, course.id);
  const archiveAction = archiveCloudCourse.bind(null, course.id);
  const reactivateAction = reactivateCloudCourse.bind(null, course.id);
  const deleteAction = permanentlyDeleteCloudCourse.bind(null, course.id);
  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="编辑云端课程" subtitle={`Giorno ${course.dayNumber}`} backHref={`/teacher/courses?camp=${encodeURIComponent(course.campId)}`} />
        <section className="hero"><p className="kicker">Course Editor</p><h1>{course.italianTitle}</h1><p>{course.chineseTitle} · 学生端刷新后读取最新云端内容。</p></section>
        <TeacherCourseEditor
          archiveAction={archiveAction}
          course={course}
          deleteAction={deleteAction}
          reactivateAction={reactivateAction}
          saveAction={saveAction}
        />
      </section>
    </main>
  );
}
