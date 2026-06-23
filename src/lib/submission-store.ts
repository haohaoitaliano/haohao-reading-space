import {
  openLocalDatabase,
  requestResult,
  SUBMISSION_STORE_NAME,
  transactionComplete,
} from "./local-database.ts";
import type { Visibility } from "./mock-data";

export type LocalSubmission = {
  submissionId: string;
  courseId: string;
  studentId: string;
  studentNickname: string;
  audioBlob: Blob;
  mimeType: string;
  duration: number;
  visibility: Visibility;
  version: number;
  createdAt: number;
};

export type NewLocalSubmission = Omit<LocalSubmission, "submissionId" | "version" | "createdAt">;

type SubmissionVersion = Pick<LocalSubmission, "courseId" | "studentId" | "version">;

export function getNextSubmissionVersion(
  submissions: SubmissionVersion[],
  courseId: string,
  studentId: string,
) {
  const versions = submissions
    .filter((item) => item.courseId === courseId && item.studentId === studentId)
    .map((item) => item.version);
  return (versions.length ? Math.max(...versions) : 0) + 1;
}

export function createSubmissionRecord(
  input: NewLocalSubmission,
  version: number,
  createdAt = Date.now(),
  submissionId = `${input.courseId}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
): LocalSubmission {
  return { submissionId, ...input, version, createdAt };
}

export function isSubmissionVisibleInCircle(submission: Pick<LocalSubmission, "visibility">) {
  return submission.visibility === "public";
}

export async function getLocalSubmissions() {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction(SUBMISSION_STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult<LocalSubmission[]>(
      transaction.objectStore(SUBMISSION_STORE_NAME).getAll(),
    );
    await completion;
    return records.sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    database.close();
  }
}

export async function saveLocalSubmission(input: NewLocalSubmission) {
  const database = await openLocalDatabase();
  try {
    const readTransaction = database.transaction(SUBMISSION_STORE_NAME, "readonly");
    const readCompletion = transactionComplete(readTransaction);
    const existing = await requestResult<LocalSubmission[]>(
      readTransaction.objectStore(SUBMISSION_STORE_NAME).getAll(),
    );
    await readCompletion;

    const version = getNextSubmissionVersion(existing, input.courseId, input.studentId);
    const record = createSubmissionRecord(input, version);
    const writeTransaction = database.transaction(SUBMISSION_STORE_NAME, "readwrite");
    const writeCompletion = transactionComplete(writeTransaction);
    await requestResult(writeTransaction.objectStore(SUBMISSION_STORE_NAME).put(record));
    await writeCompletion;
    return record;
  } finally {
    database.close();
  }
}
