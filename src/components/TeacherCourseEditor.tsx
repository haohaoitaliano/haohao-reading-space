"use client";

import { FileAudio, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { CourseActionResult } from "@/app/teacher/course-actions";
import { formatFileSize } from "@/lib/audio-file";
import {
  validateCourseEditorInput,
  type CourseEditorInput,
} from "@/lib/cloud-course";
import { validateCourseAudioFile } from "@/lib/course-audio";
import type { CloudCourseAudio, CloudCourseDetail } from "@/lib/cloud-course-data";
import { formatDateTimeLocalInZone, formatUnlockDateTime } from "@/lib/course-schedule";

type SaveAction = (input: CourseEditorInput) => Promise<CourseActionResult>;

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
    vocabulary: course.vocabulary.map((item) => ({ ...item })),
  };
}

export function TeacherCourseEditor({ course: initialCourse, saveAction }: {
  course: CloudCourseDetail;
  saveAction: SaveAction;
}) {
  const router = useRouter();
  const [course, setCourse] = useState(() => toEditorInput(initialCourse));
  const [audio, setAudio] = useState<CloudCourseAudio | null>(initialCourse.audio);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingAudio, setDeletingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const previewUrl = useMemo(() => selectedFile ? URL.createObjectURL(selectedFile) : "", [selectedFile]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

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
    const validationError = validateCourseAudioFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSelectedFile(file);
    setSelectedDuration(null);
    setUploadProgress(0);
    setError("");
    const objectUrl = URL.createObjectURL(file);
    const media = new Audio(objectUrl);
    media.addEventListener("loadedmetadata", () => {
      setSelectedDuration(Number.isFinite(media.duration) ? media.duration : null);
      URL.revokeObjectURL(objectUrl);
    }, { once: true });
    media.addEventListener("error", () => URL.revokeObjectURL(objectUrl), { once: true });
  }

  async function uploadAudio() {
    if (!selectedFile || !initialCourse.id) return;
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

  async function saveChanges() {
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

  return (
    <div className="stack">
      {error ? <p className="notice" role="alert">{error}</p> : null}
      {message ? <p className="success-notice" role="status">{message}</p> : null}

      <section className="quiet-card">
        <p className="kicker">云端课程内容</p>
        <label className="field">课程天数
          <input min={1} onChange={(event) => updateField("dayNumber", Number(event.target.value))} type="number" value={course.dayNumber} />
        </label>
        <label className="field">意大利语标题
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
          <p className="notice">自动解锁：{formatUnlockDateTime(initialCourse.automaticUnlockAt, initialCourse.timezone)}（{initialCourse.timezone}）</p>
        ) : (
          <label className="field">手动解锁时间（{initialCourse.timezone}）
            <input onChange={(event) => updateField("unlockAtLocal", event.target.value || null)} type="datetime-local" value={course.unlockAtLocal ?? ""} />
          </label>
        )}
        <label className="field">今日解锁说明
          <textarea onChange={(event) => updateField("description", event.target.value)} rows={3} value={course.description} />
        </label>
        <label className="field">阅读材料
          <textarea onChange={(event) => updateField("readingText", event.target.value)} rows={7} value={course.readingText} />
        </label>
        <label className="field">阅读后的感想中文引导语
          <textarea onChange={(event) => updateField("reflectionPromptZh", event.target.value)} rows={4} value={course.reflectionPromptZh} />
        </label>
        <label className="field">阅读后的感想意大利语引导语
          <textarea onChange={(event) => updateField("reflectionPromptIt", event.target.value)} rows={4} value={course.reflectionPromptIt} />
        </label>
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
      </section>

      <p className="notice">课程文字与示范音频保存到 Supabase；学生录音仍只保存在当前浏览器和设备中。</p>
      <button className="button full" disabled={saving || uploading} onClick={saveChanges} type="button">
        <Save size={18} /> {saving ? "正在保存..." : "保存课程"}
      </button>
    </div>
  );
}
