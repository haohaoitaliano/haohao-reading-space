import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin media library combines course audio and video assets", async () => {
  const source = await readFile(new URL("./cloud-course-data.ts", import.meta.url), "utf8");

  assert.match(source, /export async function getAdminCourseMediaLibrary/);
  assert.match(source, /\.from\("course_audio"\)/);
  assert.match(source, /\.from\("course_videos"\)/);
  assert.match(source, /createSignedCourseAudio/);
  assert.match(source, /createSignedCourseVideo/);
  assert.match(source, /kind: "audio"/);
  assert.match(source, /kind: "video"/);
  assert.match(source, /sort\(\(left, right\) => new Date\(right\.updatedAt\)/);
});
