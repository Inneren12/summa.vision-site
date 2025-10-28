import type { VizLibraryTag } from "./types";

let cachedWebGL2Support: boolean | null = null;
let cachedWebGLSupport: boolean | null = null;

function resolveDocument(): Document | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document;
}

function tryGetContext(canvas: HTMLCanvasElement, type: string): RenderingContext | null {
  try {
    return canvas.getContext(type as never);
  } catch {
    return null;
  }
}

function evaluateContext(type: string): boolean {
  const doc = resolveDocument();
  if (!doc) {
    return false;
  }

  const canvas = doc.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  try {
    const context = tryGetContext(canvas, type);
    return context !== null;
  } finally {
    if (typeof canvas.remove === "function") {
      canvas.remove();
    }
  }
}

export const supportsWebGL2 = (): boolean => {
  if (cachedWebGL2Support !== null) {
    return cachedWebGL2Support;
  }

  cachedWebGL2Support = evaluateContext("webgl2");
  return cachedWebGL2Support;
};

export const supportsWebGL = (): boolean => {
  if (cachedWebGLSupport !== null) {
    return cachedWebGLSupport;
  }

  if (supportsWebGL2()) {
    cachedWebGLSupport = true;
    return true;
  }

  const doc = resolveDocument();
  if (!doc) {
    cachedWebGLSupport = false;
    return false;
  }

  const canvas = doc.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  try {
    const context = tryGetContext(canvas, "webgl") || tryGetContext(canvas, "experimental-webgl");
    cachedWebGLSupport = context !== null;
    return cachedWebGLSupport;
  } finally {
    if (typeof canvas.remove === "function") {
      canvas.remove();
    }
  }
};

export interface WebglFallbackOptions {
  readonly lib: VizLibraryTag;
  readonly title?: string;
  readonly message: string;
  readonly note?: string;
}

function resolveOwnerDocument(target: HTMLElement): Document | null {
  return target.ownerDocument ?? resolveDocument();
}

export function renderWebglFallback(
  target: HTMLElement,
  options: WebglFallbackOptions,
): () => void {
  const doc = resolveOwnerDocument(target);
  if (!doc) {
    return () => {};
  }

  while (target.firstChild) {
    target.removeChild(target.firstChild);
  }

  target.setAttribute("data-viz-fallback", "webgl");
  target.setAttribute("data-viz-fallback-lib", options.lib);

  const wrapper = doc.createElement("div");
  wrapper.className = "viz-compat-fallback";
  wrapper.dataset.vizFallback = "webgl";
  wrapper.dataset.vizFallbackLib = options.lib;
  wrapper.setAttribute("role", "group");
  wrapper.setAttribute("aria-label", options.title ?? "Режим совместимости");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.gap = "0.75rem";
  wrapper.style.width = "100%";
  wrapper.style.height = "100%";
  wrapper.style.minHeight = "220px";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.padding = "1.5rem";
  wrapper.style.borderRadius = "0.75rem";
  wrapper.style.border = "1px solid rgba(148, 163, 184, 0.35)";
  wrapper.style.background =
    "linear-gradient(135deg, rgba(15, 23, 42, 0.04), rgba(148, 163, 184, 0.08))";
  wrapper.style.color = "rgba(15, 23, 42, 0.78)";
  wrapper.style.textAlign = "center";
  wrapper.style.fontSize = "0.9375rem";
  wrapper.style.lineHeight = "1.5";

  const placeholder = doc.createElement("div");
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.style.width = "min(260px, 90%)";
  placeholder.style.aspectRatio = "4 / 3";
  placeholder.style.borderRadius = "0.5rem";
  placeholder.style.background =
    "repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.25) 0, rgba(148, 163, 184, 0.25) 12px, rgba(148, 163, 184, 0.1) 12px, rgba(148, 163, 184, 0.1) 24px)";

  const title = doc.createElement("p");
  title.textContent = options.title ?? "Режим совместимости";
  title.style.margin = "0";
  title.style.fontWeight = "600";
  title.style.fontSize = "1rem";

  const message = doc.createElement("p");
  message.textContent = options.message;
  message.style.margin = "0";
  message.style.maxWidth = "36ch";

  const note = doc.createElement("p");
  note.textContent = options.note ?? "Интерактивная визуализация требует поддержки WebGL.";
  note.style.margin = "0";
  note.style.maxWidth = "40ch";
  note.style.fontSize = "0.875rem";
  note.style.color = "rgba(15, 23, 42, 0.62)";

  wrapper.appendChild(placeholder);
  wrapper.appendChild(title);
  wrapper.appendChild(message);
  wrapper.appendChild(note);

  target.appendChild(wrapper);

  return () => {
    if (wrapper.parentNode === target) {
      target.removeChild(wrapper);
    }
    if (!target.childNodes.length) {
      target.removeAttribute("data-viz-fallback");
      target.removeAttribute("data-viz-fallback-lib");
    }
  };
}
