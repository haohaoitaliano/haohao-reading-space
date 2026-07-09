import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("course creation checks day uniqueness inside the selected camp", async () => {
  const source = await readFile(new URL("./course-actions.ts", import.meta.url), "utf8");
  assert.match(source, /\.eq\("camp_id", camp\.id\)[\s\S]*\.eq\("day_number", input\.dayNumber\)/);
  assert.match(source, /该训练营中已存在 Giorno/);
});

test("existing course updates never write camp_id", async () => {
  const source = await readFile(new URL("./course-actions.ts", import.meta.url), "utf8");
  const updateBlock = source.slice(source.indexOf("export async function updateCloudCourse"), source.indexOf("export async function createCloudCourse"));
  assert.doesNotMatch(updateBlock, /camp_id\s*:/);
});

test("course lifecycle actions archive and permanently delete only courses without submissions", async () => {
  const source = await readFile(new URL("./course-actions.ts", import.meta.url), "utf8");
  assert.match(source, /export async function archiveCloudCourse/);
  assert.match(source, /status: "archived"/);
  assert.match(source, /export async function reactivateCloudCourse/);
  assert.match(source, /status: "published"/);
  assert.match(source, /export async function permanentlyDeleteCloudCourse/);
  assert.match(source, /student_submissions/);
  assert.match(source, /已有学生提交，不能永久删除/);
  assert.match(source, /COURSE_AUDIO_BUCKET/);
  assert.match(source, /\.remove\(\[audio\.storage_path\]\)/);
});
