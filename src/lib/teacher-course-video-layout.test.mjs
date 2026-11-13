import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../components/TeacherCourseEditor.tsx", import.meta.url);
const cssUrl = new URL("../app/globals.css", import.meta.url);

test("teacher course video previews stay inside the editor with wrapping file names", async () => {
  const [editor, css] = await Promise.all([
    readFile(editorUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(editor, /teacher-course-video-section/);
  assert.equal((editor.match(/className="teacher-course-video-preview"/g) ?? []).length, 2);
  assert.match(css, /\.teacher-course-video-section,[\s\S]*min-width: 0/);
  assert.match(css, /\.teacher-course-video-meta \.file-name[\s\S]*overflow-wrap: anywhere[\s\S]*white-space: normal/);
  assert.match(css, /\.teacher-course-video-preview[\s\S]*width: 100%[\s\S]*max-width: 100%[\s\S]*height: auto/);
});
