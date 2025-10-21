/* eslint-disable */
/**
 * Do not edit directly
 * Generated on Tue, 21 Oct 2025 06:24:41 GMT
 */

export const tokens = {
  "color": {
    "brand": {
      "blue": {
        "500": "#2fafea"
      }
    },
    "neutral": {
      "100": "#f3f5f7",
      "200": "#e6eaf0",
      "300": "#d3d9e1",
      "400": "#b8c0ca",
      "500": "#9ca4b1",
      "600": "#6e7682",
      "700": "#3c424a",
      "800": "#272c33",
      "900": "#181c20",
      "950": "#101418",
      "000": "#ffffff",
      "050": "#fafbfc"
    },
    "accent": {
      "teal": "#1bb6a1",
      "violet": "#7056e2",
      "magenta": "#d6569e",
      "orange": "#f47c3c",
      "yellow": "#f5c04a"
    },
    "fg": {
      "default": "#101418",
      "muted": "#3c424a",
      "subtle": "#6e7682",
      "inverse": "#ffffff",
      "accent": "#2fafea"
    },
    "bg": {
      "canvas": "#ffffff",
      "surface": "#fafbfc",
      "elevated": "#f3f5f7",
      "subtle": "#e6eaf0",
      "inverse": "#101418"
    },
    "border": {
      "subtle": "#e6eaf0",
      "default": "#d3d9e1",
      "emphasis": "#b8c0ca",
      "inverse": "#272c33",
      "focus": "#2fafea"
    },
    "status": {
      "ok": "#1fbf75",
      "warn": "#f0a400",
      "alert": "#e24545",
      "info": "#2fafea"
    },
    "statusSurface": {
      "ok": {
        "fg": "#1fbf75",
        "bg": "#e6f7ef",
        "border": "#b2e4cb"
      },
      "warn": {
        "fg": "#f0a400",
        "bg": "#fff4e0",
        "border": "#f6d599"
      },
      "alert": {
        "fg": "#e24545",
        "bg": "#fdecef",
        "border": "#f3bdc6"
      },
      "info": {
        "fg": "#2fafea",
        "bg": "#e9f7fd",
        "border": "#b8e6f6"
      }
    },
    "series": {
      "1": "#2fafea",
      "2": "#5f75f7",
      "3": "#f9739a",
      "4": "#f2c94c",
      "5": "#6fcf97",
      "6": "#56ccf2",
      "7": "#bb6bd9",
      "8": "#f2994a",
      "9": "#9b51e0",
      "10": "#27ae60",
      "11": "#eb5757",
      "12": "#2d9cdb"
    },
    "grid": {
      "major": "#d3d9e1",
      "minor": "#e6eaf0"
    }
  },
  "font": {
    "family": {
      "sans": "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
      "mono": "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, SFMono, Consolas, 'Liberation Mono', Menlo, monospace"
    },
    "weight": {
      "regular": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeight": {
      "tight": 1.1,
      "snug": 1.25,
      "normal": 1.5,
      "relaxed": 1.7
    },
    "size": {
      "display": "3.5rem",
      "h1": "2.75rem",
      "h2": "2.25rem",
      "h3": "1.875rem",
      "h4": "1.5rem",
      "h5": "1.25rem",
      "h6": "1.125rem",
      "body": "1rem",
      "bodySm": "0.9375rem",
      "caption": "0.8125rem"
    }
  },
  "space": {
    "0": "0px",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "7": "28px",
    "8": "32px"
  },
  "radius": {
    "xs": "4px",
    "s": "8px",
    "m": "12px",
    "l": "16px",
    "2xl": "20px",
    "full": "999px"
  },
  "shadow": {
    "z1": "0 1px 2px rgba(16, 20, 24, 0.06), 0 1px 1px rgba(16, 20, 24, 0.04)",
    "z2": "0 4px 10px rgba(16, 20, 24, 0.08), 0 1px 2px rgba(16, 20, 24, 0.06)",
    "z3": "0 10px 20px rgba(16, 20, 24, 0.10), 0 2px 6px rgba(16, 20, 24, 0.08)"
  },
  "z": {
    "below": -1,
    "base": 0,
    "nav": 10,
    "popover": 20,
    "modal": 30,
    "toast": 40
  },
  "motion": {
    "duration": {
      "fast": "120ms",
      "base": "180ms",
      "gentle": "240ms"
    },
    "easing": {
      "standard": "cubic-bezier(0.2, 0, 0, 1)",
      "emphasized": "cubic-bezier(0.2, 0, 0, 1.2)"
    }
  },
  "a11y": {
    "textOnCanvas": {
      "minRatio": 4.5
    }
  }
} as const;

