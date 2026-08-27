import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../app/api/student/submissions/[id]/audio/route.ts", import.meta.url);
const cardUrl = new URL("../components/CloudSubmissionCard.tsx", import.meta.url);

test("audio GET returns a fresh signed resource without proxying the recording", async () => {
  const source = await readFile(routeUrl, "utf8");

  assert.match(source, /export async function GET/);
  assert.match(source, /from\("student_submissions"\)/);
  assert.match(source, /playback_storage_path/);
  assert.match(source, /transcode_status === "ready"/);
  assert.match(source, /playback_mime_type === "audio\/mp4"/);
  assert.match(source, /playbackReady \? submission\.playback_storage_path! : submission\.storage_path/);
  assert.match(source, /createSignedUrl/);
  assert.match(source, /NextResponse\.json\(\{[\s\S]*url:\s*signed\.signedUrl/);
  assert.match(source, /expiresIn:\s*STUDENT_RECORDING_SIGNED_URL_SECONDS/);
  assert.match(source, /cache-control",\s*"private, no-store"/i);
  assert.doesNotMatch(source, /fetch\(signed\.signedUrl/);
  assert.doesNotMatch(source, /arrayBuffer\(\)/);
  assert.doesNotMatch(source, /NextResponse\.redirect/);
});

test("cloud submission cards fetch a signed URL before assigning the audio source", async () => {
  const source = await readFile(cardUrl, "utf8");

  assert.match(source, /fetch\(submission\.audioUrl,\s*\{[\s\S]*cache:\s*"no-store"[\s\S]*signal:\s*controller\.signal/);
  assert.match(source, /setAudioUrl\(result\.url\)/);
  assert.match(source, /<audio[\s\S]*src=\{audioUrl \|\| undefined\}/);
  assert.match(source, /正在准备播放器/);
  assert.match(source, /setAudioError\(true\)/);
  assert.doesNotMatch(source, /\{audioUrl \? \(\s*<audio/);
  assert.doesNotMatch(source, /<audio[\s\S]*src=\{submission\.audioUrl\}/);
});
