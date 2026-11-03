export const PHOTO_COMPRESSION_TRIGGER_BYTES = 5 * 1024 * 1024;
export const PHOTO_COMPRESSION_TARGET_BYTES = 2 * 1024 * 1024;

const compressionSteps = [
  { maxEdge: 2560, quality: 0.92 },
  { maxEdge: 2300, quality: 0.9 },
  { maxEdge: 2048, quality: 0.88 },
  { maxEdge: 1800, quality: 0.86 },
] as const;

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("当前浏览器无法读取这张照片，请选择尺寸较小的 JPG 或 PNG 照片。"));
    image.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("照片压缩失败，请重新选择，或选择尺寸较小的照片。"));
    }, "image/jpeg", quality);
  });
}

export async function compressPhotoForUpload(file: File) {
  if (file.size <= PHOTO_COMPRESSION_TRIGGER_BYTES) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    let smallestBlob: Blob | null = null;

    for (const step of compressionSteps) {
      const scale = Math.min(1, step.maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("当前浏览器无法压缩照片，请选择尺寸较小的照片。");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToJpeg(canvas, step.quality);
      if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
      if (blob.size <= PHOTO_COMPRESSION_TARGET_BYTES) {
        return new File([blob], "photo-compressed.jpg", { type: "image/jpeg", lastModified: file.lastModified });
      }
    }

    if (smallestBlob && smallestBlob.size <= PHOTO_COMPRESSION_TRIGGER_BYTES) {
      return new File([smallestBlob], "photo-compressed.jpg", { type: "image/jpeg", lastModified: file.lastModified });
    }
    throw new Error("照片压缩后仍超过 5 MB，请选择尺寸较小或画面更简单的照片。");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
