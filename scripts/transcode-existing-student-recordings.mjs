import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "student-recordings";
const TARGET_MIME_TYPE = "audio/mp4";
const TARGET_BITRATE = "64k";
const apply = process.argv.includes("--apply");
const verifyOnly = process.argv.includes("--verify");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`${command} exited with ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

async function assertFfmpegAvailable() {
  await run(ffmpeg, ["-version"]);
}

function parseDuration(stderr) {
  const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

async function transcodeAndVerify(inputPath, outputPath, expectedDuration) {
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
  const tolerance = Math.max(1, Number(expectedDuration) * 0.02);
  if (Math.abs(actualDuration - Number(expectedDuration)) > tolerance) {
    throw new Error(`verification failed: duration ${actualDuration}s differs from ${expectedDuration}s`);
  }
  const file = await stat(outputPath);
  if (file.size <= 0) throw new Error("verification failed: output is empty");
  return { size: file.size, duration: actualDuration };
}

const { data: submissions, error: queryError } = await supabase
  .from("student_submissions")
  .select("id, student_display_name, storage_path, mime_type, size_bytes, duration_seconds, playback_storage_path, playback_mime_type, playback_size_bytes, transcode_status")
  .in("mime_type", ["audio/webm", "audio/ogg"])
  .order("created_at", { ascending: true });

if (queryError) throw queryError;
const pending = (submissions ?? []).filter((row) => row.transcode_status !== "ready");

console.log(`Found ${submissions?.length ?? 0} WebM/Ogg submission(s); ${pending.length} need playback conversion.`);
for (const row of submissions ?? []) {
  console.log(`- ${row.student_display_name}: ${row.id} [${row.transcode_status}]`);
}

if (verifyOnly) {
  for (const row of submissions ?? []) {
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
    const signature = String.fromCharCode(...playbackBytes.slice(4, 8));
    if (originalBytes.byteLength !== Number(row.size_bytes)) {
      throw new Error(`verification failed: original size mismatch for ${row.id}`);
    }
    if (playbackBytes.byteLength !== Number(row.playback_size_bytes) || signature !== "ftyp") {
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
    console.log(`Verified ${row.student_display_name}: original ${originalBytes.byteLength} bytes + M4A ${playbackBytes.byteLength} bytes`);
  }
  console.log(`Verified ${submissions?.length ?? 0} original/playback object pair(s).`);
  process.exit(0);
}

if (!apply) {
  console.log("Dry run only. Re-run with --apply to create verified M4A playback files.");
  process.exit(0);
}

await assertFfmpegAvailable();
const tempRoot = await mkdtemp(join(tmpdir(), "haohao-recording-transcode-"));
let converted = 0;

try {
  for (const row of pending) {
    const inputPath = join(tempRoot, `${row.id}.source`);
    const outputPath = join(tempRoot, `${row.id}.m4a`);
    const playbackPath = `${dirname(row.storage_path)}/playback-aac-lc-v1.m4a`;
    let uploaded = false;

    console.log(`Converting ${row.student_display_name}: ${row.id}`);
    const { error: processingError } = await supabase
      .from("student_submissions")
      .update({ transcode_status: "processing" })
      .eq("id", row.id);
    if (processingError) throw processingError;

    try {
      const { data: source, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(row.storage_path);
      if (downloadError || !source) throw downloadError ?? new Error("source download failed");
      await writeFile(inputPath, Buffer.from(await source.arrayBuffer()));
      const verified = await transcodeAndVerify(inputPath, outputPath, Number(row.duration_seconds));
      const output = await readFile(outputPath);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(playbackPath, output, { contentType: TARGET_MIME_TYPE, upsert: false });
      if (uploadError) throw uploadError;
      uploaded = true;

      const { error: updateError } = await supabase
        .from("student_submissions")
        .update({
          playback_storage_path: playbackPath,
          playback_mime_type: TARGET_MIME_TYPE,
          playback_size_bytes: verified.size,
          transcode_status: "ready",
        })
        .eq("id", row.id);
      if (updateError) throw updateError;
      converted += 1;
      console.log(`Ready ${row.student_display_name}: ${verified.duration.toFixed(2)}s, ${verified.size} bytes`);
    } catch (error) {
      if (uploaded) await supabase.storage.from(BUCKET).remove([playbackPath]);
      await supabase
        .from("student_submissions")
        .update({
          playback_storage_path: null,
          playback_mime_type: null,
          playback_size_bytes: null,
          transcode_status: "failed",
        })
        .eq("id", row.id);
      throw error;
    } finally {
      await rm(inputPath, { force: true });
      await rm(outputPath, { force: true });
    }
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log(`Completed ${converted} conversion(s). Original recordings were not modified.`);
