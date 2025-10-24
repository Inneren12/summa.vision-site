import "server-only";

import { cookies } from "next/headers";

import { resolveEffectiveFlags } from "./effective.shared";
import { type EffectiveFlags } from "./flags";
import { getFeatureFlagsFromHeaders } from "./server";
import { stableId as buildStableId } from "./stable-id";

function buildCookieHeaderString(): string {
  // next/headers cookies() в Next14 синхронен; формируем header-подобную строку для реюза
  const ck = cookies();
  const all = ck.getAll();
  if (!all.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Вычисляет "эффективные" флаги (булево/строка/число) для SSR/RSC, учитывая percent/overrides. */
export async function getFlagsServer(opts?: { userId?: string }): Promise<EffectiveFlags> {
  const cookieHeader = buildCookieHeaderString();
  const merged = await getFeatureFlagsFromHeaders({ cookie: cookieHeader });
  const id = buildStableId(opts?.userId);
  return resolveEffectiveFlags(id, merged);
}
