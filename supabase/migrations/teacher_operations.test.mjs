import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202606240003_teacher_operations.sql", import.meta.url);

test("migration adds private weekly meetings with member read and admin write policies", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.weekly_meetings/i);
  assert.match(sql, /alter table public\.weekly_meetings enable row level security/i);
  assert.match(sql, /private\.is_active_camp_member\(camp_id\)/i);
  assert.match(sql, /private\.is_admin\(\)/i);
});

test("admin functions create camps and hash invite codes without storing plaintext", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /public\.create_camp_admin/i);
  assert.match(sql, /public\.create_camp_invite_admin/i);
  assert.match(sql, /extensions\.digest/i);
  assert.match(sql, /insert into public\.camp_invites[\s\S]*code_hash/i);
  assert.doesNotMatch(sql, /add column invite_code/i);
  assert.match(sql, /if not private\.is_admin\(\)/i);
});

test("meeting writes use camp-local time and protected admin RPC", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /public\.save_weekly_meeting_admin/i);
  assert.match(sql, /local_scheduled_at at time zone camp_timezone/i);
  assert.match(sql, /grant execute on function public\.save_weekly_meeting_admin/i);
});
