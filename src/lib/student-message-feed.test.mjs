import assert from "node:assert/strict";
import test from "node:test";
import { STUDENT_MESSAGE_PAGE_SIZE, selectStudentMessagePage } from "./student-message-feed.ts";

test("student message pages contain five items and sort equal timestamps by id", () => {
  const messages = Array.from({ length: 7 }, (_, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    createdAt: "2026-11-23T10:00:00.000Z",
  }));
  const result = selectStudentMessagePage(messages);
  assert.equal(STUDENT_MESSAGE_PAGE_SIZE, 5);
  assert.equal(result.page.length, 5);
  assert.equal(result.hasMore, true);
  assert.deepEqual(result.page.map((message) => message.id), messages.slice(2).reverse().map((message) => message.id));
});
