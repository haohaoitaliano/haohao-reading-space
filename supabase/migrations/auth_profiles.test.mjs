import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202606220001_auth_profiles.sql", import.meta.url);

test("profiles migration creates student-by-default profiles with RLS", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create type public\.app_role as enum \('student', 'admin'\)/i);
  assert.match(sql, /role public\.app_role not null default 'student'/i);
  assert.match(sql, /references auth\.users\s*\(id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /create trigger on_auth_user_created/i);
  assert.match(sql, /execute function public\.handle_new_user\(\)/i);
  assert.match(sql, /create policy "profiles_select_own_or_admin"/i);
  assert.match(sql, /create policy "profiles_update_own_or_admin"/i);
  assert.match(sql, /new\.role <> old\.role/i);
  assert.match(sql, /private\.is_admin\(\)/i);
});
