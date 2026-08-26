import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202608260001_student_course_video_access.sql", import.meta.url);

test("student course video access follows unlocked course content permissions", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /drop policy if exists "course_videos_select_admin_only"/i);
  assert.match(sql, /course_videos_select_unlocked_or_admin/i);
  assert.match(sql, /private\.is_admin\(\) or private\.can_read_course_content\(course_id\)/i);
  assert.match(sql, /drop policy if exists "course_videos_objects_select_admin_only"/i);
  assert.match(sql, /course_videos_objects_select_unlocked_or_admin/i);
  assert.match(sql, /bucket_id = 'course-videos'/i);
  assert.match(sql, /private\.can_read_course_content\(course_row\.id\)/i);
  assert.match(sql, /storage\.foldername\(storage\.objects\.name\)/i);
  assert.doesNotMatch(sql, /service_role/i);
});
