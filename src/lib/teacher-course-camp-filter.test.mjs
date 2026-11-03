import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("teacher course management prefers a valid URL camp and otherwise the newest camp", async () => {
  const page = await readFile(new URL("../app/teacher/courses/page.tsx", import.meta.url), "utf8");
  const data = await readFile(new URL("./cloud-course-data.ts", import.meta.url), "utf8");

  assert.match(page, /getAdminCampOptions\(\{ newestFirst: true \}\)/);
  assert.match(page, /camps\.find\(\(camp\) => camp\.id === query\.camp\) \?\? camps\[0\] \?\? null/);
  assert.match(data, /order\("created_at", \{ ascending: !options\?\.newestFirst \}\)/);
  assert.match(page, /filterCoursesForCamp\(courseResult\.courses, selectedCamp\.id\)/);
  assert.match(page, /campCourses\.filter\(\(course\) => course\.status === status\.value\)\.length/);
});
