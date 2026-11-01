import assert from "node:assert/strict";
import test from "node:test";
import { buildCircleSubmissions, countSubmissionCommentsByTarget } from "./circle-submission.ts";

const rows = [
  {
    id: "public-old",
    campId: "camp-a",
    courseId: "course-4",
    dayNumber: 4,
    courseTitle: "Il profumo del pane",
    userId: "student-a",
    studentName: "Luca",
    storagePath: "camp-a/student-a/public-old/recording.webm",
    durationSeconds: 9,
    targetDurationSeconds: null,
    visibility: "public",
    version: 1,
    createdAt: "2026-06-24T08:00:00.000Z",
  },
  {
    id: "private-new",
    campId: "camp-a",
    courseId: "course-4",
    dayNumber: 4,
    courseTitle: "Il profumo del pane",
    userId: "student-a",
    studentName: "Luca",
    storagePath: "camp-a/student-a/private-new/recording.webm",
    durationSeconds: 6,
    targetDurationSeconds: null,
    visibility: "teacher_only",
    version: 2,
    createdAt: "2026-06-24T09:00:00.000Z",
  },
  {
    id: "other-camp",
    campId: "camp-b",
    courseId: "course-2",
    dayNumber: 2,
    courseTitle: "La finestra aperta",
    userId: "student-b",
    studentName: "Marta",
    storagePath: "camp-b/student-b/other-camp/recording.webm",
    durationSeconds: 7,
    targetDurationSeconds: null,
    visibility: "public",
    version: 1,
    createdAt: "2026-06-24T10:00:00.000Z",
  },
  {
    id: "public-new",
    campId: "camp-a",
    courseId: "course-3",
    dayNumber: 3,
    courseTitle: "Una parola gentile",
    userId: "student-c",
    studentName: "林小满",
    storagePath: "camp-a/student-c/public-new/recording.webm",
    durationSeconds: 8,
    targetDurationSeconds: 10,
    visibility: "public",
    version: 3,
    createdAt: "2026-06-24T08:30:00.000Z",
  },
  {
    id: "own-private",
    campId: "camp-a",
    courseId: "course-2",
    dayNumber: 2,
    courseTitle: "La finestra aperta",
    userId: "current-student",
    studentName: "我",
    storagePath: "camp-a/current-student/own-private/recording.webm",
    durationSeconds: 5,
    targetDurationSeconds: null,
    visibility: "teacher_only",
    version: 1,
    createdAt: "2026-06-24T11:00:00.000Z",
  },
];

test("keeps only public submissions from the active camp in newest-first order", () => {
  const submissions = buildCircleSubmissions(rows, "camp-a");

  assert.deepEqual(submissions.map((item) => item.id), ["public-new", "public-old"]);
});

test("returns only presentation fields and a same-origin audio endpoint", () => {
  const [submission] = buildCircleSubmissions(rows, "camp-a");

  assert.deepEqual(submission, {
    id: "public-new",
    courseId: "course-3",
    dayNumber: 3,
    courseTitle: "Una parola gentile",
    studentName: "林小满",
    durationSeconds: 8,
    targetDurationSeconds: 10,
    visibility: "public",
    version: 3,
    createdAt: "2026-06-24T08:30:00.000Z",
    audioUrl: "/api/student/submissions/public-new/audio",
    encouragementCount: 0,
    hasEncouraged: false,
    commentCount: 0,
    comments: [],
  });
  assert.equal("userId" in submission, false);
  assert.equal("storagePath" in submission, false);
  assert.equal("signedUrl" in submission, false);
});

test("circle keeps the current student's private work and marks own cards", () => {
  const submissions = buildCircleSubmissions(rows, "camp-a", "current-student");

  assert.deepEqual(
    submissions.map((item) => [item.id, item.isOwn]),
    [
      ["own-private", true],
      ["public-new", false],
      ["public-old", false],
    ],
  );
});

test("counts legacy and unified-assignment comments by their visible work target", () => {
  const counts = countSubmissionCommentsByTarget([
    { submission_id: "legacy-audio", assignment_submission_id: null },
    { submission_id: "legacy-audio", assignment_submission_id: null },
    { submission_id: null, assignment_submission_id: "unified-work" },
    { submission_id: null, assignment_submission_id: "unified-work" },
    { submission_id: null, assignment_submission_id: "photo-only" },
  ]);

  assert.equal(counts.get("legacy-audio"), 2);
  assert.equal(counts.get("unified-work"), 2);
  assert.equal(counts.get("photo-only"), 1);
});
