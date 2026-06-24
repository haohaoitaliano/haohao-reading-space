export const STUDENT_RECORDING_BUCKET = "student-recordings";
export const STUDENT_RECORDING_MAX_BYTES = 30 * 1024 * 1024;
export const STUDENT_RECORDING_SIGNED_URL_SECONDS = 300;

const mimeExtensions: Record<string, string> = {
  "audio/mpeg": "mp3",
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
  const expectedExtension = mimeExtensions[normalizeStudentRecordingMimeType(mimeType)];
  if (expectedExtension && (!extension || extension === expectedExtension)) return expectedExtension;
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

export function buildStudentRecordingPath(
  campId: string,
  userId: string,
  submissionId: string,
  extension: string,
) {
  return `${campId}/${userId}/${submissionId}/recording.${extension}`;
}
