import assert from "node:assert/strict";
import test from "node:test";
import { getMeetingConnectionError, getMeetingStatus, getMeetingStatusLabel, splitMeetingDescription } from "./meeting-details.ts";

test("meeting connection accepts a number, a valid HTTP link, or both", () => {
  assert.equal(getMeetingConnectionError("", "884 210 778"), null);
  assert.equal(getMeetingConnectionError("https://meeting.example.com/room", ""), null);
  assert.equal(getMeetingConnectionError("https://meeting.example.com/room", "884 210 778"), null);
});

test("meeting connection requires one option and validates links when present", () => {
  assert.equal(getMeetingConnectionError("", ""), "请填写会议链接或会议号。");
  assert.equal(getMeetingConnectionError("meeting.example.com", "884 210 778"), "请输入有效的会议链接。");
  assert.equal(getMeetingConnectionError("javascript:alert(1)", "884 210 778"), "请输入有效的会议链接。");
});

test("meeting descriptions preserve text and expose only complete HTTP links", () => {
  assert.deepEqual(splitMeetingDescription("回放：https://example.com/replay。\n请复习。"), [
    { type: "text", value: "回放：" },
    { type: "link", value: "https://example.com/replay" },
    { type: "text", value: "。" },
    { type: "text", value: "\n请复习。" },
  ]);
  assert.deepEqual(splitMeetingDescription("普通文字 <script>alert(1)</script>"), [
    { type: "text", value: "普通文字 <script>alert(1)</script>" },
  ]);
});

test("meeting status has only upcoming and ended states", () => {
  const start = "2026-11-11T14:00:00.000Z";
  assert.equal(getMeetingStatus(start, Date.parse("2026-11-11T13:59:59.999Z")), "upcoming");
  assert.equal(getMeetingStatus(start, Date.parse(start)), "ended");
  assert.equal(getMeetingStatusLabel("upcoming"), "未开始");
  assert.equal(getMeetingStatusLabel("ended"), "已结束");
});
