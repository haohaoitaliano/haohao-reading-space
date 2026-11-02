import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("./202611020001_student_recording_pending_read.sql", import.meta.url),
  "utf8",
);

test("pending recording reads stay owner-only and active-camp scoped", () => {
  assert.match(migration, /for select\s+to authenticated/i);
  assert.match(migration, /bucket_id = 'student-recordings'/);
  assert.match(migration, /profile_row\.role = 'student'/);
  assert.match(migration, /profile_row\.status = 'active'/);
  assert.match(migration, /\)\[2\] = \(select auth\.uid\(\)\)::text/);
  assert.match(migration, /private\.is_active_camp_member/);
});

test("pending recording policy does not widen writes or bucket visibility", () => {
  assert.doesNotMatch(migration, /for insert|for update|for delete/i);
  assert.doesNotMatch(migration, /public\s*=\s*true/i);
  assert.doesNotMatch(migration, /to anon/i);
  assert.doesNotMatch(migration, /update\s+storage\.buckets|insert\s+into\s+storage\.buckets/i);
  assert.doesNotMatch(migration, /delete\s+from|truncate|drop\s+table/i);
});
