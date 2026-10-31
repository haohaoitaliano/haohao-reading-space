export const STUDENT_PHOTO_BUCKET = "student-homework-photos";
export const STUDENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const STUDENT_PHOTO_MAX_COUNT = 3;
export const STUDENT_PHOTO_SIGNED_URL_SECONDS = 60 * 60;

const mimeByExtension = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
} as const;

export type StudentPhotoMimeType = typeof mimeByExtension[keyof typeof mimeByExtension];

function fileExtension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

export function getStudentPhotoMimeType(file: Pick<File, "name" | "type">): StudentPhotoMimeType | null {
  if ((Object.values(mimeByExtension) as string[]).includes(file.type)) {
    return file.type as StudentPhotoMimeType;
  }
  return mimeByExtension[fileExtension(file.name) as keyof typeof mimeByExtension] ?? null;
}

export function getStudentPhotoExtension(file: Pick<File, "name" | "type">) {
  const mimeType = getStudentPhotoMimeType(file);
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "jpg";
}

export function validateStudentPhotoFile(file: Pick<File, "name" | "size" | "type">) {
  if (file.size <= 0) return `${file.name || "照片"}为空，请重新选择。`;
  if (file.size > STUDENT_PHOTO_MAX_BYTES) return `${file.name || "照片"}超过 5 MB。`;
  if (!getStudentPhotoMimeType(file)) return `${file.name || "所选文件"}不是支持的 JPG、PNG 或 HEIC 照片。`;
  return null;
}

export function buildStudentPhotoPath(input: {
  campId: string;
  userId: string;
  courseId: string;
  submissionId: string;
  photoId: string;
  extension: string;
}) {
  return `${input.campId}/${input.userId}/${input.courseId}/${input.submissionId}/${input.photoId}.${input.extension}`;
}

export async function hasStudentPhotoSignature(file: Blob, mimeType: StudentPhotoMimeType) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= png.length && png.every((value, index) => bytes[index] === value);
  }
  if (bytes.length < 12) return false;
  const boxType = String.fromCharCode(...bytes.slice(4, 8));
  const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
  return boxType === "ftyp" && ["heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1"].includes(brand);
}
