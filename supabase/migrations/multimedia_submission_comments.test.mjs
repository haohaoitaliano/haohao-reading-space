import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("./202610310003_multimedia_submission_comments.sql", import.meta.url), "utf8");

test("multimedia comments extend legacy comments without deleting history", () => {
  assert.match(sql, /alter table public\.submission_comments/i);
  assert.match(sql, /parent_comment_id uuid/i);
  assert.match(sql, /assignment_submission_id uuid/i);
  assert.match(sql, /audio_storage_path text unique/i);
  assert.match(sql, /image_storage_path text unique/i);
  assert.doesNotMatch(sql, /delete from public\.submission_comments/i);
  assert.doesNotMatch(sql, /drop table public\.submission_comments/i);
});

test("comment access follows the existing assignment visibility and active-camp rules", () => {
  assert.match(sql, /private\.can_read_student_assignment\(target_assignment_submission_id\)/i);
  assert.match(sql, /submission_row\.visibility = 'public'/i);
  assert.match(sql, /private\.is_active_camp_member\(submission_row\.camp_id\)/i);
  assert.match(sql, /private\.is_active_camp_user\(submission_row\.camp_id, submission_row\.user_id\)/i);
  assert.match(sql, /private\.is_admin\(\)/i);
});

test("comment media stays private and enforces requested limits", () => {
  assert.match(sql, /'submission-comment-media',[\s\S]*false,[\s\S]*3145728/i);
  assert.match(sql, /audio_duration_seconds > 0 and audio_duration_seconds <= 45/i);
  assert.match(sql, /'image\/jpeg', 'image\/png', 'image\/webp'/i);
  assert.match(sql, /audio_transcode_status in \('pending', 'processing', 'ready', 'failed', 'not_required'\)/i);
});
