import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202606230004_fix_course_audio_storage_rls.sql", import.meta.url);

test("storage audio policy qualifies the outer object path", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /drop policy if exists "course_audio_objects_select_unlocked_or_admin"/i);
  assert.match(sql, /storage\.foldername\(storage\.objects\.name\)/i);
  assert.match(sql, /course_row\.status = 'published'/i);
  assert.match(sql, /member_row\.user_id = \(select auth\.uid\(\)\)/i);
});
