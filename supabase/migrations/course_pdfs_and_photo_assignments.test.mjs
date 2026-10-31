import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202610310001_course_pdfs_and_photo_assignments.sql", import.meta.url);

test("migration keeps old recording assignments enabled and adds independent photo assignments", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /recording_assignment_enabled boolean not null default true/i);
  assert.match(sql, /photo_assignment_enabled boolean not null default false/i);
  assert.match(sql, /drop constraint if exists course_contents_reading_text_check/i);
  assert.match(sql, /alter column reading_text drop not null/i);
  assert.match(sql, /create table public\.student_photo_submissions/i);
  assert.match(sql, /unique \(course_id, user_id, version\)/i);
  assert.match(sql, /position integer not null check \(position between 1 and 3\)/i);
  assert.match(sql, /size_bytes bigint not null check \(size_bytes > 0 and size_bytes <= 5242880\)/i);
  assert.match(sql, /course_has_no_submissions[\s\S]*not exists \(select 1 from public\.student_photo_submissions/i);
});

test("PDF and photo storage stay private and follow course or ownership permissions", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /'course-pdfs',[\s\S]*?false,[\s\S]*?20971520/i);
  assert.match(sql, /course_pdfs_objects_select_unlocked_or_admin/i);
  assert.match(sql, /private\.can_read_course_content\(pdf_row\.course_id\)/i);
  assert.match(sql, /'student-homework-photos',[\s\S]*?false,[\s\S]*?5242880/i);
  assert.match(sql, /student_homework_photos_objects_insert_own/i);
  assert.match(sql, /student_photo_submissions_select_own_or_admin/i);
  assert.match(sql, /submission_row\.user_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /service_role/i);
});

test("photo assignment insert policy validates camp, course and enabled assignment", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /student_photo_submissions_insert_own/i);
  assert.match(sql, /course_row\.camp_id = camp_id/i);
  assert.match(sql, /content_row\.photo_assignment_enabled/i);
  assert.match(sql, /storage\.foldername\(storage\.objects\.name\)/i);
});
