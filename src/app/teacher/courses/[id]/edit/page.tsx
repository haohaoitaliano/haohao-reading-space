import { Header } from "@/components/Header";
import { TeacherCourseEditor } from "@/components/TeacherCourseEditor";
import { requireAdmin } from "@/lib/auth";
import { createLocalCourseData } from "@/lib/course-local-store";
import { getCourse } from "@/lib/mock-data";

type TeacherCourseEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeacherCourseEditPage({ params }: TeacherCourseEditPageProps) {
  await requireAdmin();
  const { id } = await params;
  const course = getCourse(id);
  const defaultCourse = createLocalCourseData(course);

  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="编辑每日课程" subtitle={`Giorno ${course.day}`} backHref="/teacher" />

        <section className="hero">
          <p className="kicker">Course Editor</p>
          <h1>{course.titleIt}</h1>
          <p>{course.titleZh} · 本阶段所有编辑内容均为本地原型。</p>
        </section>

        <TeacherCourseEditor defaultCourse={defaultCourse} />
      </section>
    </main>
  );
}