export type Tokens = typeof tokens;
export type TokenPath = 'a11y.textOnCanvas.minRatio' | 'color.accent.magenta' | 'color.accent.orange' | 'color.accent.teal' | 'color.accent.violet' | 'color.accent.yellow' | 'color.bg.canvas' | 'color.bg.elevated' | 'color.bg.inverse' | 'color.bg.subtle' | 'color.bg.surface' | 'color.border.default' | 'color.border.emphasis' | 'color.border.focus' | 'color.border.inverse' | 'color.border.subtle' | 'color.brand.blue.500' | 'color.fg.accent' | 'color.fg.default' | 'color.fg.inverse' | 'color.fg.muted' | 'color.fg.subtle' | 'color.grid.major' | 'color.grid.minor' | 'color.neutral.000' | 'color.neutral.050' | 'color.neutral.100' | 'color.neutral.200' | 'color.neutral.300' | 'color.neutral.400' | 'color.neutral.500' | 'color.neutral.600' | 'color.neutral.700' | 'color.neutral.800' | 'color.neutral.900' | 'color.neutral.950' | 'color.series.1' | 'color.series.10' | 'color.series.11' | 'color.series.12' | 'color.series.2' | 'color.series.3' | 'color.series.4' | 'color.series.5' | 'color.series.6' | 'color.series.7' | 'color.series.8' | 'color.series.9' | 'color.status.alert' | 'color.status.info' | 'color.status.ok' | 'color.status.warn' | 'color.statusSurface.alert.bg' | 'color.statusSurface.alert.border' | 'color.statusSurface.alert.fg' | 'color.statusSurface.info.bg' | 'color.statusSurface.info.border' | 'color.statusSurface.info.fg' | 'color.statusSurface.ok.bg' | 'color.statusSurface.ok.border' | 'color.statusSurface.ok.fg' | 'color.statusSurface.warn.bg' | 'color.statusSurface.warn.border' | 'color.statusSurface.warn.fg' | 'font.family.mono' | 'font.family.sans' | 'font.lineHeight.normal' | 'font.lineHeight.relaxed' | 'font.lineHeight.snug' | 'font.lineHeight.tight' | 'font.size.body' | 'font.size.bodySm' | 'font.size.caption' | 'font.size.display' | 'font.size.h1' | 'font.size.h2' | 'font.size.h3' | 'font.size.h4' | 'font.size.h5' | 'font.size.h6' | 'font.weight.bold' | 'font.weight.medium' | 'font.weight.regular' | 'font.weight.semibold' | 'motion.duration.base' | 'motion.duration.fast' | 'motion.duration.gentle' | 'motion.easing.emphasized' | 'motion.easing.standard' | 'radius.2xl' | 'radius.full' | 'radius.l' | 'radius.m' | 'radius.s' | 'radius.xs' | 'shadow.z1' | 'shadow.z2' | 'shadow.z3' | 'space.0' | 'space.1' | 'space.2' | 'space.3' | 'space.4' | 'space.5' | 'space.6' | 'space.7' | 'space.8' | 'z.base' | 'z.below' | 'z.modal' | 'z.nav' | 'z.popover' | 'z.toast';

export const tokenPaths = [
  'a11y.textOnCanvas.minRatio',
  'color.accent.magenta',
  'color.accent.orange',
  'color.accent.teal',
  'color.accent.violet',
  'color.accent.yellow',
  'color.bg.canvas',
  'color.bg.elevated',
  'color.bg.inverse',
  'color.bg.subtle',
  'color.bg.surface',
  'color.border.default',
  'color.border.emphasis',
  'color.border.focus',
  'color.border.inverse',
  'color.border.subtle',
  'color.brand.blue.500',
  'color.fg.accent',
  'color.fg.default',
  'color.fg.inverse',
  'color.fg.muted',
  'color.fg.subtle',
  'color.grid.major',
  'color.grid.minor',
  'color.neutral.000',
  'color.neutral.050',
  'color.neutral.100',
  'color.neutral.200',
  'color.neutral.300',
  'color.neutral.400',
  'color.neutral.500',
  'color.neutral.600',
  'color.neutral.700',
  'color.neutral.800',
  'color.neutral.900',
  'color.neutral.950',
  'color.series.1',
  'color.series.10',
  'color.series.11',
  'color.series.12',
  'color.series.2',
  'color.series.3',
  'color.series.4',
  'color.series.5',
  'color.series.6',
  'color.series.7',
  'color.series.8',
  'color.series.9',
  'color.status.alert',
  'color.status.info',
  'color.status.ok',
  'color.status.warn',
  'color.statusSurface.alert.bg',
  'color.statusSurface.alert.border',
  'color.statusSurface.alert.fg',
  'color.statusSurface.info.bg',
  'color.statusSurface.info.border',
  'color.statusSurface.info.fg',
  'color.statusSurface.ok.bg',
  'color.statusSurface.ok.border',
  'color.statusSurface.ok.fg',
  'color.statusSurface.warn.bg',
  'color.statusSurface.warn.border',
  'color.statusSurface.warn.fg',
  'font.family.mono',
  'font.family.sans',
  'font.lineHeight.normal',
  'font.lineHeight.relaxed',
  'font.lineHeight.snug',
  'font.lineHeight.tight',
  'font.size.body',
  'font.size.bodySm',
  'font.size.caption',
  'font.size.display',
  'font.size.h1',
  'font.size.h2',
  'font.size.h3',
  'font.size.h4',
  'font.size.h5',
  'font.size.h6',
  'font.weight.bold',
  'font.weight.medium',
  'font.weight.regular',
  'font.weight.semibold',
  'motion.duration.base',
  'motion.duration.fast',
  'motion.duration.gentle',
  'motion.easing.emphasized',
  'motion.easing.standard',
  'radius.2xl',
  'radius.full',
  'radius.l',
  'radius.m',
  'radius.s',
  'radius.xs',
  'shadow.z1',
  'shadow.z2',
  'shadow.z3',
  'space.0',
  'space.1',
  'space.2',
  'space.3',
  'space.4',
  'space.5',
  'space.6',
  'space.7',
  'space.8',
  'z.base',
  'z.below',
  'z.modal',
  'z.nav',
  'z.popover',
  'z.toast'
] as const;

export function getTokenValue(path) {
  const segments = path.split('.');
  return segments.reduce((result, segment) => (result ? result[segment] : undefined), tokens);
}
