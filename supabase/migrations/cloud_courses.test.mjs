import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202606230002_cloud_courses.sql", import.meta.url);

test("cloud course migration creates the normalized course tables and indexes", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const table of ["courses", "course_contents", "course_vocabulary"]) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /unique\s*\(camp_id, day_number\)/i);
  assert.match(sql, /unique\s*\(course_id, position\)/i);
  assert.match(sql, /courses_camp_status_unlock_idx/i);
  assert.match(sql, /course_vocabulary_course_position_idx/i);
});

test("students only receive published unlocked content from their active camp", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /private\.is_active_camp_member/i);
  assert.match(sql, /private\.can_read_course_content/i);
  assert.match(sql, /course_row\.status = 'published'/i);
  assert.match(sql, /course_row\.unlock_at is null or course_row\.unlock_at <= now\(\)/i);
  assert.match(sql, /courses_select_published_member_or_admin/i);
  assert.match(sql, /course_contents_select_unlocked_or_admin/i);
  assert.match(sql, /course_vocabulary_select_unlocked_or_admin/i);
});

test("only admins receive write policies for all course tables", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const table of ["courses", "course_contents", "course_vocabulary"]) {
    assert.match(sql, new RegExp(`${table}_insert_admin_only`, "i"));
    assert.match(sql, new RegExp(`${table}_update_admin_only`, "i"));
    assert.match(sql, new RegExp(`${table}_delete_admin_only`, "i"));
  }
  assert.doesNotMatch(sql, /insert_student|update_student|delete_student/i);
});
