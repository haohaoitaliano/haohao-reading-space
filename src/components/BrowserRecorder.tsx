"use client";

import { Mic, RotateCcw, Square, Trash2, Upload, Volume2 } from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  chooseRecordingMimeType,
  formatRecordingDuration,
  getRecordingTargetFeedback,
  getMicrophoneErrorMessage,
  requestMicrophoneWithTimeout,
  RECORDING_SECURE_CONTEXT_MESSAGE,
  RECORDING_UNSUPPORTED_MESSAGE,
} from "@/lib/recording-utils";
import { validateManualStudentRecordingFile } from "@/lib/student-recording";
import type { StudentCourseSubmissionSummary } from "@/lib/cloud-course-data";

type RecorderState = "idle" | "requesting" | "recording" | "ready" | "error" | "submit_error";

const stateLabels: Record<RecorderState, string> = {
  idle: "尚未录音",
  requesting: "正在请求权限",
  recording: "正在录音",
  ready: "可试听",
  error: "录音失败",
  submit_error: "提交失败",
};

export type PreparedRecording = {
  blob: Blob;
  mimeType: string;
  source: "browser_recording" | "manual_upload";
  durationSeconds: number;
};

export function BrowserRecorder({
  latestSubmission,
  maxDurationSeconds,
  targetDurationSeconds,
  onPreparedChange,
}: {
  latestSubmission: StudentCourseSubmissionSummary | null;
  maxDurationSeconds: number;
  targetDurationSeconds: number | null;
  onPreparedChange: (recording: PreparedRecording | null) => void;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [recordingSource, setRecordingSource] = useState<"browser_recording" | "manual_upload">("browser_recording");
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const microphoneRequestIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    setAudioBlob(null);
    setRecordingSource("browser_recording");
    setDuration(0);
    setMessage("");
    chunksRef.current = [];
    onPreparedChange(null);
  }, [audioUrl, onPreparedChange]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopTimer();
      stopTracks();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl, stopTimer, stopTracks]);

  useEffect(() => {
    return () => {
      microphoneRequestIdRef.current += 1;
    };
  }, []);

  const requestMicrophoneAndStart = async () => {
    const requestId = ++microphoneRequestIdRef.current;
    try {
      const stream = await requestMicrophoneWithTimeout(() =>
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        }),
      );
      if (requestId !== microphoneRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const selectedMimeType = chooseRecordingMimeType((type) =>
        typeof MediaRecorder.isTypeSupported === "function" ? MediaRecorder.isTypeSupported(type) : false,
      );
      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stopTimer();
        stopTracks();
        setState("error");
        setMessage("录音过程中发生错误，请重新录制。");
      };
      recorder.onstop = () => {
        stopTimer();
        stopTracks();
        const recordedDuration = Math.min(
          maxDurationSeconds,
          Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        );
        const recordedMimeType = recorder.mimeType || selectedMimeType || chunksRef.current[0]?.type || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordedMimeType });
        if (blob.size === 0) {
          setState("error");
          setMessage("没有录到声音，请检查麦克风后重新录制。");
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        setDuration(recordedDuration);
        setRecordingSource("browser_recording");
        setAudioBlob(blob);
        setAudioUrl(objectUrl);
        setState("ready");
        onPreparedChange({
          blob,
          mimeType: recordedMimeType,
          source: "browser_recording",
          durationSeconds: recordedDuration,
        });
      };

      startedAtRef.current = Date.now();
      setDuration(0);
      recorder.start(250);
      setState("recording");
      setMessage("");
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDuration(Math.min(elapsed, maxDurationSeconds));
        if (elapsed >= maxDurationSeconds && recorder.state === "recording") {
          setMessage(`已达到最大录音时长 ${formatRecordingDuration(maxDurationSeconds)}，录音已自动停止。`);
          recorder.stop();
        }
      }, 250);
    } catch (error) {
      if (requestId !== microphoneRequestIdRef.current) return;
      stopTimer();
      stopTracks();
      setState("error");
      setMessage(getMicrophoneErrorMessage(error));
    }
  };

  const startRecording = () => {
    setMessage("");
    const isInsecureContext = typeof window !== "undefined" && !window.isSecureContext;
    if (
      typeof window === "undefined" ||
      typeof window.MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState("error");
      setMessage(isInsecureContext ? RECORDING_SECURE_CONTEXT_MESSAGE : RECORDING_UNSUPPORTED_MESSAGE);
      return;
    }

    clearRecording();
    setState("requesting");
    setMessage("正在请求麦克风权限…");
    void requestMicrophoneAndStart();
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const deleteRecording = () => {
    clearRecording();
    setState("idle");
  };

  const selectManualRecording = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateManualStudentRecordingFile(file);
    if (validationError) {
      setMessage(validationError);
      setState("submit_error");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const media = new Audio(objectUrl);
    media.preload = "metadata";
    media.addEventListener("loadedmetadata", () => {
      const fileDuration = Math.max(1, Math.round(media.duration));
      if (!Number.isFinite(media.duration)) {
        URL.revokeObjectURL(objectUrl);
        setState("submit_error");
        setMessage("无法读取音频时长，请重新选择 M4A 或 MP3 文件。");
        return;
      }
      if (fileDuration > maxDurationSeconds) {
        URL.revokeObjectURL(objectUrl);
        setState("submit_error");
        setMessage(`音频超过本任务最大时长 ${formatRecordingDuration(maxDurationSeconds)}，请压缩内容后重新上传。`);
        return;
      }
      clearRecording();
      setAudioBlob(file);
      setAudioUrl(objectUrl);
      setRecordingSource("manual_upload");
      setDuration(fileDuration);
      setState("ready");
      setMessage("音频已选择，可以试听后正式提交。");
      onPreparedChange({
        blob: file,
        mimeType: file.type || (file.name.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "audio/mp4"),
        source: "manual_upload",
        durationSeconds: fileDuration,
      });
    }, { once: true });
    media.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      setState("submit_error");
      setMessage("无法读取音频文件，请确认文件是可播放的 M4A 或 MP3。");
    }, { once: true });
    media.src = objectUrl;
  };

  const replayRecording = async () => {
    try {
      await audioRef.current?.play();
    } catch {
      setMessage("无法播放这段录音，请重新录制或更换浏览器后重试。");
    }
  };

  const canUseRecording = state !== "recording" && state !== "requesting";
  const hasRecording = Boolean(audioBlob && audioUrl);
  const showRecordingSuccess = hasRecording && recordingSource === "browser_recording";
  const persistedVersion = latestSubmission?.version ?? null;
  const statusLabel = state === "idle" && persistedVersion
    ? `已提交 · 第 ${persistedVersion} 次提交`
    : stateLabels[state];
  const statusDuration = state === "idle" && latestSubmission
    ? latestSubmission.durationSeconds
    : duration;
  const hasSubmitted = state === "idle" && Boolean(persistedVersion);
  const targetFeedback = hasRecording
    ? getRecordingTargetFeedback(duration, targetDurationSeconds)
    : null;

  return (
    <section className={`quiet-card assignment-panel oral-assignment record-panel recorder-${state}`} aria-labelledby="oral-assignment-title">
      <div className="row assignment-panel-heading">
        <div>
          <h2 id="oral-assignment-title">口语输出</h2>
          <p className="assignment-guidance">跟着老师的示范，大声读出来吧！可以反复练习，选择满意的一次提交。</p>
          <p className="assignment-limit">
            最大录制时长：{formatRecordingDuration(maxDurationSeconds)}
            {targetDurationSeconds ? ` · 🎯 目标：${targetDurationSeconds} 秒以内` : ""}
          </p>
          {targetDurationSeconds ? (
            <small>在保持发音准确、清晰、自然的同时完成挑战，不是越快越好。</small>
          ) : null}
        </div>
        {state !== "idle" || hasSubmitted ? (
          <span className={`pill ${state === "recording" ? "recording-pill" : hasSubmitted ? "olive" : "sky"}`}>
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className={`record-status ${state === "recording" ? "is-recording" : ""}`} aria-live="polite">
        <span className="record-dot" />
        <div>
          <strong>{state === "recording" ? "正在录音" : statusLabel}</strong>
          <p style={{ margin: "2px 0 0" }}>
            {state === "idle" && latestSubmission ? "最近提交 " : ""}
            {formatRecordingDuration(statusDuration)}
          </p>
        </div>
      </div>

      {hasRecording ? (
        <audio ref={audioRef} controls preload="metadata" src={audioUrl} style={{ width: "100%" }}>
          当前浏览器不支持音频播放。
        </audio>
      ) : null}

      {showRecordingSuccess ? (
        <p className="success-notice" role="status">✓ 录音成功 · {Math.round(duration)} 秒</p>
      ) : null}

      {state === "recording" ? (
        <button className="button danger full recorder-primary" onClick={stopRecording} type="button">
          <Square size={19} />
          停止录音
        </button>
      ) : (
        <button className="button full recorder-primary" disabled={!canUseRecording} onClick={startRecording} type="button">
          <Mic size={19} />
          {hasRecording ? "重新录制" : state === "error" ? "重新请求麦克风权限" : "开始录音"}
        </button>
      )}

      {message ? <p className="notice" role="status">{message}</p> : null}
      {targetFeedback ? (
        <p className={targetFeedback.reached ? "success-notice" : "notice"} role="status">
          {targetFeedback.message}
        </p>
      ) : null}

      <div className="grid-two">
        <button className="button secondary" disabled={!hasRecording} onClick={replayRecording} type="button">
          <Volume2 size={18} />
          试听
        </button>
        <button className="button ghost" disabled={!hasRecording} onClick={deleteRecording} type="button">
          <Trash2 size={18} />
          删除
        </button>
      </div>

      {hasRecording ? (
        <button className="button ghost full" onClick={startRecording} type="button">
          <RotateCcw size={18} />
          重录
        </button>
      ) : null}

      <input
        accept=".m4a,.mp3,.wav,audio/mp4,audio/x-m4a,audio/mpeg,audio/wav,audio/x-wav"
        hidden
        onChange={selectManualRecording}
        ref={fileInputRef}
        type="file"
      />
      <details className="manual-upload-fallback">
        <summary>无法直接录音？上传已有音频</summary>
        <div className="manual-upload-content">
          <p>仅支持 M4A / MP3，最大 3 MB</p>
          <button
            className="button ghost full"
            disabled={!canUseRecording}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload size={18} />选择已有音频
          </button>
        </div>
      </details>

    </section>
  );
}
