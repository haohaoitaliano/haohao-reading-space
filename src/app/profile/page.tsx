import { BookOpenCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getStudentCampProgress } from "@/lib/student-camp-progress";
import { NicknameForm } from "./NicknameForm";

export default async function ProfilePage() {
  const { profile, email } = await requireAuthenticatedUser();
  const { courseResult, submissionResult, stats } = await getStudentCampProgress(profile.id);
  const statsUnavailable = courseResult.state === "database_error" || submissionResult.error;

  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="个人资料" subtitle={profile.display_name} backHref="/progress" />

        <section className="hero">
          <div className="avatar" style={{ width: 58, height: 58, marginBottom: 16 }}>
            {profile.display_name.charAt(0)}
          </div>
          <p className="kicker">Il mio profilo</p>
          <h1>{profile.display_name}</h1>
          <p>{courseResult.camp?.name ?? "尚未选择当前训练营"}</p>
        </section>

        {courseResult.state === "database_error" ? <p className="notice" role="alert">训练营与课程数据暂时无法读取。</p> : null}
        {courseResult.state === "no_selected_camp" ? <p className="notice">请先在<Link href="/spaces">我的学习空间</Link>选择当前训练营。</p> : null}
        {courseResult.state === "no_membership" ? <p className="notice">尚未加入训练营。</p> : null}
        {submissionResult.error ? <p className="notice" role="alert">学习统计暂时无法读取。</p> : null}

        <section className="quiet-card stack">
          <div className="profile-info-row">
            <UserRound color="var(--sky)" />
            <div>
              <h3>真实登录身份</h3>
              <p style={{ margin: 0 }}>{email ?? "未提供邮箱"} · {profile.role === "admin" ? "管理员" : "学生"}</p>
            </div>
          </div>
          <div className="profile-info-row">
            <BookOpenCheck color="var(--olive)" />
            <div>
              <h3>本期学习</h3>
              <p style={{ margin: 0 }}>
                {statsUnavailable
                  ? "学习统计暂时无法读取"
                  : `已完成 ${stats.completedTasks} 个任务 · 已完成 ${stats.completedOutputs} 次输出`}
              </p>
            </div>
          </div>
        </section>

        {profile.role === "student" ? <NicknameForm initialDisplayName={profile.display_name} /> : null}

        <Link className="button full" href="/my-work" style={{ marginTop: 14 }}>
          查看我的作业
        </Link>
        <div style={{ marginTop: 10 }}><LogoutButton /></div>
      </section>
    </AppFrame>
  );
}
