"use client";

import { DetailedError, Upload } from "tus-js-client";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type DirectUploadTicket = {
  bucket: string;
  path: string;
  token: string;
  mimeType: string;
};

type UploadOptions = {
  file: File | Blob;
  ticket: DirectUploadTicket;
  onProgress: (percentage: number) => void;
};

function getResumableEndpoint() {
  const projectUrl = new URL(getSupabaseConfig().url);
  if (projectUrl.hostname.endsWith(".supabase.co") && !projectUrl.hostname.endsWith(".storage.supabase.co")) {
    projectUrl.hostname = projectUrl.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  projectUrl.pathname = "/storage/v1/upload/resumable";
  projectUrl.search = "";
  projectUrl.hash = "";
  return projectUrl.toString();
}

function uploadErrorMessage(error: Error) {
  const status = error instanceof DetailedError ? error.originalResponse?.getStatus() : undefined;
  if (status === 401 || status === 403) return "上传授权已失效或当前账号没有权限，请重新点击上传。";
  if (status === 409) return "云端已存在同名文件，请保留当前材料并重新点击上传。";
  if (status === 413) return "文件超过 Supabase Storage 允许的大小，请联系管理员检查 bucket 和项目全局限制。";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "网络已断开，请恢复网络后重新上传。";
  return "连接云端存储失败，请保留当前材料并重新上传。";
}

export function uploadFileDirectly({ file, ticket, onProgress }: UploadOptions) {
  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: getResumableEndpoint(),
      headers: { "x-signature": ticket.token },
      metadata: {
        bucketName: ticket.bucket,
        objectName: ticket.path,
        contentType: ticket.mimeType,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress(bytesUploaded, bytesTotal) {
        const percentage = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
        onProgress(Math.min(100, Math.max(0, percentage)));
      },
      onError(error) {
        reject(new Error(uploadErrorMessage(error)));
      },
      onSuccess() {
        onProgress(100);
        resolve();
      },
    });

    void upload.findPreviousUploads().then((previousUploads) => {
      const previous = previousUploads.find((item) => item.uploadUrl);
      if (previous) upload.resumeFromPreviousUpload(previous);
      upload.start();
    }).catch(() => upload.start());
  });
}

export async function readJsonResponse<T>(response: Response, fallback: string) {
  let payload: T & { message?: string };
  try {
    payload = await response.json() as T & { message?: string };
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) throw new Error(payload.message || fallback);
  return payload;
}
