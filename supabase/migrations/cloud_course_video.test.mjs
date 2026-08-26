import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202608240001_cloud_course_video.sql", import.meta.url);

test("course video migration creates private metadata and storage", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.course_videos/i);
  assert.match(sql, /course_id uuid primary key references public\.courses/i);
  assert.match(sql, /storage_path text unique not null/i);
  assert.match(sql, /duration_seconds/i);
  assert.match(sql, /alter table public\.course_videos enable row level security/i);
  assert.match(sql, /insert into storage\.buckets/i);
  assert.match(sql, /'course-videos'/i);
  assert.match(sql, /false,\s*104857600/i);
});

test("only admins can read and mutate course video metadata and objects", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /course_videos_select_admin_only/i);
  assert.match(sql, /course_videos_objects_select_admin_only/i);
  for (const action of ["insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`course_videos_${action}_admin_only`, "i"));
    assert.match(sql, new RegExp(`course_videos_objects_${action}_admin_only`, "i"));
  }
  assert.match(sql, /private\.is_admin\(\)/i);
  assert.doesNotMatch(sql, /service_role/i);
});
