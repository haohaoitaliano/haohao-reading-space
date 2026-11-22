import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CIRCLE_PAGE_SIZE,
  selectCirclePageCandidates,
} from "./circle-feed.ts";

test("circle cursor pagination is stable for equal timestamps", () => {
  const candidates = Array.from({ length: 25 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    createdAt: index < 3 ? "2026-11-22T12:00:00.000Z" : `2026-11-22T11:${String(index).padStart(2, "0")}:00.000Z`,
    source: index % 2 ? "recording" : "assignment",
  }));
  const { page, hasMore } = selectCirclePageCandidates(candidates);

  assert.equal(CIRCLE_PAGE_SIZE, 20);
  assert.equal(page.length, 20);
  assert.equal(hasMore, true);
  assert.deepEqual(
    page.slice(0, 3).map((item) => item.id),
    [...candidates.slice(0, 3)].sort((left, right) => right.id.localeCompare(left.id)).map((item) => item.id),
  );
  assert.equal(new Set(page.map((item) => item.id)).size, page.length);
});

test("circle queries a bounded server page and keeps interaction batching", async () => {
  const [pageData, cloudData, photoData, route, feed] = await Promise.all([
    readFile(new URL("./circle-page-data.ts", import.meta.url), "utf8"),
    readFile(new URL("./cloud-submission-data.ts", import.meta.url), "utf8"),
    readFile(new URL("./photo-submission-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/student/circle/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/CircleFeed.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageData, /candidateLimit = CIRCLE_PAGE_SIZE \+ 1/);
  assert.match(pageData, /\.order\("created_at", \{ ascending: false \}\)[\s\S]*\.order\("id", \{ ascending: false \}\)[\s\S]*\.limit\(candidateLimit\)/);
  assert.match(pageData, /created_at\.lt\.\$\{cursor\.createdAt\}[\s\S]*id\.lt\.\$\{cursor\.id\}/);
  assert.match(pageData, /\.is\("assignment_submission_id", null\)/);
  assert.match(pageData, /getCampCircleSubmissions\(campId, currentUserId, pageIds\)/);
  assert.match(pageData, /getCampUnifiedAssignments\(campId, currentUserId, pageIds\)/);
  assert.match(cloudData, /INTERACTION_QUERY_BATCH_SIZE = 50/);
  assert.match(photoData, /COMMENT_QUERY_BATCH_SIZE = 50/);
  assert.match(route, /getActiveCampForUser\(auth\.profile\.id\)/);
  assert.match(feed, /new IntersectionObserver/);
  assert.match(feed, /appendUniqueCards/);
  assert.match(feed, /sessionStorage/);
});
