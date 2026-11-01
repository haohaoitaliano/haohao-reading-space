import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202611010001_optional_meeting_link_and_number.sql", import.meta.url);

test("meeting migration preserves data while adding optional connection fields", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /add column meeting_number text/i);
  assert.match(sql, /alter column meeting_url drop not null/i);
  assert.match(sql, /meeting_url[\s\S]*meeting_number[\s\S]*at least one|meeting url or number required/i);
  assert.doesNotMatch(sql, /delete from public\.weekly_meetings|truncate/i);
});

test("meeting save RPC remains admin-only and stores the optional number", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /if not private\.is_admin\(\)/i);
  assert.match(sql, /meeting_number = normalized_meeting_number/i);
  assert.match(sql, /grant execute on function public\.save_weekly_meeting_admin[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /create policy|drop policy|disable row level security/i);
});
