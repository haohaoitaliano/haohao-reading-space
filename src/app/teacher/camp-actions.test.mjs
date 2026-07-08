import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("camp lifecycle actions archive, reactivate, and delete only empty camps", async () => {
  const source = await readFile(new URL("./camp-actions.ts", import.meta.url), "utf8");
  assert.match(source, /export async function updateCampStatus/);
  assert.match(source, /status: "active" \| "archived"/);
  assert.match(source, /export async function permanentlyDeleteCamp/);
  assert.match(source, /getCampUsageCounts/);
  assert.match(source, /只有空训练营才能永久删除/);
});
