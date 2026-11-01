"use client";

import { Download, ExternalLink, FileText, Lightbulb, MessageSquareText, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { BrowserRecorder, type PreparedRecording } from "@/components/BrowserRecorder";
import { PhotoAssignmentUploader, type PreparedPhoto } from "@/components/PhotoAssignmentUploader";
import { PhotoSubmissionCard } from "@/components/PhotoSubmissionCard";
import { Header } from "@/components/Header";
import { formatFileSize } from "@/lib/audio-file";
import type {
  CloudCourseAudio,
  CloudCourseDetail,
  CloudCourseVideo,
  CloudCoursePdf,
  StudentCourseSubmissionSummary,
} from "@/lib/cloud-course-data";
import type { CloudPhotoSubmission } from "@/lib/photo-submission-data";

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

function CloudCourseVideoPlayer({ video }: { video: CloudCourseVideo }) {
  return (
    <section className="quiet-card stack" aria-label="今日视频">
      <div>
        <p className="kicker">Video di oggi</p>
        <h2 style={{ marginBottom: 4 }}>今日视频</h2>
        <p style={{ margin: 0, fontSize: 13 }}>{video.fileName} · {formatFileSize(video.sizeBytes)}</p>
      </div>
      <video controls preload="metadata" src={video.signedUrl} style={{ width: "100%", borderRadius: 8 }}>
        当前浏览器不支持视频播放。
      </video>
    </section>
  );
}

function CoursePdfReader({ pdf, initiallyOpen }: { pdf: CloudCoursePdf; initiallyOpen: boolean }) {
  return (
    <details className="pdf-reader" open={initiallyOpen}>
      <summary><FileText size={18} /><span>{pdf.fileName} · {formatFileSize(pdf.sizeBytes)}</span></summary>
      <iframe src={pdf.signedUrl} title={`在线阅读 ${pdf.fileName}`} />
      <div className="row pdf-actions">
        <a className="button secondary" href={pdf.signedUrl} rel="noreferrer" target="_blank"><ExternalLink size={17} />全屏阅读</a>
        <a className="button ghost" href={pdf.downloadUrl}><Download size={17} />下载</a>
      </div>
    </details>
  );
}

type StudentCourseDetailProps = {
  course: CloudCourseDetail;
  latestSubmission: StudentCourseSubmissionSummary | null;
  latestPhotoSubmission: { version: number; createdAt: string } | null;
  photoSubmissions: CloudPhotoSubmission[];
};

export function StudentCourseDetail({ course, latestSubmission, photoSubmissions }: StudentCourseDetailProps) {
  const [preparedRecording, setPreparedRecording] = useState<PreparedRecording | null>(null);
  const [preparedPhotos, setPreparedPhotos] = useState<PreparedPhoto[]>([]);
  const [submissionState, setSubmissionState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const assignmentIdRef = useRef("");
  const hasReflection = Boolean(
    course.reflectionPromptZh.trim() || course.reflectionPromptIt.trim(),
  );
  const handleRecordingPrepared = useCallback((recording: PreparedRecording | null) => {
    setPreparedRecording(recording);
    setSubmissionState((state) => state === "success" ? state : "idle");
    setSubmissionMessage("");
  }, []);
  const handlePhotosPrepared = useCallback((photos: PreparedPhoto[]) => {
    setPreparedPhotos(photos);
    setSubmissionState((state) => state === "success" ? state : "idle");
    setSubmissionMessage("");
  }, []);
  const allRequiredMaterialsReady = useMemo(() => (
    (!course.recordingAssignmentEnabled || Boolean(preparedRecording))
    && (!course.photoAssignmentEnabled || preparedPhotos.length > 0)
  ), [course.photoAssignmentEnabled, course.recordingAssignmentEnabled, preparedPhotos.length, preparedRecording]);
  const hasAssignment = course.recordingAssignmentEnabled || course.photoAssignmentEnabled;

  function submitAssignment() {
    if (!allRequiredMaterialsReady || submissionState === "submitting") return;
    if (!assignmentIdRef.current) assignmentIdRef.current = crypto.randomUUID();
    const formData = new FormData();
    formData.set("assignmentId", assignmentIdRef.current);
    if (course.recordingAssignmentEnabled && preparedRecording) {
      const extension = preparedRecording.mimeType.includes("mpeg") ? "mp3"
        : preparedRecording.mimeType.includes("wav") ? "wav"
          : preparedRecording.mimeType.includes("mp4") ? "m4a" : "webm";
      formData.set("audio", preparedRecording.blob, `recording.${extension}`);
      formData.set("source", preparedRecording.source);
      formData.set("durationSeconds", String(preparedRecording.durationSeconds));
    }
    for (const photo of preparedPhotos) {
      formData.append("photos", photo.file, photo.file.name);
      formData.append("photoIds", photo.id);
    }

    setSubmissionState("submitting");
    setSubmissionMessage("");
    setUploadProgress(0);
    const request = new XMLHttpRequest();
    request.open("POST", `/api/student/courses/${course.id}/assignment-submissions`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      let result: { message?: string } = {};
      try { result = JSON.parse(request.responseText) as { message?: string }; } catch { /* use fallback */ }
      if (request.status >= 200 && request.status < 300) {
        setUploadProgress(100);
        setSubmissionState("success");
        setSubmissionMessage("");
        return;
      }
      setSubmissionState("error");
      setSubmissionMessage(result.message ?? "提交失败，材料仍保留在本页，请直接重试。");
    });
    request.addEventListener("error", () => {
      setSubmissionState("error");
      setSubmissionMessage("网络中断，材料仍保留在本页，请直接重试。");
    });
    request.send(formData);
  }

  return (
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

          {course.video ? <CloudCourseVideoPlayer video={course.video} /> : null}

          {course.pdfs.length ? (
            <section className="quiet-card stack" aria-label="PDF 课件">
              <div><p className="kicker">Materiali PDF</p><h2 style={{ marginBottom: 4 }}>PDF 课件</h2><p style={{ margin: 0 }}>可直接在线阅读，也可以全屏打开或下载。</p></div>
              {course.pdfs.map((pdf, index) => <CoursePdfReader initiallyOpen={index === 0} key={pdf.id} pdf={pdf} />)}
            </section>
          ) : null}

          {course.readingText.trim() ? (
            <section className="quiet-card">
              <p className="kicker">Testo</p>
              <p className="italian-text reading-text">{course.readingText}</p>
            </section>
          ) : null}

          {course.vocabulary.length > 0 ? (
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
          ) : null}

          {hasReflection ? (
            <section className="quiet-card stack">
              <div className="row start">
                <MessageSquareText color="var(--sky)" />
                <div>
                  <p className="kicker">Riflessione dopo la lettura</p>
                  <h2 style={{ marginBottom: 0 }}>阅读后的感想</h2>
                </div>
              </div>
              {course.reflectionPromptZh.trim() ? <p style={{ margin: 0 }}>{course.reflectionPromptZh}</p> : null}
              {course.reflectionPromptIt.trim() ? (
                <p className="italian-text" lang="it" style={{ fontSize: 17, margin: 0 }}>
                  {course.reflectionPromptIt}
                </p>
              ) : null}
              <label className="field" style={{ marginBottom: 0 }}>
                写下你的感想
                <textarea placeholder="可以用中文或意大利语写下你的感受或联想" rows={5} />
              </label>
              <p className="notice" style={{ margin: 0 }}>录音时，可以在跟读原文后读出你写下的感想。</p>
            </section>
          ) : null}

          {course.recordingAssignmentEnabled ? (
            <BrowserRecorder
              latestSubmission={latestSubmission}
              maxDurationSeconds={course.maxDurationSeconds}
              onPreparedChange={handleRecordingPrepared}
              targetDurationSeconds={course.targetDurationSeconds}
            />
          ) : null}

          {course.photoAssignmentEnabled ? (
            <PhotoAssignmentUploader onPreparedChange={handlePhotosPrepared} />
          ) : null}

          {!hasAssignment ? (
            <p className="success-notice">本课无需提交作业，完成课程内容即可。</p>
          ) : null}

          {hasAssignment ? (
            <section className="quiet-card stack" aria-label="提交作业">
              <div>
                <p className="kicker">提交前确认</p>
                <h2 style={{ marginBottom: 4 }}>本次作业</h2>
              </div>
              {course.recordingAssignmentEnabled ? (
                <p className={preparedRecording ? "success-notice" : "notice"} style={{ margin: 0 }}>
                  {preparedRecording ? `✓ 录音已准备 · ${Math.round(preparedRecording.durationSeconds)} 秒` : "请先完成录音并试听。"}
                </p>
              ) : null}
              {course.photoAssignmentEnabled ? (
                <p className={preparedPhotos.length ? "success-notice" : "notice"} style={{ margin: 0 }}>
                  {preparedPhotos.length ? `✓ 已选择 ${preparedPhotos.length} 张照片` : "请先选择 1–3 张照片。"}
                </p>
              ) : null}
              {allRequiredMaterialsReady ? <p className="success-notice" style={{ margin: 0 }}>✓ 所有必需材料已准备完成</p> : null}
              <p className="notice" style={{ margin: 0 }}>提交后，作业会向同一训练营的活跃成员公开。</p>
              {submissionState === "success" ? (
                <div className="success-notice stack" role="status">
                  <strong>Ottimo lavoro! 🎉</strong>
                  <span>今天的作业已经提交，也来看看同学们的学习成果吧！</span>
                  <Link className="button full" href="/circle">去作业圈看看</Link>
                </div>
              ) : (
                <button className="button full" disabled={!allRequiredMaterialsReady || submissionState === "submitting"} onClick={submitAssignment} type="button">
                  <Send size={18} />{submissionState === "submitting" ? `正在提交${uploadProgress ? ` · ${uploadProgress}%` : "…"}` : submissionState === "error" ? "重试提交作业" : "提交作业"}
                </button>
              )}
              {submissionMessage ? <p className="notice" role="alert">{submissionMessage}</p> : null}
            </section>
          ) : null}

          {course.photoAssignmentEnabled && photoSubmissions.length ? (
            <section className="stack">
              <div><p className="kicker">历史版本</p><h2>我的照片作业</h2></div>
              {photoSubmissions.map((submission) => <PhotoSubmissionCard key={submission.id} manageable submission={submission} />)}
            </section>
          ) : null}

          <p className="notice" style={{ margin: 0 }}>
            课程资源和已提交作业均来自受权限保护的云端存储；未提交的临时录音或照片刷新后会丢失。
          </p>
        </div>
    </section>
  );
}
