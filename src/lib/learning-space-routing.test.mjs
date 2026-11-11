import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ACTIVE_CAMP_COOKIE } from "./active-camp-cookie.ts";

test("uses active_camp_id as the current learning-space cookie", () => {
  assert.equal(ACTIVE_CAMP_COOKIE, "active_camp_id");
});

test("my work queries are scoped to the selected camp", async () => {
  const source = await readFile(new URL("./cloud-submission-data.ts", import.meta.url), "utf8");

  assert.match(source, /getOwnCloudSubmissions\(userId: string, campId: string\)/);
  assert.match(source, /\.eq\("user_id", userId\)[\s\S]*\.eq\("camp_id", campId\)/);
});

test("student submission upload checks the current learning space", async () => {
  const source = await readFile(new URL("../app/api/student/courses/[id]/submissions/route.ts", import.meta.url), "utf8");

  assert.match(source, /getCurrentLearningSpace\(auth\.profile\.id\)/);
  assert.match(source, /course\.camp_id !== campResult\.camp\.id/);
});

test("home uses current-camp cloud submissions without prototype data", async () => {
  const source = await readFile(new URL("../app/home/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /@\/lib\/mock-data/);
  assert.match(source, /getStudentCampProgress\(profile\.id\)/);
  assert.match(source, /getPublicCampSubmissions\(result\.camp\.id, profile\.id, 2\)/);
  assert.doesNotMatch(source, /66%|progress\.streak/);
});

test("student progress pages share the current-camp data source", async () => {
  const [sharedSource, progressSource, profileSource] = await Promise.all([
    readFile(new URL("./student-camp-progress.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(sharedSource, /getStudentCourseList\(userId\)/);
  assert.match(sharedSource, /getOwnRecordingSubmissionSummaries\(userId, courseResult\.camp\.id\)/);
  assert.match(progressSource, /getStudentCampProgress\(profile\.id\)/);
  assert.match(profileSource, /getStudentCampProgress\(profile\.id\)/);
  assert.match(progressSource, /href="\/my-work"/);
  assert.doesNotMatch(profileSource, /@\/lib\/mock-data|模拟级别|7 天免费公测|progress\.completed|progress\.submitted/);
});

test("public submission queries are camp-scoped and limited in the database", async () => {
  const source = await readFile(new URL("./cloud-submission-data.ts", import.meta.url), "utf8");

  assert.match(source, /\.eq\("camp_id", campId\)[\s\S]*\.eq\("visibility", "public"\)/);
  assert.match(source, /query = query\.limit/);
});

test("circle includes the current student's own submissions without cross-camp data", async () => {
  const source = await readFile(new URL("./cloud-submission-data.ts", import.meta.url), "utf8");

  assert.match(source, /getCampCircleSubmissions\(campId: string, currentUserId: string\)/);
  assert.match(source, /\.eq\("camp_id", campId\)[\s\S]*\.or\(`visibility\.eq\.public,user_id\.eq\.\$\{currentUserId\}`\)/);
  assert.doesNotMatch(
    source.slice(source.indexOf("export async function getCampCircleSubmissions")),
    /\.neq\("user_id", currentUserId\)/,
  );
});

test("circle reads only the aggregate assignment count for the active camp", async () => {
  const dataSource = await readFile(new URL("./cloud-submission-data.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../app/circle/page.tsx", import.meta.url), "utf8");

  assert.match(dataSource, /getCampCompletedAssignmentCount\(campId: string\)/);
  assert.match(dataSource, /rpc\("get_camp_completed_assignment_count", \{[\s\S]*target_camp_id: campId/);
  assert.match(pageSource, /getCampCompletedAssignmentCount\(campResult\.camp\.id\)/);
  assert.match(pageSource, /Passo dopo passo 👣，每一次表达都是一小步的进步。/);
  assert.match(pageSource, /到今天为止，我们一起输出了 <strong>\{countResult\.count\}<\/strong> 份作业 👏/);
  assert.doesNotMatch(pageSource, /<Header title="同学作业圈" subtitle=/);
});
