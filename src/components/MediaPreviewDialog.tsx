"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export type PreviewImage = {
  id: string;
  src: string;
  downloadUrl: string;
  fileName: string;
  alt: string;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function usePreviewDialog(onClose: () => void) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [onClose]);

  return closeButtonRef;
}

export function ImagePreviewDialog({
  images,
  initialIndex,
  onClose,
  onRefresh,
}: {
  images: PreviewImage[];
  initialIndex: number;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const closeButtonRef = usePreviewDialog(onClose);
  const [index, setIndex] = useState(() => clamp(initialIndex, 0, Math.max(0, images.length - 1)));
  const [scale, setScale] = useState(1);
  const [translation, setTranslation] = useState({ x: 0, y: 0 });
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; scale: number; midpoint: { x: number; y: number } } | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const image = images[index];

  function resetView(nextIndex = index) {
    setIndex(nextIndex);
    setScale(1);
    setTranslation({ x: 0, y: 0 });
    setImageState("loading");
    pointersRef.current.clear();
    pinchRef.current = null;
    dragRef.current = null;
  }

  function moveBy(offset: number) {
    resetView((index + offset + images.length) % images.length);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (images.length < 2) return;
      if (event.key === "ArrowLeft") moveBy(-1);
      if (event.key === "ArrowRight") moveBy(1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // The active index is intentionally included so keyboard navigation always uses the current photo.
  }, [images.length, index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!image) return null;

  function pointerDistance(points: Array<{ x: number; y: number }>) {
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function pointerMidpoint(points: Array<{ x: number; y: number }>) {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length === 2) {
      const midpoint = pointerMidpoint(points);
      pinchRef.current = { distance: pointerDistance(points), scale, midpoint };
      dragRef.current = null;
    } else if (points.length === 1) {
      dragRef.current = points[0];
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length === 2 && pinchRef.current) {
      const midpoint = pointerMidpoint(points);
      const nextScale = clamp(
        pinchRef.current.scale * (pointerDistance(points) / Math.max(1, pinchRef.current.distance)),
        1,
        5,
      );
      setScale(nextScale);
      setTranslation((current) => ({
        x: current.x + midpoint.x - pinchRef.current!.midpoint.x,
        y: current.y + midpoint.y - pinchRef.current!.midpoint.y,
      }));
      pinchRef.current.midpoint = midpoint;
    } else if (points.length === 1 && dragRef.current && scale > 1) {
      const point = points[0];
      setTranslation((current) => ({
        x: current.x + point.x - dragRef.current!.x,
        y: current.y + point.y - dragRef.current!.y,
      }));
      dragRef.current = point;
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    const remaining = [...pointersRef.current.values()];
    dragRef.current = remaining[0] ?? null;
    if (scale <= 1) setTranslation({ x: 0, y: 0 });
  }

  function updateScale(nextScale: number) {
    const value = clamp(nextScale, 1, 5);
    setScale(value);
    if (value === 1) setTranslation({ x: 0, y: 0 });
  }

  return (
    <div
      aria-label="照片预览"
      aria-modal="true"
      className="media-preview-backdrop image-preview-backdrop"
      onClick={(event) => { if (event.currentTarget === event.target) onClose(); }}
      role="dialog"
    >
      <header className="media-preview-header">
        <div className="media-preview-title">
          <strong>{image.fileName}</strong>
          {images.length > 1 ? <span>{index + 1} / {images.length}</span> : null}
        </div>
        <div className="media-preview-actions">
          <a className="media-preview-icon-button" download={image.fileName} href={image.downloadUrl}>
            <Download size={20} /><span className="media-preview-action-label">下载原图</span>
          </a>
          <button aria-label="关闭照片预览" className="media-preview-close" onClick={onClose} ref={closeButtonRef} type="button">
            <X size={24} />
          </button>
        </div>
      </header>

      <div
        className="image-preview-stage"
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      >
        {imageState === "loading" ? <p className="media-preview-status"><LoaderCircle className="spinning" size={24} />正在加载照片…</p> : null}
        {imageState === "error" ? (
          <div className="media-preview-error" role="alert">
            <strong>照片暂时无法预览</strong>
            <p>文件链接可能已过期，或当前网络无法读取。你仍可以尝试下载原图。</p>
            <div className="pdf-error-actions">
              {onRefresh ? <button className="button secondary" onClick={onRefresh} type="button"><RefreshCw size={17} />重新获取文件</button> : null}
              <a className="button ghost" download={image.fileName} href={image.downloadUrl}><Download size={17} />下载原图</a>
            </div>
          </div>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={image.alt}
          className={imageState === "ready" ? "is-ready" : ""}
          draggable={false}
          onError={() => setImageState("error")}
          onLoad={() => setImageState("ready")}
          src={image.src}
          style={{ transform: `translate3d(${translation.x}px, ${translation.y}px, 0) scale(${scale})` }}
        />
      </div>

      {images.length > 1 ? (
        <>
          <button aria-label="上一张照片" className="image-preview-nav previous" onClick={() => moveBy(-1)} type="button"><ChevronLeft size={28} /></button>
          <button aria-label="下一张照片" className="image-preview-nav next" onClick={() => moveBy(1)} type="button"><ChevronRight size={28} /></button>
        </>
      ) : null}
      <div className="image-preview-zoom" aria-label="照片缩放工具">
        <button aria-label="缩小照片" disabled={scale <= 1} onClick={() => updateScale(scale - 0.5)} type="button"><Minus size={19} /></button>
        <span>{Math.round(scale * 100)}%</span>
        <button aria-label="放大照片" disabled={scale >= 5} onClick={() => updateScale(scale + 0.5)} type="button"><Plus size={19} /></button>
        <button aria-label="重置照片缩放" disabled={scale === 1 && translation.x === 0 && translation.y === 0} onClick={() => updateScale(1)} type="button"><RotateCcw size={18} /></button>
      </div>
    </div>
  );
}

function PdfPageCanvas({ document, pageNumber, zoom }: {
  document: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === "undefined" ? 360 : window.innerWidth);

  useEffect(() => {
    function handleResize() { setViewportWidth(window.innerWidth); }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let stopped = false;
    let renderTask: RenderTask | undefined;
    void Promise.resolve().then(() => {
      if (!stopped) setState("loading");
      return document.getPage(pageNumber);
    }).then((page) => {
      if (stopped || !canvasRef.current) return;
      const naturalViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(280, Math.min(viewportWidth, 1100) - 32);
      const fitScale = Math.min(1.5, availableWidth / naturalViewport.width);
      const viewport = page.getViewport({ scale: fitScale * zoom });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({
        canvasContext: context,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        viewport,
      });
      return renderTask.promise;
    }).then(() => {
      if (!stopped) setState("ready");
    }).catch((error: unknown) => {
      if (!stopped && !(error instanceof Error && error.name === "RenderingCancelledException")) setState("error");
    });

    return () => {
      stopped = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, viewportWidth, zoom]);

  return (
    <section aria-label={`第 ${pageNumber} 页`} className="pdf-preview-page">
      {state === "loading" ? <span className="pdf-page-loading"><LoaderCircle className="spinning" size={20} />第 {pageNumber} 页加载中…</span> : null}
      {state === "error" ? <p className="notice" role="alert">第 {pageNumber} 页暂时无法显示。</p> : null}
      <canvas aria-hidden={state !== "ready"} ref={canvasRef} />
      <small>第 {pageNumber} 页</small>
    </section>
  );
}

export function PdfPreviewDialog({
  fileName,
  signedUrl,
  downloadUrl,
  onClose,
  onRefresh,
}: {
  fileName: string;
  signedUrl: string;
  downloadUrl: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const closeButtonRef = usePreviewDialog(onClose);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let stopped = false;
    let loadedDocument: PDFDocumentProxy | null = null;
    void import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const loadingTask = pdfjs.getDocument({ url: signedUrl });
      loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (!stopped && total > 0) setProgress(Math.round((loaded / total) * 100));
      };
      return loadingTask.promise;
    }).then((pdfDocument) => {
      loadedDocument = pdfDocument;
      if (stopped) {
        void pdfDocument.destroy();
        return;
      }
      setDocument(pdfDocument);
      setState("ready");
    }).catch(() => {
      if (!stopped) setState("error");
    });

    return () => {
      stopped = true;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [retryKey, signedUrl]);

  return (
    <div aria-label={`PDF 预览：${fileName}`} aria-modal="true" className="media-preview-backdrop pdf-preview-backdrop" role="dialog">
      <div className="pdf-preview-panel">
        <header className="media-preview-header pdf-preview-header">
          <div className="media-preview-title"><FileText size={20} /><strong>{fileName}</strong>{document ? <span>{document.numPages} 页</span> : null}</div>
          <div className="media-preview-actions">
            <a className="media-preview-icon-button" download={fileName} href={downloadUrl}><Download size={20} /><span className="media-preview-action-label">下载</span></a>
            <button aria-label="关闭 PDF 预览" className="media-preview-close" onClick={onClose} ref={closeButtonRef} type="button"><X size={24} /></button>
          </div>
        </header>

        <div className="pdf-preview-toolbar" aria-label="PDF 缩放工具">
          <button aria-label="缩小 PDF" disabled={zoom <= 0.75} onClick={() => setZoom((value) => clamp(value - 0.25, 0.75, 2.5))} type="button"><Minus size={18} /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="放大 PDF" disabled={zoom >= 2.5} onClick={() => setZoom((value) => clamp(value + 0.25, 0.75, 2.5))} type="button"><Plus size={18} /></button>
          <button aria-label="重置 PDF 缩放" disabled={zoom === 1} onClick={() => setZoom(1)} type="button"><RotateCcw size={17} /></button>
        </div>

        <div className="pdf-preview-scroll">
          {state === "loading" ? (
            <p className="media-preview-status"><LoaderCircle className="spinning" size={24} />正在加载 PDF{progress === null ? "…" : ` · ${progress}%`}</p>
          ) : null}
          {state === "error" ? (
            <div className="media-preview-error" role="alert">
              <strong>PDF 暂时无法预览</strong>
              <p>文件链接可能已过期，或当前网络不支持读取。页面不会自动跳转。</p>
              <div className="pdf-error-actions">
                <button className="button secondary" onClick={() => {
                  setState("loading");
                  setProgress(null);
                  setDocument(null);
                  setRetryKey((value) => value + 1);
                }} type="button"><RefreshCw size={17} />重试预览</button>
                <button className="button ghost" onClick={onRefresh} type="button"><RefreshCw size={17} />重新获取文件</button>
                <a className="button ghost" download={fileName} href={downloadUrl}><Download size={17} />下载 PDF</a>
              </div>
            </div>
          ) : null}
          {state === "ready" && document ? Array.from({ length: document.numPages }, (_, index) => (
            <PdfPageCanvas document={document} key={index + 1} pageNumber={index + 1} zoom={zoom} />
          )) : null}
        </div>
      </div>
    </div>
  );
}
