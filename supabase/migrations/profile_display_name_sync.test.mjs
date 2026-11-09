import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202611090001_sync_profile_display_name.sql", import.meta.url);

test("profile nickname migration synchronizes only the updated user's name snapshots", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /after update of display_name on public\.profiles/i);
  assert.match(sql, /when \(old\.display_name is distinct from new\.display_name\)/i);
  for (const table of [
    "student_submissions",
    "student_photo_submissions",
    "student_assignment_submissions",
    "submission_comments",
  ]) {
    assert.match(sql, new RegExp(`update public\\.${table}[\\s\\S]*?where user_id = new\\.id`, "i"));
  }
  assert.doesNotMatch(sql, /update public\.profiles/i);
  assert.match(sql, /pg_trigger_depth\(\) <= 1/i);
  assert.match(sql, /revoke all on function private\.sync_profile_display_name_snapshots\(\)[\s\S]*?authenticated/i);
});
