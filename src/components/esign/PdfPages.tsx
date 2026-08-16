"use client";

/**
 * Renders a PDF (from a URL) to stacked canvases using pdfjs-dist and exposes,
 * for each page, an absolutely-positioned overlay layer sized exactly to the
 * rendered page. Field divs are placed on the overlay using normalized
 * coordinates (0..1). Shared by the field editor and the public signing page.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

export interface PageSize {
  width: number; // displayed CSS pixels
  height: number;
}

interface PdfPagesProps {
  fileUrl: string;
  maxWidth?: number;
  className?: string;
  /** Render overlay content for a given page (fields, drop targets, etc.). */
  renderOverlay?: (pageIndex: number, size: PageSize) => React.ReactNode;
  /** Click handler with normalized (0..1) coordinates within the page. */
  onPageClick?: (
    pageIndex: number,
    xNorm: number,
    yNorm: number,
    size: PageSize
  ) => void;
  onReady?: (sizes: PageSize[]) => void;
}

export function PdfPages({
  fileUrl,
  maxWidth = 820,
  className,
  renderOverlay,
  onPageClick,
  onReady,
}: PdfPagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        // Worker served from CDN matching the installed version.
        pdfjs.GlobalWorkerOptions.workerSrc =
          "https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

        const loadingTask = pdfjs.getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        const availableWidth = Math.min(
          container.clientWidth || maxWidth,
          maxWidth
        );
        const dpr = window.devicePixelRatio || 1;
        const newSizes: PageSize[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = availableWidth / base.width;
          const viewport = page.getViewport({ scale });

          const pageWrapper = document.createElement("div");
          pageWrapper.className = "esign-page";
          pageWrapper.style.position = "relative";
          pageWrapper.style.width = `${viewport.width}px`;
          pageWrapper.style.height = `${viewport.height}px`;
          pageWrapper.style.margin = "0 auto 20px auto";
          pageWrapper.style.boxShadow = "0 1px 8px rgba(0,0,0,0.15)";
          pageWrapper.setAttribute("data-page-index", String(i - 1));

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.style.display = "block";
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.scale(dpr, dpr);
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
          pageWrapper.appendChild(canvas);

          // Overlay mount point (React portal target via absolute div).
          const overlay = document.createElement("div");
          overlay.className = "esign-overlay";
          overlay.style.position = "absolute";
          overlay.style.inset = "0";
          overlay.setAttribute("data-overlay-index", String(i - 1));
          pageWrapper.appendChild(overlay);

          container.appendChild(pageWrapper);
          newSizes.push({ width: viewport.width, height: viewport.height });
        }

        if (!cancelled) {
          setSizes(newSizes);
          setLoading(false);
          onReadyRef.current?.(newSizes);
        }
      } catch (e) {
        console.error("PDF render error:", e);
        if (!cancelled) {
          setError("Could not load the document preview.");
          setLoading(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, maxWidth]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onPageClick) return;
      const target = e.target as HTMLElement;
      const pageEl = target.closest(".esign-page") as HTMLElement | null;
      if (!pageEl) return;
      const idx = Number(pageEl.getAttribute("data-page-index"));
      const rect = pageEl.getBoundingClientRect();
      const xNorm = (e.clientX - rect.left) / rect.width;
      const yNorm = (e.clientY - rect.top) / rect.height;
      onPageClick(idx, xNorm, yNorm, {
        width: rect.width,
        height: rect.height,
      });
    },
    [onPageClick]
  );

  return (
    <div className={className}>
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading document…
        </div>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <div ref={containerRef} onClick={handleClick} />
      {/* React-rendered overlays are positioned by the parent using `sizes`. */}
      {!loading &&
        !error &&
        renderOverlay &&
        sizes.map((size, idx) => (
          <PageOverlayPortal key={idx} pageIndex={idx}>
            {renderOverlay(idx, size)}
          </PageOverlayPortal>
        ))}
    </div>
  );
}

/**
 * Portals overlay content into the absolute overlay div created for each page.
 */
import { createPortal } from "react-dom";

function PageOverlayPortal({
  pageIndex,
  children,
}: {
  pageIndex: number;
  children: React.ReactNode;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.querySelector(
      `.esign-overlay[data-overlay-index="${pageIndex}"]`
    ) as HTMLElement | null;
    setTarget(el);
  }, [pageIndex]);
  if (!target) return null;
  return createPortal(children, target);
}
