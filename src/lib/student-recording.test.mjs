import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudentRecordingPath,
  MANUAL_STUDENT_RECORDING_MAX_BYTES,
  STUDENT_RECORDING_MAX_BYTES,
  validateManualStudentRecordingFile,
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

test("manual uploads accept only M4A and MP3 files up to 3 MB", () => {
  assert.equal(validateManualStudentRecordingFile({ name: "practice.m4a", type: "audio/mp4", size: 1024 }), null);
  assert.equal(validateManualStudentRecordingFile({ name: "practice.mp3", type: "audio/mpeg", size: 1024 }), null);
  assert.equal(
    validateManualStudentRecordingFile({ name: "practice.wav", type: "audio/wav", size: 1024 }),
    "暂不支持 WAV 格式。WAV 文件通常较大，请转换为 M4A 或 MP3 后重新上传。",
  );
  assert.equal(
    validateManualStudentRecordingFile({
      name: "large.mp3",
      type: "audio/mpeg",
      size: MANUAL_STUDENT_RECORDING_MAX_BYTES + 1,
    }),
    "音频文件过大，单个文件请勿超过 3 MB。建议使用 M4A 或 MP3 格式，或压缩音频后重新上传。",
  );
  assert.equal(
    validateManualStudentRecordingFile({ name: "practice.webm", type: "audio/webm", size: 1024 }),
    "手动上传仅支持 M4A 或 MP3 格式。",
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
