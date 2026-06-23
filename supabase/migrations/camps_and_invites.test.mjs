import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202606230001_camps_and_invites.sql", import.meta.url);

test("camp migration creates the three RLS-protected tables", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const table of ["camps", "camp_invites", "camp_members"]) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /unique\s*\(camp_id, user_id\)/i);
  assert.match(sql, /private\.is_admin\(\)/i);
  const invitesTable = sql.match(/create table public\.camp_invites[\s\S]*?\);/i)?.[0] ?? "";
  assert.doesNotMatch(invitesTable, /invite_code\s+text/i);
});

test("invite redemption is authenticated, hashed, locked, and idempotent", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /redeem_camp_invite\s*\(invite_code text\)/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /extensions\.digest/i);
  assert.match(sql, /for update of invite_row, camp_row/i);
  assert.match(sql, /result_code\s*:=\s*'already_joined'/i);
  for (const resultCode of [
    "invalid_invite",
    "invite_inactive",
    "invite_expired",
    "invite_full",
    "camp_inactive",
    "camp_full",
  ]) {
    assert.match(sql, new RegExp(`result_code\\s*:=\\s*'${resultCode}'`, "i"));
  }
  assert.match(sql, /used_count\s*=\s*used_count\s*\+\s*1/i);
  assert.match(sql, /grant execute on function public\.redeem_camp_invite\(text\) to authenticated/i);
  assert.match(sql, /revoke all on function public\.redeem_camp_invite\(text\) from public, anon/i);
});

test("students cannot directly read invites or write memberships", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /camp_invites_admin_all/i);
  assert.doesNotMatch(sql, /camp_invites_[^"\n]*student/i);
  assert.match(sql, /camp_members_select_own_or_admin/i);
  assert.match(sql, /camp_members_insert_admin_only/i);
  assert.match(sql, /camp_members_update_admin_only/i);
});
