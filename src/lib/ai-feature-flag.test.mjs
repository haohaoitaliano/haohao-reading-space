import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ENABLE_AI_FEEDBACK } from "./features.ts";

test("AI feedback is disabled for the public beta", () => {
  assert.equal(ENABLE_AI_FEEDBACK, false);
});

test("student AI feedback links are gated by the feature flag", async () => {
  const myWork = await readFile(new URL("../app/my-work/page.tsx", import.meta.url), "utf8");
  const circleDetail = await readFile(new URL("../app/circle/[id]/page.tsx", import.meta.url), "utf8");
  const recorder = await readFile(new URL("../components/BrowserRecorder.tsx", import.meta.url), "utf8");

  assert.match(myWork, /ENABLE_AI_FEEDBACK/);
  assert.match(circleDetail, /ENABLE_AI_FEEDBACK/);
  assert.match(recorder, /ENABLE_AI_FEEDBACK/);
  assert.match(recorder, /if \(ENABLE_AI_FEEDBACK\) \{[\s\S]*router\.push\(`\/ai-feedback/);
});
