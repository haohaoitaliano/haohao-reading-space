import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../api/teacher/courses/[id]/video/route.ts", import.meta.url);

test("course video upload route signs direct uploads before persisting verified metadata", async () => {
  const source = await readFile(routeUrl, "utf8");

  assert.match(source, /\.from\("course_videos"\)\.upsert/);
  assert.match(source, /createSignedUploadUrl\(storagePath\)/);
  assert.match(source, /verifyStorageObject\(context\.supabase, COURSE_VIDEO_BUCKET/);
  assert.doesNotMatch(source, /\.upload\(storagePath, file/);
  assert.match(source, /revalidateCourseVideoViews\(context\.course\.id, context\.course\.day_number\)/);
  assert.match(source, /无法读取当前视频信息，请确认视频数据库迁移已执行。/);
  assert.match(source, /视频已传到 Storage，但课程视频信息保存失败/);
  assert.doesNotMatch(source, /COURSE_AUDIO_BUCKET/);
});
