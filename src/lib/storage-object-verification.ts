import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ExpectedObject = {
  size: number;
  mimeType: string;
};

export type VerifiedStorageObject = {
  firstBytes: ArrayBuffer;
  size: number;
  mimeType: string;
};

function normalizedMimeType(value: string | null) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export async function verifyStorageObject(
  supabase: ServerSupabaseClient,
  bucket: string,
  path: string,
  expected: ExpectedObject,
): Promise<{ object?: VerifiedStorageObject; error?: string }> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return { error: "找不到刚上传的文件，请重新上传。" };

  let response: Response;
  try {
    response = await fetch(data.signedUrl, {
      cache: "no-store",
      headers: { Range: "bytes=0-15" },
    });
  } catch {
    return { error: "暂时无法核对云端文件，请稍后重试。" };
  }
  if (response.status !== 206) {
    await response.body?.cancel();
    return { error: "云端文件校验失败，请重新上传。" };
  }

  const totalMatch = response.headers.get("content-range")?.match(/\/(\d+)$/);
  const actualSize = totalMatch ? Number(totalMatch[1]) : Number.NaN;
  const actualMimeType = normalizedMimeType(response.headers.get("content-type"));
  const expectedMimeType = normalizedMimeType(expected.mimeType);
  if (!Number.isSafeInteger(actualSize) || actualSize !== expected.size) {
    await response.body?.cancel();
    return { error: "云端文件大小与所选文件不一致，请重新上传。" };
  }
  if (actualMimeType !== expectedMimeType) {
    await response.body?.cancel();
    return { error: "云端文件格式与所选文件不一致，请重新上传。" };
  }

  return {
    object: {
      firstBytes: await response.arrayBuffer(),
      size: actualSize,
      mimeType: actualMimeType,
    },
  };
}
