import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202608280002_course_recording_durations.sql", import.meta.url);

test("course recording duration migration adds safe defaults and challenge constraints", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /add column max_duration_seconds integer not null default 120/i);
  assert.match(sql, /add column target_duration_seconds integer/i);
  assert.match(sql, /check \(max_duration_seconds > 0\)/i);
  assert.match(sql, /check \(target_duration_seconds is null or target_duration_seconds > 0\)/i);
  assert.match(sql, /target_duration_seconds is null or target_duration_seconds <= max_duration_seconds/i);
  assert.doesNotMatch(sql, /delete from public\.courses/i);
});

test("course schedule exposes maximum and target recording durations", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /status text, max_duration_seconds integer, target_duration_seconds integer/i);
  assert.match(sql, /course_row\.max_duration_seconds/i);
  assert.match(sql, /course_row\.target_duration_seconds/i);
  assert.match(sql, /grant execute on function public\.get_course_schedule\(uuid\) to authenticated/i);
});

test("submitted recording files and metadata become immutable", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /submitted recording cannot be changed/i);
  assert.match(sql, /new\.storage_path is distinct from old\.storage_path/i);
  assert.match(sql, /new\.duration_seconds is distinct from old\.duration_seconds/i);
  assert.match(sql, /private\.is_admin\(\)[\s\S]*auth\.role\(\)[\s\S]*service_role[\s\S]*submitted recording cannot be changed/i);
  assert.match(sql, /drop policy if exists "student_recordings_objects_update_own"/i);
  assert.match(sql, /submission playback metadata cannot be changed/i);
});
