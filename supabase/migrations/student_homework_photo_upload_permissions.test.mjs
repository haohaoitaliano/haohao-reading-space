import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("./202611200001_student_homework_photo_upload_permissions.sql", import.meta.url),
  "utf8",
);

test("photo upload and pre-submission verification do not depend on legacy assignment flags", () => {
  assert.match(migration, /for select[\s\S]*bucket_id = 'student-homework-photos'/i);
  assert.match(migration, /for insert[\s\S]*bucket_id = 'student-homework-photos'/i);
  assert.match(migration, /private\.is_active_camp_member/g);
  assert.match(migration, /private\.can_read_course_content/g);
  assert.match(migration, /course_row\.camp_id = \(\(storage\.foldername/g);
  assert.doesNotMatch(migration, /photo_assignment_enabled/i);
  assert.doesNotMatch(migration, /photo_assignment_required/i);
});

test("photo upload permission migration changes no assignment data", () => {
  assert.doesNotMatch(migration, /delete\s+from/i);
  assert.doesNotMatch(migration, /update\s+public\./i);
  assert.doesNotMatch(migration, /truncate/i);
  assert.doesNotMatch(migration, /drop\s+table/i);
});
