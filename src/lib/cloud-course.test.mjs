import assert from "node:assert/strict";
import test from "node:test";
import {
  getCourseRouteId,
  filterCoursesForCamp,
  isCourseUnlocked,
  parseCourseDay,
  selectCourseCamp,
  validateCourseEditorInput,
} from "./cloud-course.ts";

test("maps course days to stable giorno routes", () => {
  assert.equal(getCourseRouteId(4), "giorno-4");
  assert.equal(parseCourseDay("giorno-4"), 4);
  assert.equal(parseCourseDay("4"), 4);
  assert.equal(parseCourseDay("giorno-zero"), null);
});

test("filters teacher courses by the selected camp without changing course data", () => {
  const courses = [
    { id: "beta-day-1", campId: "beta" },
    { id: "b1-day-1", campId: "b1" },
  ];
  assert.deepEqual(filterCoursesForCamp(courses, "b1"), [courses[1]]);
  assert.equal(courses[0].campId, "beta");
});

test("selects an explicit manageable camp or defaults to the first active camp", () => {
  const camps = [
    { id: "draft", status: "draft" },
    { id: "active-1", status: "active" },
    { id: "active-2", status: "active" },
  ];
  assert.equal(selectCourseCamp(camps, "active-2")?.id, "active-2");
  assert.equal(selectCourseCamp(camps, "missing")?.id, "active-1");
  assert.equal(selectCourseCamp(camps, null)?.id, "active-1");
});

test("only treats a finite past effective unlock time as unlocked", () => {
  const now = new Date("2026-06-23T12:00:00Z");
  assert.equal(isCourseUnlocked(null, now), false);
  assert.equal(isCourseUnlocked("2026-06-23T11:59:59Z", now), true);
  assert.equal(isCourseUnlocked("2026-06-24T00:00:00Z", now), false);
});

test("validates required admin course fields and vocabulary positions", () => {
  const valid = {
    dayNumber: 4,
    italianTitle: "Il profumo del pane",
    chineseTitle: "面包的香气",
    description: "练习描述生活中的气味和画面。",
    readingText: "Davanti al forno...",
    reflectionPromptZh: "感想",
    reflectionPromptIt: "Riflessione",
    unlockMode: "auto",
    unlockAtLocal: null,
    status: "published",
    vocabulary: [{ position: 1, word: "forno", meaningZh: "烤炉" }],
  };

  assert.equal(validateCourseEditorInput(valid), null);
  assert.equal(validateCourseEditorInput({ ...valid, dayNumber: 0 }), "课程天数必须大于 0");
  assert.equal(validateCourseEditorInput({ ...valid, italianTitle: "" }), "请输入意大利语标题");
  assert.equal(validateCourseEditorInput({ ...valid, readingText: "" }), "请输入阅读材料");
});
