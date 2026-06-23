import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { getCourseRouteId } from "@/lib/cloud-course";
import type { CloudCourseSummary } from "@/lib/cloud-course-data";

function formatUnlockAt(value: string | null) {
  if (!value) return "已开放";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

export function CourseCard({ course }: { course: CloudCourseSummary }) {
  const content = (
    <article className="item-card">
      <div className="row start">
        <div className={`course-status ${course.isUnlocked ? "" : "locked"}`}>
          {course.isUnlocked ? course.dayNumber : <Lock size={18} />}
        </div>
        <div style={{ flex: 1 }}>
          <div className="row start">
            <div>
              <p className="kicker">Giorno {course.dayNumber}</p>
              <h3>{course.italianTitle}</h3>
            </div>
            <span className={`pill ${course.isUnlocked ? "sky" : "muted"}`}>
              {course.isUnlocked ? <Sparkles size={13} /> : <Lock size={13} />}
              {course.isUnlocked ? "已解锁" : "未解锁"}
            </span>
          </div>
          <p style={{ marginBottom: 4 }}>{course.chineseTitle}</p>
          {!course.isUnlocked ? (
            <p style={{ margin: 0, fontSize: 13 }}>解锁时间：{formatUnlockAt(course.unlockAt)}</p>
          ) : null}
        </div>
      </div>
    </article>
  );

  if (!course.isUnlocked) return content;
  return <Link href={`/courses/${getCourseRouteId(course.dayNumber)}`}>{content}</Link>;
}
