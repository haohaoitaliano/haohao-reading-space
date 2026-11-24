import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("teacher course editor hides the unlock description without dropping stored content", async () => {
  const editor = await readFile(
    new URL("../components/TeacherCourseEditor.tsx", import.meta.url),
    "utf8",
  );
  const actions = await readFile(
    new URL("../app/teacher/course-actions.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(editor, /今日解锁说明/);
  assert.doesNotMatch(editor, /updateField\("description"/);
  assert.match(editor, /description: course\.description/);
  assert.match(actions, /description: input\.description\.trim\(\) \|\| null/g);
});
