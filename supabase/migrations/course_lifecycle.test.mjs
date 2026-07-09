import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202607080002_course_lifecycle.sql", import.meta.url);

test("course deletion is limited to courses without student submissions", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /private\.course_has_no_submissions/i);
  assert.match(sql, /not exists \(select 1 from public\.student_submissions/i);
  assert.match(sql, /drop policy if exists "courses_delete_admin_only"/i);
  assert.match(sql, /using \(private\.is_admin\(\) and private\.course_has_no_submissions\(id\)\)/i);
});
