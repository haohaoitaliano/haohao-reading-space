import assert from "node:assert/strict";
import test from "node:test";
import { buildLearningProgress, buildStudentCampStats, getTodayTaskStatus } from "./learning-progress.ts";

test("missing work includes only published courses already unlocked", () => {
  const result = buildLearningProgress({
    now: new Date("2026-06-24T10:00:00Z"),
    members: [
      { userId: "student-1", displayName: "林小满" },
      { userId: "student-2", displayName: "Luca" },
    ],
    courses: [
      { id: "c1", dayNumber: 1, title: "Uno", status: "published", effectiveUnlockAt: "2026-06-23T08:00:00Z" },
      { id: "c2", dayNumber: 2, title: "Due", status: "published", effectiveUnlockAt: "2026-06-24T09:00:00Z" },
      { id: "future", dayNumber: 3, title: "Tre", status: "published", effectiveUnlockAt: "2026-06-25T08:00:00Z" },
      { id: "draft", dayNumber: 4, title: "Quattro", status: "draft", effectiveUnlockAt: "2026-06-20T08:00:00Z" },
      { id: "archived", dayNumber: 5, title: "Cinque", status: "archived", effectiveUnlockAt: "2026-06-20T08:00:00Z" },
    ],
    submissions: [
      { userId: "student-1", courseId: "c1" },
      { userId: "student-1", courseId: "c1" },
      { userId: "student-1", courseId: "future" },
    ],
  });

  assert.deepEqual(result[0].submittedCourses.map((course) => course.id), ["c1"]);
  assert.deepEqual(result[0].missingCourses.map((course) => course.id), ["c2"]);
  assert.equal(result[0].submittedCount, 1);
  assert.deepEqual(result[1].missingCourses.map((course) => course.id), ["c1", "c2"]);
});

test("student camp stats count opened missing tasks and every real submission", () => {
  const stats = buildStudentCampStats({
    courses: [
      { id: "opened-done", isUnlocked: true },
      { id: "opened-missing", isUnlocked: true },
      { id: "locked", isUnlocked: false },
    ],
    submissions: [
      { courseId: "opened-done", version: 1 },
      { courseId: "opened-done", version: 2 },
      { courseId: "locked", version: 1 },
    ],
  });

  assert.deepEqual(stats, {
    openedTasks: 2,
    completedTasks: 1,
    pendingTasks: 1,
    completedOutputs: 3,
    resubmissions: 1,
    completionPercent: 50,
  });
});

test("today task status distinguishes no task, pending, completed, and query errors", () => {
  assert.equal(getTodayTaskStatus({ hasTask: false, hasSubmission: false, submissionError: false }), "今日暂无任务");
  assert.equal(getTodayTaskStatus({ hasTask: true, hasSubmission: false, submissionError: false }), "待完成");
  assert.equal(getTodayTaskStatus({ hasTask: true, hasSubmission: true, submissionError: false }), "已完成");
  assert.equal(getTodayTaskStatus({ hasTask: true, hasSubmission: false, submissionError: true }), "状态暂时无法读取");
});
