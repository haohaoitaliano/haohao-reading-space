import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedUrl = new URL("./202606230002_reading_beta_courses.sql", import.meta.url);

test("course seed targets reading-beta-7d and inserts seven complete courses once", async () => {
  const sql = await readFile(seedUrl, "utf8");

  assert.match(sql, /reading-beta-7d/i);
  assert.match(sql, /jsonb_array_length\(course_seed\)\s*<>\s*7/i);
  assert.match(sql, /Il profumo del pane/i);
  assert.match(sql, /Davanti al forno, il profumo del pane caldo/i);
  assert.match(sql, /Riflessione dopo la lettura/i);
  assert.match(sql, /烤炉、面包店/i);
  assert.match(sql, /on conflict \(camp_id, day_number\) do nothing/i);
  assert.doesNotMatch(sql, /on conflict[\s\S]{0,80}do update/i);
});
