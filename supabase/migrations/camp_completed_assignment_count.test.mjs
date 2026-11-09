import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202611090003_camp_completed_assignment_count.sql", import.meta.url);

test("camp assignment count exposes only an active-member aggregate", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /returns bigint/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\)[\s\S]*raise exception 'active camp membership required'/i);
  assert.match(sql, /private\.is_active_camp_member\(target_camp_id\)/i);
  assert.match(sql, /student_assignment_submissions[\s\S]*union[\s\S]*student_submissions[\s\S]*union[\s\S]*student_photo_submissions/i);
  assert.match(sql, /select assignment_row\.user_id, assignment_row\.course_id/i);
  assert.match(sql, /select recording_row\.user_id, recording_row\.course_id/i);
  assert.match(sql, /select photo_row\.user_id, photo_row\.course_id/i);
  assert.match(sql, /revoke all on function public\.get_camp_completed_assignment_count\(uuid\)[\s\S]*from public, anon/i);
  assert.match(sql, /grant execute on function public\.get_camp_completed_assignment_count\(uuid\)[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /create policy|alter policy|drop policy|disable row level security/i);
});
