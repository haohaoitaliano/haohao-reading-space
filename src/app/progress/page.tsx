"use client";

import { BookOpenCheck, CalendarDays, ChartNoAxesColumnIncreasing, Mic2 } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { progress } from "@/lib/mock-data";
import { useStudentNickname } from "@/lib/use-student-nickname";

export default function ProgressPage() {
  const nickname = useStudentNickname();
  const completion = Math.round((progress.completed / progress.totalDays) * 100);

  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="学习进度" subtitle={`${nickname} · 21 天共读`} />
        <div className="hero">
          <p className="kicker">Progresso</p>
          <h1>{nickname}，已经完成 {progress.completed} 天，继续保持。</h1>
          <p>进度数据均为本地模拟，用来展示第一版学生端统计方式。</p>
        </div>

        <section className="quiet-card stack">
          <div className="row">
            <h2>本期共读进度</h2>
            <ChartNoAxesColumnIncreasing color="var(--olive)" />
          </div>
          <div className="progress-bar">
            <span style={{ "--value": `${completion}%` } as React.CSSProperties} />
          </div>
          <p style={{ margin: 0 }}>{completion}% · 已解锁 {progress.unlocked} 天</p>
        </section>

        <section className="grid-two" style={{ marginTop: 14 }}>
          <div className="metric"><BookOpenCheck /><strong>{progress.completed}</strong><span>已经完成</span></div>
          <div className="metric"><Mic2 /><strong>{progress.submitted}</strong><span>提交录音</span></div>
          <div className="metric"><CalendarDays /><strong>{progress.unlocked}</strong><span>已经解锁</span></div>
          <div className="metric"><ChartNoAxesColumnIncreasing /><strong>{progress.resubmitted}</strong><span>重新提交</span></div>
        </section>

        <section className="notice" style={{ marginTop: 14 }}>
          本期共读：{progress.totalDays} 天；尚未完成：{progress.unfinished} 天；连续学习：{progress.streak} 天。
        </section>

        <Link className="button secondary full" href="/profile" style={{ marginTop: 14 }}>
          查看个人资料
        </Link>
      </section>
    </AppFrame>
  );
}
