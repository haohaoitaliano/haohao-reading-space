"use client";

import { ArrowRight, MessageCircleReply } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useState } from "react";

type StudentMessageUnreadContextValue = {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
};

const StudentMessageUnreadContext = createContext<StudentMessageUnreadContextValue>({
  unreadCount: 0,
  setUnreadCount: () => undefined,
});

export function StudentMessageUnreadProvider({
  children,
  initialUnreadCount,
}: {
  children: React.ReactNode;
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCountState] = useState(initialUnreadCount);
  return (
    <StudentMessageUnreadContext.Provider value={{
      unreadCount,
      setUnreadCount: (count) => setUnreadCountState(Math.max(0, count)),
    }}>
      {children}
    </StudentMessageUnreadContext.Provider>
  );
}

export function StudentMessageNavDot() {
  const { unreadCount } = useContext(StudentMessageUnreadContext);
  return unreadCount > 0 ? <span aria-label="有未读消息" className="nav-message-dot" /> : null;
}

export function StudentMessageEntry() {
  const { unreadCount } = useContext(StudentMessageUnreadContext);
  return (
    <Link className="quiet-card message-entry" href="/messages">
      <span className="message-entry-icon"><MessageCircleReply size={22} /></span>
      <span><strong>我的消息</strong><small>查看别人给你的评论和回复</small></span>
      {unreadCount > 0 ? (
        <span className="message-entry-count"><span aria-hidden="true" className="message-dot" />{unreadCount}</span>
      ) : <ArrowRight size={18} />}
    </Link>
  );
}

export function useStudentMessageUnread() {
  return useContext(StudentMessageUnreadContext);
}
