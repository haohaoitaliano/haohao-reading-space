import assert from "node:assert/strict";
import test from "node:test";
import {
  countCommentCharacters,
  normalizeSubmissionComment,
  validateSubmissionComment,
} from "./submission-interaction.ts";

test("submission comments trim surrounding whitespace and reject empty content", () => {
  assert.equal(normalizeSubmissionComment("  加油！  "), "加油！");
  assert.equal(validateSubmissionComment(" \n\t "), "评论不能为空。");
});

test("submission comments accept at most 100 Unicode characters", () => {
  assert.equal(countCommentCharacters("👏好"), 2);
  assert.equal(validateSubmissionComment("好".repeat(100)), null);
  assert.equal(validateSubmissionComment("好".repeat(101)), "评论最多 100 字。");
});
