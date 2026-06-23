import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseRecordingMimeType,
  formatRecordingDuration,
  getMicrophoneErrorMessage,
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

test("formats a recording duration as minutes and seconds", () => {
  assert.equal(formatRecordingDuration(0), "00:00");
  assert.equal(formatRecordingDuration(65), "01:05");
});
