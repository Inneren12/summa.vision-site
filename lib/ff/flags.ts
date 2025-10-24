// Реестр флагов: source-of-truth для типов, дефолтов и описаний
import { type RolloutConfig, type VariantConfig } from "./shared";

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
  uiExperiment: {
    type: "variant",
    defaultValue: {
      enabled: true,
      variants: { control: 50, treatment: 50 },
      salt: "uiExperiment",
      defaultVariant: "control",
    } as VariantConfig,
    description: "UI experiment (control vs treatment)",
    owner: "team-design",
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
  variant: VariantConfig;
};

export type RawValueFor<N extends FlagName> = KindMap[FlagKind<N>];
export type EffectiveValueFor<N extends FlagName> =
  FlagKind<N> extends "rollout"
    ? boolean
    : FlagKind<N> extends "boolean"
      ? boolean
      : FlagKind<N> extends "string"
        ? string
        : FlagKind<N> extends "variant"
          ? string
          : number;

export type EffectiveFlags = { [K in FlagName]: EffectiveValueFor<K> };

export function isKnownFlag(name: string): name is FlagName {
  return Object.prototype.hasOwnProperty.call(FLAG_REGISTRY, name);
}

export function knownFlags(): FlagName[] {
  return Object.keys(FLAG_REGISTRY) as FlagName[];
}
