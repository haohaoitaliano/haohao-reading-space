import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202606230003_cloud_course_audio.sql", import.meta.url);

test("course audio migration creates private metadata and storage", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.course_audio/i);
  assert.match(sql, /course_id uuid primary key references public\.courses/i);
  assert.match(sql, /storage_path text unique not null/i);
  assert.match(sql, /duration_seconds/i);
  assert.match(sql, /alter table public\.course_audio enable row level security/i);
  assert.match(sql, /insert into storage\.buckets/i);
  assert.match(sql, /'course-audio'/i);
  assert.match(sql, /false,\s*20971520/i);
});

test("students only read unlocked audio metadata and storage objects", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /course_audio_select_unlocked_or_admin/i);
  assert.match(sql, /private\.can_read_course_content\(course_id\)/i);
  assert.match(sql, /course_audio_objects_select_unlocked_or_admin/i);
  assert.match(sql, /course_row\.status = 'published'/i);
  assert.match(sql, /course_row\.unlock_at is null or course_row\.unlock_at <= now\(\)/i);
  assert.match(sql, /member_row\.user_id = \(select auth\.uid\(\)\)/i);
});

test("only active admins can mutate course audio objects", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const action of ["insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`course_audio_objects_${action}_admin_only`, "i"));
  }
  assert.match(sql, /private\.is_admin\(\)/i);
  assert.doesNotMatch(sql, /service_role/i);
});
