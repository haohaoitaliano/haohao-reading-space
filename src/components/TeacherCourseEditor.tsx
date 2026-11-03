"use client";

import { Archive, ExternalLink, FileAudio, FileText, Plus, RotateCcw, Save, Trash2, Upload, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { CourseActionResult } from "@/app/teacher/course-actions";
import { formatFileSize } from "@/lib/audio-file";
import {
  validateCourseEditorInput,
  type CourseEditorInput,
} from "@/lib/cloud-course";
import { validateCourseAudioFile } from "@/lib/course-audio";
import { validateCourseVideoFile } from "@/lib/course-video";
import { validateCoursePdfFile } from "@/lib/course-pdf";
import type { CloudCourseAudio, CloudCourseDetail, CloudCoursePdf, CloudCourseVideo } from "@/lib/cloud-course-data";
import { formatDateTimeLocalInZone, formatUnlockDateTime } from "@/lib/course-schedule";
import {
  readJsonResponse,
  uploadFileDirectly,
  type DirectUploadTicket,
} from "@/lib/direct-storage-upload";

type SaveAction = (input: CourseEditorInput) => Promise<CourseActionResult>;
type LifecycleAction = () => Promise<CourseActionResult>;
type FeedbackArea = "course" | "pdf" | "audio" | "video" | "lifecycle";

function toEditorInput(course: CloudCourseDetail): CourseEditorInput {
  return {
    dayNumber: course.dayNumber,
    italianTitle: course.italianTitle,
    chineseTitle: course.chineseTitle,
    description: course.description,
    readingText: course.readingText,
    reflectionPromptZh: course.reflectionPromptZh,
    reflectionPromptIt: course.reflectionPromptIt,
    unlockMode: course.unlockMode,
    unlockAtLocal: formatDateTimeLocalInZone(course.unlockOverrideAt, course.timezone),
    status: course.status,
    maxDurationSeconds: course.maxDurationSeconds,
    targetDurationSeconds: course.targetDurationSeconds,
    recordingAssignmentEnabled: course.recordingAssignmentEnabled,
    photoAssignmentEnabled: course.photoAssignmentEnabled,
    vocabulary: course.vocabulary.map((item) => ({ ...item })),
  };
}

export function TeacherCourseEditor({
  archiveAction,
  course: initialCourse,
  deleteAction,
  reactivateAction,
  saveAction,
}: {
  course: CloudCourseDetail;
  saveAction: SaveAction;
  archiveAction?: LifecycleAction;
  reactivateAction?: LifecycleAction;
  deleteAction?: LifecycleAction;
}) {
  const router = useRouter();
  const [course, setCourse] = useState(() => toEditorInput(initialCourse));
  const [audio, setAudio] = useState<CloudCourseAudio | null>(initialCourse.audio);
  const [video, setVideo] = useState<CloudCourseVideo | null>(initialCourse.video);
  const [pdfs, setPdfs] = useState<CloudCoursePdf[]>(initialCourse.pdfs);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedVideoDuration, setSelectedVideoDuration] = useState<number | null>(null);
  const [selectedPdfFiles, setSelectedPdfFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPdfs, setUploadingPdfs] = useState(false);
  const [pdfUploadProgress, setPdfUploadProgress] = useState(0);
  const [deletingAudio, setDeletingAudio] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState(false);
  const [deletingPdfId, setDeletingPdfId] = useState("");
  const [saving, setSaving] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [feedbackArea, setFeedbackArea] = useState<FeedbackArea>("course");
  const previewUrl = useMemo(() => selectedFile ? URL.createObjectURL(selectedFile) : "", [selectedFile]);
  const videoPreviewUrl = useMemo(
    () => selectedVideoFile ? URL.createObjectURL(selectedVideoFile) : "",
    [selectedVideoFile],
  );

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => { if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl); }, [videoPreviewUrl]);

  function updateField<K extends keyof CourseEditorInput>(field: K, value: CourseEditorInput[K]) {
    setCourse((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function updateVocabulary(index: number, field: "position" | "word" | "meaningZh", value: string | number) {
    updateField("vocabulary", course.vocabulary.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    ));
  }

  function addVocabulary() {
    const nextPosition = Math.max(0, ...course.vocabulary.map((item) => item.position)) + 1;
    updateField("vocabulary", [...course.vocabulary, { position: nextPosition, word: "", meaningZh: "" }]);
  }

  function removeVocabulary(index: number) {
    updateField("vocabulary", course.vocabulary.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFeedbackArea("audio");
    setError("");
    setMessage("");
    const validationError = validateCourseAudioFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSelectedFile(file);
    setSelectedDuration(null);
    setUploadProgress(0);
    const objectUrl = URL.createObjectURL(file);
    const media = new Audio(objectUrl);
    media.addEventListener("loadedmetadata", () => {
      setSelectedDuration(Number.isFinite(media.duration) ? media.duration : null);
      URL.revokeObjectURL(objectUrl);
    }, { once: true });
    media.addEventListener("error", () => URL.revokeObjectURL(objectUrl), { once: true });
  }

  function handleVideoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFeedbackArea("video");
    setError("");
    setMessage("");
    const validationError = validateCourseVideoFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSelectedVideoFile(file);
    setSelectedVideoDuration(null);
    const objectUrl = URL.createObjectURL(file);
    const media = document.createElement("video");
    media.preload = "metadata";
    media.addEventListener("loadedmetadata", () => {
      setSelectedVideoDuration(Number.isFinite(media.duration) ? media.duration : null);
      URL.revokeObjectURL(objectUrl);
    }, { once: true });
    media.addEventListener("error", () => URL.revokeObjectURL(objectUrl), { once: true });
    media.src = objectUrl;
  }

  function handlePdfFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setFeedbackArea("pdf");
    setError("");
    setMessage("");
    for (const file of files) {
      const validationError = validateCoursePdfFile(file);
      if (validationError) {
        setError(`${file.name}：${validationError}`);
        return;
      }
    }
    setSelectedPdfFiles((current) => [...current, ...files]);
    setPdfUploadProgress(0);
  }

  async function uploadAudio() {
    if (!selectedFile || !initialCourse.id) return;
    setFeedbackArea("audio");
    setUploading(true);
    setUploadProgress(0);
    setError("");
    setMessage("");

    const result = await new Promise<{ success: boolean; message: string; audio?: CloudCourseAudio }>((resolve) => {
      const request = new XMLHttpRequest();
      request.open("POST", `/api/teacher/courses/${initialCourse.id}/audio`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
      };
      request.onload = () => {
        try { resolve(JSON.parse(request.responseText)); }
        catch { resolve({ success: false, message: "音频上传失败，请稍后重试。" }); }
      };
      request.onerror = () => resolve({ success: false, message: "网络错误，音频上传失败。" });
      const formData = new FormData();
      formData.set("audio", selectedFile);
      if (selectedDuration !== null) formData.set("durationSeconds", String(selectedDuration));
      request.send(formData);
    });

    if (result.success && result.audio) {
      setAudio(result.audio);
      setSelectedFile(null);
      setUploadProgress(100);
      setMessage(result.message);
    } else {
      setError(result.message);
    }
    setUploading(false);
  }

  async function deleteAudio() {
    if (!initialCourse.id || !audio) return;
    setFeedbackArea("audio");
    setDeletingAudio(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/teacher/courses/${initialCourse.id}/audio`, { method: "DELETE" });
      const result = await response.json() as { success: boolean; message: string };
      if (!response.ok || !result.success) throw new Error();
      setAudio(null);
      setMessage(result.message);
    } catch {
      setError("音频删除失败，请稍后重试。");
    } finally {
      setDeletingAudio(false);
    }
  }

  async function uploadVideo() {
    if (!selectedVideoFile || !initialCourse.id) return;
    setFeedbackArea("video");
    setUploadingVideo(true);
    setError("");
    setMessage("");

    try {
      const uploadInfo = {
        fileName: selectedVideoFile.name,
        mimeType: selectedVideoFile.type,
        size: selectedVideoFile.size,
      };
      const prepareResponse = await fetch(`/api/teacher/courses/${initialCourse.id}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", ...uploadInfo }),
      });
      const prepared = await readJsonResponse<{ upload: DirectUploadTicket }>(prepareResponse, "无法创建视频上传授权，请重试。");
      await uploadFileDirectly({
        file: selectedVideoFile,
        ticket: prepared.upload,
      });
      const completeResponse = await fetch(`/api/teacher/courses/${initialCourse.id}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          path: prepared.upload.path,
          durationSeconds: selectedVideoDuration,
          ...uploadInfo,
        }),
      });
      const result = await readJsonResponse<{ success: boolean; message: string; video?: CloudCourseVideo }>(
        completeResponse,
        "视频已传到云端，但课程信息确认失败；请保留文件并重试。",
      );
      if (!result.video) throw new Error(result.message || "视频上传状态异常，请刷新页面确认。");
      setVideo(result.video);
      setSelectedVideoFile(null);
      setMessage(result.message);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "视频上传失败，请保留文件并重试。");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function deleteVideo() {
    if (!initialCourse.id || !video) return;
    setFeedbackArea("video");
    setDeletingVideo(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/teacher/courses/${initialCourse.id}/video`, { method: "DELETE" });
      const result = await response.json() as { success: boolean; message: string };
      if (!response.ok || !result.success) throw new Error(result.message);
      setVideo(null);
      setMessage(result.message);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error && deleteError.message ? deleteError.message : "视频删除失败，请稍后重试。");
    } finally {
      setDeletingVideo(false);
    }
  }

  async function uploadPdfs() {
    if (!initialCourse.id || !selectedPdfFiles.length) return;
    setFeedbackArea("pdf");
    setUploadingPdfs(true);
    setPdfUploadProgress(0);
    setError("");
    setMessage("");
    const uploaded: CloudCoursePdf[] = [];

    for (const [index, file] of selectedPdfFiles.entries()) {
      const result = await new Promise<{ success: boolean; message: string; pdf?: CloudCoursePdf }>((resolve) => {
        const request = new XMLHttpRequest();
        request.open("POST", `/api/teacher/courses/${initialCourse.id}/pdfs`);
        request.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const fileProgress = event.loaded / event.total;
          setPdfUploadProgress(Math.round(((index + fileProgress) / selectedPdfFiles.length) * 100));
        };
        request.onload = () => {
          try {
            const payload = JSON.parse(request.responseText) as { success?: boolean; message?: string; pdf?: CloudCoursePdf };
            resolve({
              success: request.status >= 200 && request.status < 300 && Boolean(payload.success),
              message: payload.message ?? "PDF 上传失败，请重试。",
              pdf: payload.pdf,
            });
          } catch {
            resolve({ success: false, message: "PDF 上传失败，请稍后重试。" });
          }
        };
        request.onerror = () => resolve({ success: false, message: "网络错误，PDF 上传失败。" });
        const formData = new FormData();
        formData.set("pdf", file);
        request.send(formData);
      });
      if (!result.success || !result.pdf) {
        setPdfs((current) => [...current, ...uploaded]);
        setSelectedPdfFiles((current) => current.slice(index));
        setError(`${file.name}：${result.message}；尚未上传的文件已保留，可直接重试。`);
        setUploadingPdfs(false);
        router.refresh();
        return;
      }
      uploaded.push(result.pdf);
    }
    setPdfs((current) => [...current, ...uploaded]);
    setSelectedPdfFiles([]);
    setPdfUploadProgress(100);
    setMessage(`已上传 ${uploaded.length} 个 PDF。`);
    setUploadingPdfs(false);
    router.refresh();
  }

  async function deletePdf(pdf: CloudCoursePdf) {
    if (!initialCourse.id || !window.confirm(`确定删除“${pdf.fileName}”吗？`)) return;
    setFeedbackArea("pdf");
    setDeletingPdfId(pdf.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/teacher/courses/${initialCourse.id}/pdfs/${pdf.id}`, { method: "DELETE" });
      const result = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "PDF 删除失败，请重试。");
      setPdfs((current) => current.filter((item) => item.id !== pdf.id));
      setMessage(result.message || "PDF 已删除。");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "PDF 删除失败，请重试。");
    } finally {
      setDeletingPdfId("");
    }
  }

  async function saveChanges() {
    setFeedbackArea("course");
    const validationError = validateCourseEditorInput(course);
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError("");
    setMessage("");

    const result = await saveAction(course);
    if (!result.success) {
      setError(result.message);
      setSaving(false);
      return;
    }

    setMessage(result.message);
    if (!initialCourse.id && result.courseId) {
      window.location.assign(`/teacher/courses/${result.courseId}/edit`);
      return;
    }
    router.refresh();
    setSaving(false);
  }

  async function runLifecycleAction(
    action: LifecycleAction | undefined,
    redirectAfterSuccess = false,
    nextStatus?: CourseEditorInput["status"],
  ) {
    if (!action) return;
    setFeedbackArea("lifecycle");
    setLifecycleBusy(true);
    setError("");
    setMessage("");
    const result = await action();
    if (!result.success) {
      setError(result.message);
      setLifecycleBusy(false);
      return;
    }
    setMessage(result.message);
    if (nextStatus) setCourse((current) => ({ ...current, status: nextStatus }));
    if (redirectAfterSuccess) {
      window.location.assign("/teacher");
      return;
    }
    router.refresh();
    setLifecycleBusy(false);
  }

  function confirmPermanentDelete() {
    if (!initialCourse.id || !deleteAction) return;
    const confirmed = window.confirm(
      "确定要永久删除这节课程吗？这个操作不可恢复，示范音频、视频和 PDF 文件也会同步删除。",
    );
    if (!confirmed) return;
    void runLifecycleAction(deleteAction, true);
  }

  function renderFeedback(area: FeedbackArea) {
    if (feedbackArea !== area) return null;
    if (error) return <p className="notice" role="alert">{error}</p>;
    if (message) return <p className="success-notice" role="status">{message}</p>;
    return null;
  }

  return (
    <div className="stack">
      <section className="quiet-card">
        <p className="kicker">云端课程内容</p>
        <label className="field">课程天数
          <input min={0} onChange={(event) => updateField("dayNumber", Number(event.target.value))} type="number" value={course.dayNumber} />
        </label>
        <label className="field">{course.dayNumber === 0 ? "课程标题" : "意大利语标题"}
          <input onChange={(event) => updateField("italianTitle", event.target.value)} value={course.italianTitle} />
        </label>
        <label className="field">中文标题
          <input onChange={(event) => updateField("chineseTitle", event.target.value)} value={course.chineseTitle} />
        </label>
        <label className="field">课程状态
          <select onChange={(event) => updateField("status", event.target.value as CourseEditorInput["status"])} value={course.status}>
            <option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option>
          </select>
        </label>
        <label className="field">解锁方式
          <select onChange={(event) => updateField("unlockMode", event.target.value as CourseEditorInput["unlockMode"])} value={course.unlockMode}>
            <option value="auto">按训练营日期自动解锁</option>
            <option value="manual">手动指定本课时间</option>
          </select>
        </label>
        {course.unlockMode === "auto" ? (
          <p className="notice">自动解锁：{course.dayNumber === 0
            ? "课程创建后立即解锁"
            : initialCourse.id
              ? formatUnlockDateTime(initialCourse.automaticUnlockAt, initialCourse.timezone)
              : "保存后按所选训练营开始时间和 Giorno 计算"}（{initialCourse.timezone}）</p>
        ) : (
          <label className="field">手动解锁时间（{initialCourse.timezone}）
            <input onChange={(event) => updateField("unlockAtLocal", event.target.value || null)} type="datetime-local" value={course.unlockAtLocal ?? ""} />
          </label>
        )}
        <label className="field">今日解锁说明
          <textarea onChange={(event) => updateField("description", event.target.value)} rows={3} value={course.description} />
        </label>
        <label className="field">阅读材料（选填）
          <textarea onChange={(event) => updateField("readingText", event.target.value)} rows={7} value={course.readingText} />
        </label>
        <label className="field">阅读后的感想中文引导语
          <textarea onChange={(event) => updateField("reflectionPromptZh", event.target.value)} rows={4} value={course.reflectionPromptZh} />
        </label>
        <label className="field">阅读后的感想意大利语引导语
          <textarea onChange={(event) => updateField("reflectionPromptIt", event.target.value)} rows={4} value={course.reflectionPromptIt} />
        </label>
        <label className="field">最大录音时长（秒）
          <input
            min={1}
            onChange={(event) => updateField("maxDurationSeconds", Number(event.target.value))}
            step={1}
            type="number"
            value={course.maxDurationSeconds}
          />
          <small>达到这个时长时，网页录音会自动停止。现有课程默认为 120 秒。</small>
        </label>
        <label className="field">目标时长（秒，可选）
          <input
            max={course.maxDurationSeconds}
            min={1}
            onChange={(event) => updateField(
              "targetDurationSeconds",
              event.target.value === "" ? null : Number(event.target.value),
            )}
            placeholder="例如 30；留空表示普通录音任务"
            step={1}
            type="number"
            value={course.targetDurationSeconds ?? ""}
          />
          <small>这是准确、清晰、自然表达下的挑战目标，不是提交限制。</small>
        </label>
        <fieldset className="assignment-options">
          <legend>本课作业类型</legend>
          <label>
            <input checked={course.recordingAssignmentEnabled} onChange={(event) => updateField("recordingAssignmentEnabled", event.target.checked)} type="checkbox" />
            开启录音作业
          </label>
          <label>
            <input checked={course.photoAssignmentEnabled} onChange={(event) => updateField("photoAssignmentEnabled", event.target.checked)} type="checkbox" />
            开启照片作业
          </label>
          <small>两项可以同时开启；全部关闭时，本课无需提交作业。</small>
        </fieldset>
      </section>

      <section className="quiet-card stack">
        <div className="row"><div><p className="kicker">Vocabolario</p><h2>重点词汇</h2></div>
          <button className="button secondary" onClick={addVocabulary} type="button"><Plus size={18} /> 添加</button>
        </div>
        {course.vocabulary.map((item, index) => (
          <div className="item-card" key={item.id ?? `new-${index}`}>
            <label className="field">位置
              <input min={1} onChange={(event) => updateVocabulary(index, "position", Number(event.target.value))} type="number" value={item.position} />
            </label>
            <label className="field">单词
              <input onChange={(event) => updateVocabulary(index, "word", event.target.value)} value={item.word} />
            </label>
            <label className="field">中文释义
              <input onChange={(event) => updateVocabulary(index, "meaningZh", event.target.value)} value={item.meaningZh} />
            </label>
            <button className="button ghost full" onClick={() => removeVocabulary(index)} type="button"><Trash2 size={18} /> 删除这个词</button>
          </div>
        ))}
      </section>

      <section className="quiet-card stack">
        <div className="row start"><div><p className="kicker">Private Storage</p><h2>PDF 课件</h2></div><FileText color="var(--sky)" /></div>
        {!initialCourse.id ? <p className="notice">请先创建课程，再上传 PDF 课件。</p> : null}
        <label className="button secondary full upload-picker">
          <Upload size={18} />选择 PDF 文件
          <input accept=".pdf,application/pdf" disabled={!initialCourse.id || uploadingPdfs} multiple onChange={handlePdfFileChange} type="file" />
        </label>
        {selectedPdfFiles.length ? (
          <div className="stack">
            {selectedPdfFiles.map((file, index) => (
              <div className="item-card row start" key={`${file.name}-${file.lastModified}-${index}`}>
                <div><strong className="file-name">待上传 · {file.name}</strong><p style={{ marginBottom: 0 }}>{formatFileSize(file.size)}</p></div>
                <button aria-label={`移除 ${file.name}`} className="button ghost" disabled={uploadingPdfs} onClick={() => setSelectedPdfFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 size={18} /></button>
              </div>
            ))}
            {uploadingPdfs ? <div className="progress-bar" aria-label="PDF 上传进度"><span style={{ "--value": `${pdfUploadProgress}%` } as React.CSSProperties} /></div> : null}
            <button className="button full" disabled={uploadingPdfs} onClick={() => void uploadPdfs()} type="button"><Upload size={18} />{uploadingPdfs ? `上传中 ${pdfUploadProgress}%` : `上传 ${selectedPdfFiles.length} 个 PDF`}</button>
          </div>
        ) : null}
        {renderFeedback("pdf")}
        {pdfs.length ? pdfs.map((pdf) => (
          <div className="audio-box" key={pdf.id}>
            <div className="row start">
              <div><strong className="file-name">已上传 · {pdf.fileName}</strong><p>{formatFileSize(pdf.sizeBytes)}</p></div>
              <button aria-label={`删除 ${pdf.fileName}`} className="button ghost" disabled={deletingPdfId === pdf.id} onClick={() => void deletePdf(pdf)} type="button"><Trash2 size={18} /></button>
            </div>
            {pdf.signedUrl ? <a className="button secondary full" href={pdf.signedUrl} rel="noreferrer" target="_blank"><ExternalLink size={17} />在线预览 PDF</a> : <p className="notice">预览链接暂时不可用，请刷新页面。</p>}
          </div>
        )) : <div className="item-card"><p style={{ margin: 0 }}>暂无 PDF 课件。</p></div>}
      </section>

      <section className="quiet-card stack">
        <div className="row start"><div><p className="kicker">Private Storage</p><h2>云端示范音频</h2></div><FileAudio color="var(--sky)" /></div>
        {!initialCourse.id ? <p className="notice">请先创建课程，再上传示范音频。</p> : null}
        <label className="button secondary full upload-picker">
          {audio ? <RotateCcw size={18} /> : <Upload size={18} />}{audio ? "选择替换音频" : "选择音频文件"}
          <input accept=".mp3,.m4a,.wav,.webm,.ogg,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,audio/ogg" disabled={!initialCourse.id || uploading} onChange={handleFileChange} type="file" />
        </label>

        {selectedFile && previewUrl ? (
          <div className="audio-box">
            <div className="row start"><div><strong className="file-name">待上传 · {selectedFile.name}</strong><p>{formatFileSize(selectedFile.size)}</p></div>
              <button aria-label="取消选择音频" className="button ghost" onClick={() => setSelectedFile(null)} type="button"><Trash2 size={18} /></button>
            </div>
            <audio controls preload="metadata" src={previewUrl} style={{ width: "100%" }} />
            {uploading ? <div className="progress-bar" aria-label="音频上传进度"><span style={{ "--value": `${uploadProgress}%` } as React.CSSProperties} /></div> : null}
            <button className="button full" disabled={uploading} onClick={uploadAudio} type="button"><Upload size={18} /> {uploading ? `上传中 ${uploadProgress}%` : "上传到云端"}</button>
          </div>
        ) : null}

        {audio ? (
          <div className="audio-box">
            <div className="row start"><div><strong className="file-name">已上传 · {audio.fileName}</strong><p>{formatFileSize(audio.sizeBytes)}</p></div>
              <button aria-label="删除云端示范音频" className="button ghost" disabled={deletingAudio} onClick={deleteAudio} type="button"><Trash2 size={18} /></button>
            </div>
            <audio controls preload="metadata" src={audio.signedUrl} style={{ width: "100%" }} />
          </div>
        ) : <div className="item-card"><p style={{ margin: 0 }}>暂无云端示范音频。</p></div>}
        {renderFeedback("audio")}
      </section>

      <section className="quiet-card stack">
        <div className="row start"><div><p className="kicker">Private Storage</p><h2>云端示范视频</h2></div><Video color="var(--olive)" /></div>
        {!initialCourse.id ? <p className="notice">请先创建课程，再上传示范视频。</p> : null}
        <label className="button secondary full upload-picker">
          {video ? <RotateCcw size={18} /> : <Upload size={18} />}{video ? "选择替换视频" : "选择视频文件"}
          <input accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" disabled={!initialCourse.id || uploadingVideo} onChange={handleVideoFileChange} type="file" />
        </label>

        {selectedVideoFile && videoPreviewUrl ? (
          <div className="audio-box">
            <div className="row start"><div><strong className="file-name">待上传 · {selectedVideoFile.name}</strong><p>{formatFileSize(selectedVideoFile.size)}</p></div>
              <button aria-label="取消选择视频" className="button ghost" onClick={() => setSelectedVideoFile(null)} type="button"><Trash2 size={18} /></button>
            </div>
            <video controls preload="metadata" src={videoPreviewUrl} style={{ width: "100%", borderRadius: 8 }} />
            <button className="button full" disabled={uploadingVideo} onClick={uploadVideo} type="button"><Upload size={18} /> {uploadingVideo ? "正在上传" : "上传视频到云端"}</button>
          </div>
        ) : null}

        {video ? (
          <div className="audio-box">
            <div className="row start"><div><strong className="file-name">已上传 · {video.fileName}</strong><p>{formatFileSize(video.sizeBytes)}</p></div>
              <button aria-label="删除云端示范视频" className="button ghost" disabled={deletingVideo} onClick={deleteVideo} type="button"><Trash2 size={18} /></button>
            </div>
            {video.signedUrl ? (
              <video controls preload="metadata" src={video.signedUrl} style={{ width: "100%", borderRadius: 8 }} />
            ) : (
              <p className="notice" style={{ margin: 0 }}>视频已保存，预览链接暂时不可用；请刷新页面重试。</p>
            )}
          </div>
        ) : <div className="item-card"><p style={{ margin: 0 }}>暂无云端示范视频。</p></div>}
        {renderFeedback("video")}
      </section>

      {initialCourse.id ? (
        <section className="quiet-card stack">
          <div className="row start">
            <div>
              <p className="kicker">Lifecycle</p>
              <h2>课程生命周期</h2>
            </div>
            <Archive color="var(--sage)" />
          </div>
          <p className="notice">
            归档后学生端不再显示这节课；课程文字、示范音频和历史提交会继续保留，老师仍可查看并重新启用。
          </p>
          <div className="row">
            {course.status === "archived" ? (
              <button
                className="button secondary"
                disabled={lifecycleBusy || saving || uploading || uploadingVideo || uploadingPdfs}
                onClick={() => void runLifecycleAction(reactivateAction, false, "published")}
                type="button"
              >
                <RotateCcw size={18} /> 重新启用
              </button>
            ) : (
              <button
                className="button secondary"
                disabled={lifecycleBusy || saving || uploading || uploadingVideo || uploadingPdfs}
                onClick={() => void runLifecycleAction(archiveAction, false, "archived")}
                type="button"
              >
                <Archive size={18} /> 归档课程
              </button>
            )}
            <button
              className="button ghost"
              disabled={lifecycleBusy || saving || uploading || uploadingVideo || uploadingPdfs || initialCourse.submissionCount > 0}
              onClick={confirmPermanentDelete}
              type="button"
            >
              <Trash2 size={18} /> 永久删除课程
            </button>
          </div>
          {renderFeedback("lifecycle")}
          {initialCourse.submissionCount > 0 ? (
            <p className="notice">已有 {initialCourse.submissionCount} 条学生提交，不能永久删除；请使用归档。</p>
          ) : (
            <p className="notice">只有没有任何学生提交的课程才可以永久删除；删除后不可恢复。</p>
          )}
        </section>
      ) : null}

      <p className="notice">课程文字、媒体和作业配置保存到 Supabase；上传前的临时文件只保存在当前浏览器。</p>
      <button className="button full" disabled={saving || uploading || uploadingVideo || uploadingPdfs} onClick={saveChanges} type="button">
        <Save size={18} /> {saving ? "正在保存..." : "保存课程"}
      </button>
      {renderFeedback("course")}
    </div>
  );
}
