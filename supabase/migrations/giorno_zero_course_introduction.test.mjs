import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202611030001_giorno_zero_course_introduction.sql", import.meta.url);

test("Giorno 0 is allowed and automatically available after it is created", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /check\s*\(day_number >= 0\)/i);
  assert.match(sql, /when course_row\.day_number = 0 then course_row\.created_at/i);
  assert.match(sql, /make_interval\(days => course_row\.day_number - 1\)/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.courses/i);
});
