import { BookPlus, ChartBar, Headphones, MessageSquareText, Plus, Video } from "lucide-react";
import Link from "next/link";
import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";
import { TeacherCampScheduleEditor } from "@/components/TeacherCampScheduleEditor";
import { requireAdmin } from "@/lib/auth";
import { getAdminCampOptions, getAdminCourseList } from "@/lib/cloud-course-data";
import { formatUnlockDateTime } from "@/lib/course-schedule";
import { getAdminCloudSubmissions } from "@/lib/cloud-submission-data";
import { weeklyMeeting } from "@/lib/mock-data";

export default async function TeacherPage() {
  const { profile } = await requireAdmin();
  const [courseResult, submissionResult, camps] = await Promise.all([
    getAdminCourseList(),
    getAdminCloudSubmissions(),
    getAdminCampOptions(),
  ]);
  const tools = [
    { label: "管理课程", icon: BookPlus, text: `${courseResult.courses.length} 节云端课程`, href: "#cloud-courses" },
    { label: "上传示范音频或视频", icon: Headphones, text: "在课程编辑页管理云端示范音频", href: courseResult.courses[0] ? `/teacher/courses/${courseResult.courses[0].id}/edit` : undefined },
    { label: "查看学生提交记录", icon: MessageSquareText, text: `${submissionResult.submissions.length} 条云端提交`, href: "#student-submissions" },
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
          <p>课程、示范音频和学生提交均由 Supabase 私有存储与权限规则保护。</p>
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
                  <div className="row start"><div><p className="kicker">Giorno {course.dayNumber}</p><h3>{course.italianTitle}</h3><p style={{ margin: 0 }}>{course.chineseTitle} · {formatUnlockDateTime(course.unlockAt, course.timezone)}</p></div>
                    <span className={`pill ${course.status === "published" ? "olive" : "muted"}`}>{course.status === "published" ? "已发布" : course.status === "draft" ? "草稿" : "已归档"}</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>

        <section className="quiet-card stack" style={{ marginTop: 20 }}>
          <div><p className="kicker">Daily Unlock</p><h2>训练营自动解锁</h2></div>
          <p>Giorno 1 使用训练营开始时间，之后每节按训练营当地日历顺延一天。</p>
          {camps.map((camp) => <TeacherCampScheduleEditor camp={camp} key={camp.id} />)}
        </section>

        <section className="quiet-card stack" id="student-submissions" style={{ marginTop: 20 }}>
          <div className="row"><h2>学生提交记录</h2><span className="pill sky">云端</span></div>
          {submissionResult.submissions.map((submission) => (
            <CloudSubmissionCard key={submission.id} submission={submission} />
          ))}
          {!submissionResult.error && submissionResult.submissions.length === 0 ? <p className="notice">还没有学生提交录音。</p> : null}
          {submissionResult.error ? <p className="notice" role="alert">学生提交暂时无法读取。</p> : null}
        </section>

        <div style={{ marginTop: 14 }}><LogoutButton className="button full" /></div>
      </section>
    </main>
  );
}
