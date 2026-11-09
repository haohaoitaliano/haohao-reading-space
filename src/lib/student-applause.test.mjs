import assert from "node:assert/strict";
import test from "node:test";
import { getRomeDayBounds } from "./student-applause.ts";

test("Rome applause day bounds follow winter and summer offsets", () => {
  assert.deepEqual(getRomeDayBounds(new Date("2026-01-15T12:00:00Z")), {
    start: "2026-01-14T23:00:00.000Z",
    end: "2026-01-15T23:00:00.000Z",
  });
  assert.deepEqual(getRomeDayBounds(new Date("2026-07-15T12:00:00Z")), {
    start: "2026-07-14T22:00:00.000Z",
    end: "2026-07-15T22:00:00.000Z",
  });
});
