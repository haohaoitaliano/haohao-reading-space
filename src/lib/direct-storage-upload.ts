"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type DirectUploadTicket = {
  bucket: string;
  path: string;
  token: string;
  mimeType: string;
};

type UploadOptions = {
  file: File | Blob;
  ticket: DirectUploadTicket;
};

function signedUploadErrorMessage(message: string) {
  if (/already exists|duplicate/i.test(message)) return "云端已存在同名文件，请重新选择文件后上传。";
  if (/unauthorized|forbidden|jwt|token|signature/i.test(message)) return "视频上传授权无效或已过期，请重新点击上传。";
  if (/too large|exceeded|maximum|size/i.test(message)) return "视频超过云端存储允许的大小，请联系管理员检查限制。";
  return "视频上传到云端失败，请保留当前文件并重试。";
}

export async function uploadFileDirectly({ file, ticket }: UploadOptions) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, file, {
      cacheControl: "3600",
      contentType: ticket.mimeType,
      upsert: false,
    });
  if (error) {
    throw new Error(signedUploadErrorMessage(error.message));
  }
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
