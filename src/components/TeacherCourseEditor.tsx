"use client";

import { FileAudio, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { CourseActionResult } from "@/app/teacher/course-actions";
import { formatFileSize, isSupportedAudioFile } from "@/lib/audio-file";
import {
  getCourseRouteId,
  validateCourseEditorInput,
  type CourseEditorInput,
} from "@/lib/cloud-course";
import type { CloudCourseDetail } from "@/lib/cloud-course-data";
import {
  createCourseAudioAsset,
  loadLocalCourseAudio,
  saveLocalCourseAudio,
  type CourseAudioAsset,
} from "@/lib/course-local-store";

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
    unlockAt: course.unlockAt,
    status: course.status,
    vocabulary: course.vocabulary.map((item) => ({ ...item })),
  };
}

function datetimeLocalValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export function TeacherCourseEditor({ course: initialCourse, saveAction }: {
  course: CloudCourseDetail;
  saveAction: SaveAction;
}) {
  const [course, setCourse] = useState(() => toEditorInput(initialCourse));
  const [audio, setAudio] = useState<CourseAudioAsset | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const localCourseId = getCourseRouteId(course.dayNumber);
  const previewUrl = useMemo(() => audio ? URL.createObjectURL(audio.blob) : "", [audio]);

  useEffect(() => {
    let cancelled = false;
    loadLocalCourseAudio(getCourseRouteId(initialCourse.dayNumber))
      .then((savedAudio) => { if (!cancelled) setAudio(savedAudio); })
      .catch(() => { if (!cancelled) setError("本地示范音频读取失败。"); })
      .finally(() => { if (!cancelled) setLoadingAudio(false); });
    return () => { cancelled = true; };
  }, [initialCourse.dayNumber]);

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
    if (!isSupportedAudioFile(file.name)) {
      setError("请选择 MP3、M4A 或 WAV 音频文件");
      return;
    }
    setAudio(createCourseAudioAsset(file));
    setError("");
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

    try {
      await saveLocalCourseAudio(localCourseId, audio);
      setMessage(result.message);
      if (!initialCourse.id && result.courseId) {
        window.location.assign(`/teacher/courses/${result.courseId}/edit`);
        return;
      }
    } catch {
      setMessage(result.message);
      setError("课程文字已保存，但本地示范音频保存失败。");
    } finally {
      setSaving(false);
    }
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
        <label className="field">解锁时间
          <input onChange={(event) => updateField("unlockAt", event.target.value ? new Date(event.target.value).toISOString() : null)} type="datetime-local" value={datetimeLocalValue(course.unlockAt)} />
        </label>
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
        <div className="row start"><div><p className="kicker">本地示范素材</p><h2>示范音频</h2></div><FileAudio color="var(--sky)" /></div>
        <label className="button secondary full upload-picker">
          {audio ? <RotateCcw size={18} /> : <Upload size={18} />}{audio ? "重新选择音频" : "选择音频文件"}
          <input accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav" onChange={handleFileChange} type="file" />
        </label>
        {audio && previewUrl ? (
          <div className="audio-box">
            <div className="row start"><div><strong className="file-name">{audio.name}</strong><p>{formatFileSize(audio.size)}</p></div>
              <button aria-label="删除选中的音频" className="button ghost" onClick={() => setAudio(null)} type="button"><Trash2 size={18} /></button>
            </div>
            <audio controls preload="metadata" src={previewUrl} style={{ width: "100%" }} />
          </div>
        ) : <div className="item-card"><p style={{ margin: 0 }}>{loadingAudio ? "正在读取音频..." : "暂无示范音频。"}</p></div>}
      </section>

      <p className="notice">课程文字保存到 Supabase；音频仍只保存在当前浏览器和设备中。</p>
      <button className="button full" disabled={saving || loadingAudio} onClick={saveChanges} type="button">
        <Save size={18} /> {saving ? "正在保存..." : "保存课程"}
      </button>
    </div>
  );
}
