import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseRecordingMimeType,
  formatRecordingDuration,
  getMicrophoneErrorMessage,
  getRecordingTargetFeedback,
  MICROPHONE_REQUEST_TIMEOUT_MESSAGE,
  RECORDING_SECURE_CONTEXT_MESSAGE,
  requestMicrophoneWithTimeout,
} from "./recording-utils.ts";

test("chooses the first MIME type supported by the browser", () => {
  const supported = new Set(["audio/mp4", "audio/ogg;codecs=opus"]);

  assert.equal(chooseRecordingMimeType((type) => supported.has(type)), "audio/mp4");
});

test("returns an empty MIME type when the browser needs its default", () => {
  assert.equal(chooseRecordingMimeType(() => false), "");
});

test("maps microphone permission refusal to the required message", () => {
  assert.equal(
    getMicrophoneErrorMessage({ name: "NotAllowedError" }),
    "无法使用麦克风，请在浏览器设置中允许麦克风权限。",
  );
});

test("maps microphone initialization failures to a clear message", () => {
  assert.equal(
    getMicrophoneErrorMessage({ name: "NotReadableError" }),
    "麦克风可能被其他程序占用，或初始化失败。请关闭其他正在使用麦克风的程序后重试。",
  );
});

test("maps microphone request timeout to a clear message", () => {
  assert.equal(
    getMicrophoneErrorMessage({ name: "TimeoutError" }),
    MICROPHONE_REQUEST_TIMEOUT_MESSAGE,
  );
});

test("times out a microphone request that does not return", async () => {
  await assert.rejects(
    requestMicrophoneWithTimeout(() => new Promise(() => {}), 5),
    { name: "TimeoutError" },
  );
});

test("stops a microphone stream that arrives after timeout", async () => {
  let resolveRequest;
  let stopped = false;
  const request = new Promise((resolve) => {
    resolveRequest = resolve;
  });

  await assert.rejects(requestMicrophoneWithTimeout(() => request, 5), { name: "TimeoutError" });
  resolveRequest({ getTracks: () => [{ stop: () => { stopped = true; } }] });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(stopped, true);
});

test("explains that microphone recording requires a secure page", () => {
  assert.match(RECORDING_SECURE_CONTEXT_MESSAGE, /安全连接/);
  assert.match(RECORDING_SECURE_CONTEXT_MESSAGE, /HTTPS/);
});

test("formats a recording duration as minutes and seconds", () => {
  assert.equal(formatRecordingDuration(0), "00:00");
  assert.equal(formatRecordingDuration(65), "01:05");
});

test("target duration is feedback rather than a submission limit", () => {
  assert.deepEqual(getRecordingTargetFeedback(28, 30), {
    reached: true,
    message: "本次用时：28 秒 ✅ 已达到本次目标！再听一遍，检查发音和语调。",
  });
  assert.deepEqual(getRecordingTargetFeedback(36, 30), {
    reached: false,
    message: "本次用时：36 秒。🎯 目标：30 秒以内。可以再试一次，看看能不能在保持发音准确、清晰、自然的同时更流畅。",
  });
  assert.equal(getRecordingTargetFeedback(36, null), null);
});
