"use client";

import { Download, FileText, Lightbulb, Maximize2, MessageSquareText, Minimize2, Pause, Play, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrowserRecorder, type PreparedRecording } from "@/components/BrowserRecorder";
import { ImagePreviewDialog, PdfPreviewDialog } from "@/components/MediaPreviewDialog";
import { PhotoAssignmentUploader, type PreparedPhoto } from "@/components/PhotoAssignmentUploader";
import { PhotoSubmissionCard } from "@/components/PhotoSubmissionCard";
import { Header } from "@/components/Header";
import { getStudentCourseDayLabel } from "@/lib/cloud-course";
import { formatFileSize } from "@/lib/audio-file";
import type {
  CloudCourseAudio,
  CloudCourseDetail,
  CloudCourseVideo,
  CloudCoursePdf,
  StudentCourseSubmissionSummary,
} from "@/lib/cloud-course-data";
import {
  readJsonResponse,
  uploadFileDirectly,
  type DirectUploadTicket,
} from "@/lib/direct-storage-upload";
import type { CloudPhotoSubmission } from "@/lib/photo-submission-data";
import { getDirectStudentRecordingMimeType, STUDENT_RECORDING_MAX_SECONDS } from "@/lib/student-recording";

function renderReadingText(text: string) {
  const nodes: ReactNode[] = [];
  const urlPattern = /https:\/\/[^\s<>"']+/gi;
  let cursor = 0;

  for (const match of text.matchAll(urlPattern)) {
    const start = match.index;
    const href = match[0].replace(/[.,!?;:)\]}。，！？；：）】》]+$/u, "");
    if (!href) continue;
    nodes.push(text.slice(cursor, start));
    nodes.push(<a href={href} key={start} rel="noopener noreferrer" target="_blank">{href}</a>);
    cursor = start + href.length;
  }

  nodes.push(text.slice(cursor));
  return nodes;
}

function ReadingContent({ course }: { course: CloudCourseDetail }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const imageMap = new Map(course.readingImages.map((image) => [image.id, image]));
  const previewImages = course.readingImages.map((image) => ({
    id: image.id,
    src: image.signedUrl,
    downloadUrl: image.signedUrl,
    fileName: image.fileName,
    alt: image.fileName || "阅读配图",
  }));
  const hasContent = course.readingBlocks.some((block) => block.type === "image" ? imageMap.has(block.imageId) : Boolean(block.text.trim()));
  if (!hasContent) return null;
  return (
    <section className="quiet-card reading-content">
      <p className="kicker">Testo</p>
      {course.readingBlocks.map((block) => {
        if (block.type === "text") return block.text ? <p className="italian-text reading-text" key={block.id}>{renderReadingText(block.text)}</p> : null;
        const image = imageMap.get(block.imageId);
        if (!image) return null;
        const index = previewImages.findIndex((item) => item.id === image.id);
        return (
          <button aria-label={`查看大图：${image.fileName}`} className="reading-content-image" key={block.id} onClick={() => setPreviewIndex(index)} type="button">
            <img alt={image.fileName || "阅读配图"} height={image.height ?? undefined} src={image.signedUrl} width={image.width ?? undefined} /> {/* eslint-disable-line @next/next/no-img-element */}
          </button>
        );
      })}
      {previewIndex !== null ? <ImagePreviewDialog images={previewImages} initialIndex={previewIndex} onClose={() => setPreviewIndex(null)} /> : null}
    </section>
  );
}

function CloudCourseAudioPlayer({ audio }: { audio: CloudCourseAudio }) {
  return (
    <section className="audio-box" aria-label="老师示范音频">
      <strong className="file-name">老师示范 · {audio.fileName}</strong>
      <p style={{ margin: 0, fontSize: 13 }}>{formatFileSize(audio.sizeBytes)}</p>
      <audio controls preload="none" src={audio.signedUrl} style={{ width: "100%" }}>
        当前浏览器不支持音频播放。
      </audio>
    </section>
  );
}

