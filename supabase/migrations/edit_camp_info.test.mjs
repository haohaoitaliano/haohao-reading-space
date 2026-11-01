import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202611010002_edit_camp_info.sql", import.meta.url);

test("camp info migration is additive and preserves camp relationships", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /alter table public\.camps[\s\S]*add column description text/i);
  assert.doesNotMatch(sql, /delete from|truncate|drop table|drop policy|disable row level security/i);
  assert.doesNotMatch(sql, /courses|camp_members|student_submissions|weekly_meetings/);
});

test("camp info RPC is admin-only and updates five fields atomically in the camp timezone", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create function public\.update_camp_info_admin/i);
  assert.match(sql, /if not private\.is_admin\(\)/i);
  assert.match(sql, /name = trim\(camp_name\)/i);
  assert.match(sql, /max_students = student_limit/i);
  assert.match(sql, /starts_at = local_starts_at at time zone camp_timezone/i);
  assert.match(sql, /ends_at = case when local_ends_at is null/i);
  assert.match(sql, /description = nullif\(trim\(camp_description\), ''\)/i);
});
