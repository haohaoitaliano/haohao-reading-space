import { BookOpen, CalendarDays, CircleUserRound, Home, Layers3, Mic2 } from "lucide-react";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth";
import { getStudentMessages } from "@/lib/student-message-data";
import { StudentMessageNavDot, StudentMessageUnreadProvider } from "./StudentMessageUnread";

type AppFrameProps = {
  children: React.ReactNode;
  active?: "spaces" | "home" | "courses" | "circle" | "progress" | "weekly";
};

const navItems = [
  { key: "spaces", label: "空间", href: "/spaces", icon: Layers3 },
  { key: "home", label: "首页", href: "/home", icon: Home },
  { key: "courses", label: "课程", href: "/courses", icon: BookOpen },
  { key: "circle", label: "作业圈", href: "/circle", icon: Mic2 },
  { key: "progress", label: "我的", href: "/progress", icon: CircleUserRound },
  { key: "weekly", label: "见面", href: "/weekly", icon: CalendarDays },
] as const;

export async function AppFrame({ children, active }: AppFrameProps) {
  const auth = await getAuthContext();
  const messageResult = auth?.profile.role === "student"
    ? await getStudentMessages(auth.profile.id)
    : null;
  const unreadCount = messageResult?.state === "ok" ? messageResult.unreadCount : 0;

  return (
    <StudentMessageUnreadProvider initialUnreadCount={unreadCount}>
      <main className="app-shell">
        {children}
        <nav className="bottom-nav" aria-label="学生端导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                aria-label={item.label}
                className={`nav-link ${active === item.key ? "active" : ""}`}
                href={item.href}
                key={item.key}
              >
                <span className="nav-icon-wrap">
                  <Icon size={19} strokeWidth={2.2} />
                  {item.key === "progress" ? <StudentMessageNavDot /> : null}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </StudentMessageUnreadProvider>
  );
}
