import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("./202611010003_submission_comment_reads.sql", import.meta.url), "utf8");

test("comment reads store only the recipient, comment, and first read time", () => {
  assert.match(sql, /create table public\.submission_comment_reads/i);
  assert.match(sql, /user_id uuid not null/i);
  assert.match(sql, /comment_id uuid not null/i);
  assert.match(sql, /read_at timestamptz not null default now\(\)/i);
  assert.match(sql, /primary key \(user_id, comment_id\)/i);
  assert.doesNotMatch(sql, /comment_content|author_display_name|notification_type/i);
  assert.doesNotMatch(sql, /create trigger/i);
});

test("comment read RLS accepts only a current active student receiving a visible comment", () => {
  assert.match(sql, /target_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /profile_row\.role = 'student'/i);
  assert.match(sql, /profile_row\.status = 'active'/i);
  assert.match(sql, /comment_row\.user_id <> target_user_id/i);
  assert.match(sql, /private\.can_read_submission_comment_target/i);
  assert.match(sql, /private\.is_active_camp_member/i);
  assert.match(sql, /submission_row\.user_id = target_user_id/i);
  assert.match(sql, /assignment_row\.user_id = target_user_id/i);
  assert.match(sql, /parent_row\.user_id = target_user_id/i);
});

test("students may select and insert only, without bulk mutation permissions", () => {
  assert.match(sql, /submission_comment_reads_select_own_legal/i);
  assert.match(sql, /submission_comment_reads_insert_own_legal/i);
  assert.match(sql, /grant select on public\.submission_comment_reads to authenticated/i);
  assert.match(sql, /grant insert \(user_id, comment_id\)/i);
  assert.doesNotMatch(sql, /grant (?:update|delete)/i);
});
