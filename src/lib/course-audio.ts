export const COURSE_AUDIO_BUCKET = "course-audio";
export const COURSE_AUDIO_MAX_BYTES = 20 * 1024 * 1024;
export const COURSE_AUDIO_SIGNED_URL_SECONDS = 300;

const mimeExtensions: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
};

const allowedExtensions = new Set(Object.values(mimeExtensions));

type AudioFileLike = { name: string; type: string; size: number };

export function getCourseAudioExtension(fileName: string, mimeType: string) {
  const nameExtension = fileName.toLowerCase().split(".").pop() ?? "";
  if (allowedExtensions.has(nameExtension) && (!mimeType || mimeExtensions[mimeType] === nameExtension)) {
    return nameExtension;
  }
  return mimeExtensions[mimeType] ?? "";
}

export function validateCourseAudioFile(file: AudioFileLike) {
  if (file.size <= 0) return "音频文件不能为空";
  if (file.size > COURSE_AUDIO_MAX_BYTES) return "音频文件不能超过 20 MB";
  if (!getCourseAudioExtension(file.name, file.type)) {
    return "请选择 MP3、M4A、WAV、WebM 或 OGG 音频文件";
  }
  return null;
}

export function buildCourseAudioPath(
  campId: string,
  courseId: string,
  extension: string,
  nonce: string | number = Date.now(),
) {
  return `${campId}/${courseId}/demonstration-${nonce}.${extension}`;
}

export function getCourseAudioMimeType(extension: string) {
  const entry = Object.entries(mimeExtensions).find(([, value]) => value === extension);
  return entry?.[0] ?? "application/octet-stream";
}
