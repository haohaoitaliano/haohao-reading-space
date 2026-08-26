export const COURSE_VIDEO_BUCKET = "course-videos";
export const COURSE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const COURSE_VIDEO_SIGNED_URL_SECONDS = 300;

const mimeExtensions: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const allowedExtensions = new Set(Object.values(mimeExtensions));

type VideoFileLike = { name: string; type: string; size: number };

export function getCourseVideoExtension(fileName: string, mimeType: string) {
  const nameExtension = fileName.toLowerCase().split(".").pop() ?? "";
  if (allowedExtensions.has(nameExtension) && (!mimeType || mimeExtensions[mimeType] === nameExtension)) {
    return nameExtension;
  }
  return mimeExtensions[mimeType] ?? "";
}

export function validateCourseVideoFile(file: VideoFileLike) {
  if (file.size <= 0) return "视频文件不能为空";
  if (file.size > COURSE_VIDEO_MAX_BYTES) return "视频文件不能超过 100 MB";
  if (!getCourseVideoExtension(file.name, file.type)) {
    return "请选择 MP4、MOV 或 WebM 视频文件";
  }
  return null;
}

export function buildCourseVideoPath(
  campId: string,
  courseId: string,
  extension: string,
  nonce: string | number = Date.now(),
) {
  return `${campId}/${courseId}/demonstration-video-${nonce}.${extension}`;
}

export function getCourseVideoMimeType(extension: string) {
  const entry = Object.entries(mimeExtensions).find(([, value]) => value === extension);
  return entry?.[0] ?? "application/octet-stream";
}
