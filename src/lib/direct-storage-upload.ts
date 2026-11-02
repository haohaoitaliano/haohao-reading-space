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
  failureLabel?: string;
};

function signedUploadErrorMessage(message: string, label: string) {
  if (/failed to fetch|network|load failed|connection/i.test(message)) {
    return `${label}上传时网络连接失败，请检查网络后直接重试。`;
  }
  if (/already exists|duplicate/i.test(message)) return `${label}的云端位置已被占用，请直接重试。`;
  if (/unauthorized|forbidden|jwt|token|signature/i.test(message)) return `${label}上传授权无效或已过期，请直接重试。`;
  if (/too large|exceeded|maximum|size/i.test(message)) return `${label}超过云端存储允许的大小，请检查文件后重试。`;
  return `${label}上传到云端失败，请保留当前材料并重试。`;
}

export async function uploadFileDirectly({ file, ticket, failureLabel = "视频" }: UploadOptions) {
  const supabase = createSupabaseBrowserClient();
  const fileMimeType = file.type.split(";", 1)[0]?.trim().toLowerCase();
  const uploadBody = fileMimeType === ticket.mimeType
    ? file
    : new Blob([file], { type: ticket.mimeType });
  const { error } = await supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, uploadBody, {
      cacheControl: "3600",
      contentType: ticket.mimeType,
      upsert: false,
    });
  if (error) {
    throw new Error(signedUploadErrorMessage(error.message, failureLabel));
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
