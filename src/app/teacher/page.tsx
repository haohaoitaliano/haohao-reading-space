import { BookPlus, ChartBar, Headphones, MessageSquareText, Plus, Video } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";
import { requireAdmin } from "@/lib/auth";
import { getAdminCourseList } from "@/lib/cloud-course-data";
import { assignments, getCourse, getStudent, weeklyMeeting } from "@/lib/mock-data";

function formatUnlockAt(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(value))
    : "立即解锁";
}

export default async function TeacherPage() {
  const { profile } = await requireAdmin();
  const courseResult = await getAdminCourseList();
  const tools = [
    { label: "管理课程", icon: BookPlus, text: `${courseResult.courses.length} 节云端课程`, href: "#cloud-courses" },
    { label: "上传示范音频或视频", icon: Headphones, text: "音频仍在课程编辑页本地保存", href: courseResult.courses[0] ? `/teacher/courses/${courseResult.courses[0].id}/edit` : undefined },
    { label: "查看学生提交记录", icon: MessageSquareText, text: `${assignments.length} 条本地原型提交`, href: undefined },
    { label: "查看学习完成情况", icon: ChartBar, text: "查看完成天数、提交和补交状态", href: undefined },
    { label: "管理每周线上会议", icon: Video, text: weeklyMeeting.title, href: undefined },
  ];

  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="老师后台" subtitle={`${profile.display_name} · 管理员`} backHref="/home" />
        <div className="hero">
          <p className="kicker">Teacher Studio</p>
          <h1>管理云端课程与训练营学习内容。</h1>
          <p>课程文字和解锁信息保存到 Supabase；音频、录音和作业仍保留本地原型。</p>
        </div>

        <section className="teacher-grid">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const card = <article className="item-card"><div className="row start"><span className="brand-mark" style={{ width: 38, height: 38, background: "var(--olive)" }}><Icon size={18} /></span><div><h3>{tool.label}</h3><p style={{ margin: 0 }}>{tool.text}</p></div></div></article>;
            return tool.href ? <Link href={tool.href} key={tool.label}>{card}</Link> : <div key={tool.label}>{card}</div>;
          })}
        </section>

        <section id="cloud-courses" style={{ marginTop: 20 }}>
          <div className="row"><div><p className="kicker">Cloud Courses</p><h2>课程管理</h2></div>
            <Link className="button" href="/teacher/courses/new"><Plus size={18} /> 新建课程</Link>
          </div>
          {courseResult.error ? <p className="notice" role="alert">课程数据库暂时不可用。</p> : null}
          {!courseResult.error && !courseResult.courses.length ? <p className="notice">当前没有课程。</p> : null}
          <div className="stack">
            {courseResult.courses.map((course) => (
              <Link href={`/teacher/courses/${course.id}/edit`} key={course.id}>
                <article className="item-card">
                  <div className="row start"><div><p className="kicker">Giorno {course.dayNumber}</p><h3>{course.italianTitle}</h3><p style={{ margin: 0 }}>{course.chineseTitle} · {formatUnlockAt(course.unlockAt)}</p></div>
                    <span className={`pill ${course.status === "published" ? "olive" : "muted"}`}>{course.status === "published" ? "已发布" : course.status === "draft" ? "草稿" : "已归档"}</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>

        <section className="quiet-card stack" style={{ marginTop: 20 }}>
          <div className="row"><h2>学生提交记录</h2><span className="pill sky">本地原型</span></div>
          {assignments.map((assignment) => {
            const student = getStudent(assignment.studentId);
            const course = getCourse(assignment.courseId);
            return <div className="item-card" key={assignment.id}><strong>{student.name} · Giorno {course.day}</strong><p style={{ margin: "4px 0" }}>{assignment.submittedAt} · 第 {assignment.version} 版</p></div>;
          })}
        </section>

        <div style={{ marginTop: 14 }}><LogoutButton className="button full" /></div>
      </section>
    </main>
  );
}
