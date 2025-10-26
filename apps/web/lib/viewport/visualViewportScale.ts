export const VISUAL_VIEWPORT_SCALE_VAR = "--vv-scale";
export const VISUAL_VIEWPORT_SCALE_EVENT = "vv_scale_change";

const SCALE_EPSILON = 0.001;

export interface VisualViewportScaleChangeDetail {
  readonly scale: number;
  readonly previousScale: number;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function readVisualViewportScale(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  const viewport = window.visualViewport;
  if (!viewport) {
    return 1;
  }

  const scale = viewport.scale;
  if (isFinitePositive(scale)) {
    return scale;
  }

  const innerHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const visualHeight = isFinitePositive(viewport.height) ? viewport.height : 0;
  if (visualHeight > 0 && innerHeight > 0) {
    const fallback = innerHeight / visualHeight;
    if (isFinitePositive(fallback)) {
      return fallback;
    }
  }

  return 1;
}

function formatScale(scale: number): string {
  return `${scale}`;
}

function dispatchScaleChange(scale: number, previousScale: number): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<VisualViewportScaleChangeDetail>(VISUAL_VIEWPORT_SCALE_EVENT, {
      detail: { scale, previousScale },
    }),
  );
}

export default function installVisualViewportScale(
  varName: string = VISUAL_VIEWPORT_SCALE_VAR,
): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const updateCssVar = (scale: number) => {
    document.documentElement.style.setProperty(varName, formatScale(scale));
  };

  let lastScale = readVisualViewportScale();
  updateCssVar(lastScale);
  dispatchScaleChange(lastScale, lastScale);

  const handleChange = () => {
    const nextScale = readVisualViewportScale();
    if (!isFinitePositive(nextScale)) {
      return;
    }

    if (Math.abs(nextScale - lastScale) <= SCALE_EPSILON) {
      return;
    }

    const previous = lastScale;
    lastScale = nextScale;
    updateCssVar(nextScale);
    dispatchScaleChange(nextScale, previous);
  };

  const visualViewport = window.visualViewport;

  if (visualViewport && typeof visualViewport.addEventListener === "function") {
    visualViewport.addEventListener("resize", handleChange);
    visualViewport.addEventListener("scroll", handleChange);
  }

  window.addEventListener("resize", handleChange, { passive: true });
  window.addEventListener("orientationchange", handleChange, { passive: true });

  return () => {
    if (visualViewport && typeof visualViewport.removeEventListener === "function") {
      visualViewport.removeEventListener("resize", handleChange);
      visualViewport.removeEventListener("scroll", handleChange);
    }
    window.removeEventListener("resize", handleChange);
    window.removeEventListener("orientationchange", handleChange);
  };
}

const ROOT_MARGIN_TOKEN = /^(-?\d*(?:\.\d+)?)(px|%)$/i;

function normalizeZero(value: number): number {
  return Math.abs(value) < 1e-8 ? 0 : value;
}

function formatNumber(value: number): string {
  const normalized = normalizeZero(value);
  const rounded = Number(normalized.toFixed(4));
  return `${normalizeZero(rounded)}`;
}

export function scaleRootMargin(rootMargin: string | undefined, scale: number): string | undefined {
  if (!rootMargin) {
    return rootMargin;
  }
  if (!isFinitePositive(scale) || Math.abs(scale - 1) <= SCALE_EPSILON) {
    return rootMargin;
  }

  const tokens = rootMargin.trim().split(/\s+/);
  if (tokens.length === 0) {
    return rootMargin;
  }

  const scaledTokens = tokens.map((token) => {
    const match = token.match(ROOT_MARGIN_TOKEN);
    if (!match) {
      return token;
    }
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value) || value === 0) {
      return `0${match[2]}`;
    }
    const scaled = value / scale;
    return `${formatNumber(scaled)}${match[2]}`;
  });

  return scaledTokens.join(" ");
}
