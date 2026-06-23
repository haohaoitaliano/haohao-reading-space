import { Heart, MessageCircle, Play } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { AudioPlayerMock } from "@/components/AudioPlayerMock";
import { getAssignment, getCourse, getStudent } from "@/lib/mock-data";

type AssignmentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AssignmentPage({ params }: AssignmentPageProps) {
  const { id } = await params;
  const assignment = getAssignment(id);
  const student = getStudent(assignment.studentId);
  const course = getCourse(assignment.courseId);

  return (
    <AppFrame active="circle">
      <section className="screen with-top">
        <Header title="公开作业详情" subtitle={`Giorno ${course.day}`} backHref="/circle" />

        <section className="quiet-card stack">
          <div className="row start">
            <div className="avatar">{student.avatar}</div>
            <div>
              <p className="kicker">{student.italianName}</p>
              <h1 style={{ fontSize: 26, marginBottom: 6 }}>{student.name} 的跟读</h1>
              <p style={{ margin: 0 }}>{course.titleIt} · {assignment.submittedAt}</p>
            </div>
          </div>
          <AudioPlayerMock title="同学公开录音" duration="01:32" />
          <p>{assignment.reflection}</p>
          <div className="grid-two">
            <button className="button secondary">
              <Heart size={18} />
              点赞 {assignment.likes}
            </button>
            <button className="button ghost">
              <Play size={18} />
              收听
            </button>
          </div>
        </section>

        <section className="quiet-card stack" style={{ marginTop: 14 }}>
          <div className="row">
            <h2>评论</h2>
            <MessageCircle color="var(--sky)" />
          </div>
          {assignment.comments.map((comment) => (
            <div className="item-card" key={comment.id}>
              <strong>{comment.studentName}</strong>
              <p style={{ margin: "4px 0 0" }}>{comment.content}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>{comment.time}</p>
            </div>
          ))}
          <button className="button full">写一句鼓励</button>
        </section>

        <section className="quiet-card" style={{ marginTop: 14 }}>
          <p className="kicker">隐私说明</p>
          <p style={{ marginBottom: 0 }}>同学可以收听公开录音和互动，但看不到该同学的 AI 详细反馈。</p>
          <Link className="pill muted" href="/ai-feedback" style={{ marginTop: 10 }}>
            查看本人 AI 反馈示例
          </Link>
        </section>
      </section>
    </AppFrame>
  );
}
