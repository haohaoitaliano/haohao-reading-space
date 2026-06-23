import { AppFrame } from "@/components/AppFrame";
import { CourseCard } from "@/components/CourseCard";
import { Header } from "@/components/Header";
import { courses } from "@/lib/mock-data";

export default function CoursesPage() {
  return (
    <AppFrame active="courses">
      <section className="screen with-top">
        <Header title="21 天共读课程" subtitle="每天自动解锁一节" />
        <div className="hero">
          <p className="kicker">Corso di lettura</p>
          <h1>7 节示例课，展示 21 天训练营节奏。</h1>
          <p>已完成、今日解锁和未解锁状态都使用本地模拟数据。未解锁课程只显示标题和解锁日期。</p>
        </div>
        <div className="stack">
          {courses.map((course) => (
            <CourseCard course={course} key={course.id} />
          ))}
        </div>
      </section>
    </AppFrame>
  );
}
