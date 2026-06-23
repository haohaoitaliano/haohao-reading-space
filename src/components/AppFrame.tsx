import { BookOpen, CalendarDays, CircleUserRound, Home, Mic2 } from "lucide-react";
import Link from "next/link";

type AppFrameProps = {
  children: React.ReactNode;
  active?: "home" | "courses" | "circle" | "progress" | "weekly";
};

const navItems = [
  { key: "home", label: "首页", href: "/home", icon: Home },
  { key: "courses", label: "课程", href: "/courses", icon: BookOpen },
  { key: "circle", label: "作业圈", href: "/circle", icon: Mic2 },
  { key: "progress", label: "进度", href: "/progress", icon: CircleUserRound },
  { key: "weekly", label: "周会", href: "/weekly", icon: CalendarDays },
] as const;

export function AppFrame({ children, active }: AppFrameProps) {
  return (
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
              <Icon size={19} strokeWidth={2.2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
