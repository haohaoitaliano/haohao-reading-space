import { TicketCheck } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { JoinCampForm } from "./JoinCampForm";

export default function JoinCampPage() {
  return (
    <AppFrame active="spaces">
      <section className="screen with-top">
        <Header title="加入训练营" subtitle="添加新的共读营" backHref="/spaces" />
        <div className="hero">
          <TicketCheck color="var(--accent)" size={42} />
          <p className="kicker" style={{ marginTop: 16 }}>加入训练营</p>
          <h1>输入训练营邀请码。</h1>
          <p>验证成功后，这个训练营会出现在“我的学习空间”中。</p>
        </div>

        <JoinCampForm />
      </section>
    </AppFrame>
  );
}
