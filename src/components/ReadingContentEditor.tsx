"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import type { CloudCourseReadingImage } from "@/lib/cloud-course-data";
import { createReadingTextBlock, validateCourseReadingImage, type ReadingContentBlock } from "@/lib/course-reading";

export function ReadingContentEditor({ courseId, blocks, images, onBlocksChange, onImagesChange, onBusyChange }: {
  courseId: string;
  blocks: ReadingContentBlock[];
  images: CloudCourseReadingImage[];
  onBlocksChange: (blocks: ReadingContentBlock[]) => void;
  onImagesChange: (images: CloudCourseReadingImage[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [insertion, setInsertion] = useState({ index: 0, offset: 0 });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const imageMap = new Map(images.map((image) => [image.id, image]));

  function updateText(id: string, text: string) {
    onBlocksChange(blocks.map((block) => block.id === id && block.type === "text" ? { ...block, text } : block));
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !courseId) return;
    const validationError = validateCourseReadingImage(file);
    if (validationError) { setError(validationError); return; }
    setUploading(true);
    onBusyChange(true);
    setError("");
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); };
        image.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
        image.src = url;
      });
      const body = new FormData();
      body.set("image", file);
      body.set("width", String(dimensions.width));
      body.set("height", String(dimensions.height));
      const response = await fetch(`/api/teacher/courses/${courseId}/reading-images`, { method: "POST", body });
      const result = await response.json() as { success?: boolean; message?: string; image?: CloudCourseReadingImage };
      if (!response.ok || !result.success || !result.image) throw new Error(result.message || "图片上传失败。");
      const next = [...blocks];
      const target = next[insertion.index];
      if (target?.type === "text") {
        const before = { ...target, text: target.text.slice(0, insertion.offset) };
        const after = createReadingTextBlock(target.text.slice(insertion.offset));
        next.splice(insertion.index, 1, before, { id: crypto.randomUUID(), type: "image", imageId: result.image.id }, after);
      } else {
        next.splice(insertion.index + 1, 0, { id: crypto.randomUUID(), type: "image", imageId: result.image.id }, createReadingTextBlock());
      }
      onImagesChange([...images, result.image]);
      onBlocksChange(next);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "图片上传失败，请重试。");
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }

  async function removeImage(blockId: string, imageId: string) {
    if (!window.confirm("确定删除这张阅读配图吗？")) return;
    setError("");
    const response = await fetch(`/api/teacher/courses/${courseId}/reading-images/${imageId}`, { method: "DELETE" });
    const result = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || !result.success) { setError(result.message || "图片删除失败。"); return; }
    const next = blocks.filter((block) => block.id !== blockId);
    onBlocksChange(next.length ? next : [createReadingTextBlock()]);
    onImagesChange(images.filter((image) => image.id !== imageId));
  }

  return (
    <div className="field reading-editor-field">
      <span>阅读材料（选填）</span>
      <div className="reading-editor-toolbar">
        <button className="button secondary" disabled={!courseId || uploading} onClick={() => inputRef.current?.click()} type="button">
          {uploading ? <LoaderCircle className="spinning" size={18} /> : <ImagePlus size={18} />}{uploading ? "上传中…" : "在光标后插入图片"}
        </button>
        <input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onChange={handleImage} ref={inputRef} type="file" />
      </div>
      {!courseId ? <small>请先保存新课程，再在编辑页插入图片。</small> : <small>先把光标放到文字中的目标位置，再点击插入图片。</small>}
      <div className="reading-editor-canvas">
        {blocks.map((block, index) => block.type === "text" ? (
          <textarea
            aria-label={`阅读文字第 ${index + 1} 段`}
            key={block.id}
            onChange={(event) => updateText(block.id, event.target.value)}
            onFocus={(event) => setInsertion({ index, offset: event.currentTarget.selectionStart })}
            onSelect={(event) => setInsertion({ index, offset: event.currentTarget.selectionStart })}
            placeholder="输入阅读文字或链接…"
            rows={Math.max(3, block.text.split("\n").length + 1)}
            value={block.text}
          />
        ) : (
          <figure className="reading-editor-image" key={block.id}>
            {imageMap.get(block.imageId)?.signedUrl ? <img alt={imageMap.get(block.imageId)?.fileName ?? "阅读配图"} src={imageMap.get(block.imageId)!.signedUrl} /> : <p className="notice">图片预览暂时不可用。</p>} {/* eslint-disable-line @next/next/no-img-element */}
            <button className="button ghost" onClick={() => void removeImage(block.id, block.imageId)} type="button"><Trash2 size={17} />删除图片</button>
          </figure>
        ))}
      </div>
      {error ? <p className="notice" role="alert">{error}</p> : null}
    </div>
  );
}
