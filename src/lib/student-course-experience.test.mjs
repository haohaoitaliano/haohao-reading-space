import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("course submission redirects to the circle only after submission succeeds", async () => {
  const recorder = await readFile(new URL("../components/BrowserRecorder.tsx", import.meta.url), "utf8");

  const successMessageIndex = recorder.indexOf("录音提交成功");
  const redirectIndex = recorder.indexOf('router.push("/circle")');

  assert.ok(successMessageIndex >= 0);
  assert.ok(redirectIndex > successMessageIndex);
  assert.match(recorder, /setTimeout\(\(\) => \{[\s\S]*router\.push\("\/circle"\)[\s\S]*\}, 900\)/);
  assert.doesNotMatch(recorder, /router\.push\(`\/ai-feedback/);
});

test("course page hides optional modules that have no teacher content", async () => {
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");

  assert.match(detail, /course\.video \? <CloudCourseVideoPlayer video=\{course\.video\} \/> : null/);
  assert.match(detail, /course\.vocabulary\.length > 0/);
  assert.match(detail, /const hasReflection = Boolean\(/);
  assert.match(detail, /\{hasReflection \? \(/);
  assert.doesNotMatch(detail, /今天暂无视频/);
});

test("course reading text preserves teacher-entered line breaks without horizontal overflow", async () => {
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(detail, /className="italian-text reading-text">\{course\.readingText\}<\/p>/);
  assert.match(styles, /\.reading-text\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*pre-wrap;[^}]*\}/);
});

test("latest course submission is isolated by user, camp, and course", async () => {
  const dataSource = await readFile(new URL("./cloud-course-data.ts", import.meta.url), "utf8");
  const recorder = await readFile(new URL("../components/BrowserRecorder.tsx", import.meta.url), "utf8");

  assert.match(
    dataSource,
    /\.from\("student_submissions"\)[\s\S]*?\.eq\("user_id", userId\)[\s\S]*?\.eq\("camp_id", campResult\.camp\.id\)[\s\S]*?\.eq\("course_id", summary\.id\)[\s\S]*?\.order\("version", \{ ascending: false \}\)/,
  );
  assert.match(recorder, /`已提交 · 第 \$\{persistedVersion\} 次提交`/);
  assert.match(recorder, /latestSubmission\?\.version/);
});

test("recorder enforces the task maximum while target duration remains feedback", async () => {
  const recorder = await readFile(new URL("../components/BrowserRecorder.tsx", import.meta.url), "utf8");
  const route = await readFile(
    new URL("../app/api/student/courses/[id]/submissions/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(recorder, /elapsed >= maxDurationSeconds/);
  assert.match(recorder, /录音已自动停止/);
  assert.match(recorder, /getRecordingTargetFeedback\(duration, targetDurationSeconds\)/);
  assert.match(recorder, /主要方式 · 网页直接录音/);
  assert.match(recorder, /无法直接录音？上传已有音频/);
  assert.match(recorder, /仅支持 M4A \/ MP3，最大 3 MB/);
  assert.match(route, /source === "manual_upload"[\s\S]*validateManualStudentRecordingFile/);
  assert.match(route, /duration > maxDurationSeconds/);
  assert.doesNotMatch(route, /duration > .*target/i);
});
