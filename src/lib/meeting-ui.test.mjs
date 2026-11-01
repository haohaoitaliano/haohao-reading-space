import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin meeting UI clearly separates inserts from editing a selected meeting", async () => {
  const editor = await readFile(new URL("../components/MeetingManager.tsx", import.meta.url), "utf8");
  assert.match(editor, /useState\(meeting\?\.meetingNumber \?\? ""\)/);
  assert.match(editor, /useState\(meeting\?\.description \?\? ""\)/);
  assert.match(editor, /saveWeeklyMeeting\(\{ id: meeting\?\.id \?\? null/);
  assert.match(editor, /新建线上见面/);
  assert.match(editor, /正在编辑：\$\{meeting\.title\}/);
  assert.match(editor, /编辑这场线上见面/);
  assert.match(editor, /if \(!meeting\) \{/);
});

test("student meeting page conditionally renders number, join link, and safe linked description", async () => {
  const page = await readFile(new URL("../app/weekly/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /meeting\.meetingNumber \? <MeetingNumber/);
  assert.match(page, /meeting\.meetingUrl \? <a[^>]*target="_blank"/);
  assert.match(page, /splitMeetingDescription\(meeting\.description\)/);
  assert.match(page, /getMeetingStatus\(meeting\.scheduledAt, result\.now\)/);
  assert.match(page, /getMeetingStatusLabel\(status\)/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.match(styles, /\.meeting-description\s*\{[^}]*white-space:\s*pre-wrap;/);
  assert.match(styles, /\.meeting-description,[\s\S]*overflow-wrap:\s*anywhere;/);
});

test("meeting queries sort both admin and student lists from earliest to latest", async () => {
  const source = await readFile(new URL("./teacher-operations-data.ts", import.meta.url), "utf8");
  const matches = source.match(/\.order\("scheduled_at", \{ ascending: true \}\)/g) ?? [];
  assert.equal(matches.length, 2);
});
