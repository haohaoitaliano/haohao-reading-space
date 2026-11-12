import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("./202611120001_account_identity_labels.sql", import.meta.url), "utf8");

test("identity labels are separate from system roles and every account starts without a special label", () => {
  assert.match(sql, /add column identity_label text/i);
  assert.match(sql, /set identity_label = 'student'/i);
  assert.match(sql, /identity_label in \('student', 'teacher', 'helper'\)/i);
  assert.doesNotMatch(sql, /display_name\s*(=|like|ilike)/i);
  assert.doesNotMatch(sql, /case when role/i);
});

test("only admins can list emails or change identity labels", () => {
  assert.match(sql, /get_admin_users[\s\S]*if not private\.is_admin\(\)/i);
  assert.match(sql, /join auth\.users/i);
  assert.match(sql, /set_user_identity_label[\s\S]*if not private\.is_admin\(\)/i);
  assert.doesNotMatch(sql, /update public\.profiles[\s\S]*set role\s*=/i);
});
