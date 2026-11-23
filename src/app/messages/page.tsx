import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { StudentMessageList } from "@/components/StudentMessageList";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getStudentMessagePage, getStudentMessages } from "@/lib/student-message-data";

export default async function MessagesPage() {
  const { profile } = await requireAuthenticatedUser();
  const [result, firstPage] = await Promise.all([getStudentMessages(profile.id), getStudentMessagePage(profile.id)]);

  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="我的消息" subtitle={result.camp?.name ?? "评论与回复"} backHref="/progress" />

        <section className="hero message-hero">
          <p className="kicker">I miei messaggi</p>
          <h1>评论与回复</h1>
          <p>点击一条消息，会进入原作业并打开对应评论。成功打开后才会标记为已读。</p>
          {result.state === "ok" && result.unreadCount > 0 ? (
            <span className="message-unread-summary"><span aria-hidden="true" className="message-dot" />{result.unreadCount} 条未读</span>
          ) : null}
        </section>

        {result.state === "no_selected_camp" ? <p className="notice">请先在我的学习空间选择当前训练营。</p> : null}
        {result.state === "no_membership" ? <p className="notice">尚未加入训练营。</p> : null}

        {firstPage.state === "ok" || firstPage.state === "database_error" ? <StudentMessageList initialError={firstPage.state === "database_error"} initialMessages={firstPage.state === "ok" ? firstPage.messages : []} initialNextCursor={firstPage.state === "ok" ? firstPage.nextCursor : null} /> : null}
      </section>
    </AppFrame>
  );
}
