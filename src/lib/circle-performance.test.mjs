import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const photoDataUrl = new URL("./photo-submission-data.ts", import.meta.url);
const cloudDataUrl = new URL("./cloud-submission-data.ts", import.meta.url);
const cardUrl = new URL("../components/CloudSubmissionCard.tsx", import.meta.url);
const galleryUrl = new URL("../components/PhotoGallery.tsx", import.meta.url);

test("circle batches photo signing instead of signing every photo twice", async () => {
  const source = await readFile(photoDataUrl, "utf8");
  assert.match(source, /\.createSignedUrls\(paths, STUDENT_PHOTO_SIGNED_URL_SECONDS\)/);
  assert.doesNotMatch(source, /\.createSignedUrl\(photo\.storage_path/);
  assert.match(source, /searchParams\.set\("download", fileName\)/);
});

test("circle defers off-screen recording and photo media work", async () => {
  const [card, gallery] = await Promise.all([
    readFile(cardUrl, "utf8"),
    readFile(galleryUrl, "utf8"),
  ]);
  assert.match(card, /new IntersectionObserver/);
  assert.match(card, /rootMargin: "500px 0px"/);
  assert.match(card, /if \(!hasAudio \|\| !shouldLoadAudio\) return/);
  assert.match(gallery, /decoding="async" loading="lazy"/);
});

test("circle loads only comment targets for collapsed counts", async () => {
  const source = await readFile(cloudDataUrl, "utf8");
  assert.match(source, /\.select\("submission_id, assignment_submission_id"\)/);
  assert.doesNotMatch(source, /\.select\("id, submission_id, assignment_submission_id, user_id, author_display_name, content, created_at"\)/);
});
