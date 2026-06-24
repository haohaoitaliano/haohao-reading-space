import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202606240001_cloud_student_recordings.sql", import.meta.url);

test("student recording migration creates private submission metadata and bucket", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.student_submissions/i);
  assert.match(sql, /visibility text not null.*'public'.*'teacher_only'/is);
  assert.match(sql, /unique \(course_id, user_id, version\)/i);
  assert.match(sql, /alter table public\.student_submissions enable row level security/i);
  assert.match(sql, /'student-recordings'/i);
  assert.match(sql, /false,\s*31457280/i);
});

test("students only manage their own submissions while admins can read all", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /student_submissions_select_visible/i);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /visibility = 'public'/i);
  assert.match(sql, /private\.is_admin\(\)/i);
  assert.match(sql, /student_submissions_insert_own/i);
  assert.match(sql, /private\.can_read_course_content\(course_id\)/i);
  assert.match(sql, /student_submissions_update_own/i);
  assert.match(sql, /student_submissions_delete_own/i);
});

test("storage policies qualify the object path and do not use elevated keys", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /storage\.foldername\(storage\.objects\.name\)/i);
  assert.match(sql, /student_recordings_objects_select_visible/i);
  assert.match(sql, /student_recordings_objects_insert_own/i);
  assert.match(sql, /student_recordings_objects_update_own/i);
  assert.match(sql, /student_recordings_objects_delete_own/i);
  assert.doesNotMatch(sql, /service_role/i);
});
