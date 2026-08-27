import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configUrl = new URL("../../next.config.ts", import.meta.url);

test("local phone previews can explicitly allow their LAN origin", async () => {
  const source = await readFile(configUrl, "utf8");

  assert.match(source, /NEXT_ALLOWED_DEV_ORIGINS/);
  assert.match(source, /allowedDevOrigins:/);
  assert.doesNotMatch(source, /allowedDevOrigins:\s*\[\s*["']\*["']/);
});
