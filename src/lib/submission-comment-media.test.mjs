import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSubmissionCommentMediaPath,
  validateSubmissionCommentAudio,
  validateSubmissionCommentImage,
} from "./submission-comment-media.ts";

test("comment audio accepts browser recordings and manual M4A or MP3 under 3 MB", () => {
  assert.equal(validateSubmissionCommentAudio({ name: "voice.m4a", type: "audio/mp4", size: 1024 }, "manual_upload"), null);
  assert.equal(validateSubmissionCommentAudio({ name: "voice.mp3", type: "audio/mpeg", size: 1024 }, "manual_upload"), null);
  assert.equal(validateSubmissionCommentAudio({ name: "voice.webm", type: "audio/webm", size: 1024 }, "browser_recording"), null);
  assert.match(validateSubmissionCommentAudio({ name: "voice.webm", type: "audio/webm", size: 1024 }, "manual_upload"), /M4A.*MP3/);
  assert.match(validateSubmissionCommentAudio({ name: "voice.mp3", type: "audio/mpeg", size: 3 * 1024 * 1024 + 1 }, "manual_upload"), /3 MB/);
});

test("comment images accept JPG PNG and WebP and use camp-scoped paths", () => {
  for (const [name, type] of [["photo.jpg", "image/jpeg"], ["photo.png", "image/png"], ["photo.webp", "image/webp"]]) {
    assert.equal(validateSubmissionCommentImage({ name, type, size: 1024 }), null);
  }
  assert.equal(buildSubmissionCommentMediaPath({ campId: "camp", userId: "user", commentId: "comment", kind: "image", extension: "webp" }), "camp/user/comment/image.webp");
  assert.match(validateSubmissionCommentImage({ name: "large.jpg", type: "image/jpeg", size: 5 * 1024 * 1024 + 1 }), /5 MB/);
});