function CloudCourseVideoPlayer({ video }: { video: CloudCourseVideo }) {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useNativeControls, setUseNativeControls] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === playerRef.current);
    const handleNativeFullscreenStart = () => setIsFullscreen(true);
    const handleNativeFullscreenEnd = () => {
      setIsFullscreen(false);
      setUseNativeControls(false);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    videoElement?.addEventListener("webkitbeginfullscreen", handleNativeFullscreenStart);
    videoElement?.addEventListener("webkitendfullscreen", handleNativeFullscreenEnd);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      videoElement?.removeEventListener("webkitbeginfullscreen", handleNativeFullscreenStart);
      videoElement?.removeEventListener("webkitendfullscreen", handleNativeFullscreenEnd);
    };
  }, []);

  const togglePlayback = () => {
    const player = videoRef.current;
    if (!player) return;
    if (player.paused) {
      void player.play();
    } else {
      player.pause();
    }
  };

  const toggleFullscreen = async () => {
    const player = playerRef.current;
    const videoElement = videoRef.current as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    }) | null;
    if (!player || !videoElement) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    if (player.requestFullscreen) {
      try {
        await player.requestFullscreen();
        return;
      } catch {
        // Fall through to the native iOS/WebView player when element fullscreen is unavailable.
      }
    }

    if (videoElement.webkitEnterFullscreen) {
      setUseNativeControls(true);
      try {
        videoElement.webkitEnterFullscreen();
      } catch {
        // Keep native controls visible so restricted WebViews still have a usable fallback.
      }
      return;
    }

    setUseNativeControls(true);
  };

  return (
    <section className="quiet-card stack" aria-label="今日视频">
      <div>
        <p className="kicker">Video di oggi</p>
        <h2 style={{ marginBottom: 4 }}>今日视频</h2>
        <p style={{ margin: 0, fontSize: 13 }}>{video.fileName} · {formatFileSize(video.sizeBytes)}</p>
      </div>
      <div className="course-video-player" ref={playerRef}>
        <video
          controls={useNativeControls}
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          playsInline
          preload="none"
          ref={videoRef}
          src={video.signedUrl}
        >
          当前浏览器不支持视频播放。
        </video>
        {!useNativeControls ? (
          <div className="course-video-controls">
            <button
              aria-label={isPlaying ? "暂停视频" : "播放视频"}
              className="course-video-control-button"
              onClick={togglePlayback}
              type="button"
            >
              {isPlaying ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
            </button>
            <button
              aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
              className="course-video-control-button"
              onClick={() => void toggleFullscreen()}
              type="button"
            >
              {isFullscreen ? <Minimize2 aria-hidden="true" size={17} /> : <Maximize2 aria-hidden="true" size={17} />}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CoursePdfReader({ pdf }: { pdf: CloudCoursePdf }) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="pdf-reader">
      <div className="pdf-reader-summary"><FileText size={18} /><span>{pdf.fileName} · {formatFileSize(pdf.sizeBytes)}</span></div>
      <div className="row pdf-actions">
        <button className="button secondary" onClick={() => setPreviewOpen(true)} type="button"><FileText size={17} />站内阅读</button>
        <a className="button ghost" download={pdf.fileName} href={pdf.downloadUrl}><Download size={17} />下载</a>
      </div>
      {previewOpen ? (
        <PdfPreviewDialog
          downloadUrl={pdf.downloadUrl}
          fileName={pdf.fileName}
          onClose={() => setPreviewOpen(false)}
          onRefresh={() => { setPreviewOpen(false); router.refresh(); }}
          signedUrl={pdf.signedUrl}
        />
      ) : null}
    </div>
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
  const submissionInFlightRef = useRef(false);
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
    (!course.recordingAssignmentRequired || Boolean(preparedRecording))
    && (!course.photoAssignmentRequired || preparedPhotos.length > 0)
  ), [course.photoAssignmentRequired, course.recordingAssignmentRequired, preparedPhotos.length, preparedRecording]);
  const hasPreparedMaterial = Boolean(preparedRecording) || preparedPhotos.length > 0;
  const canSubmit = allRequiredMaterialsReady && hasPreparedMaterial;

  async function submitAssignment() {
    if (!canSubmit || submissionState === "submitting" || submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    if (!assignmentIdRef.current) assignmentIdRef.current = crypto.randomUUID();
    let audioFile: Blob | null = null;
    let audioInfo: {
      fileName: string;
      mimeType: string;
      size: number;
      source: PreparedRecording["source"];
      durationSeconds: number;
    } | null = null;
    if (preparedRecording) {
      const mimeType = getDirectStudentRecordingMimeType(preparedRecording.mimeType, preparedRecording.source);
      const extension = mimeType.includes("mpeg") ? "mp3"
        : mimeType.includes("wav") ? "wav"
          : mimeType.includes("mp4") ? "m4a"
            : mimeType.includes("ogg") ? "ogg" : "webm";
      audioFile = new Blob([preparedRecording.blob], { type: mimeType });
      audioInfo = {
        fileName: `recording.${extension}`,
        mimeType,
        size: audioFile.size,
        source: preparedRecording.source,
        durationSeconds: preparedRecording.durationSeconds,
      };
    }
    const requestBody = {
      assignmentId: assignmentIdRef.current,
      audio: audioInfo,
      photos: preparedPhotos.map((photo) => ({
        id: photo.id,
        fileName: photo.file.name,
        mimeType: photo.file.type,
        size: photo.file.size,
      })),
    };

    setSubmissionState("submitting");
    setSubmissionMessage("正在准备安全上传…");
    setUploadProgress(0);
    try {
      const prepareResponse = await fetch(`/api/student/courses/${course.id}/assignment-submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", ...requestBody }),
      });
      const prepared = await readJsonResponse<{
        success: boolean;
        completed: boolean;
        audio?: DirectUploadTicket | null;
        photos?: DirectUploadTicket[];
      }>(prepareResponse, prepareResponse.status === 413
        ? "作业材料超过 Vercel 请求限制，请刷新页面后重试。"
        : "无法准备作业上传，请检查网络后直接重试。");
      if (prepared.completed) {
        setUploadProgress(100);
        setSubmissionState("success");
        setSubmissionMessage("");
        return;
      }

      const photoTickets = prepared.photos ?? [];
      if (Boolean(audioFile) !== Boolean(prepared.audio) || photoTickets.length !== preparedPhotos.length) {
        throw new Error("上传授权与作业材料不一致，请直接重试。");
      }
      const totalFiles = (audioFile && prepared.audio ? 1 : 0) + photoTickets.length;
      let completedFiles = 0;
      const markFileComplete = () => {
        completedFiles += 1;
        setUploadProgress(Math.round((completedFiles / Math.max(1, totalFiles)) * 85));
      };
      if (audioFile && prepared.audio) {
        setSubmissionMessage("正在上传录音…");
        await uploadFileDirectly({ file: audioFile, ticket: prepared.audio, failureLabel: "录音" });
        markFileComplete();
      }
      for (const [index, ticket] of photoTickets.entries()) {
        setSubmissionMessage(`正在上传第 ${index + 1} 张照片…`);
        await uploadFileDirectly({
          file: preparedPhotos[index].file,
          ticket,
          failureLabel: `第 ${index + 1} 张照片`,
        });
        markFileComplete();
      }

      setUploadProgress(95);
      setSubmissionMessage("正在确认作业记录…");
      const completeResponse = await fetch(`/api/student/courses/${course.id}/assignment-submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", ...requestBody }),
      });
      await readJsonResponse<{ success: boolean; completed: boolean }>(
        completeResponse,
        "文件已上传，但作业确认失败，请直接重试。",
      );
      setUploadProgress(100);
      setSubmissionState("success");
      setSubmissionMessage("");
    } catch (submissionError) {
      try {
        await fetch(`/api/student/courses/${course.id}/assignment-submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cleanup", ...requestBody }),
        });
      } catch {
        // A later retry runs the same cleanup before issuing fresh upload tickets.
      }
      setSubmissionState("error");
      const message = submissionError instanceof Error ? submissionError.message : "提交失败，请直接重试。";
      setSubmissionMessage(`${message} 录音和照片仍保留在本页。`);
    } finally {
      submissionInFlightRef.current = false;
    }
  }

  return (
    <section className="screen with-top">
        <Header title={getStudentCourseDayLabel(course.dayNumber)} subtitle={course.chineseTitle} backHref="/courses" />

        <section className="hero">
          <p className="kicker">每日课程</p>
          <h1>{course.italianTitle}</h1>
          <p>{course.description}</p>
        </section>

        <div className="stack">
          <ReadingContent course={course} />

          {course.audio ? <CloudCourseAudioPlayer audio={course.audio} /> : null}

          {course.videos.map((video) => <CloudCourseVideoPlayer key={video.id} video={video} />)}

          {course.pdfs.length ? (
            <section className="quiet-card stack" aria-label="PDF 课件">
              <div><p className="kicker">Materiali PDF</p><h2 style={{ marginBottom: 4 }}>PDF 课件</h2><p style={{ margin: 0 }}>点击“站内阅读”即可逐页查看，也可以单独下载。</p></div>
              {course.pdfs.map((pdf) => <CoursePdfReader key={pdf.id} pdf={pdf} />)}
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

          <section className="assignment-transition" aria-labelledby="assignment-transition-title">
            <p className="kicker" lang="it">Tocca a te!</p>
            <h2 id="assignment-transition-title">现在轮到你啦！🌱</h2>
            <p>读一读，写一写，不用担心不够完美。</p>
          </section>

          <BrowserRecorder
            latestSubmission={latestSubmission}
            maxDurationSeconds={STUDENT_RECORDING_MAX_SECONDS}
            onPreparedChange={handleRecordingPrepared}
            targetDurationSeconds={course.targetDurationSeconds}
          />

          <PhotoAssignmentUploader onPreparedChange={handlePhotosPrepared} />

          <section className="quiet-card stack" aria-label="提交作业">
              <div>
                <p className="kicker">提交前确认</p>
                <h2 style={{ marginBottom: 4 }}>本次作业</h2>
              </div>
              <p className={preparedRecording ? "success-notice" : "notice"} style={{ margin: 0 }}>
                {preparedRecording
                  ? `✓ 录音已准备 · ${Math.round(preparedRecording.durationSeconds)} 秒`
                  : course.recordingAssignmentRequired ? "缺少必交录音，请先完成录音并试听。" : "录音可选。"}
              </p>
              <p className={preparedPhotos.length ? "success-notice" : "notice"} style={{ margin: 0 }}>
                {preparedPhotos.length
                  ? `✓ 已选择 ${preparedPhotos.length} 张照片`
                  : course.photoAssignmentRequired ? "缺少必交照片，请先选择 1–3 张照片。" : "照片可选。"}
              </p>
              {allRequiredMaterialsReady && hasPreparedMaterial ? <p className="success-notice" style={{ margin: 0 }}>✓ 所有必交内容已准备完成</p> : null}
              <p className="notice" style={{ margin: 0 }}>提交后，作业会向同一训练营的活跃成员公开。</p>
              {submissionState === "success" ? (
                <div className="success-notice stack" role="status">
                  <strong>Ottimo lavoro! 🎉</strong>
                  <span>今天的作业已经提交，也来看看同学们的学习成果吧！</span>
                  <Link className="button full" href="/circle">去作业圈看看</Link>
                </div>
              ) : (
                <button className="button full" disabled={!canSubmit || submissionState === "submitting"} onClick={submitAssignment} type="button">
                  <Send size={18} />{submissionState === "submitting" ? `正在提交${uploadProgress ? ` · ${uploadProgress}%` : "…"}` : submissionState === "error" ? "重试提交作业" : "提交作业"}
                </button>
              )}
              {submissionMessage ? <p className="notice" role="alert">{submissionMessage}</p> : null}
          </section>

          {photoSubmissions.length ? (
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
