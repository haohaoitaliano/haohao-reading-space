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
      { id: "c1", dayNumber: 1, title: "Uno", status: "published", effectiveUnlockAt: "2026-06-23T08:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: false },
      { id: "c2", dayNumber: 2, title: "Due", status: "published", effectiveUnlockAt: "2026-06-24T09:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: true },
      { id: "future", dayNumber: 3, title: "Tre", status: "published", effectiveUnlockAt: "2026-06-25T08:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: false },
      { id: "draft", dayNumber: 4, title: "Quattro", status: "draft", effectiveUnlockAt: "2026-06-20T08:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: false },
      { id: "archived", dayNumber: 5, title: "Cinque", status: "archived", effectiveUnlockAt: "2026-06-20T08:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: false },
      { id: "no-work", dayNumber: 6, title: "Sei", status: "published", effectiveUnlockAt: "2026-06-20T08:00:00Z", recordingAssignmentEnabled: false, photoAssignmentEnabled: false },
    ],
    submissions: [
      { userId: "student-1", courseId: "c1", kind: "recording" },
      { userId: "student-1", courseId: "c1", kind: "recording" },
      { userId: "student-1", courseId: "future", kind: "recording" },
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
      { id: "opened-done", isUnlocked: true, recordingAssignmentEnabled: true, photoAssignmentEnabled: true },
      { id: "opened-missing", isUnlocked: true, recordingAssignmentEnabled: false, photoAssignmentEnabled: true },
      { id: "no-work", isUnlocked: true, recordingAssignmentEnabled: false, photoAssignmentEnabled: false },
      { id: "locked", isUnlocked: false, recordingAssignmentEnabled: true, photoAssignmentEnabled: false },
    ],
    recordingSubmissions: [
      { courseId: "opened-done", version: 1 },
      { courseId: "opened-done", version: 2 },
      { courseId: "locked", version: 1 },
    ],
    photoSubmissions: [
      { courseId: "opened-done", version: 1 },
    ],
  });

  assert.deepEqual(stats, {
    openedTasks: 2,
    completedTasks: 1,
    pendingTasks: 1,
    completedOutputs: 4,
    resubmissions: 1,
    completionPercent: 50,
  });
});

test("today task status follows independent recording and photo requirements", () => {
  const base = { hasTask: true, recordingRequired: true, photoRequired: true, hasRecordingSubmission: false, hasPhotoSubmission: false, submissionError: false };
  assert.equal(getTodayTaskStatus({ ...base, hasTask: false }), "今日暂无任务");
  assert.equal(getTodayTaskStatus(base), "待完成");
  assert.equal(getTodayTaskStatus({ ...base, hasRecordingSubmission: true }), "待完成");
  assert.equal(getTodayTaskStatus({ ...base, hasRecordingSubmission: true, hasPhotoSubmission: true }), "已完成");
  assert.equal(getTodayTaskStatus({ ...base, recordingRequired: false, photoRequired: false }), "无需提交作业");
  assert.equal(getTodayTaskStatus({ ...base, submissionError: true }), "状态暂时无法读取");
});

test("one unified recording and photo assignment completes both requirements and counts once", () => {
  const stats = buildStudentCampStats({
    courses: [{ id: "combined", isUnlocked: true, recordingAssignmentEnabled: true, photoAssignmentEnabled: true }],
    recordingSubmissions: [],
    photoSubmissions: [],
    unifiedAssignments: [{ courseId: "combined", version: 2, hasRecording: true, photoCount: 2 }],
  });
  assert.equal(stats.completedTasks, 1);
  assert.equal(stats.pendingTasks, 0);
  assert.equal(stats.completedOutputs, 1);
  assert.equal(stats.resubmissions, 1);
});
