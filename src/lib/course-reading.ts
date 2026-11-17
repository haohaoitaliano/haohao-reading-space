export const COURSE_READING_IMAGE_BUCKET = "course-reading-images";
export const COURSE_READING_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const COURSE_READING_IMAGE_SIGNED_URL_SECONDS = 60 * 60;

export type ReadingTextBlock = { id: string; type: "text"; text: string };
export type ReadingImageBlock = { id: string; type: "image"; imageId: string };
export type ReadingContentBlock = ReadingTextBlock | ReadingImageBlock;

const mimeByExtension = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type CourseReadingImageMimeType = typeof mimeByExtension[keyof typeof mimeByExtension];

export function createReadingTextBlock(text = ""): ReadingTextBlock {
  return { id: crypto.randomUUID(), type: "text", text };
}

export function normalizeReadingBlocks(value: unknown, fallbackText = ""): ReadingContentBlock[] {
  if (!Array.isArray(value)) return fallbackText ? [createReadingTextBlock(fallbackText)] : [createReadingTextBlock()];
  const blocks = value.flatMap((block): ReadingContentBlock[] => {
    if (!block || typeof block !== "object") return [];
    const item = block as Record<string, unknown>;
    const id = typeof item.id === "string" && item.id ? item.id : crypto.randomUUID();
    if (item.type === "text" && typeof item.text === "string") return [{ id, type: "text", text: item.text }];
    if (item.type === "image" && typeof item.imageId === "string" && item.imageId) {
      return [{ id, type: "image", imageId: item.imageId }];
    }
    return [];
  });
  return blocks.length ? blocks : [createReadingTextBlock(fallbackText)];
}

export function readingBlocksPlainText(blocks: ReadingContentBlock[]) {
  return blocks.filter((block): block is ReadingTextBlock => block.type === "text").map((block) => block.text).join("\n\n");
}

export function getCourseReadingImageMimeType(file: Pick<File, "name" | "type">): CourseReadingImageMimeType | null {
  if ((Object.values(mimeByExtension) as string[]).includes(file.type)) return file.type as CourseReadingImageMimeType;
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  return mimeByExtension[extension as keyof typeof mimeByExtension] ?? null;
}

export function validateCourseReadingImage(file: Pick<File, "name" | "size" | "type">) {
  if (!Number.isFinite(file.size) || file.size <= 0) return "图片文件为空，请重新选择。";
  if (file.size > COURSE_READING_IMAGE_MAX_BYTES) return "图片不能超过 8 MB。";
  if (!getCourseReadingImageMimeType(file)) return "仅支持 JPG、PNG 或 WebP 图片。";
  return null;
}

export async function hasCourseReadingImageSignature(file: Blob, mimeType: CourseReadingImageMimeType) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export function courseReadingImageExtension(mimeType: CourseReadingImageMimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function buildCourseReadingImagePath(campId: string, courseId: string, imageId: string, extension: string) {
  return `${campId}/${courseId}/${imageId}.${extension}`;
}
