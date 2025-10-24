import { FLAG_REGISTRY, type FlagName } from "./flags";

export const BOOLEAN_NAMES = Object.keys(FLAG_REGISTRY).filter(
  (n) => FLAG_REGISTRY[n as FlagName].type === "boolean",
) as FlagName[];
export const STRING_NAMES = Object.keys(FLAG_REGISTRY).filter(
  (n) => FLAG_REGISTRY[n as FlagName].type === "string",
) as FlagName[];
export const NUMBER_NAMES = Object.keys(FLAG_REGISTRY).filter(
  (n) => FLAG_REGISTRY[n as FlagName].type === "number",
) as FlagName[];
export const ROLLOUT_NAMES = Object.keys(FLAG_REGISTRY).filter(
  (n) => FLAG_REGISTRY[n as FlagName].type === "rollout",
) as FlagName[];
export const VARIANT_NAMES = Object.keys(FLAG_REGISTRY).filter(
  (n) => FLAG_REGISTRY[n as FlagName].type === "variant",
) as FlagName[];

type RolloutDefaults = { enabled: boolean; percent?: number; salt: string };

type RolloutDefaultValue =
  | {
      enabled?: boolean;
      percent?: number;
      salt?: string;
    }
  | undefined;

export const ROLLOUT_DEFAULTS: Record<FlagName, RolloutDefaults> = Object.fromEntries(
  ROLLOUT_NAMES.map((name) => {
    const definition = FLAG_REGISTRY[name];
    const def = definition.defaultValue as RolloutDefaultValue;
    const enabled = !!def?.enabled;
    const percent = typeof def?.percent === "number" ? def.percent : undefined;
    const salt = typeof def?.salt === "string" ? def.salt : name;
    return [name, { enabled, percent, salt }];
  }),
) as Record<FlagName, RolloutDefaults>;
