"use client";

import { Camera, Images, Mic, Square, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { formatFileSize } from "@/lib/audio-file";
import { chooseRecordingMimeType, formatRecordingDuration, getMicrophoneErrorMessage } from "@/lib/recording-utils";
import {
  compressSubmissionCommentImage,
  SUBMISSION_COMMENT_AUDIO_MAX_SECONDS,
  validateSubmissionCommentAudio,
  validateSubmissionCommentImage,
} from "@/lib/submission-comment-media";
import { getStudentRecordingExtension } from "@/lib/student-recording";

export type PreparedCommentAudio = {
  file: File;
  durationSeconds: number;
  source: "browser_recording" | "manual_upload";
};

export function SubmissionCommentMediaPicker({
  disabled,
  onAudioChange,
  onImageChange,
}: {
  disabled: boolean;
  onAudioChange: (audio: PreparedCommentAudio | null) => void;
  onImageChange: (image: File | null) => void;
}) {
  const [audio, setAudio] = useState<PreparedCommentAudio | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [audioUrl, imageUrl]);

  function commitAudio(next: PreparedCommentAudio | null) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudio(next);
    setAudioUrl(next ? URL.createObjectURL(next.file) : "");
    onAudioChange(next);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function startRecording() {
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = chooseRecordingMimeType((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const seconds = Math.min(SUBMISSION_COMMENT_AUDIO_MAX_SECONDS, Math.max(1, (Date.now() - startedAtRef.current) / 1000));
        const blobType = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        const extension = getStudentRecordingExtension("", blobType) || "webm";
        const file = new File([blob], `comment-recording.${extension}`, { type: blobType });
        const error = validateSubmissionCommentAudio(file, "browser_recording");
        if (error) setMessage(error);
        else commitAudio({ file, durationSeconds: seconds, source: "browser_recording" });
        setRecording(false);
        setDuration(Math.round(seconds));
      };
      recorder.onerror = () => { setMessage("录音失败，请重新录制。"); setRecording(false); };
      startedAtRef.current = Date.now();
      setDuration(0);
      setRecording(true);
      recorder.start(250);
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDuration(Math.min(SUBMISSION_COMMENT_AUDIO_MAX_SECONDS, seconds));
        if (seconds >= SUBMISSION_COMMENT_AUDIO_MAX_SECONDS) stopRecording();
      }, 250);
    } catch (error) {
      setMessage(getMicrophoneErrorMessage(error));
    }
  }

  async function getAudioDuration(file: File) {
    const url = URL.createObjectURL(file);
    try {
      const element = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        element.onloadedmetadata = () => resolve();
        element.onerror = () => reject(new Error("invalid audio"));
      });
      return element.duration;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function selectAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    const error = validateSubmissionCommentAudio(file, "manual_upload");
    if (error) return setMessage(error);
    try {
      const seconds = await getAudioDuration(file);
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > SUBMISSION_COMMENT_AUDIO_MAX_SECONDS) {
        return setMessage("录音时长必须在 45 秒以内。");
      }
      commitAudio({ file, durationSeconds: seconds, source: "manual_upload" });
    } catch {
      setMessage("无法读取录音时长，请选择有效的 M4A 或 MP3 文件。");
    }
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    try {
      const compressed = await compressSubmissionCommentImage(file);
      const error = validateSubmissionCommentImage(compressed);
      if (error) return setMessage(error);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImage(compressed);
      setImageUrl(URL.createObjectURL(compressed));
      onImageChange(compressed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "照片处理失败，请重新选择。");
    }
  }

  return (
    <div className="comment-media-picker">
      <div className="comment-media-actions">
        <button className="button ghost" disabled={disabled || recording || Boolean(audio)} onClick={() => void startRecording()} type="button"><Mic size={17} />录音</button>
        {recording ? <button className="button secondary" onClick={stopRecording} type="button"><Square size={16} />停止 {formatRecordingDuration(duration)}</button> : null}
        <label className="button ghost upload-picker"><Upload size={17} />上传录音<input accept="audio/mp4,audio/x-m4a,audio/mpeg,.m4a,.mp3" disabled={disabled || recording || Boolean(audio)} onChange={(event) => void selectAudio(event)} type="file" /></label>
        <label className="button ghost upload-picker"><Camera size={17} />拍照<input accept="image/jpeg,image/png,image/webp" capture="environment" disabled={disabled || Boolean(image)} onChange={(event) => void selectImage(event)} type="file" /></label>
        <label className="button ghost upload-picker"><Images size={17} />相册<input accept="image/jpeg,image/png,image/webp" disabled={disabled || Boolean(image)} onChange={(event) => void selectImage(event)} type="file" /></label>
      </div>
      {audio ? <div className="comment-attachment-preview"><audio controls preload="metadata" src={audioUrl} /><span>{formatRecordingDuration(audio.durationSeconds)} · {formatFileSize(audio.file.size)}</span><button aria-label="移除录音" onClick={() => commitAudio(null)} type="button"><Trash2 size={17} /></button></div> : null}
      {image ? <div className="comment-image-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="待发送照片" src={imageUrl} />
        <span>{formatFileSize(image.size)}</span>
        <button aria-label="移除照片" onClick={() => { URL.revokeObjectURL(imageUrl); setImage(null); setImageUrl(""); onImageChange(null); }} type="button"><Trash2 size={17} /></button>
      </div> : null}
      {message ? <p className="submission-interaction-message" role="alert">{message}</p> : null}
    </div>
  );
}
