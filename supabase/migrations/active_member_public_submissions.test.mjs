import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(
  new URL("./202608270001_active_member_public_submissions.sql", import.meta.url),
  "utf8",
);

test("public submissions require both viewer and submitter to be active camp members", () => {
  assert.match(sql, /private\.is_active_camp_member\(camp_id\)/i);
  assert.match(sql, /private\.is_active_camp_user\(camp_id, user_id\)/i);
  assert.match(sql, /visibility\s*=\s*'public'/i);
});
