import { MessageCircleReply } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getStudentMessages } from "@/lib/student-message-data";
import { IDENTITY_LABEL_TEXT } from "@/lib/identity-label";

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

export default async function MessagesPage() {
  const { profile } = await requireAuthenticatedUser();
  const result = await getStudentMessages(profile.id);

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

        {result.state === "database_error" ? <p className="notice" role="alert">消息暂时无法读取，请稍后重试。</p> : null}
        {result.state === "no_selected_camp" ? <p className="notice">请先在我的学习空间选择当前训练营。</p> : null}
        {result.state === "no_membership" ? <p className="notice">尚未加入训练营。</p> : null}

        {result.state === "ok" ? (
          <div className="message-list">
            {result.messages.map((message) => (
              <Link
                aria-label={`${message.authorName}的消息${message.isRead ? "，已读" : "，未读"}`}
                className={`message-card${message.isRead ? "" : " is-unread"}`}
                href={`/circle?submission=${encodeURIComponent(message.targetId)}&comment=${encodeURIComponent(message.id)}`}
                key={message.id}
              >
                <div className="message-card-heading">
                  <span className="avatar message-avatar">{message.authorName.charAt(0) || "评"}</span>
                  <div className="message-card-author">
                    <strong>{message.authorName}</strong>
                    {message.identityLabel && message.identityLabel !== "student" ? <span className="pill olive">{IDENTITY_LABEL_TEXT[message.identityLabel]}</span> : null}
                  </div>
                  {!message.isRead ? <span aria-label="未读" className="message-dot" /> : null}
                </div>
                <p className="message-content">{message.content}</p>
                <div className="message-work">
                  <span>Giorno {message.dayNumber} · {message.courseTitle}</span>
                  <span>{message.workOwnerName}的作业</span>
                </div>
                <div className="message-card-footer">
                  <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                  <span>查看并回复 <MessageCircleReply size={16} /></span>
                </div>
              </Link>
            ))}
            {result.messages.length === 0 ? (
              <section className="quiet-card message-empty">
                <MessageCircleReply color="var(--sky)" />
                <div><h2>暂时没有消息</h2><p>别人评论你的作业或回复你的评论后，会显示在这里。</p></div>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
    </AppFrame>
  );
}
