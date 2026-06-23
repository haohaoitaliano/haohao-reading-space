import assert from "node:assert/strict";
import test from "node:test";
import { getCampInviteMessage, isCampInviteSuccess, redeemCampInvite } from "./camp-invite.ts";

test("maps every invite result to a safe Chinese message", () => {
  assert.equal(getCampInviteMessage("invalid_invite"), "邀请码不存在");
  assert.equal(getCampInviteMessage("invite_expired"), "邀请码已过期");
  assert.equal(getCampInviteMessage("invite_inactive"), "邀请码已停用");
  assert.equal(getCampInviteMessage("invite_full"), "邀请码使用次数已满");
  assert.equal(getCampInviteMessage("camp_full"), "训练营已满");
  assert.equal(getCampInviteMessage("camp_inactive"), "训练营未开放");
  assert.equal(getCampInviteMessage("already_joined"), "你已经加入该训练营");
  assert.equal(getCampInviteMessage("database_error"), "网络或数据库错误，请稍后重试");
});

test("turns RPC and network failures into a safe database error", async () => {
  const rpcError = await redeemCampInvite({
    rpc: async () => ({ data: null, error: new Error("internal details") }),
  }, "CODE");
  assert.equal(rpcError.resultCode, "database_error");

  const networkError = await redeemCampInvite({
    rpc: async () => { throw new Error("network details"); },
  }, "CODE");
  assert.equal(networkError.resultCode, "database_error");
});

test("only joined and already_joined are successful redemption results", () => {
  assert.equal(isCampInviteSuccess("joined"), true);
  assert.equal(isCampInviteSuccess("already_joined"), true);
  assert.equal(isCampInviteSuccess("invalid_invite"), false);
});
