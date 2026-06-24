import { Header } from "@/components/Header";
import { InviteManager } from "@/components/InviteManager";
import { requireAdmin } from "@/lib/auth";
import { getAdminInviteData } from "@/lib/teacher-operations-data";

export default async function TeacherInvitesPage() {
  await requireAdmin();
  const result = await getAdminInviteData();
  return <main className="app-shell"><section className="screen with-top">
    <Header backHref="/teacher" subtitle="仅管理员可管理" title="邀请码管理" />
    <section className="hero"><p className="kicker">Camp Invites</p><h1>管理训练营加入凭证。</h1><p>设置使用次数与有效期，必要时可立即停用。</p></section>
    {result.error ? <p className="notice" role="alert">邀请码暂时无法读取。</p> : <InviteManager camps={result.camps} invites={result.invites} />}
  </section></main>;
}
