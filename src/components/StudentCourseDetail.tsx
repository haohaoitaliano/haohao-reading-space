"use client";

import { Lightbulb, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { AppFrame } from "@/components/AppFrame";
import { AssignmentCard } from "@/components/AssignmentCard";
import { useAuthProfile } from "@/components/AuthProfileProvider";
import { BrowserRecorder } from "@/components/BrowserRecorder";
import { Header } from "@/components/Header";
import { LocalSubmissionCard } from "@/components/LocalSubmissionCard";
import { formatFileSize } from "@/lib/audio-file";
import type { CloudCourseAudio, CloudCourseDetail } from "@/lib/cloud-course-data";
import type { Assignment } from "@/lib/mock-data";
import { useLocalSubmissions } from "@/lib/use-local-submissions";

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
  assignments: Assignment[];
  course: CloudCourseDetail;
  localCourseId: string;
};

export function StudentCourseDetail({
  assignments,
  course,
  localCourseId,
}: StudentCourseDetailProps) {
  const profile = useAuthProfile();
  const { submissions, error: submissionsError } = useLocalSubmissions();
  const classmatesLocalSubmissions = submissions.filter(
    (submission) =>
      submission.courseId === localCourseId &&
      submission.visibility === "public" &&
      submission.studentId !== profile?.id,
  );

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

          <BrowserRecorder courseId={localCourseId} />

          <section>
            <div className="row">
              <h2>本课作业</h2>
              <Link className="pill sky" href="/circle">作业圈</Link>
            </div>
            <div className="stack">
              {assignments.map((assignment) => (
                <AssignmentCard assignment={assignment} key={assignment.id} />
              ))}
              {classmatesLocalSubmissions.map((submission) => (
                <LocalSubmissionCard key={submission.submissionId} submission={submission} />
              ))}
            </div>
            {submissionsError ? <p className="notice" role="alert">{submissionsError}</p> : null}
          </section>

          <p className="notice" style={{ margin: 0 }}>
            课程文字与示范音频来自云端；学生录音仍保存在当前浏览器与设备中。
          </p>
        </div>
      </section>
    </AppFrame>
  );
}
