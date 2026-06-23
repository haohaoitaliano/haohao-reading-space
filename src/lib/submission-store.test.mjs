import assert from "node:assert/strict";
import test from "node:test";
import {
  createSubmissionRecord,
  getNextSubmissionVersion,
  isSubmissionVisibleInCircle,
} from "./submission-store.ts";

const existing = [
  { courseId: "giorno-4", studentId: "student-1", version: 1 },
  { courseId: "giorno-4", studentId: "student-1", version: 2 },
  { courseId: "giorno-4", studentId: "student-2", version: 4 },
  { courseId: "giorno-3", studentId: "student-1", version: 6 },
];

test("increments versions only for the same student and course", () => {
  assert.equal(getNextSubmissionVersion(existing, "giorno-4", "student-1"), 3);
  assert.equal(getNextSubmissionVersion(existing, "giorno-4", "student-3"), 1);
});

test("creates a complete local submission record", () => {
  const audioBlob = new Blob(["audio"], { type: "audio/webm" });
  const record = createSubmissionRecord(
    {
      courseId: "giorno-4",
      studentId: "student-1",
      studentNickname: "好好",
      audioBlob,
      mimeType: "audio/webm",
      duration: 8,
      visibility: "public",
    },
    2,
    1_750_000_000_000,
    "submission-2",
  );

  assert.deepEqual(record, {
    submissionId: "submission-2",
    courseId: "giorno-4",
    studentId: "student-1",
    studentNickname: "好好",
    audioBlob,
    mimeType: "audio/webm",
    duration: 8,
    visibility: "public",
    version: 2,
    createdAt: 1_750_000_000_000,
  });
});

test("only public submissions are visible in the circle", () => {
  assert.equal(isSubmissionVisibleInCircle({ visibility: "public" }), true);
  assert.equal(isSubmissionVisibleInCircle({ visibility: "teacher_only" }), false);
});
