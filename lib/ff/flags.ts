// Реестр флагов: source-of-truth для типов, дефолтов и описаний
import { type RolloutConfig } from "./shared";

export const FLAG_REGISTRY = {
  newCheckout: {
    type: "rollout",
    defaultValue: { enabled: false } as RolloutConfig,
    description: "Enable new checkout flow",
    owner: "team-payments",
  },
  betaUI: {
    type: "boolean",
    defaultValue: false,
    description: "Enable beta design system",
    owner: "team-design",
  },
  bannerText: {
    type: "string",
    defaultValue: "",
    description: "Homepage banner text",
    owner: "team-marketing",
  },
  maxItems: {
    type: "number",
    defaultValue: 10,
    description: "Max items per page",
    owner: "team-web",
  },
  // Защищённый rollout-флаг (для тестов и политики ignoreOverrides)
  protectedRollout: {
    type: "rollout",
    defaultValue: { enabled: true, percent: 100 } as RolloutConfig,
    description: "Security-sensitive rollout",
    owner: "sec",
    ignoreOverrides: true,
  },
} as const;

export type FlagName = keyof typeof FLAG_REGISTRY;
export type FlagKind<N extends FlagName> = (typeof FLAG_REGISTRY)[N]["type"];

type KindMap = {
  boolean: boolean;
  string: string;
  number: number;
  rollout: RolloutConfig;
};

export type RawValueFor<N extends FlagName> = KindMap[FlagKind<N>];
export type EffectiveValueFor<N extends FlagName> =
  FlagKind<N> extends "rollout"
    ? boolean
    : FlagKind<N> extends "boolean"
      ? boolean
      : FlagKind<N> extends "string"
        ? string
        : number;

export type EffectiveFlags = { [K in FlagName]: EffectiveValueFor<K> };

export function isKnownFlag(name: string): name is FlagName {
  return Object.prototype.hasOwnProperty.call(FLAG_REGISTRY, name);
}

export function knownFlags(): FlagName[] {
  return Object.keys(FLAG_REGISTRY) as FlagName[];
}
