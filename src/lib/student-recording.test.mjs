import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudentRecordingPath,
  STUDENT_RECORDING_MAX_BYTES,
  validateStudentRecordingFile,
} from "./student-recording.ts";

test("accepts browser recording formats", () => {
  for (const file of [
    { name: "recording.webm", type: "audio/webm", size: 1024 },
    { name: "recording.m4a", type: "audio/mp4", size: 1024 },
    { name: "recording.ogg", type: "audio/ogg", size: 1024 },
    { name: "recording.wav", type: "audio/wav", size: 1024 },
  ]) {
    assert.equal(validateStudentRecordingFile(file), null);
  }
  assert.equal(
    validateStudentRecordingFile({ name: "recording.webm", type: "audio/webm;codecs=opus", size: 1024 }),
    null,
  );
});

test("rejects empty, unsupported, and oversized recordings", () => {
  assert.equal(validateStudentRecordingFile({ name: "empty.webm", type: "audio/webm", size: 0 }), "录音内容为空，请重新录制");
  assert.equal(validateStudentRecordingFile({ name: "note.txt", type: "text/plain", size: 10 }), "当前录音格式不受支持，请更换浏览器后重试");
  assert.equal(validateStudentRecordingFile({ name: "large.webm", type: "audio/webm", size: STUDENT_RECORDING_MAX_BYTES + 1 }), "录音文件不能超过 30 MB");
});

test("builds an owner-scoped storage path", () => {
  assert.equal(
    buildStudentRecordingPath("camp-1", "user-1", "submission-1", "webm"),
    "camp-1/user-1/submission-1/recording.webm",
  );
});
