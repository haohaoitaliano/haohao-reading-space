import { BookPlus, ChartBar, Headphones, MessageSquareText, Video } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";
import { requireAdmin } from "@/lib/auth";
import { assignments, courses, getCourse, getStudent, weeklyMeeting } from "@/lib/mock-data";

const tools = [
  { label: "管理课程", icon: BookPlus, text: `${courses.length} 节示例课，管理解锁时间和阅读材料`, href: "/teacher/courses/giorno-4/edit" },
  { label: "上传示范音频或视频", icon: Headphones, text: "进入课程编辑页选择本地示范音频", href: "/teacher/courses/giorno-4/edit" },
  { label: "查看学生提交记录", icon: MessageSquareText, text: `${assignments.length} 条提交，含公开和仅老师可见`, href: undefined },
  { label: "查看学习完成情况", icon: ChartBar, text: "查看完成天数、提交和补交状态", href: undefined },
  { label: "管理每周线上会议", icon: Video, text: weeklyMeeting.title, href: undefined },
];

export default async function TeacherPage() {
  const { profile } = await requireAdmin();

  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="老师后台" subtitle={`${profile.display_name} · 管理员`} backHref="/home" />
        <div className="hero">
          <p className="kicker">Teacher Studio</p>
          <h1>管理课程、学习素材、提交记录和周会。</h1>
          <p>当前已启用真实管理员身份检查；课程和录音仍使用本地原型数据。</p>
        </div>

        <section className="teacher-grid">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const card = (
              <article className="item-card" key={tool.label}>
                <div className="row start">
                  <span className="brand-mark" style={{ width: 38, height: 38, background: "var(--olive)" }}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3>{tool.label}</h3>
                    <p style={{ margin: 0 }}>{tool.text}</p>
                  </div>
                </div>
              </article>
            );

            return tool.href ? <Link href={tool.href} key={tool.label}>{card}</Link> : card;
          })}
        </section>

        <section className="quiet-card stack" style={{ marginTop: 14 }}>
          <div className="row">
            <h2>学生提交记录</h2>
            <span className="pill sky">全部可见</span>
          </div>
          {assignments.map((assignment) => {
            const student = getStudent(assignment.studentId);
            const course = getCourse(assignment.courseId);

            return (
              <div className="item-card" key={assignment.id}>
                <div className="row start">
                  <div>
                    <strong>{student.name} · Giorno {course.day}</strong>
                    <p style={{ margin: "4px 0" }}>{assignment.submittedAt} · 第 {assignment.version} 版</p>
                  </div>
                  <span className={`pill ${assignment.visibility === "public" ? "sky" : "muted"}`}>
                    {assignment.visibility === "public" ? "公开" : "仅老师可见"}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0" }}>
                  AI 分析：{assignment.aiStatus === "ready" ? "已生成" : "处理中"}
                </p>
              </div>
            );
          })}
        </section>

        <div style={{ marginTop: 14 }}><LogoutButton className="button full" /></div>
      </section>
    </main>
  );
}
