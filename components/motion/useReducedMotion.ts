import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

let mediaQueryList: MediaQueryList | null = null;
let matchMediaSource: typeof window.matchMedia | null = null;

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    if (typeof window.matchMedia !== "function") {
      return null;
    }

    if (mediaQueryList && matchMediaSource === window.matchMedia) {
      return mediaQueryList;
    }

    matchMediaSource = window.matchMedia;
    mediaQueryList = matchMediaSource(REDUCED_MOTION_QUERY);
    return mediaQueryList;
  } catch {
    mediaQueryList = null;
    matchMediaSource = null;
    return null;
  }
}

function getSnapshot(): boolean {
  const mediaQueryList = getMediaQueryList();
  return mediaQueryList?.matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(listener: () => void): () => void {
  const mediaQueryList = getMediaQueryList();
  if (!mediaQueryList) {
    return () => {};
  }

  const handleChange = () => {
    listener();
  };

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", handleChange);
    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }

  if (typeof mediaQueryList.addListener === "function") {
    mediaQueryList.addListener(handleChange);
    return () => {
      mediaQueryList.removeListener(handleChange);
    };
  }

  return () => {};
}

export function useReducedMotion(): { isReducedMotion: boolean } {
  const isReducedMotion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { isReducedMotion };
}
