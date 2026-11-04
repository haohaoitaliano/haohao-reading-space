import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "student-recordings";
const TARGET_MIME_TYPE = "audio/mp4";
const TARGET_BITRATE = "64k";
const PROCESSING_STALE_MS = 15 * 60 * 1000;
const DEFAULT_WATCH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 25;
const ROW_COLUMNS = [
  "id",
  "student_display_name",
  "storage_path",
  "mime_type",
  "size_bytes",
  "duration_seconds",
  "playback_storage_path",
  "playback_mime_type",
  "playback_size_bytes",
  "transcode_status",
  "updated_at",
].join(", ");

const apply = process.argv.includes("--apply");
const verifyOnly = process.argv.includes("--verify");
const watch = process.argv.includes("--watch");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const targetSubmissionId = readArgument("--submission-id") || process.env.TRANSCODE_SUBMISSION_ID || null;
const watchIntervalMs = Math.max(
  1_000,
  Number(process.env.TRANSCODE_WATCH_INTERVAL_MS) || DEFAULT_WATCH_INTERVAL_MS,
);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}
if (watch && !apply) throw new Error("--watch requires --apply");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || null : null;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`${command} exited with ${code}: ${stderr.slice(-2_000)}`));
    });
  });
}

async function assertFfmpegAvailable() {
  await run(ffmpeg, ["-version"]);
}

function parseDuration(stderr) {
  const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (match) return Number(match[1]) * 3_600 + Number(match[2]) * 60 + Number(match[3]);
  const decodedTimes = [...stderr.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  const decoded = decodedTimes.at(-1);
  if (!decoded) return null;
  return Number(decoded[1]) * 3_600 + Number(decoded[2]) * 60 + Number(decoded[3]);
}

async function transcodeAndVerify(inputPath, outputPath) {
  const sourceInspection = await run(ffmpeg, ["-hide_banner", "-i", inputPath, "-f", "null", "-"]);
  const sourceDuration = parseDuration(sourceInspection);
  if (sourceDuration === null || sourceDuration <= 0) {
    throw new Error("verification failed: source duration is unavailable");
  }

  await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
    "-vn", "-c:a", "aac", "-profile:a", "aac_low", "-b:a", TARGET_BITRATE,
    "-ac", "1", "-movflags", "+faststart", outputPath,
  ]);

  const inspection = await run(ffmpeg, ["-hide_banner", "-i", outputPath, "-f", "null", "-"]);
  if (!/Audio:\s*aac\s*\(LC\)/i.test(inspection)) {
    throw new Error("verification failed: output is not AAC-LC");
  }
  const actualDuration = parseDuration(inspection);
  if (actualDuration === null) throw new Error("verification failed: output duration is unavailable");
  const tolerance = Math.max(0.5, sourceDuration * 0.02);
  if (Math.abs(actualDuration - sourceDuration) > tolerance) {
    throw new Error(`verification failed: output duration ${actualDuration}s differs from source ${sourceDuration}s`);
  }
  const file = await stat(outputPath);
  if (file.size <= 0) throw new Error("verification failed: output is empty");
  const bytes = await readFile(outputPath);
  if (bytes.subarray(4, 8).toString("ascii") !== "ftyp") {
    throw new Error("verification failed: output is not an MP4/M4A file");
  }
  return { size: file.size, duration: actualDuration };
}

function isStaleProcessing(row) {
  return row.transcode_status === "processing"
    && Date.now() - Date.parse(row.updated_at) >= PROCESSING_STALE_MS;
}

function needsConversion(row) {
  return row.transcode_status === "pending"
    || row.transcode_status === "failed"
    || isStaleProcessing(row);
}

async function listWebmSubmissions({ includeReady = false } = {}) {
  let query = supabase
    .from("student_submissions")
    .select(ROW_COLUMNS)
    .in("mime_type", ["audio/webm", "audio/ogg"])
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH_SIZE);
  if (targetSubmissionId) query = query.eq("id", targetSubmissionId);
  if (!includeReady) query = query.in("transcode_status", ["pending", "failed", "processing"]);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function claimSubmission(row) {
  let query = supabase
    .from("student_submissions")
    .update({ transcode_status: "processing" })
    .eq("id", row.id)
    .eq("storage_path", row.storage_path);

  if (row.transcode_status === "processing") {
    if (!isStaleProcessing(row)) return null;
    query = query.eq("transcode_status", "processing").eq("updated_at", row.updated_at);
  } else {
    query = query.in("transcode_status", ["pending", "failed"]);
  }

  const { data, error } = await query.select(ROW_COLUMNS).maybeSingle();
  if (error) throw error;
  return data;
}

async function markFailed(row) {
  await supabase
    .from("student_submissions")
    .update({
      playback_storage_path: null,
      playback_mime_type: null,
      playback_size_bytes: null,
      transcode_status: "failed",
    })
    .eq("id", row.id)
    .eq("storage_path", row.storage_path)
    .eq("transcode_status", "processing");
}

