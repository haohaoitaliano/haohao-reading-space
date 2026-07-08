import { Header } from "@/components/Header";
import { CampLifecycleManager } from "@/components/CampLifecycleManager";
import { requireAdmin } from "@/lib/auth";
import { getAdminCampManagementData } from "@/lib/teacher-operations-data";

export default async function TeacherCampsPage() {
  await requireAdmin();
  const result = await getAdminCampManagementData();
  return <main className="app-shell"><section className="screen with-top">
    <Header backHref="/teacher" subtitle="停用、启用与空训练营删除" title="训练营管理" />
    <section className="hero"><p className="kicker">Camp Management</p><h1>管理训练营生命周期。</h1><p>停用不会删除课程、学生、录音或历史提交。</p></section>
    {result.error ? <p className="notice" role="alert">训练营暂时无法读取。</p> : <CampLifecycleManager camps={result.camps} />}
  </section></main>;
}
