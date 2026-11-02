import assert from "node:assert/strict";
import test from "node:test";
import { buildStudentMessages } from "./student-message.ts";

const targets = [
  { id: "own-work", userId: "me", studentName: "我", dayNumber: 2, courseTitle: "La casa" },
  { id: "other-work", userId: "other", studentName: "小林", dayNumber: 3, courseTitle: "Il pane" },
];

const baseComment = {
  submission_id: null,
  assignment_submission_id: "own-work",
  author_display_name: "小林",
  author_role: "student",
  content: "继续加油！",
  parent_comment_id: null,
  audio_storage_path: null,
  image_storage_path: null,
};

test("messages include comments on own work and replies to own comments, newest first", () => {
  const messages = buildStudentMessages({
    currentUserId: "me",
    targets,
    readCommentIds: new Set(["direct"]),
    comments: [
      { ...baseComment, id: "direct", user_id: "other", created_at: "2026-11-01T09:00:00Z" },
      { ...baseComment, id: "mine", user_id: "me", assignment_submission_id: "other-work", created_at: "2026-11-01T09:30:00Z" },
      { ...baseComment, id: "reply", user_id: "admin", author_display_name: "助教", author_role: "admin", assignment_submission_id: "other-work", parent_comment_id: "mine", created_at: "2026-11-01T10:00:00Z" },
    ],
  });

  assert.deepEqual(messages.map((message) => message.id), ["reply", "direct"]);
  assert.equal(messages[0].authorRole, "admin");
  assert.equal(messages[0].isReplyOnOtherWork, true);
  assert.equal(messages[1].isReplyOnOtherWork, false);
  assert.equal(messages[1].isRead, true);
});

test("one comment produces one message even when it is both on own work and a reply", () => {
  const messages = buildStudentMessages({
    currentUserId: "me",
    targets,
    readCommentIds: new Set(),
    comments: [
      { ...baseComment, id: "mine", user_id: "me", created_at: "2026-11-01T09:00:00Z" },
      { ...baseComment, id: "both", user_id: "other", parent_comment_id: "mine", created_at: "2026-11-01T10:00:00Z" },
    ],
  });

  assert.deepEqual(messages.map((message) => message.id), ["both"]);
  assert.equal(messages[0].isReplyOnOtherWork, false);
});

test("self comments and comments whose work is no longer accessible are excluded", () => {
  const messages = buildStudentMessages({
    currentUserId: "me",
    targets,
    readCommentIds: new Set(),
    comments: [
      { ...baseComment, id: "self", user_id: "me", created_at: "2026-11-01T09:00:00Z" },
      { ...baseComment, id: "inaccessible", user_id: "other", assignment_submission_id: "deleted-work", created_at: "2026-11-01T10:00:00Z" },
    ],
  });

  assert.deepEqual(messages, []);
});
