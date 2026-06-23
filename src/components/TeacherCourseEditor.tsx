"use client";

import { FileAudio, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { formatFileSize, isSupportedAudioFile } from "@/lib/audio-file";
import {
  createCourseAudioAsset,
  loadLocalCourse,
  saveLocalCourse,
  type LocalCourseData,
  type LocalVocabularyItem,
} from "@/lib/course-local-store";

export function TeacherCourseEditor({ defaultCourse }: { defaultCourse: LocalCourseData }) {
  const [course, setCourse] = useState(defaultCourse);
  const previewUrl = useMemo(
    () => (course.audio ? URL.createObjectURL(course.audio.blob) : ""),
    [course.audio],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadLocalCourse(defaultCourse)
      .then((savedCourse) => {
        if (!cancelled && savedCourse) setCourse(savedCourse);
      })
      .catch(() => {
        if (!cancelled) {
          setError("无法读取本地课程数据。当前浏览器可能不支持 IndexedDB，已显示默认模拟内容。");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [defaultCourse]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function updateField<K extends keyof LocalCourseData>(field: K, value: LocalCourseData[K]) {
    setCourse((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function updateVocabulary(index: number, field: keyof LocalVocabularyItem, value: string) {
    const vocabulary = course.vocabulary.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );
    updateField("vocabulary", vocabulary);
  }

  function addVocabulary() {
    updateField("vocabulary", [...course.vocabulary, { word: "", meaningZh: "" }]);
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

    updateField("audio", createCourseAudioAsset(file));
    setError("");
  }

  async function saveChanges() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const record = { ...course, updatedAt: Date.now() };
      await saveLocalCourse(record);
      setCourse(record);
      setMessage("模拟修改已保存，学生端刷新后会显示最新课程内容。");
    } catch {
      setError("保存失败。当前浏览器可能不支持 IndexedDB，或本地存储空间不可用。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      {loading ? <div className="item-card"><p style={{ margin: 0 }}>正在读取本地课程数据...</p></div> : null}
      {error ? <p className="notice" role="alert" style={{ margin: 0 }}>{error}</p> : null}
      {message ? <p className="notice" role="status" style={{ margin: 0 }}>{message}</p> : null}

      <section className="quiet-card">
        <p className="kicker">课程文字内容</p>
        <label className="field">
          意大利语标题
          <input onChange={(event) => updateField("italianTitle", event.target.value)} value={course.italianTitle} />
        </label>
        <label className="field">
          中文标题
          <input onChange={(event) => updateField("chineseTitle", event.target.value)} value={course.chineseTitle} />
        </label>
        <label className="field">
          今日解锁说明
          <textarea onChange={(event) => updateField("description", event.target.value)} rows={3} value={course.description} />
        </label>
        <label className="field">
          阅读材料
          <textarea onChange={(event) => updateField("readingText", event.target.value)} rows={7} value={course.readingText} />
        </label>
        <label className="field">
          阅读后的感想中文引导语
          <textarea onChange={(event) => updateField("reflectionPromptZh", event.target.value)} rows={4} value={course.reflectionPromptZh} />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          阅读后的感想意大利语引导语
          <textarea onChange={(event) => updateField("reflectionPromptIt", event.target.value)} rows={4} value={course.reflectionPromptIt} />
        </label>
      </section>

      <section className="quiet-card stack">
        <div className="row">
          <div>
            <p className="kicker">Vocabolario</p>
            <h2 style={{ marginBottom: 0 }}>重点词汇</h2>
          </div>
          <button className="button secondary" onClick={addVocabulary} type="button">
            <Plus size={18} /> 添加词汇
          </button>
        </div>

        {course.vocabulary.map((item, index) => (
          <div className="item-card" key={`${index}-${course.vocabulary.length}`}>
            <label className="field">
              单词
              <input
                aria-label={`单词 ${index + 1}`}
                onChange={(event) => updateVocabulary(index, "word", event.target.value)}
                value={item.word}
              />
            </label>
            <label className="field">
              中文释义
              <input
                aria-label={`中文释义 ${index + 1}`}
                onChange={(event) => updateVocabulary(index, "meaningZh", event.target.value)}
                value={item.meaningZh}
              />
            </label>
            <button
              aria-label={`删除词汇 ${index + 1}`}
              className="button ghost full"
              onClick={() => removeVocabulary(index)}
              type="button"
            >
              <Trash2 size={18} /> 删除这个词
            </button>
          </div>
        ))}
      </section>

      <section className="quiet-card stack">
        <div className="row start">
          <div>
            <p className="kicker">示范素材</p>
            <h2>上传示范音频</h2>
            <p style={{ margin: 0 }}>支持 MP3、M4A、WAV，与课程文字内容一起保存。</p>
          </div>
          <FileAudio color="var(--sky)" />
        </div>

        <label className="button secondary full upload-picker">
          {course.audio ? <RotateCcw size={18} /> : <Upload size={18} />}
          {course.audio ? "重新选择音频" : "选择音频文件"}
          <input
            accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav"
            onChange={handleFileChange}
            type="file"
          />
        </label>

        {course.audio && previewUrl ? (
          <div className="audio-box">
            <div className="row start">
              <div style={{ minWidth: 0 }}>
                <strong className="file-name">{course.audio.name}</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13 }}>{formatFileSize(course.audio.size)}</p>
              </div>
              <button
                aria-label="删除选中的音频"
                className="button ghost"
                onClick={() => updateField("audio", null)}
                type="button"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <audio controls preload="metadata" src={previewUrl} style={{ width: "100%" }}>
              当前浏览器不支持音频播放。
            </audio>
          </div>
        ) : (
          <div className="item-card"><p style={{ margin: 0 }}>暂无示范音频。</p></div>
        )}
      </section>

      <p className="notice" style={{ margin: 0 }}>
        当前为本地原型，课程内容和音频仅保存在此浏览器和此设备中。
      </p>

      <button className="button full" disabled={saving || loading} onClick={saveChanges} type="button">
        <Save size={18} />
        {saving ? "正在保存..." : "保存模拟修改"}
      </button>
    </div>
  );
}
