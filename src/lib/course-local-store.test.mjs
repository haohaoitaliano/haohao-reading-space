import assert from "node:assert/strict";
import test from "node:test";
import { createCourseAudioAsset, createLocalCourseData } from "./course-local-store.ts";

const mockCourse = {
  id: "giorno-4",
  day: 4,
  titleIt: "Il profumo del pane",
  titleZh: "面包的香气",
  intro: "今日解锁说明",
  unlockDate: "2026-07-04",
  status: "today",
  audioTitle: "示范音频",
  duration: "02:18",
  text: "Testo italiano",
  vocabulary: [{ word: "pane", meaning: "面包" }],
};

test("creates the unified local course data shape", () => {
  const record = createLocalCourseData(mockCourse, 1_750_000_000_000);

  assert.equal(record.courseId, "giorno-4");
  assert.equal(record.dayNumber, 4);
  assert.equal(record.italianTitle, "Il profumo del pane");
  assert.equal(record.chineseTitle, "面包的香气");
  assert.equal(record.description, "今日解锁说明");
  assert.equal(record.readingText, "Testo italiano");
  assert.deepEqual(record.vocabulary, [{ word: "pane", meaningZh: "面包" }]);
  assert.equal(record.unlockDate, "2026-07-04");
  assert.equal(record.updatedAt, 1_750_000_000_000);
  assert.equal(record.audio, null);
});

test("creates an audio asset for the same course record", () => {
  const file = new File(["audio"], "giorno-4.wav", { type: "audio/wav" });
  const audio = createCourseAudioAsset(file, 1_750_000_000_001);

  assert.equal(audio.name, "giorno-4.wav");
  assert.equal(audio.type, "audio/wav");
  assert.equal(audio.size, file.size);
  assert.equal(audio.blob, file);
  assert.equal(audio.updatedAt, 1_750_000_000_001);
});
