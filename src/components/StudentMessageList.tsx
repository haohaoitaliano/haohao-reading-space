"use client";

import { MessageCircleReply, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IDENTITY_LABEL_TEXT } from "@/lib/identity-label";
import type { StudentMessage } from "@/lib/student-message";
import type { StudentMessagePagePayload } from "@/lib/student-message-feed";

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(value));
}

async function requestPage(cursor: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`/api/student/messages${query}`, { cache: "no-store" });
  const result = await response.json().catch(() => ({})) as Partial<StudentMessagePagePayload> & { message?: string };
  if (!response.ok || !Array.isArray(result.messages)) throw new Error(result.message || "消息暂时无法读取，请稍后重试。");
  return result as StudentMessagePagePayload;
}

export function StudentMessageList({ initialMessages, initialNextCursor, initialError }: { initialMessages: StudentMessage[]; initialNextCursor: string | null; initialError: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ? "消息暂时无法读取，请稍后重试。" : "");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || (!nextCursor && messages.length > 0 && !error)) return;
    inFlightRef.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await requestPage(nextCursor);
      setMessages((current) => {
        const known = new Set(current.map((message) => message.id));
        return [...current, ...result.messages.filter((message) => !known.has(message.id))];
      });
      setNextCursor(result.nextCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "消息暂时无法读取，请稍后重试。");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [error, messages.length, nextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor || error || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) void loadMore(); }, { rootMargin: "600px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, loadMore, nextCursor]);

  return <div className="message-list">
    {messages.map((message) => <Link aria-label={`${message.authorName}的消息${message.isRead ? "，已读" : "，未读"}`} className={`message-card${message.isRead ? "" : " is-unread"}`} href={`/circle?submission=${encodeURIComponent(message.targetId)}&comment=${encodeURIComponent(message.id)}`} key={message.id}>
      <div className="message-card-heading"><span className="avatar message-avatar">{message.authorName.charAt(0) || "评"}</span><div className="message-card-author"><strong>{message.authorName}</strong>{message.identityLabel && message.identityLabel !== "student" ? <span className="pill olive">{IDENTITY_LABEL_TEXT[message.identityLabel]}</span> : null}</div>{!message.isRead ? <span aria-label="未读" className="message-dot" /> : null}</div>
      <p className="message-content">{message.content}</p>
      <div className="message-work"><span>Giorno {message.dayNumber} · {message.courseTitle}</span><span>{message.workOwnerName}的作业</span></div>
      <div className="message-card-footer"><time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time><span>查看并回复 <MessageCircleReply size={16} /></span></div>
    </Link>)}
    {messages.length === 0 && !error ? <section className="quiet-card message-empty"><MessageCircleReply color="var(--sky)" /><div><h2>暂时没有消息</h2><p>别人评论你的作业或回复你的评论后，会显示在这里。</p></div></section> : null}
    {error ? <div className="notice" role="alert"><p style={{ marginTop: 0 }}>{error}</p><button className="button ghost" disabled={loading} onClick={() => void loadMore()} type="button"><RefreshCw size={16} />重试</button></div> : null}
    {loading ? <p className="notice" role="status">正在加载更多消息…</p> : null}
    <div aria-hidden="true" ref={sentinelRef} style={{ height: 1 }} />
  </div>;
}
