import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, data, actions, progress, comments, workCard, interactions, messages, labelForm, workSection] = await Promise.all([
  readFile(new URL("../app/teacher/submissions/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("./user-management-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/teacher/submissions/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("./teacher-operations-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/student/submissions/[id]/comments/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/CloudSubmissionCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/SubmissionInteractions.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/messages/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/teacher/submissions/IdentityLabelForm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/teacher/submissions/WorkRecordsSection.tsx", import.meta.url), "utf8"),
]);

test("user management searches nickname or email and includes users before membership or work", () => {
  assert.match(page, /displayName.*includes\(needle\).*email.*includes\(needle\)/s);
  assert.match(data, /get_admin_users/);
  assert.match(data, /camps: \[\]/);
  assert.match(page, /尚未加入训练营/);
});

test("user management keeps RPC diagnostics server-side without showing a migration guess", () => {
  assert.match(data, /console\.error\("get_admin_users RPC failed"/);
  assert.match(data, /code: error\.code/);
  assert.match(data, /details: error\.details/);
  assert.doesNotMatch(page, /请确认身份标签 migration 已应用/);
  assert.match(page, /请检查服务端错误日志/);
});

test("user management switches between a full-width list and detail while preserving filters", () => {
  assert.match(page, /!selectedUser \? <>/);
  assert.doesNotMatch(page, /选择一位用户/);
  assert.match(page, /返回用户列表/);
  assert.match(page, /#user-\$\{selectedUser\.id\}/);
  assert.match(page, /id=\{`user-\$\{user\.id\}`\}/);
  assert.match(page, /camp: query\.camp, user: selectedUser\.id, workCamp: camp\.id/);
});

test("work records count courses across camps without loading media until requested", () => {
  assert.match(data, /getAdminUserAssignmentCount\(userId: string\)/);
  assert.match(data, /student_assignment_submissions"\)\.select\("course_id"\)\.eq\("user_id", userId\)/);
  assert.match(data, /student_submissions"\)\.select\("course_id"\)\.eq\("user_id", userId\)/);
  assert.match(data, /student_photo_submissions"\)\.select\("course_id"\)\.eq\("user_id", userId\)/);
  assert.match(data, /new Set\(/);
  assert.match(page, /selectedUser && selectedCampId && workExpanded/);
  assert.match(page, /query\.work === "1"/);
  assert.match(workSection, /作业记录 · 共/);
  assert.match(workSection, /正在加载…/);
  assert.match(workSection, /if \(pending\) return/);
  assert.match(workSection, /router\.refresh\(\)/);
});

test("identity label saves do not mutate system roles", () => {
  assert.match(actions, /set_user_identity_label/);
  assert.doesNotMatch(actions, /\.update\(|role\s*:/);
  assert.match(page, /标签不会改变权限/);
});

test("learning progress consistently filters members by student identity label", () => {
  assert.match(progress, /profiles\(display_name, identity_label, status\)/);
  assert.match(progress, /row\.profiles\?\.identity_label === "student"/);
  assert.doesNotMatch(progress, /profiles\?\.role === "student"/);
});

test("comments resolve current identity labels instead of historical author roles", () => {
  assert.match(comments, /getVisibleIdentityLabels/);
  assert.match(comments, /identityLabel: identityLabels\.get\(row\.user_id\)/);
});

test("student is an internal statistics value and is not shown beside names", () => {
  assert.match(labelForm, /无特殊标签（纳入学员统计）/);
  for (const source of [workCard, interactions, messages]) {
    assert.match(source, /identityLabel !== "student"/);
  }
});
