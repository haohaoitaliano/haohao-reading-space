import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../components/MediaPreviewDialog.tsx", import.meta.url);
const galleryUrl = new URL("../components/PhotoGallery.tsx", import.meta.url);
const courseUrl = new URL("../components/StudentCourseDetail.tsx", import.meta.url);
const photoCardUrl = new URL("../components/PhotoSubmissionCard.tsx", import.meta.url);
const cloudCardUrl = new URL("../components/CloudSubmissionCard.tsx", import.meta.url);

test("student and circle assignment photos use the shared in-page gallery", async () => {
  const [gallery, photoCard, cloudCard] = await Promise.all([
    readFile(galleryUrl, "utf8"),
    readFile(photoCardUrl, "utf8"),
    readFile(cloudCardUrl, "utf8"),
  ]);
  assert.match(photoCard, /<PhotoGallery/);
  assert.match(cloudCard, /<PhotoGallery/);
  assert.match(gallery, /<ImagePreviewDialog/);
  assert.doesNotMatch(gallery, /target=["']_blank["']/);
});

test("photo preview supports touch gestures, navigation, closing, and original download", async () => {
  const component = await readFile(componentUrl, "utf8");
  assert.match(component, /onPointerDown={handlePointerDown}/);
  assert.match(component, /onPointerMove={handlePointerMove}/);
  assert.match(component, /上一张照片/);
  assert.match(component, /下一张照片/);
  assert.match(component, /关闭照片预览/);
  assert.match(component, /下载原图/);
  assert.match(component, /照片暂时无法预览/);
});

test("course PDFs open in the PDF.js in-page reader and keep download separate", async () => {
  const [component, course] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(courseUrl, "utf8"),
  ]);
  assert.match(course, /<PdfPreviewDialog/);
  assert.match(course, /站内阅读/);
  assert.doesNotMatch(course, /target=["']_blank["']/);
  assert.match(component, /import\("pdfjs-dist"\)/);
  assert.match(component, /document\.numPages/);
  assert.match(component, /pdf-preview-scroll/);
  assert.match(component, /PDF 暂时无法预览/);
  assert.match(component, /页面不会自动跳转/);
  assert.match(component, /下载 PDF/);
});
