import { getStudentRecordingExtension, normalizeStudentRecordingMimeType } from "./student-recording.ts";
import { compressPhotoForUpload, PHOTO_COMPRESSION_TRIGGER_BYTES } from "./photo-compression.ts";

export const SUBMISSION_COMMENT_MEDIA_BUCKET = "submission-comment-media";
export const SUBMISSION_COMMENT_AUDIO_MAX_BYTES = 3 * 1024 * 1024;
export const SUBMISSION_COMMENT_AUDIO_MAX_SECONDS = 45;
export const SUBMISSION_COMMENT_IMAGE_MAX_BYTES = PHOTO_COMPRESSION_TRIGGER_BYTES;
export const SUBMISSION_COMMENT_SIGNED_URL_SECONDS = 5 * 60;

const imageMimeExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export function validateSubmissionCommentAudio(
  file: Pick<File, "name" | "size" | "type">,
  source: "browser_recording" | "manual_upload",
) {
  if (file.size <= 0) return "录音内容为空，请重新录制。";
  if (file.size > SUBMISSION_COMMENT_AUDIO_MAX_BYTES) return "录音文件不能超过 3 MB。";
  const extension = getStudentRecordingExtension(file.name, file.type);
  const mimeType = normalizeStudentRecordingMimeType(file.type);
  if (source === "manual_upload") {
    const supported = (extension === "m4a" && (!mimeType || mimeType === "audio/mp4" || mimeType === "audio/x-m4a"))
      || (extension === "mp3" && (!mimeType || mimeType === "audio/mpeg" || mimeType === "audio/mp3"));
    if (!supported) return "上传录音仅支持 M4A 或 MP3 格式。";
  } else if (!extension || !["m4a", "mp3", "webm", "ogg"].includes(extension)) {
    return "当前浏览器生成的录音格式不受支持，请改为上传 M4A 或 MP3。";
  }
  return null;
}

export function getSubmissionCommentImageMimeType(file: Pick<File, "name" | "type">) {
  const normalized = file.type.toLowerCase();
  if (normalized in imageMimeExtensions) return normalized as keyof typeof imageMimeExtensions;
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg" as const;
  if (extension === "png") return "image/png" as const;
  if (extension === "webp") return "image/webp" as const;
  return null;
}

export function validateSubmissionCommentImage(file: Pick<File, "name" | "size" | "type">) {
  if (file.size <= 0) return "照片内容为空，请重新选择。";
  if (file.size > SUBMISSION_COMMENT_IMAGE_MAX_BYTES) return "照片压缩后仍超过 5 MB，请选择尺寸较小的照片。";
  if (!getSubmissionCommentImageMimeType(file)) return "照片仅支持 JPG、PNG 或 WebP 格式。";
  return null;
}

export async function hasSubmissionCommentImageSignature(file: Blob, mimeType: string) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export function getSubmissionCommentImageExtension(mimeType: keyof typeof imageMimeExtensions) {
  return imageMimeExtensions[mimeType];
}

export function buildSubmissionCommentMediaPath(input: {
  campId: string;
  userId: string;
  commentId: string;
  kind: "audio" | "image";
  extension: string;
}) {
  return `${input.campId}/${input.userId}/${input.commentId}/${input.kind}.${input.extension}`;
}

export async function compressSubmissionCommentImage(file: File) {
  const mimeType = getSubmissionCommentImageMimeType(file);
  if (!mimeType) throw new Error("照片仅支持 JPG、PNG 或 WebP 格式。");
  return compressPhotoForUpload(file);
}
