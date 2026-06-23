import assert from "node:assert/strict";
import test from "node:test";
import {
  COURSE_AUDIO_MAX_BYTES,
  getCourseAudioExtension,
  validateCourseAudioFile,
} from "./course-audio.ts";

test("accepts common course audio formats", () => {
  for (const file of [
    { name: "demo.mp3", type: "audio/mpeg", size: 1024 },
    { name: "demo.m4a", type: "audio/mp4", size: 1024 },
    { name: "demo.wav", type: "audio/wav", size: 1024 },
    { name: "demo.webm", type: "audio/webm", size: 1024 },
    { name: "demo.ogg", type: "audio/ogg", size: 1024 },
  ]) {
    assert.equal(validateCourseAudioFile(file), null);
  }
});

test("rejects empty, unsupported, and oversized files", () => {
  assert.equal(validateCourseAudioFile({ name: "demo.mp3", type: "audio/mpeg", size: 0 }), "音频文件不能为空");
  assert.equal(validateCourseAudioFile({ name: "demo.txt", type: "text/plain", size: 10 }), "请选择 MP3、M4A、WAV、WebM 或 OGG 音频文件");
  assert.equal(validateCourseAudioFile({ name: "demo.mp3", type: "audio/mpeg", size: COURSE_AUDIO_MAX_BYTES + 1 }), "音频文件不能超过 20 MB");
});

test("derives a safe storage extension", () => {
  assert.equal(getCourseAudioExtension("voice.M4A", "audio/mp4"), "m4a");
  assert.equal(getCourseAudioExtension("voice", "audio/mpeg"), "mp3");
  assert.equal(getCourseAudioExtension("voice.exe", "audio/wav"), "wav");
});
