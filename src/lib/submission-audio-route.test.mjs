import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../app/api/student/submissions/[id]/audio/route.ts", import.meta.url);

test("audio GET streams a fresh signed resource without exposing its URL", async () => {
  const source = await readFile(routeUrl, "utf8");

  assert.match(source, /export async function GET/);
  assert.match(source, /from\("student_submissions"\)/);
  assert.match(source, /createSignedUrl/);
  assert.match(source, /fetch\(signed\.signedUrl/);
  assert.match(source, /cache:\s*"no-store"/);
  assert.match(source, /upstream\.arrayBuffer\(\)/);
  assert.match(source, /Content-Length/);
  assert.match(source, /cache-control",\s*"private, no-store"/i);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*signedUrl/s);
});
