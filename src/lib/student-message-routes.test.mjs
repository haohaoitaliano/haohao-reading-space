import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataUrl = new URL("./student-message-data.ts", import.meta.url);
const readRouteUrl = new URL("../app/api/student/messages/[commentId]/read/route.ts", import.meta.url);
const messagesPageUrl = new URL("../app/messages/page.tsx", import.meta.url);
const progressPageUrl = new URL("../app/progress/page.tsx", import.meta.url);
const homePageUrl = new URL("../app/home/page.tsx", import.meta.url);
const circlePageUrl = new URL("../app/circle/page.tsx", import.meta.url);
const interactionsUrl = new URL("../components/SubmissionInteractions.tsx", import.meta.url);
const appFrameUrl = new URL("../components/AppFrame.tsx", import.meta.url);
const unreadUiUrl = new URL("../components/StudentMessageUnread.tsx", import.meta.url);

const [dataSource, readRouteSource, messagesPageSource, progressPageSource, homePageSource, circlePageSource, interactionsSource, appFrameSource, unreadUiSource] = await Promise.all([
  readFile(dataUrl, "utf8"),
  readFile(readRouteUrl, "utf8"),
  readFile(messagesPageUrl, "utf8"),
  readFile(progressPageUrl, "utf8"),
  readFile(homePageUrl, "utf8"),
  readFile(circlePageUrl, "utf8"),
  readFile(interactionsUrl, "utf8"),
  readFile(appFrameUrl, "utf8"),
  readFile(unreadUiUrl, "utf8"),
]);

test("message queries reuse the selected active camp and current authenticated user", () => {
  assert.match(dataSource, /getActiveCampForUser\(userId\)/);
  assert.match(dataSource, /\.eq\("camp_id", campResult\.camp\.id\)/);
  assert.match(dataSource, /buildStudentMessages/);
  assert.match(dataSource, /submission_comment_reads/);
});

test("messages are individually linked without a bulk-read action", () => {
  assert.match(messagesPageSource, /submission=.*comment=/);
  assert.match(messagesPageSource, /IDENTITY_LABEL_TEXT\[message\.identityLabel\]/);
  assert.doesNotMatch(messagesPageSource, /助教老师/);
  assert.match(messagesPageSource, /unreadCount/);
  assert.doesNotMatch(messagesPageSource, /全部标记|mark.*all/i);
  assert.match(unreadUiSource, /href="\/messages"/);
});

test("a message is marked read only after its comment loads and is focused", () => {
  assert.match(circlePageSource, /focusedCommentId/);
  assert.match(interactionsSource, /comments\.some\(\(comment\) => comment\.id === focusCommentId\)/);
  assert.match(interactionsSource, /document\.getElementById\(`comment-\$\{focusCommentId\}`\)/);
  assert.match(interactionsSource, /scrollIntoView/);
  assert.match(interactionsSource, /\/api\/student\/messages\/\$\{encodeURIComponent\(focusCommentId\)\}\/read/);
});

test("home shows one compact unread reminder without marking messages read", () => {
  assert.match(homePageSource, /getStudentMessages\(profile\.id\)/);
  assert.match(homePageSource, /some\(\(message\) => !message\.isRead && message\.isReplyOnOtherWork\)/);
  assert.match(homePageSource, /messageResult\.unreadCount/);
  assert.match(homePageSource, /href="\/messages"/);
  assert.match(homePageSource, /你的作业收到了/);
  assert.match(homePageSource, /你收到了/);
  assert.match(homePageSource, /快来看看，及时改进，别忘了回复哦！/);
  assert.doesNotMatch(homePageSource, /api\/student\/messages/);
  assert.doesNotMatch(homePageSource, /unreadMessages\.map|message-card is-unread/);
});

test("read writes are authenticated, active-camp derived, recipient checked, and idempotent", () => {
  assert.match(readRouteSource, /auth\.profile\.role !== "student"/);
  assert.match(readRouteSource, /getStudentMessages\(auth\.profile\.id\)/);
  assert.match(readRouteSource, /messages\.find\(\(item\) => item\.id === commentId\)/);
  assert.match(readRouteSource, /user_id: auth\.profile\.id/);
  assert.match(readRouteSource, /error\?\.code === "23505"/);
  assert.match(readRouteSource, /unreadCount/);
});

test("bottom navigation and the progress entry share one cached unread state", () => {
  assert.match(dataSource, /cache\(async \(userId: string\)/);
  assert.match(appFrameSource, /getStudentMessages\(auth\.profile\.id\)/);
  assert.match(appFrameSource, /StudentMessageUnreadProvider/);
  assert.match(appFrameSource, /item\.key === "progress" \? <StudentMessageNavDot/);
  assert.match(unreadUiSource, /unreadCount > 0 \? <span aria-label="有未读消息"/);
  assert.match(unreadUiSource, /message-entry-count/);
  assert.match(progressPageSource, /<StudentMessageEntry \/>/);
  assert.match(interactionsSource, /setUnreadCount\(result\.unreadCount\)/);
});
