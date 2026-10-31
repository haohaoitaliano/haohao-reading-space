import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "submission-comment-media";
const TARGET_MIME_TYPE = "audio/mp4";
const PROCESSING_STALE_MS = 15 * 60 * 1000;
const apply = process.argv.includes("--apply");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const targetCommentId = readArgument("--comment-id") || process.env.TRANSCODE_COMMENT_ID || null;

if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

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
    child.once("close", (code) => code === 0 ? resolve(stderr) : reject(new Error(`${command} exited with ${code}: ${stderr.slice(-2000)}`)));
  });
}

function isStale(row) {
  return row.audio_transcode_status === "processing"
    && Date.now() - Date.parse(row.created_at) >= PROCESSING_STALE_MS;
}

async function listCandidates() {
  let query = supabase.from("submission_comments")
    .select("id, audio_storage_path, audio_mime_type, audio_duration_seconds, audio_transcode_status, created_at")
    .in("audio_mime_type", ["audio/webm", "audio/ogg"])
    .in("audio_transcode_status", ["pending", "failed", "processing"])
    .order("created_at", { ascending: true }).limit(25);
  if (targetCommentId) query = query.eq("id", targetCommentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).filter((row) => row.audio_transcode_status !== "processing" || isStale(row));
}

async function claim(row) {
  let query = supabase.from("submission_comments")
    .update({ audio_transcode_status: "processing" })
    .eq("id", row.id).eq("audio_storage_path", row.audio_storage_path);
  query = row.audio_transcode_status === "processing"
    ? query.eq("audio_transcode_status", "processing")
    : query.in("audio_transcode_status", ["pending", "failed"]);
  const { data, error } = await query.select("id, audio_storage_path, audio_duration_seconds").maybeSingle();
  if (error) throw error;
  return data;
}

async function convert(row, tempRoot) {
  const inputPath = join(tempRoot, `${row.id}.source`);
  const outputPath = join(tempRoot, `${row.id}.m4a`);
  const playbackPath = `${dirname(row.audio_storage_path)}/playback-aac-lc-v1.m4a`;
  try {
    const { data: source, error: downloadError } = await supabase.storage.from(BUCKET).download(row.audio_storage_path);
    if (downloadError || !source) throw downloadError ?? new Error("source download failed");
    await writeFile(inputPath, Buffer.from(await source.arrayBuffer()));
    await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath, "-vn", "-c:a", "aac", "-profile:a", "aac_low", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", outputPath]);
    const bytes = await readFile(outputPath);
    const file = await stat(outputPath);
    if (file.size <= 0 || bytes.subarray(4, 8).toString("ascii") !== "ftyp") throw new Error("invalid M4A output");
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(playbackPath, bytes, { contentType: TARGET_MIME_TYPE, upsert: true });
    if (uploadError) throw uploadError;
    const { data: updated, error: updateError } = await supabase.from("submission_comments").update({
      audio_playback_storage_path: playbackPath,
      audio_playback_mime_type: TARGET_MIME_TYPE,
      audio_playback_size_bytes: file.size,
      audio_transcode_status: "ready",
    }).eq("id", row.id).eq("audio_storage_path", row.audio_storage_path).eq("audio_transcode_status", "processing").select("id").maybeSingle();
    if (updateError || !updated) throw updateError ?? new Error("comment changed during transcode");
  } catch (error) {
    await supabase.from("submission_comments").update({
      audio_playback_storage_path: null,
      audio_playback_mime_type: null,
      audio_playback_size_bytes: null,
      audio_transcode_status: "failed",
    }).eq("id", row.id).eq("audio_transcode_status", "processing");
    throw error;
  } finally {
    await rm(inputPath, { force: true });
    await rm(outputPath, { force: true });
  }
}

const rows = await listCandidates();
if (!apply) {
  console.log(`Found ${rows.length} comment audio file(s) eligible for conversion.`);
  process.exit(0);
}
await run(ffmpeg, ["-version"]);
const tempRoot = await mkdtemp(join(tmpdir(), "haohao-comment-transcode-"));
let failed = 0;
try {
  for (const candidate of rows) {
    const row = await claim(candidate);
    if (!row) continue;
    try {
      await convert(row, tempRoot);
      console.log(`Ready comment audio ${row.id}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed comment audio ${row.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
if (failed) process.exitCode = 1;
