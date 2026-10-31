import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerUrl = new URL("../../scripts/transcode-student-recordings.mjs", import.meta.url);
const workflowUrl = new URL("../../.github/workflows/transcode-student-recording.yml", import.meta.url);
const dispatchUrl = new URL("./student-transcode-dispatch.ts", import.meta.url);
const uploadRouteUrl = new URL("../app/api/student/courses/[id]/submissions/route.ts", import.meta.url);
const commentWorkerUrl = new URL("../../scripts/transcode-comment-audio.mjs", import.meta.url);
const commentDispatchUrl = new URL("./submission-comment-transcode-dispatch.ts", import.meta.url);
const commentRouteUrl = new URL("../app/api/student/submissions/[id]/comments/route.ts", import.meta.url);

test("transcode worker claims retryable rows and never replaces the original object", async () => {
  const source = await readFile(workerUrl, "utf8");

  assert.match(source, /transcode_status === "pending"/);
  assert.match(source, /transcode_status === "failed"/);
  assert.match(source, /PROCESSING_STALE_MS/);
  assert.match(source, /\.in\("transcode_status", \["pending", "failed"\]\)/);
  assert.match(source, /transcode_status:\s*"processing"/);
  assert.match(source, /transcode_status:\s*"ready"/);
  assert.match(source, /transcode_status:\s*"failed"/);
  assert.match(source, /playback-aac-lc-v1\.m4a/);
  assert.match(source, /"-profile:a", "aac_low"/);
  assert.match(source, /"-ac", "1"/);
  assert.match(source, /"-movflags", "\+faststart"/);
  assert.match(source, /upload\(playbackPath, output, \{ contentType: TARGET_MIME_TYPE, upsert: true \}\)/);
  assert.doesNotMatch(source, /remove\(\[row\.storage_path\]\)/);
});

test("GitHub workflow uses secrets, immediate dispatch, and scheduled recovery", async () => {
  const [workflow, dispatch, uploadRoute] = await Promise.all([
    readFile(workflowUrl, "utf8"),
    readFile(dispatchUrl, "utf8"),
    readFile(uploadRouteUrl, "utf8"),
  ]);

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "\*\/10 \* \* \* \*"/);
  assert.match(workflow, /SUPABASE_URL: \$\{\{ secrets\.SUPABASE_URL \}\}/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/);
  assert.match(workflow, /Ensure FFmpeg is available[\s\S]*timeout-minutes: 4/);
  assert.match(workflow, /DEBIAN_FRONTEND=noninteractive timeout 90s/);
  assert.match(workflow, /Acquire::Retries=3/);
  assert.match(workflow, /--no-install-recommends ffmpeg/);
  assert.doesNotMatch(workflow, /eyJ[a-zA-Z0-9_-]{20,}/);
  assert.match(dispatch, /process\.env\.GITHUB_TRANSCODE_TOKEN/);
  assert.match(dispatch, /actions\/workflows\/\$\{WORKFLOW_FILE\}\/dispatches/);
  assert.doesNotMatch(dispatch, /console\.(?:log|error)/);
  assert.match(uploadRoute, /await dispatchStudentRecordingTranscode\(submission\.id\)/);
  assert.match(uploadRoute, /return NextResponse\.json\(\{[\s\S]*success: true/);
});

test("comment audio reuses the proven recording workflow and recovery schedule", async () => {
  const [workflow, worker, dispatch, route] = await Promise.all([
    readFile(workflowUrl, "utf8"),
    readFile(commentWorkerUrl, "utf8"),
    readFile(commentDispatchUrl, "utf8"),
    readFile(commentRouteUrl, "utf8"),
  ]);

  assert.match(workflow, /comment_id:/);
  assert.match(workflow, /TRANSCODE_COMMENT_ID: \$\{\{ inputs\.comment_id \|\| '' \}\}/);
  assert.match(workflow, /Ensure FFmpeg is available[\s\S]*DEBIAN_FRONTEND=noninteractive timeout 90s/);
  assert.match(workflow, /pnpm comments:transcode -- --apply/);
  assert.match(worker, /audio_transcode_status", \["pending", "failed", "processing"\]/);
  assert.match(worker, /audio_transcode_status:\s*"ready"/);
  assert.match(worker, /playback-aac-lc-v1\.m4a/);
  assert.match(dispatch, /const WORKFLOW_FILE = "transcode-student-recording\.yml"/);
  assert.match(dispatch, /inputs: \{ comment_id: commentId \}/);
  assert.match(route, /dispatchSubmissionCommentTranscode\(data\.id\)/);
});
