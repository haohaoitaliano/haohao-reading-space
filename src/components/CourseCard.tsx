import { Check, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Course } from "@/lib/mock-data";

const labels = {
  completed: { text: "已完成", className: "olive", icon: Check },
  today: { text: "今日解锁", className: "sky", icon: Sparkles },
  locked: { text: "未解锁", className: "muted", icon: Lock },
} as const;

export function CourseCard({ course }: { course: Course }) {
  const meta = labels[course.status];
  const Icon = meta.icon;
  const content = (
    <article className="item-card">
      <div className="row start">
        <div className={`course-status ${course.status === "locked" ? "locked" : ""}`}>
          {course.status === "locked" ? <Lock size={18} /> : course.day}
        </div>
        <div style={{ flex: 1 }}>
          <div className="row start">
            <div>
              <p className="kicker">Giorno {course.day}</p>
              <h3>{course.titleIt}</h3>
            </div>
            <span className={`pill ${meta.className}`}>
              <Icon size={13} />
              {meta.text}
            </span>
          </div>
          <p style={{ marginBottom: 4 }}>{course.titleZh} · {course.intro}</p>
          {course.status === "locked" ? (
            <p style={{ margin: 0, fontSize: 13 }}>解锁日期：{course.unlockDate}</p>
          ) : null}
        </div>
      </div>
    </article>
  );

  if (course.status === "locked") {
    return content;
  }

  return <Link href={`/courses/${course.id}`}>{content}</Link>;
}
