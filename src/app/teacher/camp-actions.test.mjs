import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("camp lifecycle actions delete camps only after all members are removed", async () => {
  const source = await readFile(new URL("./camp-actions.ts", import.meta.url), "utf8");
  assert.match(source, /export async function updateCampStatus/);
  assert.match(source, /status: "active" \| "archived"/);
  assert.match(source, /export async function permanentlyDeleteCamp/);
  assert.match(source, /getCampMemberCount/);
  assert.match(source, /请先移除所有成员后再永久删除训练营/);
  assert.match(source, /\.from\("camps"\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\("id", campId\)/);
  assert.match(source, /COURSE_AUDIO_BUCKET/);
  assert.match(source, /COURSE_VIDEO_BUCKET/);
  assert.match(source, /COURSE_PDF_BUCKET/);
  assert.match(source, /STUDENT_RECORDING_BUCKET/);
  assert.match(source, /STUDENT_PHOTO_BUCKET/);
  assert.match(source, /student_photo_submissions/);
  assert.match(source, /student_submission_photos/);

  const dataSource = await readFile(new URL("../../lib/teacher-operations-data.ts", import.meta.url), "utf8");
  assert.match(dataSource, /getCampMemberCount[\s\S]*?\.eq\("camp_id", campId\)[\s\S]*?\.eq\("status", "active"\)/);
});

test("camp lifecycle UI uses member count only and keeps a confirmation dialog", async () => {
  const source = await readFile(new URL("../../components/CampLifecycleManager.tsx", import.meta.url), "utf8");
  assert.match(source, /window\.confirm/);
  assert.match(source, /disabled=\{isBusy \|\| camp\.counts\.members > 0\}/);
  assert.match(source, /成员数为 0 时可永久删除/);
  assert.match(source, /请先移除所有成员后再永久删除训练营/);
  assert.doesNotMatch(source, /totalUsage/);
});
