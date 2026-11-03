import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("course page keeps the server AppFrame outside the client course detail", async () => {
  const page = await readFile(new URL("../app/courses/[id]/page.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");

  assert.match(page, /<AppFrame active="courses">[\s\S]*<StudentCourseDetail/);
  assert.doesNotMatch(detail, /from "@\/components\/AppFrame"/);
});

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

  assert.match(detail, /course\.videos\.map\(\(video\) => <CloudCourseVideoPlayer key=\{video\.id\} video=\{video\} \/>\)/);
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

test("PDF reader opens the shared in-page reader and keeps download explicit", async () => {
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(detail, /<PdfPreviewDialog/);
  assert.match(detail, />站内阅读</);
  assert.match(detail, /href=\{pdf\.downloadUrl\}/);
  assert.doesNotMatch(detail, /target="_blank"/);
  assert.match(styles, /\.pdf-preview-scroll\s*\{[\s\S]*?overflow:\s*auto/);
});

test("photo homework accepts camera and gallery input while unified submission reports progress", async () => {
  const uploader = await readFile(new URL("../components/PhotoAssignmentUploader.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");
  assert.match(uploader, /capture="environment"/);
  assert.match(uploader, /multiple onChange=\{handleFiles\}/);
  assert.match(uploader, /STUDENT_PHOTO_MAX_COUNT/);
  assert.match(uploader, /removePhoto\(photo\.id\)/);
  assert.match(detail, /正在上传第 \$\{index \+ 1\} 张照片/);
  assert.match(detail, /录音和照片仍保留在本页/);
});

test("course assignments use warm beginner guidance without changing assignment capabilities", async () => {
  const recorder = await readFile(new URL("../components/BrowserRecorder.tsx", import.meta.url), "utf8");
  const uploader = await readFile(new URL("../components/PhotoAssignmentUploader.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");

  assert.match(detail, /Tocca a te!/);
  assert.match(detail, /现在轮到你啦！🌱/);
  assert.match(detail, /听完老师的示范，试着自己读一读、写一写吧。/);
  assert.match(detail, /不用担心不够完美，我们一步一步来。/);
  assert.match(detail, /hasAssignment \? \(/);

  assert.match(recorder, />口语输出</);
  assert.match(recorder, /跟着老师的示范，大声读出来吧！可以反复练习，选择满意的一次提交。/);
  assert.doesNotMatch(recorder, /主要方式 · 网页直接录音/);
  assert.doesNotMatch(recorder, /录一次，也可以再来一次/);
  assert.match(recorder, /state !== "idle" \|\| hasSubmitted/);
  assert.match(recorder, /无法直接录音？上传已有音频/);

  assert.match(uploader, />手写输出</);
  assert.match(uploader, /拿出纸和笔，写下今天学到的意大利语，再拍照上传吧！/);
  assert.doesNotMatch(uploader, /照片作业/);
  assert.doesNotMatch(uploader, /准备手写作业照片/);
  assert.match(uploader, /capture="environment"/);
  assert.match(uploader, /multiple onChange=\{handleFiles\}/);
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
  assert.match(route, /body\.action === "prepare"/);
  assert.match(route, /createSignedUploadUrl\(path\)/);
  assert.match(route, /body\.action === "cleanup"/);
  assert.match(route, /complete_student_assignment/);
  assert.match(route, /cleanupUploadPlan/);
  assert.match(route, /verifyUploadedPlan/);
  assert.match(route, /dispatchStudentRecordingTranscode\(completed\.audio_submission_id\)/);
});

test("video and unified student assignments use official signed uploads while PDF keeps its prior upload", async () => {
  const uploader = await readFile(new URL("./direct-storage-upload.ts", import.meta.url), "utf8");
  const editor = await readFile(new URL("../components/TeacherCourseEditor.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../components/StudentCourseDetail.tsx", import.meta.url), "utf8");
  const assignmentRoute = await readFile(
    new URL("../app/api/student/courses/[id]/assignment-submissions/route.ts", import.meta.url),
    "utf8",
  );
  const pdfRoute = await readFile(
    new URL("../app/api/teacher/courses/[id]/pdfs/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(uploader, /uploadToSignedUrl\(ticket\.path, ticket\.token, uploadBody/);
  assert.doesNotMatch(uploader, /tus-js-client|x-signature|fingerprint/);
  assert.match(editor, /uploadFileDirectly/);
  assert.match(editor, /uploadingVideo \? "正在上传"/);
  assert.match(detail, /uploadFileDirectly\(\{ file: audioFile/);
  assert.match(detail, /file: preparedPhotos\[index\]\.file/);
  assert.doesNotMatch(detail, /new FormData\(\)/);
  assert.match(assignmentRoute, /createSignedUploadUrl\(path\)/);
  assert.doesNotMatch(assignmentRoute, /request\.formData\(\)/);
  assert.match(pdfRoute, /request\.formData\(\)/);
  assert.match(pdfRoute, /\.upload\(storagePath, file/);
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
  assert.match(recorder, />口语输出</);
  assert.match(recorder, /无法直接录音？上传已有音频/);
  assert.match(recorder, /仅支持 M4A \/ MP3，最大 3 MB/);
  assert.match(route, /source === "manual_upload"[\s\S]*validateManualStudentRecordingFile/);
  assert.match(route, /duration > maxDurationSeconds/);
  assert.doesNotMatch(route, /duration > .*target/i);
});
