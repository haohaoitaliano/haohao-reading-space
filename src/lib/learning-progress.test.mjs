import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminLearningProgress, buildLearningProgress, buildStudentCampStats, getTodayTaskStatus } from "./learning-progress.ts";

test("missing work includes only published courses already unlocked", () => {
  const result = buildLearningProgress({
    now: new Date("2026-06-24T10:00:00Z"),
    members: [
      { userId: "student-1", displayName: "林小满" },
      { userId: "student-2", displayName: "Luca" },
    ],
    courses: [
      { id: "intro", dayNumber: 0, title: "欢迎与试打卡", status: "published", effectiveUnlockAt: "2026-06-20T08:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: true },
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
      { id: "intro", dayNumber: 0, isUnlocked: true, recordingAssignmentEnabled: true, photoAssignmentEnabled: true },
      { id: "opened-done", dayNumber: 1, isUnlocked: true, recordingAssignmentEnabled: true, photoAssignmentEnabled: true },
      { id: "opened-missing", dayNumber: 2, isUnlocked: true, recordingAssignmentEnabled: false, photoAssignmentEnabled: true },
      { id: "no-work", dayNumber: 3, isUnlocked: true, recordingAssignmentEnabled: false, photoAssignmentEnabled: false },
      { id: "locked", dayNumber: 4, isUnlocked: false, recordingAssignmentEnabled: true, photoAssignmentEnabled: false },
    ],
    recordingSubmissions: [
      { courseId: "intro", version: 1 },
      { courseId: "opened-done", version: 1 },
      { courseId: "opened-done", version: 2 },
      { courseId: "locked", version: 1 },
    ],
    photoSubmissions: [
      { courseId: "intro", version: 1 },
      { courseId: "opened-done", version: 1 },
    ],
    unifiedAssignments: [{ courseId: "intro", version: 2, hasRecording: true, photoCount: 1 }],
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
    courses: [{ id: "combined", dayNumber: 1, isUnlocked: true, recordingAssignmentEnabled: true, photoAssignmentEnabled: true }],
    recordingSubmissions: [],
    photoSubmissions: [],
    unifiedAssignments: [{ courseId: "combined", version: 2, hasRecording: true, photoCount: 2 }],
  });
  assert.equal(stats.completedTasks, 1);
  assert.equal(stats.pendingTasks, 0);
  assert.equal(stats.completedOutputs, 1);
  assert.equal(stats.resubmissions, 1);
});

test("admin progress counts each unlocked published course once per student", () => {
  const result = buildAdminLearningProgress({
    now: new Date("2026-11-03T12:00:00Z"),
    members: [
      { userId: "student-1", displayName: "林小满" },
      { userId: "student-2", displayName: "Luca" },
    ],
    courses: [
      { id: "intro", dayNumber: 0, title: "欢迎与试打卡", status: "published", effectiveUnlockAt: "2026-11-01T08:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: true },
      { id: "c1", dayNumber: 1, title: "Uno", status: "published", effectiveUnlockAt: "2026-11-01T08:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: false },
      { id: "c2", dayNumber: 2, title: "Due", status: "published", effectiveUnlockAt: "2026-11-02T08:00:00Z", recordingAssignmentEnabled: false, photoAssignmentEnabled: true },
      { id: "no-work", dayNumber: 3, title: "Nessun compito", status: "published", effectiveUnlockAt: "2026-11-01T08:00:00Z", recordingAssignmentEnabled: false, photoAssignmentEnabled: false },
      { id: "future", dayNumber: 4, title: "Tre", status: "published", effectiveUnlockAt: "2026-11-04T08:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: false },
      { id: "draft", dayNumber: 5, title: "Quattro", status: "draft", effectiveUnlockAt: "2026-11-01T08:00:00Z", recordingAssignmentEnabled: true, photoAssignmentEnabled: false },
    ],
    submissions: [
      { userId: "student-1", courseId: "intro" },
      { userId: "student-1", courseId: "intro" },
      { userId: "student-1", courseId: "c1" },
      { userId: "student-1", courseId: "c1" },
      { userId: "student-1", courseId: "future" },
      { userId: "student-1", courseId: "no-work" },
      { userId: "student-2", courseId: "c2" },
    ],
  });

  assert.deepEqual(result.courses.map((course) => course.id), ["intro", "c1", "c2"]);
  assert.deepEqual(result.students[0].submittedCourseIds, ["intro", "c1"]);
  assert.deepEqual(result.students[1].submittedCourseIds, ["c2"]);
});
