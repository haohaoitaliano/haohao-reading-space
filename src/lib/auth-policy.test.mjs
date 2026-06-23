import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessTeacherRoutes,
  getAuthenticatedRouteRedirect,
  getPostLoginPath,
  getProfileDisplayName,
  requiresCampMembership,
  getCampMembershipRedirect,
} from "./auth-policy.ts";

test("sends students home and admins to the teacher dashboard", () => {
  assert.equal(getPostLoginPath("student"), "/home");
  assert.equal(getPostLoginPath("admin"), "/teacher");
});

test("student content routes require an active camp membership", () => {
  for (const path of ["/home", "/courses", "/courses/giorno-4", "/circle", "/my-work", "/my-submissions"]) {
    assert.equal(requiresCampMembership(path), true);
  }
  assert.equal(requiresCampMembership("/join-camp"), false);
  assert.equal(requiresCampMembership("/profile"), false);
});

test("students without a camp are redirected while admins are unaffected", () => {
  const student = { role: "student", status: "active" };
  const admin = { role: "admin", status: "active" };

  assert.equal(getCampMembershipRedirect("/home", student, false), "/join-camp");
  assert.equal(getCampMembershipRedirect("/home", student, true), null);
  assert.equal(getCampMembershipRedirect("/teacher", admin, false), null);
  assert.equal(getCampMembershipRedirect("/join-camp", student, true), "/home");
});

test("only an active admin can access teacher routes", () => {
  assert.equal(canAccessTeacherRoutes({ role: "admin", status: "active" }), true);
  assert.equal(canAccessTeacherRoutes({ role: "student", status: "active" }), false);
  assert.equal(canAccessTeacherRoutes({ role: "admin", status: "disabled" }), false);
});

test("uses the profile display name without falling back to local storage", () => {
  assert.equal(getProfileDisplayName({ display_name: " 好好 " }, "reader@example.com"), "好好");
  assert.equal(getProfileDisplayName({ display_name: "" }, "reader@example.com"), "reader");
  assert.equal(getProfileDisplayName(null, null), "同学");
});

test("route decisions protect teacher pages without redirecting the forbidden page to itself", () => {
  const student = { role: "student", status: "active" };
  const disabledAdmin = { role: "admin", status: "disabled" };

  assert.equal(getAuthenticatedRouteRedirect("/teacher", student), "/forbidden");
  assert.equal(getAuthenticatedRouteRedirect("/home", student), null);
  assert.equal(getAuthenticatedRouteRedirect("/forbidden", disabledAdmin), null);
  assert.equal(getAuthenticatedRouteRedirect("/home", disabledAdmin), "/forbidden");
});
