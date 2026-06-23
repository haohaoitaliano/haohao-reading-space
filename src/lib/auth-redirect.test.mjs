import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMagicLinkRedirect,
  getSafePostLoginPath,
} from "./auth-redirect.ts";

test("builds the localhost callback URL and preserves a safe next path", () => {
  assert.equal(
    buildMagicLinkRedirect("http://localhost:3001", null),
    "http://localhost:3001/auth/callback",
  );
  assert.equal(
    buildMagicLinkRedirect("http://localhost:3001", "/circle?day=4"),
    "http://localhost:3001/auth/callback?next=%2Fcircle%3Fday%3D4",
  );
});

test("rejects external, malformed, and authentication-loop next paths", () => {
  for (const unsafePath of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/login",
    "/auth/callback",
  ]) {
    assert.equal(getSafePostLoginPath(unsafePath, "admin"), null);
  }
});

test("does not let a student use next to enter a teacher route", () => {
  assert.equal(getSafePostLoginPath("/teacher", "student"), null);
  assert.equal(getSafePostLoginPath("/teacher/courses", "student"), null);
  assert.equal(getSafePostLoginPath("/teacher", "admin"), "/teacher");
  assert.equal(getSafePostLoginPath("/courses/giorno-4", "student"), "/courses/giorno-4");
});
