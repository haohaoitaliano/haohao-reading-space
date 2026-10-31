import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("course uses one final submission and waits for the student before opening the circle", async () => {
  const recorder = await readFile(new URL("../components/BrowserRecorder.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(recorder, /router\.push/);
  assert.doesNotMatch(recorder, /提交录音/);
  assert.match(detail, /"提交作业"/);
  assert.match(detail, /Ottimo lavoro! 🎉/);
  assert.match(detail, /href="\/circle">去作业圈看看/);
  assert.doesNotMatch(detail, /router\.push\("\/circle"\)/);
});

test("course page hides optional modules that have no teacher content", async () => {
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");

  assert.match(detail, /course\.video \? <CloudCourseVideoPlayer video=\{course\.video\} \/> : null/);
  assert.match(detail, /course\.vocabulary\.length > 0/);
  assert.match(detail, /course\.readingText\.trim\(\) \? \(/);
  assert.match(detail, /const hasReflection = Boolean\(/);
  assert.match(detail, /\{hasReflection \? \(/);
  assert.doesNotMatch(detail, /今天暂无视频/);
  assert.match(detail, /course\.pdfs\.length/);
  assert.match(detail, /course\.recordingAssignmentEnabled \? \(/);
  assert.match(detail, /course\.photoAssignmentEnabled \? \(/);
  assert.match(detail, /本课无需提交作业/);
});

test("recording submissions are explicitly public inside the active camp without a privacy picker", async () => {
  const recorder = await readFile(new URL("../components/BrowserRecorder.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");
  const accessMigration = await readFile(
    new URL("../../supabase/migrations/202608270001_active_member_public_submissions.sql", import.meta.url),
    "utf8",
  );
  assert.match(detail, /作业会向同一训练营的活跃成员公开/);
  assert.doesNotMatch(recorder, /公开设置/);
  assert.doesNotMatch(recorder, /setVisibility/);
  assert.match(accessMigration, /visibility = 'public'[\s\S]*private\.is_active_camp_member\(camp_id\)[\s\S]*private\.is_active_camp_user\(camp_id, user_id\)/);
});

test("completed browser recordings show a dynamic success notice and keep the native player", async () => {
  const recorder = await readFile(new URL("../components/BrowserRecorder.tsx", import.meta.url), "utf8");
  assert.match(recorder, /const showRecordingSuccess = hasRecording && recordingSource === "browser_recording"/);
  assert.match(recorder, /<audio ref=\{audioRef\} controls preload="metadata"/);
  assert.match(recorder, /✓ 录音成功 · \{Math\.round\(duration\)\} 秒/);
  assert.match(recorder, /clearRecording\(\);[\s\S]*setState\("idle"\)/);
  assert.match(recorder, /const startRecording = \(\) => \{[\s\S]*clearRecording\(\)/);
});

test("PDF reader keeps online mobile reading and explicit open and download options", async () => {
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(detail, /<iframe src=\{pdf\.signedUrl\}/);
  assert.match(detail, />全屏阅读</);
  assert.match(detail, /href=\{pdf\.downloadUrl\}/);
  assert.match(styles, /\.pdf-reader iframe\s*\{[\s\S]*?width:\s*100%/);
});

test("photo homework accepts camera and gallery input while unified submission reports progress", async () => {
  const uploader = await readFile(new URL("../components/PhotoAssignmentUploader.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");
  assert.match(uploader, /capture="environment"/);
  assert.match(uploader, /multiple onChange=\{handleFiles\}/);
  assert.match(uploader, /STUDENT_PHOTO_MAX_COUNT/);
  assert.match(uploader, /removePhoto\(photo\.id\)/);
  assert.match(detail, /request\.upload\.addEventListener\("progress"/);
  assert.match(detail, /材料仍保留在本页，请直接重试/);
});

test("photo submission route checks active camp and cleans partial uploads", async () => {
  const route = await readFile(
    new URL("../app/api/student/courses/[id]/photo-submissions/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /getCurrentLearningSpace\(auth\.profile\.id\)/);
  assert.match(route, /course\.camp_id !== campResult\.camp\.id/);
  assert.match(route, /photo_assignment_enabled/);
  assert.match(route, /hasStudentPhotoSignature/);
  assert.match(route, /\.remove\(uploadedPaths\)/);
  assert.match(route, /student_photo_submissions/);
  assert.match(route, /student_submission_photos/);
});

test("unified assignment route is idempotent and cleans partial uploads before retry", async () => {
  const route = await readFile(
    new URL("../app/api/student/courses/[id]/assignment-submissions/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /student_assignment_submissions/);
  assert.match(route, /if \(existing\)/);
  assert.match(route, /retryRecovered: true/);
  assert.match(route, /complete_student_assignment/);
  assert.match(route, /remove\(uploadedAudioPaths\)/);
  assert.match(route, /remove\(uploadedPhotoPaths\)/);
  assert.match(route, /dispatchStudentRecordingTranscode\(completed\.audio_submission_id\)/);
});

test("unified photo relationships accept Supabase one-to-one object results", async () => {
  const dataSource = await readFile(new URL("./photo-submission-data.ts", import.meta.url), "utf8");
  const deleteRoute = await readFile(
    new URL("../app/api/student/assignment-submissions/[id]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(dataSource, /Array\.isArray\(row\.student_photo_submissions\)/);
  assert.match(dataSource, /: row\.student_photo_submissions/);
  assert.match(deleteRoute, /Array\.isArray\(assignment\.student_photo_submissions\)/);
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
