import assert from "node:assert/strict";
import test from "node:test";
import {
  COURSE_VIDEO_MAX_BYTES,
  getCourseVideoExtension,
  validateCourseVideoFile,
} from "./course-video.ts";

test("accepts common course video formats", () => {
  for (const file of [
    { name: "demo.mp4", type: "video/mp4", size: 1024 },
    { name: "demo.mov", type: "video/quicktime", size: 1024 },
    { name: "demo.webm", type: "video/webm", size: 1024 },
  ]) {
    assert.equal(validateCourseVideoFile(file), null);
  }
});

test("rejects empty, unsupported, and oversized videos", () => {
  assert.equal(validateCourseVideoFile({ name: "demo.mp4", type: "video/mp4", size: 0 }), "视频文件不能为空");
  assert.equal(validateCourseVideoFile({ name: "demo.mp4", type: "video/mp4", size: Number.NaN }), "视频文件不能为空");
  assert.equal(validateCourseVideoFile({ name: "demo.txt", type: "text/plain", size: 10 }), "请选择 MP4、MOV 或 WebM 视频文件");
  assert.equal(validateCourseVideoFile({ name: "demo.mp4", type: "video/mp4", size: COURSE_VIDEO_MAX_BYTES + 1 }), "视频文件不能超过 100 MB");
});

test("derives a safe video storage extension", () => {
  assert.equal(getCourseVideoExtension("lesson.MOV", "video/quicktime"), "mov");
  assert.equal(getCourseVideoExtension("lesson", "video/mp4"), "mp4");
  assert.equal(getCourseVideoExtension("lesson.exe", "video/webm"), "webm");
});