async function convertSubmission(row, tempRoot) {
  const inputPath = join(tempRoot, `${row.id}.source`);
  const outputPath = join(tempRoot, `${row.id}.m4a`);
  const playbackPath = `${dirname(row.storage_path)}/playback-aac-lc-v1.m4a`;

  try {
    const { data: source, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(row.storage_path);
    if (downloadError || !source) throw downloadError ?? new Error("source download failed");
    await writeFile(inputPath, Buffer.from(await source.arrayBuffer()));
    const verified = await transcodeAndVerify(inputPath, outputPath);
    const output = await readFile(outputPath);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(playbackPath, output, { contentType: TARGET_MIME_TYPE, upsert: true });
    if (uploadError) throw uploadError;

    const { data: updated, error: updateError } = await supabase
      .from("student_submissions")
      .update({
        playback_storage_path: playbackPath,
        playback_mime_type: TARGET_MIME_TYPE,
        playback_size_bytes: verified.size,
        transcode_status: "ready",
      })
      .eq("id", row.id)
      .eq("storage_path", row.storage_path)
      .eq("transcode_status", "processing")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      await supabase.storage.from(BUCKET).remove([playbackPath]);
      throw new Error("submission changed while playback was being generated");
    }
    return verified;
  } catch (error) {
    await markFailed(row);
    throw error;
  } finally {
    await rm(inputPath, { force: true });
    await rm(outputPath, { force: true });
  }
}

async function verifyReadySubmissions() {
  const rows = await listWebmSubmissions({ includeReady: true });
  for (const row of rows) {
    if (
      row.transcode_status !== "ready"
      || row.playback_mime_type !== TARGET_MIME_TYPE
      || !row.playback_storage_path
      || !row.playback_size_bytes
    ) {
      throw new Error(`verification failed: ${row.id} does not have ready playback metadata`);
    }
    const [{ data: original, error: originalError }, { data: playback, error: playbackError }] = await Promise.all([
      supabase.storage.from(BUCKET).download(row.storage_path),
      supabase.storage.from(BUCKET).download(row.playback_storage_path),
    ]);
    if (originalError || !original) throw originalError ?? new Error(`missing original: ${row.id}`);
    if (playbackError || !playback) throw playbackError ?? new Error(`missing playback: ${row.id}`);
    const originalBytes = new Uint8Array(await original.arrayBuffer());
    const playbackBytes = new Uint8Array(await playback.arrayBuffer());
    if (originalBytes.byteLength !== Number(row.size_bytes)) {
      throw new Error(`verification failed: original size mismatch for ${row.id}`);
    }
    if (
      playbackBytes.byteLength !== Number(row.playback_size_bytes)
      || String.fromCharCode(...playbackBytes.slice(4, 8)) !== "ftyp"
    ) {
      throw new Error(`verification failed: playback object mismatch for ${row.id}`);
    }
    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.playback_storage_path, 60);
    if (signedError || !signed?.signedUrl) throw signedError ?? new Error(`unable to sign playback: ${row.id}`);
    const rangeResponse = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-1023" } });
    if (
      rangeResponse.status !== 206
      || rangeResponse.headers.get("content-type") !== TARGET_MIME_TYPE
      || !rangeResponse.headers.get("content-range")?.startsWith("bytes 0-1023/")
    ) {
      throw new Error(`verification failed: signed playback range response for ${row.id}`);
    }
  }
  console.log(`Verified ${rows.length} original/playback object pair(s).`);
}

async function processBatch() {
  const rows = (await listWebmSubmissions()).filter(needsConversion);
  if (!apply) {
    console.log(`Found ${rows.length} submission(s) eligible for playback conversion.`);
    return { converted: 0, failed: 0, eligible: rows.length };
  }
  if (rows.length === 0) return { converted: 0, failed: 0, eligible: 0 };

  const tempRoot = await mkdtemp(join(tmpdir(), "haohao-recording-transcode-"));
  let converted = 0;
  let failed = 0;
  try {
    for (const candidate of rows) {
      const row = await claimSubmission(candidate);
      if (!row) continue;
      try {
        const verified = await convertSubmission(row, tempRoot);
        converted += 1;
        console.log(`Ready submission ${row.id}: ${verified.duration.toFixed(2)}s, ${verified.size} bytes`);
      } catch (error) {
        failed += 1;
        console.error(`Failed submission ${row.id}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
  return { converted, failed, eligible: rows.length };
}

if (verifyOnly) {
  await verifyReadySubmissions();
  process.exit(0);
}

if (apply) await assertFfmpegAvailable();

if (watch) {
  console.log(`Watching for pending student recordings every ${watchIntervalMs}ms.`);
  while (true) {
    const result = await processBatch();
    if (result.converted || result.failed) {
      console.log(`Batch complete: ${result.converted} ready, ${result.failed} failed.`);
    }
    await new Promise((resolve) => setTimeout(resolve, watchIntervalMs));
  }
} else {
  const result = await processBatch();
  if (apply) console.log(`Completed: ${result.converted} ready, ${result.failed} failed. Original recordings were not modified.`);
  if (result.failed > 0) process.exitCode = 1;
}
