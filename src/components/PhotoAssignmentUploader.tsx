"use client";

import { Camera, Images, Trash2 } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { formatFileSize } from "@/lib/audio-file";
import { compressPhotoForUpload, PHOTO_COMPRESSION_TRIGGER_BYTES } from "@/lib/photo-compression";
import { getStudentPhotoMimeType, STUDENT_PHOTO_MAX_COUNT, validateStudentPhotoFile } from "@/lib/student-photo";

export type PreparedPhoto = { id: string; file: File };
type SelectedPhoto = PreparedPhoto & { previewUrl: string };

export function PhotoAssignmentUploader({ onPreparedChange }: {
  onPreparedChange: (photos: PreparedPhoto[]) => void;
}) {
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const photoUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    photoUrlsRef.current = photos.map((photo) => photo.previewUrl);
    onPreparedChange(photos.map(({ id, file }) => ({ id, file })));
  }, [onPreparedChange, photos]);

  useEffect(() => () => photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function addFiles(files: File[]) {
    setError("");
    if (photos.length + files.length > STUDENT_PHOTO_MAX_COUNT) {
      setError("每次最多选择 3 张照片，请先移除多余照片。");
      return;
    }
    setProcessing(true);
    try {
      const preparedFiles: File[] = [];
      for (const file of files) {
        if (file.size <= 0 || !getStudentPhotoMimeType(file)) {
          setError(validateStudentPhotoFile(file) || `${file.name || "所选文件"}不是支持的照片。`);
          return;
        }
        const prepared = file.size > PHOTO_COMPRESSION_TRIGGER_BYTES
          ? await compressPhotoForUpload(file)
          : file;
        const validationError = validateStudentPhotoFile(prepared);
        if (validationError) {
          setError(validationError);
          return;
        }
        preparedFiles.push(prepared);
      }
      setPhotos((current) => [
        ...current,
        ...preparedFiles.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) })),
      ]);
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : "照片压缩失败，请重新选择，或选择尺寸较小的照片。");
    } finally {
      setProcessing(false);
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) void addFiles(files);
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  }

  return (
    <section className="quiet-card assignment-panel handwriting-assignment stack" aria-labelledby="handwriting-assignment-title">
      <div>
        <h2 id="handwriting-assignment-title">手写输出</h2>
        <p className="assignment-guidance">拿出纸和笔，写下今天学到的意大利语，再拍照上传吧！</p>
      </div>
      <div className="grid-two photo-picker-actions">
        <label className="button secondary upload-picker">
          <Camera size={18} />手机拍照
          <input accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" capture="environment" disabled={processing || photos.length >= 3} onChange={handleFiles} type="file" />
        </label>
        <label className="button secondary upload-picker">
          <Images size={18} />从相册选择
          <input accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" disabled={processing || photos.length >= 3} multiple onChange={handleFiles} type="file" />
        </label>
      </div>
      {processing ? <p className="notice" role="status">正在压缩照片，请稍候…</p> : null}
      {photos.length ? (
        <>
          <div className="photo-preview-grid">
            {photos.map((photo, index) => (
              <figure key={photo.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={`待提交照片 ${index + 1}`} src={photo.previewUrl} />
                <figcaption>
                  <span>{photo.file.name} · {formatFileSize(photo.file.size)}</span>
                  <button aria-label={`移除 ${photo.file.name}`} onClick={() => removePhoto(photo.id)} type="button"><Trash2 size={16} /></button>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="success-notice" role="status">✓ 已选择 {photos.length} 张照片</p>
        </>
      ) : <p className="notice" style={{ margin: 0 }}>尚未选择照片。</p>}
      {error ? <p className="notice" role="alert">{error}</p> : null}
    </section>
  );
}
