import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const progressUrl = new URL("./student-camp-progress.ts", import.meta.url);
const courseDataUrl = new URL("./cloud-course-data.ts", import.meta.url);
const courseDetailUrl = new URL("../components/StudentCourseDetail.tsx", import.meta.url);

test("home and progress query submission summaries without signing historical photos", async () => {
  const source = await readFile(progressUrl, "utf8");
  assert.match(source, /select\("id, course_id, version"\)/);
  assert.match(source, /select\("course_id, version"\)/);
  assert.match(source, /select\("id, course_id, version, has_recording, photo_count"\)/);
  assert.doesNotMatch(source, /getOwnCloudSubmissions|getOwnPhotoSubmissions|getOwnUnifiedAssignments/);
});

test("student course detail batches and parallelizes media signing", async () => {
  const source = await readFile(courseDataUrl, "utf8");
  assert.match(source, /createSignedStudentCourseVideos/);
  assert.match(source, /createSignedStudentCoursePdfs/);
  assert.match(source, /const \[audio, videos, pdfs\] = await Promise\.all/);
  assert.match(source, /\.createSignedUrls\(videos\.map/);
  assert.match(source, /\.createSignedUrls\(pdfs\.map/);
});

test("student course audio and video wait for playback before loading media", async () => {
  const source = await readFile(courseDetailUrl, "utf8");
  assert.equal(source.match(/preload="none"/g)?.length, 2);
});
