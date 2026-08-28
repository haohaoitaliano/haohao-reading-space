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

export const RECORDING_SECURE_CONTEXT_MESSAGE =
  "当前页面不是安全连接，浏览器无法使用麦克风。请通过 HTTPS 页面录音。";

export const MICROPHONE_REQUEST_TIMEOUT_MS = 10_000;

export const MICROPHONE_REQUEST_TIMEOUT_MESSAGE =
  "请求麦克风权限超时。请检查系统权限弹窗或浏览器的麦克风设置，然后重新请求。";

function createMicrophoneTimeoutError() {
  const error = new Error("microphone_request_timeout");
  error.name = "TimeoutError";
  return error;
}

export function requestMicrophoneWithTimeout(
  request: () => Promise<MediaStream>,
  timeoutMs = MICROPHONE_REQUEST_TIMEOUT_MS,
) {
  let timedOut = false;

  return new Promise<MediaStream>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      timedOut = true;
      reject(createMicrophoneTimeoutError());
    }, timeoutMs);

    request().then(
      (stream) => {
        if (timedOut) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        clearTimeout(timeoutId);
        resolve(stream);
      },
      (error) => {
        if (timedOut) return;
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

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

  if (name === "TimeoutError") {
    return MICROPHONE_REQUEST_TIMEOUT_MESSAGE;
  }
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
