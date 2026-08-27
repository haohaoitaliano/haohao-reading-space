import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../app/api/student/submissions/[id]/audio/route.ts", import.meta.url);

test("audio GET redirects to a fresh signed resource without proxying the recording", async () => {
  const source = await readFile(routeUrl, "utf8");

  assert.match(source, /export async function GET/);
  assert.match(source, /from\("student_submissions"\)/);
  assert.match(source, /createSignedUrl/);
  assert.match(source, /NextResponse\.redirect\(signed\.signedUrl,\s*307\)/);
  assert.match(source, /cache-control",\s*"private, no-store"/i);
  assert.doesNotMatch(source, /fetch\(signed\.signedUrl/);
  assert.doesNotMatch(source, /arrayBuffer\(\)/);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*signedUrl/s);
});
