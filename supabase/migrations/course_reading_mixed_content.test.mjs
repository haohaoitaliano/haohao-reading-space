import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202611170001_course_reading_mixed_content.sql", import.meta.url);

test("reading mixed content stays optional and uses private course-scoped image access", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /add column reading_blocks jsonb/i);
  assert.match(sql, /create table public\.course_reading_images/i);
  assert.match(sql, /'course-reading-images'[\s\S]*false[\s\S]*8388608/i);
  assert.match(sql, /private\.can_read_course_content\(image_row\.course_id\)/i);
  assert.doesNotMatch(sql, /update public\.course_contents[\s\S]*reading_blocks/i);
});
