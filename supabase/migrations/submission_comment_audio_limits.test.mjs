import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("./202611170001_extend_submission_comment_audio_limits.sql", import.meta.url), "utf8");

test("comment audio migration raises the database and private bucket limits", () => {
  assert.match(sql, /audio_size_bytes between 1 and 8388608/i);
  assert.match(sql, /audio_duration_seconds > 0 and audio_duration_seconds <= 120/i);
  assert.match(sql, /update storage\.buckets[\s\S]*file_size_limit = 8388608[\s\S]*submission-comment-media/i);
});
