export const STUDENT_RECORDING_BUCKET = "student-recordings";
export const STUDENT_RECORDING_MAX_BYTES = 30 * 1024 * 1024;
export const MANUAL_STUDENT_RECORDING_MAX_BYTES = 3 * 1024 * 1024;
export const STUDENT_RECORDING_SIGNED_URL_SECONDS = 300;

const mimeExtensions: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
};

type AudioFileLike = { name: string; type: string; size: number };

export function normalizeStudentRecordingMimeType(mimeType: string) {
  return mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function getStudentRecordingExtension(fileName: string, mimeType: string) {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  const normalizedMimeType = normalizeStudentRecordingMimeType(mimeType);
  const expectedExtension = mimeExtensions[normalizedMimeType];
  if (expectedExtension && (!extension || extension === expectedExtension)) return expectedExtension;
  if (!normalizedMimeType && (extension === "mp3" || extension === "m4a")) return extension;
  return expectedExtension ?? "";
}

export function validateStudentRecordingFile(file: AudioFileLike) {
  if (file.size <= 0) return "录音内容为空，请重新录制";
  if (file.size > STUDENT_RECORDING_MAX_BYTES) return "录音文件不能超过 30 MB";
  if (!getStudentRecordingExtension(file.name, file.type)) {
    return "当前录音格式不受支持，请更换浏览器后重试";
  }
  return null;
}

export function validateManualStudentRecordingFile(file: AudioFileLike) {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const mimeType = normalizeStudentRecordingMimeType(file.type);
  if (extension === "wav" || mimeType === "audio/wav" || mimeType === "audio/x-wav") {
    return "暂不支持 WAV 格式。WAV 文件通常较大，请转换为 M4A 或 MP3 后重新上传。";
  }
  const isMp3 = extension === "mp3" && (mimeType === "audio/mpeg" || mimeType === "audio/mp3" || !mimeType);
  const isM4a = extension === "m4a" && (mimeType === "audio/mp4" || mimeType === "audio/x-m4a" || !mimeType);
  if (!isMp3 && !isM4a) {
    return "手动上传仅支持 M4A 或 MP3 格式。";
  }
  if (file.size <= 0) return "音频内容为空，请重新选择文件。";
  if (file.size > MANUAL_STUDENT_RECORDING_MAX_BYTES) {
    return "音频文件过大，单个文件请勿超过 3 MB。建议使用 M4A 或 MP3 格式，或压缩音频后重新上传。";
  }
  return null;
}

export function buildStudentRecordingPath(
  campId: string,
  userId: string,
  submissionId: string,
  extension: string,
) {
  return `${campId}/${userId}/${submissionId}/recording.${extension}`;
}
