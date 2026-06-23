"use client";

import { BookOpenCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { useAuthProfile } from "@/components/AuthProfileProvider";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";
import { getStudent, currentStudentId, progress } from "@/lib/mock-data";
import { useStudentNickname } from "@/lib/use-student-nickname";

export default function ProfilePage() {
  const nickname = useStudentNickname();
  const profile = useAuthProfile();
  const student = getStudent(currentStudentId);

  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="个人资料" subtitle={nickname} backHref="/progress" />

        <section className="hero">
          <div className="avatar" style={{ width: 58, height: 58, marginBottom: 16 }}>
            {nickname.charAt(0)}
          </div>
          <p className="kicker">Il mio profilo</p>
          <h1>{nickname}</h1>
          <p>好好意语 7 天免费公测 · 当前模拟级别 {student.level}</p>
        </section>

        <section className="quiet-card stack">
          <div className="row start">
            <UserRound color="var(--sky)" />
            <div>
              <h3>真实登录身份</h3>
              <p style={{ margin: 0 }}>{profile?.email ?? "邮箱信息加载中"} · {profile?.role === "admin" ? "管理员" : "学生"}</p>
            </div>
          </div>
          <div className="row start">
            <BookOpenCheck color="var(--olive)" />
            <div>
              <h3>本期学习</h3>
              <p style={{ margin: 0 }}>已完成 {progress.completed} 天，提交 {progress.submitted} 次录音。</p>
            </div>
          </div>
        </section>

        <Link className="button full" href="/my-work" style={{ marginTop: 14 }}>
          查看我的作业
        </Link>
        <div style={{ marginTop: 10 }}><LogoutButton /></div>
      </section>
    </AppFrame>
  );
}
