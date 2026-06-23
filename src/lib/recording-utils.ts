const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

export const RECORDING_UNSUPPORTED_MESSAGE =
  "当前浏览器暂不支持录音，请使用最新版 Safari、Chrome 或 Edge。";

export function chooseRecordingMimeType(isSupported: (type: string) => boolean) {
  return RECORDING_MIME_TYPES.find((type) => isSupported(type)) ?? "";
}

export function formatRecordingDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getMicrophoneErrorMessage(error: unknown) {
  const name = typeof error === "object" && error && "name" in error ? String(error.name) : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "无法使用麦克风，请在浏览器设置中允许麦克风权限。";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return "麦克风可能被其他程序占用，或初始化失败。请关闭其他正在使用麦克风的程序后重试。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "没有找到可用的麦克风，请连接麦克风后重试。";
  }
  return "麦克风初始化失败，请检查浏览器权限和设备状态后重试。";
}
