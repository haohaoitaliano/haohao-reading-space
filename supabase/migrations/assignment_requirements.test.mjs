import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("./202611170001_assignment_requirements.sql", import.meta.url), "utf8");

test("assignment requirements default to optional for legacy compatibility", () => {
  assert.match(migration, /recording_assignment_required boolean not null default false/i);
  assert.match(migration, /photo_assignment_required boolean not null default false/i);
  assert.doesNotMatch(migration, /update\s+public\.course_contents/i);
});

test("unified assignment RPC accepts optional extras and rejects missing requirements", () => {
  assert.match(migration, /recording_assignment_required and audio_metadata is null/i);
  assert.match(migration, /photo_assignment_required and photo_total < 1/i);
  assert.match(migration, /photo_total > 3/i);
  assert.match(migration, /audio_metadata is null and photo_total = 0/i);
  assert.doesNotMatch(migration, /assignment is disabled/i);
});
