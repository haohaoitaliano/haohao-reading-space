"use client";

import { Lightbulb, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { BrowserRecorder } from "@/components/BrowserRecorder";
import { Header } from "@/components/Header";
import { formatFileSize } from "@/lib/audio-file";
import type { CloudCourseAudio, CloudCourseDetail } from "@/lib/cloud-course-data";

function CloudCourseAudioPlayer({ audio }: { audio: CloudCourseAudio }) {
  return (
    <section className="audio-box" aria-label="老师示范音频">
      <strong className="file-name">老师示范 · {audio.fileName}</strong>
      <p style={{ margin: 0, fontSize: 13 }}>{formatFileSize(audio.sizeBytes)}</p>
      <audio controls preload="metadata" src={audio.signedUrl} style={{ width: "100%" }}>
        当前浏览器不支持音频播放。
      </audio>
    </section>
  );
}

type StudentCourseDetailProps = {
  course: CloudCourseDetail;
};

export function StudentCourseDetail({ course }: StudentCourseDetailProps) {
  return (
    <AppFrame active="courses">
      <section className="screen with-top">
        <Header title={`Giorno ${course.dayNumber}`} subtitle={course.chineseTitle} backHref="/courses" />

        <section className="hero">
          <p className="kicker">每日课程</p>
          <h1>{course.italianTitle}</h1>
          <p>{course.description}</p>
        </section>

        <div className="stack">
          {course.audio ? <CloudCourseAudioPlayer audio={course.audio} /> : (
            <section className="audio-box"><p style={{ margin: 0 }}>暂无示范音频。</p></section>
          )}

          <section className="quiet-card">
            <p className="kicker">Testo</p>
            <p className="italian-text">{course.readingText}</p>
          </section>

          <section className="quiet-card">
            <div className="row">
              <h2>重点词汇</h2>
              <Lightbulb color="var(--gold)" />
            </div>
            <div className="stack">
              {course.vocabulary.map((item, index) => (
                <div className="row" key={`${item.word}-${index}`}>
                  <strong>{item.word}</strong>
                  <span>{item.meaningZh}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="quiet-card stack">
            <div className="row start">
              <MessageSquareText color="var(--sky)" />
              <div>
                <p className="kicker">Riflessione dopo la lettura</p>
                <h2 style={{ marginBottom: 0 }}>阅读后的感想</h2>
              </div>
            </div>
            <p style={{ margin: 0 }}>{course.reflectionPromptZh}</p>
            <p className="italian-text" lang="it" style={{ fontSize: 17, margin: 0 }}>
              {course.reflectionPromptIt}
            </p>
            <label className="field" style={{ marginBottom: 0 }}>
              写下你的感想
              <textarea placeholder="可以用中文或意大利语写下你的感受或联想" rows={5} />
            </label>
            <p className="notice" style={{ margin: 0 }}>录音时，可以在跟读原文后读出你写下的感想。</p>
          </section>

          <BrowserRecorder courseId={course.id} />

          <section>
            <div className="row">
              <h2>本课作业</h2>
              <Link className="pill sky" href="/circle">作业圈</Link>
            </div>
            <p className="notice">同学选择公开的云端录音会显示在作业圈中。</p>
          </section>

          <p className="notice" style={{ margin: 0 }}>
            课程、示范音频和已提交录音均来自云端；未提交的临时录音刷新后会丢失。
          </p>
        </div>
      </section>
    </AppFrame>
  );
}
