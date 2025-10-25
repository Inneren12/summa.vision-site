"use client";
import React from "react";

import { useFlags } from "../FlagsProvider";

import { shouldRenderFlag } from "./flag-evaluate";

import { type EffectiveValueFor, type FlagName } from "@/lib/ff/flags";
import type { FlagKey } from "@/types/flags";

type KeyName = FlagKey & FlagName;

type SsrSnapshot = {
  shouldRender: boolean;
};

type Props<N extends KeyName = KeyName> = {
  name: N;
  equals?: EffectiveValueFor<N>;
  fallback?: React.ReactNode;
  /**
   * UI-заглушка на время гидратации/инициализации клиентских путей.
   * Если не задан, используется `fallback`.
   */
  skeleton?: React.ReactNode;
  children: React.ReactNode;
  /** Внутреннее поле: значение, рассчитанное на сервере. */
  ssr?: SsrSnapshot;
};

export default function FlagGate<N extends KeyName>({
  name,
  equals,
  fallback = null,
  skeleton,
  children,
  ssr,
}: Props<N>) {
  const flags = useFlags();
  const key = name as FlagName;
  const value = flags[key];
  const shouldRender = shouldRenderFlag({
    key,
    value: value as EffectiveValueFor<N> | undefined,
    equals,
  });

  const hasSsrSnapshot = Boolean(ssr);
  const [isReady, setIsReady] = React.useState(hasSsrSnapshot);

  React.useEffect(() => {
    if (!hasSsrSnapshot) {
      if (typeof requestAnimationFrame === "function") {
        const frame = requestAnimationFrame(() => {
          setIsReady(true);
        });
        return () => {
          if (typeof cancelAnimationFrame === "function") {
            cancelAnimationFrame(frame);
          }
        };
      }
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hasSsrSnapshot]);

  React.useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      hasSsrSnapshot &&
      ssr!.shouldRender !== shouldRender
    ) {
      // eslint-disable-next-line no-console -- дев-алерт по условию
      console.warn(
        `[flags] <FlagGate name="${key}"> hydration mismatch: SSR=${ssr!.shouldRender ? "render" : "skip"} vs CSR=${shouldRender ? "render" : "skip"}.`,
      );
    }
  }, [hasSsrSnapshot, key, shouldRender, ssr]);

  if (!isReady) {
    return <>{skeleton ?? fallback ?? null}</>;
  }

  return <>{shouldRender ? children : fallback}</>;
}
