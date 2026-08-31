"use client";

/**
 * Lightweight, dependency-free toast helper.
 *
 * Renders a small floating notification in the bottom-right corner of the
 * screen. Used for non-blocking success/info/error feedback across the app
 * without pulling in an external toast library.
 */

type ToastVariant = "success" | "error" | "info";

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "background:#16a34a;color:#ffffff;",
  error: "background:#dc2626;color:#ffffff;",
  info: "background:#4f46e5;color:#ffffff;",
};

const containerId = "lunenix-toast-container";

function ensureContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
    document.body.appendChild(container);
  }
  return container;
}

export function toast(
  message: string,
  variant: ToastVariant = "success",
  durationMs = 3000
): void {
  const container = ensureContainer();
  if (!container) return;

  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText =
    VARIANT_STYLES[variant] +
    "padding:12px 16px;border-radius:8px;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.25);max-width:340px;opacity:0;transform:translateY(8px);transition:opacity .2s ease,transform .2s ease;pointer-events:auto;";
  container.appendChild(el);

  // Animate in.
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });

  // Animate out + remove.
  window.setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    window.setTimeout(() => {
      el.remove();
      if (container && container.childElementCount === 0) container.remove();
    }, 220);
  }, durationMs);
}
