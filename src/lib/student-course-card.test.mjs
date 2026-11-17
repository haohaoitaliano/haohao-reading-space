import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const courseCardUrl = new URL("../components/CourseCard.tsx", import.meta.url);
const courseCardSource = await readFile(courseCardUrl, "utf8");

test("student course cards show the teacher title without a generated Giorno label", () => {
  assert.match(courseCardSource, /<h3>\{course\.italianTitle\}<\/h3>/);
  assert.doesNotMatch(courseCardSource, /getStudentCourseDayLabel/);
  assert.doesNotMatch(courseCardSource, /Giorno/);
});

test("student course cards keep day numbers for routing and unlocking only", () => {
  assert.match(courseCardSource, /getCourseRouteId\(course\.dayNumber\)/);
  assert.match(courseCardSource, /formatUnlockDateTime\(course\.unlockAt, course\.timezone\)/);
});
