import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202611030001_multiple_course_videos.sql", import.meta.url);

test("course videos gain stable ids and per-course positions without replacing existing rows", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /add column id uuid default extensions\.gen_random_uuid\(\)/i);
  assert.match(sql, /add column position integer/i);
  assert.match(sql, /update public\.course_videos[\s\S]*set position = 1/i);
  assert.match(sql, /drop constraint course_videos_pkey/i);
  assert.match(sql, /primary key \(id\)/i);
  assert.match(sql, /unique \(course_id, position\)/i);
  assert.doesNotMatch(sql, /delete from public\.course_videos/i);
  assert.doesNotMatch(sql, /storage\.objects/i);
  assert.doesNotMatch(sql, /create policy|drop policy/i);
});
