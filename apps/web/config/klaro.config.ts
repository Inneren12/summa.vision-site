export const CONSENT_SERVICES = ["analytics", "vitals", "share"] as const;

export type ConsentServiceName = (typeof CONSENT_SERVICES)[number];

export type KlaroConfig = {
  readonly version: number;
  readonly elementID?: string;
  readonly styling?: {
    readonly theme?: readonly string[];
  };
  readonly storageName?: string;
  readonly cookieExpiresAfterDays?: number;
  readonly lang?: string;
  readonly translations?: Record<string, unknown>;
  readonly default?: boolean;
  readonly mustConsent?: boolean;
  readonly privacyPolicy?: string;
  readonly services: ReadonlyArray<{
    readonly name: ConsentServiceName;
    readonly title: string;
    readonly purposes: readonly string[];
    readonly description?: string;
    readonly default?: boolean;
    readonly required?: boolean;
  }>;
};

const consentNoticeDescriptionRu =
  "Используем только согласованные события и сохраняем их в агрегированном виде.";
const consentNoticeDescriptionEn =
  "We only record aggregated events after you give explicit consent.";

export const klaroConfig: KlaroConfig = {
  version: 2,
  elementID: "klaro",
  styling: {
    theme: ["light", "topbar"],
  },
  storageName: "sv_klaro",
  cookieExpiresAfterDays: 180,
  default: false,
  mustConsent: false,
  lang: "ru",
  privacyPolicy: "/policies/privacy",
  translations: {
    ru: {
      consentModal: {
        title: "Настройки приватности",
        description:
          "Выберите, какие события можно отправлять. Мы не используем сторонние трекеры и храним данные обезличено.",
      },
      consentNotice: {
        description: consentNoticeDescriptionRu,
        learnMore: "Настроить",
      },
      privacyPolicy: {
        text: "Подробнее — в политике конфиденциальности",
      },
      ok: "Только необходимые",
      acceptSelected: "Принять выбранное",
      acceptAll: "Принять всё",
      purposes: {
        analytics: "Аналитика истории",
        performance: "Показатели качества",
        engagement: "Взаимодействия",
      },
      services: {
        analytics: {
          description:
            "Отслеживает просмотры историй и шагов, чтобы понимать, какие материалы востребованы.",
        },
        vitals: {
          description:
            "Отправляет агрегированные Web Vitals (LCP, CLS, INP) без персональных данных.",
        },
        share: {
          description: "Фиксирует клики по кнопке «Поделиться», чтобы оценивать вовлечённость.",
        },
      },
    },
    en: {
      consentModal: {
        title: "Privacy preferences",
        description:
          "Choose which events we may record. No third-party trackers are loaded and all data stays aggregated.",
      },
      consentNotice: {
        description: consentNoticeDescriptionEn,
        learnMore: "Customise",
      },
      privacyPolicy: {
        text: "Read more in the privacy policy",
      },
      ok: "Necessary only",
      acceptSelected: "Accept selection",
      acceptAll: "Accept all",
      purposes: {
        analytics: "Story analytics",
        performance: "Quality metrics",
        engagement: "Engagement",
      },
      services: {
        analytics: {
          description:
            "Tracks story and step views so we can improve the content that resonates the most.",
        },
        vitals: {
          description: "Sends aggregated Web Vitals (LCP, CLS, INP) without any personal data.",
        },
        share: {
          description: "Captures share button clicks to understand engagement levels.",
        },
      },
    },
  },
  services: [
    {
      name: "analytics",
      title: "Story analytics",
      purposes: ["analytics"],
      default: false,
    },
    {
      name: "vitals",
      title: "Web Vitals",
      purposes: ["performance"],
      default: false,
    },
    {
      name: "share",
      title: "Sharing interactions",
      purposes: ["engagement"],
      default: false,
    },
  ],
};

export type ConsentTranslations = NonNullable<typeof klaroConfig.translations>;
