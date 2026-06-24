import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("course creation checks day uniqueness inside the selected camp", async () => {
  const source = await readFile(new URL("./course-actions.ts", import.meta.url), "utf8");
  assert.match(source, /\.eq\("camp_id", camp\.id\)[\s\S]*\.eq\("day_number", input\.dayNumber\)/);
  assert.match(source, /该训练营中已存在 Giorno/);
});

test("existing course updates never write camp_id", async () => {
  const source = await readFile(new URL("./course-actions.ts", import.meta.url), "utf8");
  const updateBlock = source.slice(source.indexOf("export async function updateCloudCourse"), source.indexOf("export async function createCloudCourse"));
  assert.doesNotMatch(updateBlock, /camp_id\s*:/);
});
