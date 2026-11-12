import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("./202611120002_fix_get_admin_users_return_types.sql", import.meta.url), "utf8");

test("admin user RPC keeps its contract and casts auth email to text", () => {
  assert.match(sql, /create or replace function public\.get_admin_users\(\)/i);
  assert.match(sql, /returns table \(\s*id uuid,\s*display_name text,\s*email text,\s*system_role public\.app_role,\s*status text,\s*identity_label text,\s*camp_id uuid,\s*camp_name text,\s*membership_status text\s*\)/i);
  assert.match(sql, /coalesce\(account\.email, ''\)::text/i);
});

test("admin user RPC preserves its security boundary and business query", () => {
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /if not private\.is_admin\(\) then raise exception 'admin required'/i);
  assert.match(sql, /join auth\.users account on account\.id = profile\.id/i);
  assert.match(sql, /left join public\.camp_members member on member\.user_id = profile\.id/i);
  assert.doesNotMatch(sql, /create policy|alter table|update public\.|delete from|insert into/i);
  assert.doesNotMatch(sql, /revoke|grant/i);
});
