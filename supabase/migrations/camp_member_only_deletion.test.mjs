import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202608280001_camp_member_only_deletion.sql", import.meta.url);

test("camp deletion requires an admin and zero members at the database policy layer", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /private\.has_no_camp_members/i);
  assert.match(sql, /not exists \([\s\S]*from public\.camp_members[\s\S]*where camp_id = target_camp_id[\s\S]*and status = 'active'/i);
  assert.doesNotMatch(sql, /not exists \(select 1 from public\.(courses|weekly_meetings|camp_invites|student_submissions)/i);
  assert.match(sql, /using \(private\.is_admin\(\) and private\.has_no_camp_members\(id\)\)/i);
});

test("admins can remove student recording objects during camp deletion", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create policy "student_recordings_objects_delete_admin_only"/i);
  assert.match(sql, /bucket_id = 'student-recordings' and private\.is_admin\(\)/i);
});
