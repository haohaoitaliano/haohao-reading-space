import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202608270003_submission_interactions.sql", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");

test("submission interactions are additive and tied to submissions", () => {
  assert.match(sql, /create table public\.submission_encouragements/i);
  assert.match(sql, /create table public\.submission_comments/i);
  assert.match(sql, /unique\s*\(submission_id, user_id\)/i);
  assert.match(sql, /references public\.student_submissions \(id\) on delete cascade/i);
  assert.doesNotMatch(sql, /alter table public\.student_submissions/i);
  assert.doesNotMatch(sql, /delete from public\.student_submissions/i);
});

test("interaction RLS requires a visible public submission in an active camp", () => {
  assert.match(sql, /private\.can_interact_with_public_submission/i);
  assert.match(sql, /submission_row\.visibility = 'public'/i);
  assert.match(sql, /private\.is_active_camp_member\(submission_row\.camp_id\)/i);
  assert.match(sql, /private\.is_active_camp_user\(submission_row\.camp_id, submission_row\.user_id\)/i);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /submission_row\.user_id <> \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /grant update on public\.submission_(?:encouragements|comments)/i);
});

test("legacy comments were trimmed and constrained when originally introduced", () => {
  assert.match(sql, /new\.content := trim\(new\.content\)/i);
  assert.match(sql, /content = trim\(content\)/i);
  assert.match(sql, /char_length\(content\) between 1 and 100/i);
});
