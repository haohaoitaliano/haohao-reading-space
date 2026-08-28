import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root layout pauses other audio when a new recording starts playing", async () => {
  const coordinator = await readFile(
    new URL("../components/AudioPlaybackCoordinator.tsx", import.meta.url),
    "utf8",
  );
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(coordinator, /document\.addEventListener\("play", pauseOtherAudio, true\)/);
  assert.match(coordinator, /document\.querySelectorAll\("audio"\)/);
  assert.match(coordinator, /audio !== current && !audio\.paused/);
  assert.match(coordinator, /audio\.pause\(\)/);
  assert.match(layout, /<AudioPlaybackCoordinator \/>/);
});
