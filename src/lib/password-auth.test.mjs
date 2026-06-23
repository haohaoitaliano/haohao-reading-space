import assert from "node:assert/strict";
import test from "node:test";
import { validateLoginFields, validateRegistrationFields } from "./password-auth.ts";

test("login requires an email and password", () => {
  assert.equal(validateLoginFields("", "secret12"), "请输入你的邮箱");
  assert.equal(validateLoginFields("reader@example.com", ""), "请输入密码");
  assert.equal(validateLoginFields("reader@example.com", "secret12"), null);
});

test("registration requires a name and a password of at least six characters", () => {
  assert.equal(
    validateRegistrationFields("", "reader@example.com", "secret12", "secret12", "LETTURA01"),
    "请输入你的昵称",
  );
  assert.equal(
    validateRegistrationFields("好好", "reader@example.com", "12345", "12345", "LETTURA01"),
    "密码至少需要 6 个字符",
  );
});

test("registration requires matching passwords", () => {
  assert.equal(
    validateRegistrationFields("好好", "reader@example.com", "secret12", "different", "LETTURA01"),
    "两次输入的密码不一致",
  );
  assert.equal(
    validateRegistrationFields("好好", "reader@example.com", "secret12", "secret12", "LETTURA01"),
    null,
  );
});

test("registration requires the temporary camp invitation code", () => {
  assert.equal(
    validateRegistrationFields("好好", "reader@example.com", "secret12", "secret12", ""),
    "请输入训练营邀请码",
  );
  assert.equal(
    validateRegistrationFields("好好", "reader@example.com", "secret12", "secret12", "WRONG"),
    "邀请码不正确，请重新输入",
  );
  assert.equal(
    validateRegistrationFields("好好", "reader@example.com", "secret12", "secret12", "LETTURA01"),
    null,
  );
});
