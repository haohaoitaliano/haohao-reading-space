import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("./202611010004_direct_media_upload_limits.sql", import.meta.url),
  "utf8",
);

test("direct-upload buckets remain private with the intended file limits", () => {
  assert.match(migration, /'course-videos'[\s\S]*false,[\s\S]*104857600/);
  assert.match(migration, /'course-pdfs'[\s\S]*false,[\s\S]*20971520/);
  assert.match(migration, /'student-homework-photos'[\s\S]*false,[\s\S]*5242880/);
  assert.match(migration, /public = false/);
  assert.doesNotMatch(migration, /public\s*=\s*true/);
});

test("students may read only their own active-camp course photo paths", () => {
  assert.match(migration, /bucket_id = 'student-homework-photos'/);
  assert.match(migration, /\)\[2\] = \(select auth\.uid\(\)\)::text/);
  assert.match(migration, /private\.is_active_camp_member/);
  assert.match(migration, /private\.can_read_course_content/);
  assert.match(migration, /course_row\.camp_id = \(\(storage\.foldername/);
  assert.match(migration, /content_row\.photo_assignment_enabled/);
  assert.doesNotMatch(migration, /to anon/);
});

test("the migration changes no media or assignment rows", () => {
  assert.doesNotMatch(migration, /delete\s+from/i);
  assert.doesNotMatch(migration, /update\s+public\./i);
  assert.doesNotMatch(migration, /truncate/i);
  assert.doesNotMatch(migration, /drop\s+table/i);
});
