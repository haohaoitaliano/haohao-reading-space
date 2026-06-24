import { BookOpenCheck, CircleAlert, CircleCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { requireAdmin } from "@/lib/auth";
import { getAdminLearningProgress } from "@/lib/teacher-operations-data";

export default async function TeacherProgressPage() {
  await requireAdmin();
  const result = await getAdminLearningProgress();
  return <main className="app-shell"><section className="screen with-top">
    <Header backHref="/teacher" subtitle="已发布且已解锁课程" title="学习完成情况" />
    <section className="hero"><p className="kicker">Completion</p><h1>查看每位学生的课程提交。</h1><p>多版本按课程去重；草稿、归档和未来课程不计入未完成。</p></section>
    {result.error ? <p className="notice" role="alert">学习完成情况暂时无法读取。</p> : null}
    {result.camps.map(({ camp, students }) => <section className="stack" key={camp.id}>
      <div className="row start"><div><p className="kicker">{camp.slug}</p><h2>{camp.name}</h2></div><BookOpenCheck color="var(--olive)" /></div>
      {!students.length ? <p className="notice">当前没有 active 学生。</p> : null}
      {students.map((student) => <article className="item-card" key={student.userId}>
        <div className="row start"><div><h3>{student.displayName}</h3><p style={{ margin: 0 }}>已提交 {student.submittedCount} / {student.availableCount} 节</p></div>
          <span className={`pill ${student.missingCourses.length ? "muted" : "olive"}`}>{student.missingCourses.length ? `${student.missingCourses.length} 节未交` : "已完成"}</span>
        </div>
        <div style={{ marginTop: 12 }}><p className="kicker"><CircleCheck size={14} /> 已提交课程</p><p>{student.submittedCourses.length ? student.submittedCourses.map((course) => `Giorno ${course.dayNumber} · ${course.title}`).join("；") : "暂无"}</p></div>
        <div><p className="kicker"><CircleAlert size={14} /> 未提交课程</p><p style={{ marginBottom: 0 }}>{student.missingCourses.length ? student.missingCourses.map((course) => `Giorno ${course.dayNumber} · ${course.title}`).join("；") : "无"}</p></div>
      </article>)}
    </section>)}
  </section></main>;
}
