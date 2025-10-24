// Реестр флагов: source-of-truth для типов, дефолтов и описаний
import { type RolloutConfig, type VariantConfig } from "./shared";

type FlagType = "boolean" | "string" | "number" | "rollout" | "variant";

interface FlagMetadataBase<TType extends FlagType, TValue> {
  name: string;
  type: TType;
  defaultValue: TValue;
  description: string;
  deprecated?: boolean;
  sunsetDate?: string;
  owner?: string;
  /** Если true — cookie overrides для этого флага игнорируются (security/critical). */
  ignoreOverrides?: boolean;
  /** Значение флага может содержать чувствительные данные; экспозиции редактируются. */
  sensitive?: boolean;
}

export type FlagMetadata =
  | FlagMetadataBase<"boolean", boolean>
  | FlagMetadataBase<"string", string>
  | FlagMetadataBase<"number", number>
  | FlagMetadataBase<"rollout", RolloutConfig>
  | FlagMetadataBase<"variant", VariantConfig>;

export const FLAG_REGISTRY = {
  newCheckout: {
    name: "newCheckout",
    type: "rollout",
    defaultValue: { enabled: false } as RolloutConfig,
    description: "Enable new checkout flow",
    owner: "team-payments",
  },
  betaUI: {
    name: "betaUI",
    type: "boolean",
    defaultValue: false,
    description: "Enable beta design system",
    owner: "team-design",
  },
  bannerText: {
    name: "bannerText",
    type: "string",
    defaultValue: "",
    description: "Homepage banner text",
    owner: "team-marketing",
  },
  maxItems: {
    name: "maxItems",
    type: "number",
    defaultValue: 10,
    description: "Max items per page",
    owner: "team-web",
  },
  uiExperiment: {
    name: "uiExperiment",
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
    name: "protectedRollout",
    type: "rollout",
    defaultValue: { enabled: true, percent: 100 } as RolloutConfig,
    description: "Security-sensitive rollout",
    owner: "sec",
    ignoreOverrides: true,
  },
} as const satisfies Record<string, FlagMetadata>;

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
