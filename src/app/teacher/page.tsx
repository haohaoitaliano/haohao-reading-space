import { BookPlus, ChartBar, Headphones, KeyRound, MessageSquareText, UserPlus, Video } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";
import { requireAdmin } from "@/lib/auth";

export default async function TeacherPage() {
  const { profile } = await requireAdmin();
  const tools = [
    { label: "训练营管理", icon: UserPlus, text: "停用、启用、新建与排期", href: "/teacher/camps" },
    { label: "邀请码管理", icon: KeyRound, text: "创建、查看次数和停用", href: "/teacher/invites" },
    { label: "课程管理", icon: BookPlus, text: "查看、新建和编辑课程", href: "/teacher/courses" },
    { label: "素材库", icon: Headphones, text: "管理音频、视频和课程素材", href: "/teacher/media" },
    { label: "用户管理", icon: MessageSquareText, text: "查找学员、查看所属训练营与作业", href: "/teacher/submissions" },
    { label: "查看学习完成情况", icon: ChartBar, text: "查看已提交和未提交课程", href: "/teacher/progress" },
    { label: "管理线上见面", icon: Video, text: "创建、编辑和删除会议", href: "/teacher/meetings" },
  ];

  return (
    <main className="app-shell">
      <section className="screen with-top">
        <Header title="老师后台" subtitle={`${profile.display_name} · 管理员`} />
        <div className="hero">
          <p className="kicker">Teacher Studio</p>
          <h1>选择今天要管理的内容。</h1>
          <p>课程、训练营、示范媒体和学生提交都在各自页面中管理。</p>
        </div>

        <section className="teacher-grid">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const card = <article className="item-card teacher-tool-card"><span className="brand-mark teacher-tool-icon"><Icon size={18} /></span><div className="teacher-tool-copy"><h3>{tool.label}</h3><p>{tool.text}</p></div></article>;
            return <Link href={tool.href} key={tool.label}>{card}</Link>;
          })}
        </section>

        <div style={{ marginTop: 14 }}><LogoutButton className="button full" /></div>
      </section>
    </main>
  );
}
