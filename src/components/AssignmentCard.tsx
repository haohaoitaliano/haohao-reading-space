import { Heart, MessageCircle } from "lucide-react";
import Link from "next/link";
import { getCourse, getStudent, type Assignment } from "@/lib/mock-data";

export function AssignmentCard({
  assignment,
  compact = false,
  displayName,
}: {
  assignment: Assignment;
  compact?: boolean;
  displayName?: string;
}) {
  const student = getStudent(assignment.studentId);
  const course = getCourse(assignment.courseId);
  const isPrivate = assignment.visibility === "teacher_only";

  const card = (
    <article className="item-card">
      <div className="row start">
        <div className="avatar">{displayName?.charAt(0) || student.avatar}</div>
        <div style={{ flex: 1 }}>
          <div>
            <strong>{displayName || `${student.name} · ${student.italianName}`}</strong>
            <p style={{ margin: "2px 0 0", fontSize: 13 }}>
              Giorno {course.day} · {assignment.submittedAt} · 第 {assignment.version} 版
            </p>
          </div>
          <p style={{ margin: "10px 0" }}>{assignment.reflection}</p>
          <div className="audio-track" aria-hidden="true">
            <span style={{ width: isPrivate ? "38%" : "70%" }} />
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <span className={`pill ${isPrivate ? "muted" : "sky"}`}>
              {isPrivate ? "仅老师可见" : "公开录音"}
            </span>
            {!compact ? (
              <div className="row" style={{ justifyContent: "flex-end", color: "var(--muted)", fontSize: 13 }}>
                <span className="row" style={{ gap: 4 }}>
                  <Heart size={15} /> {assignment.likes}
                </span>
                <span className="row" style={{ gap: 4 }}>
                  <MessageCircle size={15} /> {assignment.comments.length}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );

  if (isPrivate) {
    return card;
  }

  return <Link href={`/circle/${assignment.id}`}>{card}</Link>;
}
