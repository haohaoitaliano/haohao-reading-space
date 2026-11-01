import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin meeting editor loads and saves the optional number and editable description", async () => {
  const editor = await readFile(new URL("../components/MeetingManager.tsx", import.meta.url), "utf8");
  assert.match(editor, /useState\(meeting\?\.meetingNumber \?\? ""\)/);
  assert.match(editor, /useState\(meeting\?\.description \?\? ""\)/);
  assert.match(editor, /saveWeeklyMeeting\(\{[^}]*meetingNumber, description \}\)/);
  assert.doesNotMatch(editor, /scheduledAt.*Date\.now|会议已结束/);
});

test("student meeting page conditionally renders number, join link, and safe linked description", async () => {
  const page = await readFile(new URL("../app/weekly/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /meeting\.meetingNumber \? <MeetingNumber/);
  assert.match(page, /meeting\.meetingUrl \? <a[^>]*target="_blank"/);
  assert.match(page, /splitMeetingDescription\(meeting\.description\)/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.match(styles, /\.meeting-description\s*\{[^}]*white-space:\s*pre-wrap;/);
  assert.match(styles, /\.meeting-description,[\s\S]*overflow-wrap:\s*anywhere;/);
});
