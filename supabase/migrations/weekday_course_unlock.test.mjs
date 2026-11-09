import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("./202611090002_weekday_course_unlock.sql", import.meta.url);

function addDays(date, days) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function weekdayUnlockDate(startDate, dayNumber) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const startIsoDay = start.getUTCDay() || 7;
  const firstWeekdayOffset = startIsoDay === 6 ? 2 : startIsoDay === 7 ? 1 : 0;
  const firstDate = addDays(startDate, firstWeekdayOffset);
  const firstIsoDay = ((startIsoDay - 1 + firstWeekdayOffset) % 7) + 1;
  const courseOffset = dayNumber - 1;
  const weekendDays = 2 * Math.floor((firstIsoDay - 1 + courseOffset) / 5);
  return addDays(firstDate, courseOffset + weekendDays);
}

test("weekday unlock is an additive per-camp setting that preserves existing camps", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /add column course_unlock_schedule text not null default 'daily'/i);
  assert.match(sql, /course_unlock_schedule in \('daily', 'weekdays'\)/i);
  assert.doesNotMatch(sql, /delete from|truncate|drop table|drop policy|disable row level security/i);
  assert.doesNotMatch(sql, /update public\.courses|update public\.camp_members|update public\.student_/i);
});

test("weekday unlock keeps Giorno 0 immediate and moves weekend starts to Monday", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /when day_number = 0 then created_at/i);
  assert.match(sql, /when 6 then local_starts_at \+ interval '2 days'/i);
  assert.match(sql, /when 7 then local_starts_at \+ interval '1 day'/i);
  assert.match(sql, /course_unlock_schedule = 'weekdays'/i);
  assert.match(sql, /at time zone timezone/i);
  assert.match(sql, /make_interval\(days => day_number - 1\)/i);
});

test("camp editing validates and saves the schedule without changing per-course manual unlock", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /target_course_unlock_schedule not in \('daily', 'weekdays'\)/i);
  assert.match(sql, /course_unlock_schedule = target_course_unlock_schedule/i);
  assert.match(sql, /if not private\.is_admin\(\)/i);
  assert.doesNotMatch(sql, /update public\.courses[\s\S]*unlock_mode/i);
});

test("weekday calendar covers midweek, weekend starts, and month boundaries", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((day) => weekdayUnlockDate("2026-11-04", day)),
    ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11"],
  );
  assert.equal(weekdayUnlockDate("2026-11-07", 1), "2026-11-09");
  assert.equal(weekdayUnlockDate("2026-11-08", 1), "2026-11-09");
  assert.equal(weekdayUnlockDate("2026-04-29", 4), "2026-05-04");
});

test("Europe/Rome keeps the same local unlock hour across DST changes", () => {
  const formatRome = (value) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));

  assert.equal(formatRome("2026-03-27T08:00:00Z"), "2026-03-27, 09:00");
  assert.equal(formatRome("2026-03-30T07:00:00Z"), "2026-03-30, 09:00");
  assert.equal(formatRome("2026-10-23T07:00:00Z"), "2026-10-23, 09:00");
  assert.equal(formatRome("2026-10-26T08:00:00Z"), "2026-10-26, 09:00");
});
