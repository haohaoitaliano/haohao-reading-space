import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202608270002_student_submission_playback.sql", import.meta.url);

test("playback migration adds non-destructive derived-audio metadata", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /add column playback_storage_path text unique/i);
  assert.match(sql, /add column playback_mime_type text/i);
  assert.match(sql, /add column playback_size_bytes bigint/i);
  assert.match(sql, /add column transcode_status text not null default 'pending'/i);
  assert.match(sql, /transcode_status = 'ready'[\s\S]*playback_mime_type = 'audio\/mp4'/i);
  assert.doesNotMatch(sql, /delete from public\.student_submissions/i);
  assert.doesNotMatch(sql, /drop table/i);
});

test("playback metadata is protected and private storage can sign ready derivatives", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /submission playback metadata cannot be changed/i);
  assert.match(sql, /auth\.role\(\)[\s\S]*service_role/i);
  assert.match(sql, /grant select, update on public\.student_submissions to service_role/i);
  assert.match(sql, /student_recordings_objects_select_visible/i);
  assert.match(sql, /submission_row\.transcode_status = 'ready'/i);
  assert.match(sql, /submission_row\.playback_storage_path = storage\.objects\.name/i);
});

test("replacing an original recording invalidates its derived playback metadata", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /new\.storage_path is distinct from old\.storage_path/i);
  assert.match(sql, /new\.playback_storage_path := null/i);
  assert.match(sql, /new\.transcode_status := case/i);
});
