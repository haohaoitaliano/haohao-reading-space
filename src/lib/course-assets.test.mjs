import assert from "node:assert/strict";
import test from "node:test";
import { hasCoursePdfSignature, validateCoursePdfFile } from "./course-pdf.ts";
import { getStudentPhotoMimeType, hasStudentPhotoSignature, validateStudentPhotoFile } from "./student-photo.ts";

test("PDF validation accepts PDF only and enforces 20 MB", () => {
  assert.equal(validateCoursePdfFile({ name: "lezione.pdf", size: 10, type: "application/pdf" }), null);
  assert.match(validateCoursePdfFile({ name: "lezione.jpg", size: 10, type: "image/jpeg" }), /仅支持 PDF/);
  assert.match(validateCoursePdfFile({ name: "lezione.pdf", size: 20 * 1024 * 1024 + 1, type: "application/pdf" }), /20 MB/);
});

test("photo validation accepts JPG PNG and HEIC and enforces 5 MB", () => {
  assert.equal(validateStudentPhotoFile({ name: "homework.HEIC", size: 10, type: "" }), null);
  assert.equal(getStudentPhotoMimeType({ name: "homework.HEIC", type: "" }), "image/heic");
  assert.equal(validateStudentPhotoFile({ name: "homework.png", size: 10, type: "image/png" }), null);
  assert.match(validateStudentPhotoFile({ name: "homework.jpg", size: 5 * 1024 * 1024 + 1, type: "image/jpeg" }), /5 MB/);
  assert.match(validateStudentPhotoFile({ name: "homework.pdf", size: 10, type: "application/pdf" }), /不是支持/);
});

test("server-side signatures reject renamed non-PDF and non-image content", async () => {
  assert.equal(await hasCoursePdfSignature(new Blob(["%PDF-1.7"])), true);
  assert.equal(await hasCoursePdfSignature(new Blob(["not a pdf"])), false);
  assert.equal(await hasStudentPhotoSignature(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])]), "image/jpeg"), true);
  assert.equal(await hasStudentPhotoSignature(new Blob(["not an image"]), "image/jpeg"), false);
});
