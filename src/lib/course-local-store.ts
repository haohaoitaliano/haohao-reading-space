import type { Course } from "./mock-data";
import {
  COURSE_STORE_NAME,
  LEGACY_AUDIO_STORE_NAME,
  openLocalDatabase,
  requestResult,
  transactionComplete,
} from "./local-database.ts";

export const DEFAULT_REFLECTION_PROMPT_ZH =
  "读完这段文字后，你有什么感受或联想？可以说说哪一句话打动了你、你想到了什么，或者你学到了什么。";
export const DEFAULT_REFLECTION_PROMPT_IT =
  "Dopo la lettura, condividi una breve riflessione: quale frase ti ha colpito, che cosa ti è venuto in mente o che cosa hai imparato?";

export type LocalVocabularyItem = {
  word: string;
  meaningZh: string;
};

export type CourseAudioAsset = {
  name: string;
  type: string;
  size: number;
  blob: Blob;
  updatedAt: number;
};

export type LocalCourseData = {
  courseId: string;
  dayNumber: number;
  italianTitle: string;
  chineseTitle: string;
  description: string;
  readingText: string;
  vocabulary: LocalVocabularyItem[];
  reflectionPromptZh: string;
  reflectionPromptIt: string;
  unlockDate: string;
  updatedAt: number;
  audio: CourseAudioAsset | null;
};

type LegacyAudioRecord = CourseAudioAsset & {
  courseId: string;
};

export function createCourseAudioAsset(file: File, updatedAt = Date.now()): CourseAudioAsset {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    blob: file,
    updatedAt,
  };
}

export function createLocalCourseData(course: Course, updatedAt = 0): LocalCourseData {
  return {
    courseId: course.id,
    dayNumber: course.day,
    italianTitle: course.titleIt,
    chineseTitle: course.titleZh,
    description: course.intro,
    readingText: course.text,
    vocabulary: course.vocabulary.map((item) => ({ word: item.word, meaningZh: item.meaning })),
    reflectionPromptZh: DEFAULT_REFLECTION_PROMPT_ZH,
    reflectionPromptIt: DEFAULT_REFLECTION_PROMPT_IT,
    unlockDate: course.unlockDate,
    updatedAt,
    audio: null,
  };
}

async function readRecord<T>(database: IDBDatabase, storeName: string, key: string) {
  const transaction = database.transaction(storeName, "readonly");
  const completion = transactionComplete(transaction);
  const result = await requestResult<T | undefined>(transaction.objectStore(storeName).get(key));
  await completion;
  return result ?? null;
}

async function writeRecord(database: IDBDatabase, record: LocalCourseData) {
  const transaction = database.transaction(COURSE_STORE_NAME, "readwrite");
  const completion = transactionComplete(transaction);
  await requestResult(transaction.objectStore(COURSE_STORE_NAME).put(record));
  await completion;
}

async function deleteLegacyAudio(database: IDBDatabase, courseId: string) {
  if (!database.objectStoreNames.contains(LEGACY_AUDIO_STORE_NAME)) return;
  const transaction = database.transaction(LEGACY_AUDIO_STORE_NAME, "readwrite");
  const completion = transactionComplete(transaction);
  await requestResult(transaction.objectStore(LEGACY_AUDIO_STORE_NAME).delete(courseId));
  await completion;
}

export async function loadLocalCourse(defaultCourse: LocalCourseData) {
  const database = await openLocalDatabase();

  try {
    const savedCourse = await readRecord<LocalCourseData>(database, COURSE_STORE_NAME, defaultCourse.courseId);
    if (savedCourse) return savedCourse;

    if (!database.objectStoreNames.contains(LEGACY_AUDIO_STORE_NAME)) return null;
    const legacyAudio = await readRecord<LegacyAudioRecord>(
      database,
      LEGACY_AUDIO_STORE_NAME,
      defaultCourse.courseId,
    );
    if (!legacyAudio) return null;

    const migratedCourse: LocalCourseData = {
      ...defaultCourse,
      updatedAt: legacyAudio.updatedAt,
      audio: {
        name: legacyAudio.name,
        type: legacyAudio.type,
        size: legacyAudio.size,
        blob: legacyAudio.blob,
        updatedAt: legacyAudio.updatedAt,
      },
    };
    await writeRecord(database, migratedCourse);
    await deleteLegacyAudio(database, defaultCourse.courseId);
    return migratedCourse;
  } finally {
    database.close();
  }
}

export async function saveLocalCourse(course: LocalCourseData) {
  const database = await openLocalDatabase();

  try {
    await writeRecord(database, course);
  } finally {
    database.close();
  }
}
