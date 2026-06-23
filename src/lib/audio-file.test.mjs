import assert from "node:assert/strict";
import test from "node:test";
import { formatFileSize, isSupportedAudioFile } from "./audio-file.ts";

test("accepts MP3, M4A, and WAV filenames", () => {
  assert.equal(isSupportedAudioFile("lezione.mp3"), true);
  assert.equal(isSupportedAudioFile("lezione.M4A"), true);
  assert.equal(isSupportedAudioFile("lezione.wav"), true);
});

test("rejects unsupported audio filenames", () => {
  assert.equal(isSupportedAudioFile("lezione.aac"), false);
  assert.equal(isSupportedAudioFile("lezione.pdf"), false);
});

test("formats file sizes for display", () => {
  assert.equal(formatFileSize(850), "850 B");
  assert.equal(formatFileSize(1536), "1.5 KB");
  assert.equal(formatFileSize(2_621_440), "2.5 MB");
});
