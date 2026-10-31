import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202610310002_unified_assignment_submissions.sql", import.meta.url);

test("unified assignments link audio and photos without rewriting legacy history", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.student_assignment_submissions/i);
  assert.match(sql, /add column assignment_submission_id uuid unique/i);
  assert.match(sql, /existing\.assignment_submission_id is null/i);
  assert.match(sql, /create or replace function public\.complete_student_assignment/i);
  assert.match(sql, /target_assignment_id, target_camp_id, target_course_id/i);
  assert.match(sql, /return query[\s\S]*existing_assignment\.id/i);
});

test("unified completion is atomic, public only inside the active camp, and storage stays private", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /visibility[^\n]*'public'/i);
  assert.match(sql, /private\.is_active_camp_member\(assignment_row\.camp_id\)/i);
  assert.match(sql, /private\.is_active_camp_user\(assignment_row\.camp_id, assignment_row\.user_id\)/i);
  assert.match(sql, /student_homework_photos_objects_select_visible_assignment/i);
  assert.match(sql, /private\.can_read_student_assignment\(submission_row\.assignment_submission_id\)/i);
  assert.match(sql, /not exists \([\s\S]*bucket_id = 'student-recordings'/i);
  assert.match(sql, /not exists \([\s\S]*bucket_id = 'student-homework-photos'/i);
  assert.doesNotMatch(sql, /update public\.student_submissions set assignment_submission_id/i);
});
