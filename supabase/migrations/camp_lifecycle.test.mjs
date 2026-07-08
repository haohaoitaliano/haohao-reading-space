import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202607080001_camp_lifecycle.sql", import.meta.url);

test("camp deletion is limited to empty camps at the database policy layer", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /private\.is_empty_camp/i);
  assert.match(sql, /not exists \(select 1 from public\.courses/i);
  assert.match(sql, /not exists \(select 1 from public\.camp_members/i);
  assert.match(sql, /not exists \(select 1 from public\.weekly_meetings/i);
  assert.match(sql, /not exists \(select 1 from public\.camp_invites/i);
  assert.match(sql, /not exists \(select 1 from public\.student_submissions/i);
  assert.match(sql, /drop policy if exists "camps_delete_admin_only"/i);
  assert.match(sql, /using \(private\.is_admin\(\) and private\.is_empty_camp\(id\)\)/i);
});
