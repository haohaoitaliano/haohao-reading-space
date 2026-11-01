import Link from "next/link";
import { EditCampForm } from "@/components/EditCampForm";
import { Header } from "@/components/Header";
import { requireAdmin } from "@/lib/auth";
import { getAdminCampManagementData } from "@/lib/teacher-operations-data";

type EditCampPageProps = { params: Promise<{ id: string }> };

export default async function EditCampPage({ params }: EditCampPageProps) {
  await requireAdmin();
  const { id } = await params;
  const result = await getAdminCampManagementData();
  const camp = result.camps.find((item) => item.id === id);

  if (result.error || !camp) {
    return <main className="app-shell"><section className="screen"><p className="notice">训练营不存在或数据库暂时不可用。</p><Link className="button" href="/teacher/camps">返回训练营管理</Link></section></main>;
  }

  return <main className="app-shell"><section className="screen with-top">
    <Header backHref="/teacher/camps" subtitle={camp.slug} title="编辑训练营信息" />
    <section className="hero"><p className="kicker">Edit Camp</p><h1>{camp.name}</h1><p>修改基础资料不会删除或迁移训练营已有数据。</p></section>
    <EditCampForm camp={camp} />
  </section></main>;
}
