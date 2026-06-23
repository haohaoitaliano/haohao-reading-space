"use client";

import { ArrowRight, CalendarCheck, Headphones, Mic2 } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { AssignmentCard } from "@/components/AssignmentCard";
import { assignments, courses, currentStudentId, progress } from "@/lib/mock-data";
import { useStudentNickname } from "@/lib/use-student-nickname";

export default function HomePage() {
  const nickname = useStudentNickname();
  const today = courses.find((course) => course.status === "today") ?? courses[0];
  const publicAssignments = assignments.filter(
    (assignment) => assignment.visibility === "public" && assignment.studentId !== currentStudentId,
  );

  return (
    <AppFrame active="home">
      <section className="screen with-top">
        <Header title="共读空间" subtitle={`Buongiorno, ${nickname}`} />

        <section className="hero">
          <p className="kicker">今日课程 · Giorno {today.day}</p>
          <h1>{today.titleIt}</h1>
          <p>{today.titleZh} · {today.intro}</p>
          <Link className="button" href={`/courses/${today.id}`}>
            进入今日阅读
            <ArrowRight size={18} />
          </Link>
        </section>

        <section className="grid-two" style={{ marginBottom: 14 }}>
          <div className="metric">
            <CalendarCheck size={20} color="var(--olive)" />
            <strong>{progress.completed}</strong>
            <span>已完成天数</span>
          </div>
          <div className="metric">
            <Mic2 size={20} color="var(--accent)" />
            <strong>{progress.streak}</strong>
            <span>连续学习</span>
          </div>
        </section>

        <section className="quiet-card stack">
          <div className="row">
            <div>
              <p className="kicker">今日任务</p>
              <h2>听、读、录、交流</h2>
            </div>
            <Headphones color="var(--sky)" />
          </div>
          <div className="progress-bar" aria-label="今日任务进度">
            <span style={{ "--value": "66%" } as React.CSSProperties} />
          </div>
          <p style={{ margin: 0 }}>已听示范音频，待提交跟读录音和阅读感受。</p>
        </section>

        <section style={{ marginTop: 18 }}>
          <div className="row">
            <h2>同学新作业</h2>
            <Link className="pill sky" href="/circle">查看全部</Link>
          </div>
          <div className="stack">
            {publicAssignments.slice(0, 2).map((assignment) => (
              <AssignmentCard assignment={assignment} key={assignment.id} compact />
            ))}
          </div>
        </section>
      </section>
    </AppFrame>
  );
}
