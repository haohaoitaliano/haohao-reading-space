"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatFileSize } from "@/lib/audio-file";
import { ImagePreviewDialog, type PreviewImage } from "./MediaPreviewDialog";

type GalleryPhoto = {
  id: string;
  fileName: string;
  sizeBytes: number;
  position: number;
  signedUrl: string;
  downloadUrl: string;
};

export function PhotoGallery({ photos, ownerName }: { photos: GalleryPhoto[]; ownerName: string }) {
  const router = useRouter();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewImages: PreviewImage[] = photos.map((photo) => ({
    id: photo.id,
    src: photo.signedUrl,
    downloadUrl: photo.downloadUrl,
    fileName: photo.fileName,
    alt: `${ownerName}的作业照片 ${photo.position}`,
  }));

  return (
    <>
      <div className="photo-grid">
        {photos.map((photo, index) => (
          <figure key={photo.id}>
            <button
              aria-label={`预览 ${photo.fileName}`}
              className="photo-preview-trigger"
              onClick={() => setPreviewIndex(index)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`${ownerName}的作业照片 ${photo.position}`} src={photo.signedUrl} />
            </button>
            <figcaption>
              <span>{photo.fileName} · {formatFileSize(photo.sizeBytes)}</span>
              <a aria-label={`下载 ${photo.fileName}`} download={photo.fileName} href={photo.downloadUrl}>
                <Download size={15} />
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
      {previewIndex !== null ? (
        <ImagePreviewDialog
          images={previewImages}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onRefresh={() => { setPreviewIndex(null); router.refresh(); }}
        />
      ) : null}
    </>
  );
}
