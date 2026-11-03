import assert from "node:assert/strict";
import test from "node:test";
import { formatDateTimeLocalInZone, formatUnlockDateTime } from "./course-schedule.ts";

test("formats an instant as a datetime-local value in the camp timezone", () => {
  assert.equal(
    formatDateTimeLocalInZone("2026-03-28T08:00:00.000Z", "Europe/Rome"),
    "2026-03-28T09:00",
  );
  assert.equal(
    formatDateTimeLocalInZone("2026-03-29T07:00:00.000Z", "Europe/Rome"),
    "2026-03-29T09:00",
  );
});

test("formats unlock text in the camp timezone rather than the browser timezone", () => {
  assert.match(
    formatUnlockDateTime("2026-06-24T07:00:00.000Z", "Europe/Rome"),
    /09:00/,
  );
});

test("handles empty and invalid dates without crashing date displays or editors", () => {
  assert.equal(formatUnlockDateTime(null, "Europe/Rome"), "训练营开始时间尚未设置");
  assert.equal(formatUnlockDateTime("invalid-date", "Europe/Rome"), "训练营开始时间尚未设置");
  assert.equal(formatDateTimeLocalInZone(null, "Europe/Rome"), "");
  assert.equal(formatDateTimeLocalInZone("invalid-date", "Europe/Rome"), "");
});
