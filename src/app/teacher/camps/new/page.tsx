import { Header } from "@/components/Header";
import { NewCampForm } from "@/components/NewCampForm";
import { requireAdmin } from "@/lib/auth";

export default async function NewCampPage() {
  await requireAdmin();
  return <main className="app-shell"><section className="screen with-top">
    <Header backHref="/teacher" subtitle="Supabase 云端训练营" title="新建训练营" />
    <section className="hero"><p className="kicker">New Camp</p><h1>创建一期新的共读训练营。</h1><p>开始时间按训练营时区保存，并用于每日课程自动解锁。</p></section>
    <NewCampForm />
  </section></main>;
}
