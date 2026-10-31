import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contextUrl = new URL("./submission-interaction-server.ts", import.meta.url);
const encouragementUrl = new URL("../app/api/student/submissions/[id]/encouragement/route.ts", import.meta.url);
const commentUrl = new URL("../app/api/student/submissions/[id]/comments/route.ts", import.meta.url);
const deleteCommentUrl = new URL("../app/api/student/submissions/[id]/comments/[commentId]/route.ts", import.meta.url);

const [contextSource, encouragementSource, commentSource, deleteCommentSource] = await Promise.all([
  readFile(contextUrl, "utf8"),
  readFile(encouragementUrl, "utf8"),
  readFile(commentUrl, "utf8"),
  readFile(deleteCommentUrl, "utf8"),
]);

test("interaction routes require the selected active camp and a public submission", () => {
  assert.match(contextSource, /getActiveCampForUser\(auth\.profile\.id\)/);
  assert.match(contextSource, /\.eq\("camp_id", campResult\.camp\.id\)/);
  assert.match(contextSource, /\.eq\("visibility", "public"\)/);
  assert.match(contextSource, /auth\.profile\.role !== "student"/);
});

test("encouragement routes bind writes to the authenticated user and block self encouragement", () => {
  assert.match(encouragementSource, /context\.submission\.user_id === context\.auth\.profile\.id/);
  assert.match(encouragementSource, /user_id: context\.auth\.profile\.id/);
  assert.match(encouragementSource, /\.eq\("user_id", context\.auth\.profile\.id\)/);
});

test("comment routes validate content and only delete the authenticated user's comment", () => {
  assert.match(commentSource, /validateSubmissionComment\(rawContent, Boolean\(audioFile \|\| imageFile\)\)/);
  assert.match(commentSource, /user_id: context\.auth\.profile\.id/);
  assert.match(deleteCommentSource, /assignment_submission_id\.eq\.\$\{context\.target\.id\},submission_id\.eq\.\$\{context\.target\.id\}/);
  assert.match(deleteCommentSource, /\.eq\("user_id", context\.auth\.profile\.id\)/);
});
