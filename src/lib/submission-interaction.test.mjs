import assert from "node:assert/strict";
import test from "node:test";
import {
  countCommentCharacters,
  normalizeSubmissionComment,
  validateSubmissionComment,
} from "./submission-interaction.ts";

test("submission comments trim whitespace and allow attachment-only feedback", () => {
  assert.equal(normalizeSubmissionComment("  加油！  "), "加油！");
  assert.equal(validateSubmissionComment(" \n\t "), "请填写文字，或添加录音/照片。");
  assert.equal(validateSubmissionComment(" \n\t ", true), null);
});

test("submission comments accept at most 1000 Unicode characters", () => {
  assert.equal(countCommentCharacters("👏好"), 2);
  assert.equal(validateSubmissionComment("好".repeat(1000)), null);
  assert.equal(validateSubmissionComment("好".repeat(1001)), "评论最多 1000 字。");
});
