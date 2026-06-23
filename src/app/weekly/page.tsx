import { CalendarDays, Copy, PlayCircle } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Header } from "@/components/Header";
import { weeklyMeeting } from "@/lib/mock-data";

export default function WeeklyPage() {
  return (
    <AppFrame active="weekly">
      <section className="screen with-top">
        <Header title="每周线上见面" subtitle="外部会议链接占位" />
        <div className="hero">
          <p className="kicker">Incontro settimanale</p>
          <h1>{weeklyMeeting.title}</h1>
          <p>平台第一版不开发直播功能，只放置外部会议链接、准备内容、回放和总结。</p>
        </div>

        <div className="stack">
          <section className="quiet-card stack">
            <div className="row">
              <h2>会议信息</h2>
              <CalendarDays color="var(--sky)" />
            </div>
            <p>{weeklyMeeting.date} · {weeklyMeeting.time}</p>
            <div className="item-card">
              <strong>会议链接</strong>
              <p style={{ margin: "6px 0 0", wordBreak: "break-word" }}>{weeklyMeeting.link}</p>
            </div>
            <div className="grid-two">
              <div className="metric"><strong>{weeklyMeeting.meetingId}</strong><span>会议号</span></div>
              <div className="metric"><strong>{weeklyMeeting.password}</strong><span>密码</span></div>
            </div>
            <button className="button secondary full">
              <Copy size={18} />
              复制会议信息
            </button>
          </section>

          <section className="quiet-card stack">
            <h2>本周讨论问题</h2>
            {weeklyMeeting.questions.map((question) => (
              <div className="item-card" key={question}>{question}</div>
            ))}
          </section>

          <section className="quiet-card">
            <p className="kicker">课前准备</p>
            <p>{weeklyMeeting.preparation}</p>
            <p className="kicker">本周总结</p>
            <p style={{ marginBottom: 0 }}>{weeklyMeeting.summary}</p>
          </section>

          <section className="audio-box">
            <div className="row">
              <div>
                <strong>{weeklyMeeting.replay}</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13 }}>直播回放记录占位</p>
              </div>
              <PlayCircle color="var(--accent)" />
            </div>
          </section>
        </div>
      </section>
    </AppFrame>
  );
}
