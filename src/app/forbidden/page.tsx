import { ShieldX } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export default function ForbiddenPage() {
  return (
    <main className="app-shell">
      <section className="screen">
        <div className="hero">
          <ShieldX color="var(--accent)" size={42} />
          <p className="kicker" style={{ marginTop: 16 }}>Accesso negato</p>
          <h1>你没有权限访问这个页面。</h1>
          <p>学生账号不能进入老师后台；停用账号也不能访问受保护内容。</p>
        </div>
        <div className="stack">
          <Link className="button full" href="/home">返回学生首页</Link>
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
