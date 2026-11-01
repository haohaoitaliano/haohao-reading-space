export const COURSE_PDF_BUCKET = "course-pdfs";
export const COURSE_PDF_MAX_BYTES = 20 * 1024 * 1024;
export const COURSE_PDF_SIGNED_URL_SECONDS = 60 * 60;

export function validateCoursePdfFile(file: Pick<File, "name" | "size" | "type">) {
  if (!Number.isFinite(file.size) || file.size <= 0) return "PDF 文件为空，请重新选择。";
  if (file.size > COURSE_PDF_MAX_BYTES) return "PDF 文件不能超过 20 MB。";
  const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
  if (file.type !== "application/pdf" && !(file.type === "" && hasPdfExtension)) {
    return "仅支持 PDF 文件。";
  }
  if (!hasPdfExtension) return "PDF 文件名必须以 .pdf 结尾。";
  return null;
}

export function buildCoursePdfPath(campId: string, courseId: string, pdfId: string) {
  return `${campId}/${courseId}/${pdfId}.pdf`;
}

export async function hasCoursePdfSignature(file: Blob) {
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return bytes.length === 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}
