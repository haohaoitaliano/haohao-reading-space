import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { aiFeedback } from "@/lib/mock-data";

export default function AiFeedbackPage() {
  return (
    <AppFrame active="progress">
      <section className="screen with-top">
        <Header title="AI 反馈示例" subtitle="仅本人和老师可见" backHref="/my-work" />

        <section className="hero">
          <p className="kicker">Pronuncia · Feedback</p>
          <h1>这是一份模拟发音反馈。</h1>
          <p>用于展示产品流程，不调用任何 AI API，也不代表专业语音学评分。</p>
        </section>

        <div className="stack">
          <section className="notice">
            当前为模拟 AI 反馈，尚未接入真实发音分析。
          </section>
          <section className="notice">
            AI 反馈仅供练习参考，不能完全代替老师的专业判断。
          </section>

          <section className="quiet-card">
            <div className="row start">
              <CheckCircle2 color="var(--olive)" />
              <div>
                <h2>整体完整度</h2>
                <p style={{ margin: 0 }}>{aiFeedback.completeness}</p>
              </div>
            </div>
          </section>

          <section className="quiet-card stack">
            <h2>需要注意</h2>
            <div>
              <p className="kicker">可能漏读</p>
              <p>{aiFeedback.missedWords.join("、")}</p>
            </div>
            <div>
              <p className="kicker">可能不够清楚</p>
              <p>{aiFeedback.unclearWords.join("、")}</p>
            </div>
            <div>
              <p className="kicker">额外读出</p>
              <p>{aiFeedback.extraWords.join("、")}</p>
            </div>
          </section>

          <section className="quiet-card stack">
            <div className="row">
              <h2>练习建议</h2>
              <RotateCcw color="var(--accent)" />
            </div>
            <p>{aiFeedback.suggestion}</p>
            {aiFeedback.tips.map((tip) => (
              <div className="item-card" key={tip}>{tip}</div>
            ))}
          </section>

          <section className="notice">
            <AlertTriangle size={17} style={{ verticalAlign: "text-bottom" }} /> 暂不承诺准确判断开放/闭合元音、全部双辅音、复杂语调或地区口音。
          </section>
        </div>
      </section>
    </AppFrame>
  );
}
