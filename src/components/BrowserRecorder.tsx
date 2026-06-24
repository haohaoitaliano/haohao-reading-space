"use client";

import { Mic, RotateCcw, Send, Square, Trash2, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthProfile } from "@/components/AuthProfileProvider";
import {
  chooseRecordingMimeType,
  formatRecordingDuration,
  getMicrophoneErrorMessage,
  RECORDING_UNSUPPORTED_MESSAGE,
} from "@/lib/recording-utils";

type RecorderState = "idle" | "requesting" | "recording" | "ready" | "submitting" | "submitted" | "error" | "submit_error";

const stateLabels: Record<RecorderState, string> = {
  idle: "尚未录音",
  requesting: "正在请求权限",
  recording: "正在录音",
  ready: "可试听",
  submitting: "正在提交",
  submitted: "已提交",
  error: "录音失败",
  submit_error: "提交失败",
};

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg")) return "mp3";
  return "webm";
}

export function BrowserRecorder({ courseId }: { courseId: string }) {
  const router = useRouter();
  const profile = useAuthProfile();
  const [state, setState] = useState<RecorderState>("idle");
  const [visibility, setVisibility] = useState<"public" | "teacher_only">("public");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setMimeType("");
    setDuration(0);
    setMessage("");
    chunksRef.current = [];
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopTimer();
      stopTracks();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [audioUrl, stopTimer, stopTracks]);

  const startRecording = async () => {
    setMessage("");
    if (
      typeof window === "undefined" ||
      typeof window.MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState("error");
      setMessage(RECORDING_UNSUPPORTED_MESSAGE);
      return;
    }

    clearRecording();
    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
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
        const recordedDuration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const recordedMimeType = recorder.mimeType || selectedMimeType || chunksRef.current[0]?.type || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordedMimeType });
        if (blob.size === 0) {
          setState("error");
          setMessage("没有录到声音，请检查麦克风后重新录制。");
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        setDuration(recordedDuration);
        setMimeType(recordedMimeType);
        setAudioBlob(blob);
        setAudioUrl(objectUrl);
        setState("ready");
      };

      startedAtRef.current = Date.now();
      setDuration(0);
      recorder.start(250);
      setState("recording");
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (error) {
      stopTimer();
      stopTracks();
      setState("error");
      setMessage(getMicrophoneErrorMessage(error));
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const deleteRecording = () => {
    clearRecording();
    setState("idle");
  };

  const replayRecording = async () => {
    try {
      await audioRef.current?.play();
    } catch {
      setMessage("无法播放这段录音，请重新录制或更换浏览器后重试。");
    }
  };

  const submitRecording = async () => {
    if (!audioBlob || !mimeType || !profile) return;
    setState("submitting");
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("audio", new File(
        [audioBlob],
        `recording.${extensionForMimeType(mimeType)}`,
        { type: mimeType },
      ));
      formData.set("durationSeconds", String(duration));
      formData.set("visibility", visibility);
      const response = await fetch(`/api/student/courses/${courseId}/submissions`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json() as {
        success: boolean;
        message?: string;
        submissionId?: string;
        version?: number;
      };
      if (!response.ok || !result.success || !result.submissionId) {
        throw new Error(result.message || "submit_failed");
      }
      setState("submitted");
      setMessage(`录音提交成功 · 第 ${result.version} 版`);
      redirectTimerRef.current = setTimeout(() => {
        router.push(`/ai-feedback?submissionId=${encodeURIComponent(result.submissionId ?? "")}`);
      }, 900);
    } catch (error) {
      setState("submit_error");
      setMessage(error instanceof Error && error.message !== "submit_failed"
        ? error.message
        : "录音提交失败，请检查网络后重试。");
    }
  };

  const canUseRecording = state !== "recording" && state !== "requesting" && state !== "submitting";
  const hasRecording = Boolean(audioBlob && audioUrl);

  return (
    <section className={`quiet-card record-panel recorder-${state}`}>
      <div className="row">
        <div>
          <p className="kicker">跟读录音</p>
          <h2 style={{ marginBottom: 0 }}>录一次，也可以再来一次</h2>
        </div>
        <span className={`pill ${state === "recording" ? "recording-pill" : state === "submitted" ? "olive" : "sky"}`}>
          {stateLabels[state]}
        </span>
      </div>

      <div className={`record-status ${state === "recording" ? "is-recording" : ""}`} aria-live="polite">
        <span className="record-dot" />
        <div>
          <strong>{state === "recording" ? "正在录音" : stateLabels[state]}</strong>
          <p style={{ margin: "2px 0 0" }}>{formatRecordingDuration(duration)}</p>
        </div>
      </div>

      {hasRecording ? (
        <audio ref={audioRef} controls preload="metadata" src={audioUrl} style={{ width: "100%" }}>
          当前浏览器不支持音频播放。
        </audio>
      ) : null}

      {state === "recording" ? (
        <button className="button danger full recorder-primary" onClick={stopRecording} type="button">
          <Square size={19} />
          停止录音
        </button>
      ) : (
        <button className="button full recorder-primary" disabled={!canUseRecording} onClick={startRecording} type="button">
          <Mic size={19} />
          {hasRecording ? "重新录制" : "开始录音"}
        </button>
      )}

      <div className="grid-two">
        <button className="button secondary" disabled={!hasRecording || state === "submitting"} onClick={replayRecording} type="button">
          <Volume2 size={18} />
          试听
        </button>
        <button className="button ghost" disabled={!hasRecording || state === "submitting"} onClick={deleteRecording} type="button">
          <Trash2 size={18} />
          删除
        </button>
      </div>

      {hasRecording ? (
        <button className="button ghost full" disabled={state === "submitting"} onClick={startRecording} type="button">
          <RotateCcw size={18} />
          重录
        </button>
      ) : null}

      <div className="privacy-options">
        <p className="kicker">公开设置</p>
        <label className="privacy-option">
          <input
            checked={visibility === "public"}
            disabled={state === "recording" || state === "submitting"}
            name="visibility"
            onChange={() => setVisibility("public")}
            type="radio"
          />
          <span><strong>对同学公开</strong><small>同班同学可以收听、点赞和评论</small></span>
        </label>
        <label className="privacy-option">
          <input
            checked={visibility === "teacher_only"}
            disabled={state === "recording" || state === "submitting"}
            name="visibility"
            onChange={() => setVisibility("teacher_only")}
            type="radio"
          />
          <span><strong>仅老师可见</strong><small>只会出现在本人的“我的作业”中</small></span>
        </label>
      </div>

      <button className="button full" disabled={!profile || !hasRecording || state === "submitting" || state === "submitted"} onClick={submitRecording} type="button">
        <Send size={18} />
          {state === "submitting" ? "正在上传..." : "提交录音"}
      </button>
      {message ? <p className={state === "submitted" ? "success-notice" : "notice"} role="status">{message}</p> : null}
    </section>
  );
}
