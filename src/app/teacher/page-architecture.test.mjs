import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("teacher dashboard stays a navigation hub", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /href: "\/teacher\/camps"/);
  assert.match(source, /href: "\/teacher\/invites"/);
  assert.match(source, /href: "\/teacher\/courses"/);
  assert.match(source, /label: "素材库"/);
  assert.match(source, /href: "\/teacher\/media"/);
  assert.match(source, /href: "\/teacher\/submissions"/);
  assert.match(source, /href: "\/teacher\/progress"/);
  assert.match(source, /href: "\/teacher\/meetings"/);
  assert.doesNotMatch(source, /TeacherCampScheduleEditor/);
  assert.doesNotMatch(source, /TeacherCourseCampFilter/);
  assert.doesNotMatch(source, /CloudSubmissionCard/);
  assert.doesNotMatch(source, /getAdminCourseList/);
  assert.doesNotMatch(source, /getAdminCloudSubmissions/);
});
