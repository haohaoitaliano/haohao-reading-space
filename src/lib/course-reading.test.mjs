import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReadingBlocks, readingBlocksPlainText, validateCourseReadingImage } from "./course-reading.ts";

test("legacy reading text becomes one editable text block", () => {
  const blocks = normalizeReadingBlocks(null, "Testo\nhttps://example.com");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "text");
  assert.equal(blocks[0].text, "Testo\nhttps://example.com");
});

test("mixed reading blocks preserve text and image order", () => {
  const blocks = normalizeReadingBlocks([
    { id: "a", type: "text", text: "Prima" },
    { id: "b", type: "image", imageId: "image-1" },
    { id: "c", type: "text", text: "Dopo" },
  ]);
  assert.deepEqual(blocks.map((block) => block.type), ["text", "image", "text"]);
  assert.equal(readingBlocksPlainText(blocks), "Prima\n\nDopo");
});

test("reading images accept JPG PNG and WebP up to 8 MB", () => {
  assert.equal(validateCourseReadingImage({ name: "foto.jpg", type: "image/jpeg", size: 10 }), null);
  assert.equal(validateCourseReadingImage({ name: "foto.webp", type: "image/webp", size: 10 }), null);
  assert.match(validateCourseReadingImage({ name: "foto.gif", type: "image/gif", size: 10 }), /仅支持/);
  assert.match(validateCourseReadingImage({ name: "foto.jpg", type: "image/jpeg", size: 8 * 1024 * 1024 + 1 }), /8 MB/);
});
