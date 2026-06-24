import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202606240002_automatic_course_unlock.sql", import.meta.url);

test("migration adds camp timezone and explicit automatic/manual course modes", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /alter table public\.camps\s+add column timezone text not null default 'Europe\/Rome'/i);
  assert.match(sql, /alter table public\.courses\s+add column unlock_mode text not null default 'auto'/i);
  assert.match(sql, /unlock_mode in \('auto', 'manual'\)/i);
});

test("effective unlock keeps the camp wall-clock time across calendar days", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /private\.course_effective_unlock_at/i);
  assert.match(sql, /camp_row\.starts_at at time zone camp_row\.timezone/i);
  assert.match(sql, /make_interval\(days => course_row\.day_number - 1\)/i);
  assert.match(sql, /at time zone camp_row\.timezone/i);
  assert.match(sql, /course_row\.unlock_mode = 'manual'/i);
});

test("RLS and course audio storage use the same effective unlock function", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create or replace function private\.can_read_course_content/i);
  assert.match(sql, /private\.course_effective_unlock_at\(target_course_id\) <= now\(\)/i);
  assert.match(sql, /drop policy if exists "course_audio_objects_select_unlocked_or_admin"/i);
  assert.match(sql, /private\.can_read_course_content\(course_row\.id\)/i);
});

test("admins receive protected camp and course scheduling functions", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /public\.update_camp_schedule/i);
  assert.match(sql, /public\.set_course_unlock_schedule/i);
  assert.match(sql, /if not private\.is_admin\(\)/i);
  assert.match(sql, /grant execute on function public\.update_camp_schedule/i);
  assert.match(sql, /grant execute on function public\.set_course_unlock_schedule/i);
});
