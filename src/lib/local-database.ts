export const LOCAL_DATABASE_NAME = "haohao-reading-space";
export const LOCAL_DATABASE_VERSION = 4;
export const COURSE_STORE_NAME = "courses";
export const SUBMISSION_STORE_NAME = "submissions";
export const LEGACY_AUDIO_STORE_NAME = "course-audio";

export function openLocalDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(COURSE_STORE_NAME)) {
        database.createObjectStore(COURSE_STORE_NAME, { keyPath: "courseId" });
      }
      if (!database.objectStoreNames.contains(SUBMISSION_STORE_NAME)) {
        const submissions = database.createObjectStore(SUBMISSION_STORE_NAME, {
          keyPath: "submissionId",
        });
        submissions.createIndex("courseId", "courseId", { unique: false });
        submissions.createIndex("studentNickname", "studentNickname", { unique: false });
        submissions.createIndex("createdAt", "createdAt", { unique: false });
        submissions.createIndex("studentId", "studentId", { unique: false });
      } else {
        const submissions = request.transaction?.objectStore(SUBMISSION_STORE_NAME);
        if (submissions && !submissions.indexNames.contains("studentId")) {
          submissions.createIndex("studentId", "studentId", { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked"));
  });
}

export function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted"));
  });
}
