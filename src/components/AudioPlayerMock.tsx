import { Headphones, Play } from "lucide-react";

export function AudioPlayerMock({ title, duration }: { title: string; duration: string }) {
  return (
    <section className="audio-box" aria-label={title}>
      <div className="row">
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <span className="brand-mark" style={{ width: 38, height: 38, background: "var(--sky)" }}>
            <Headphones size={19} />
          </span>
          <div>
            <strong>{title}</strong>
            <p style={{ margin: "2px 0 0", fontSize: 13 }}>示范音频 · {duration}</p>
          </div>
        </div>
        <button className="button secondary" aria-label="播放示范音频">
          <Play size={18} fill="currentColor" />
        </button>
      </div>
      <div className="audio-track" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}
