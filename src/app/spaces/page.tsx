import { ArrowRight, Layers3, Plus } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { ACTIVE_CAMP_COOKIE } from "@/lib/active-camp-cookie";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getStudentLearningSpaces } from "@/lib/learning-space";
import { selectLearningSpace } from "./actions";

type SpacesPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SpacesPage({ searchParams }: SpacesPageProps) {
  const { profile } = await requireAuthenticatedUser();
  if (profile.role === "admin") redirect("/teacher");

  const [{ error }, result, cookieStore] = await Promise.all([
    searchParams,
    getStudentLearningSpaces(profile.id),
    cookies(),
  ]);
  const activeCampId = cookieStore.get(ACTIVE_CAMP_COOKIE)?.value ?? null;

  return (
    <AppFrame active="spaces">
      <section className="screen with-top">
        <Header title="我的学习空间" subtitle={`${profile.display_name} · 共读营`} />
        <section className="hero">
          <Layers3 color="var(--accent)" size={42} />
          <p className="kicker" style={{ marginTop: 16 }}>Spazi di lettura</p>
          <h1>选择今天要进入的训练营。</h1>
          <p>一个账号可以加入多个共读营，课程、录音和作业圈会按当前训练营分别显示。</p>
        </section>

        {error === "invalid" ? <p className="notice" role="alert">无法切换到这个训练营，请刷新后重试。</p> : null}
        {result.state === "database_error" ? <p className="notice" role="alert">学习空间暂时无法读取，请稍后重试。</p> : null}

        <div className="stack">
          {result.spaces.map((camp) => (
            <form action={selectLearningSpace} className="quiet-card stack" key={camp.id}>
              <input name="campId" type="hidden" value={camp.id} />
              <div className="row start">
                <div>
                  <p className="kicker">{camp.slug}</p>
                  <h2>{camp.name}</h2>
                  <p style={{ margin: 0 }}>进行中 · {camp.timezone}</p>
                </div>
                {camp.id === activeCampId ? <span className="pill olive">当前</span> : <span className="pill sky">进行中</span>}
              </div>
              <button className="button full" type="submit">
                进入这个训练营 <ArrowRight size={18} />
              </button>
            </form>
          ))}

          {result.state === "no_membership" ? (
            <section className="quiet-card">
              <h2>还没有加入训练营</h2>
              <p>输入老师提供的邀请码后，这里会显示你的学习空间。</p>
            </section>
          ) : null}

          <Link className="button secondary full" href="/join-camp">
            <Plus size={18} /> 加入新的训练营
          </Link>
        </div>
      </section>
    </AppFrame>
  );
}
