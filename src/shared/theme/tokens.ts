/* eslint-disable */
/**
 * Do not edit directly
 * Generated on Tue, 21 Oct 2025 06:22:26 GMT
 */

export const tokens = {
  "color": {
    "brand": {
      "blue": {
        "100": "#c7eefb",
        "200": "#9ddcf5",
        "300": "#6ec8ee",
        "400": "#46b9e9",
        "500": "#2fafea",
        "600": "#1c98cf",
        "700": "#0f7ca9",
        "800": "#096082",
        "900": "#063c4f",
        "050": "#e6f8fe"
      }
    },
    "neutral": {
      "100": "#eceff4",
      "200": "#d7dce4",
      "300": "#b8c0cc",
      "400": "#96a1b2",
      "500": "#75829a",
      "600": "#59657c",
      "700": "#435069",
      "800": "#2e3a4d",
      "900": "#1b2633",
      "950": "#101418",
      "000": "#ffffff",
      "050": "#f6f8fa"
    },
    "accent": {
      "teal": "#1bb6a1",
      "violet": "#7056e2",
      "magenta": "#d6569e",
      "orange": "#f47c3c",
      "yellow": "#f5c04a"
    },
    "status": {
      "ok": "#2cb67d",
      "warn": "#e6a93a",
      "alert": "#d64550",
      "info": "#2fafea"
    },
    "bg": {
      "canvas": "#ffffff",
      "surface": "#f6f8fa",
      "elevated": "#ffffff",
      "subtle": "#eceff4",
      "inverse": "#101418"
    },
    "fg": {
      "default": "#101418",
      "muted": "#59657c",
      "subtle": "#75829a",
      "inverse": "#f6f8fa",
      "accent": "#2fafea"
    },
    "border": {
      "subtle": "#eceff4",
      "default": "#d7dce4",
      "emphasis": "#96a1b2",
      "inverse": "#2e3a4d",
      "focus": "#2fafea"
    },
    "statusSurface": {
      "ok": {
        "fg": "#2cb67d",
        "bg": "#ebf7f1",
        "border": "#b6e5cf"
      },
      "warn": {
        "fg": "#e6a93a",
        "bg": "#fff5e5",
        "border": "#f2d8a1"
      },
      "alert": {
        "fg": "#d64550",
        "bg": "#fcebee",
        "border": "#f3bec7"
      },
      "info": {
        "fg": "#2fafea",
        "bg": "#e9f7fd",
        "border": "#b8e6f6"
      }
    }
  },
  "dataviz": {
    "series": {
      "1": "#2F7ED8",
      "2": "#8BBC21",
      "3": "#910000",
      "4": "#1AADCE",
      "5": "#492970",
      "6": "#77A1E5",
      "7": "#C42525",
      "8": "#A6C96A",
      "9": "#2F4858",
      "10": "#F6AE2D",
      "11": "#33658A",
      "12": "#55C1FF"
    },
    "grid": {
      "major": "#E7ECF2",
      "minor": "#F1F4F8"
    },
    "axis": {
      "label": "#3C424A",
      "line": "#D3D9E1"
    },
    "semantic": {
      "positive": "#1FBF75",
      "negative": "#E24545",
      "neutral": "#6B7280"
    },
    "size": {
      "marker": {
        "sm": "4px",
        "md": "6px",
        "lg": "8px"
      }
    },
    "width": {
      "line": "1.5px"
    }
  },
  "font": {
    "family": {
      "sans": "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
      "mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      "serif": "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif"
    },
    "weight": {
      "regular": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeight": {
      "display": 1.1,
      "headings": 1.2,
      "body": 1.55
    },
    "size": {
      "display": "44px",
      "h1": "36px",
      "h2": "28px",
      "h3": "22px",
      "h4": "18px",
      "body": "16px",
      "caption": "13px"
    },
    "numeric": {
      "tabular": "tabular-nums"
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
    "8": "32px",
    "9": "40px",
    "10": "48px"
  },
  "radius": {
    "xs": "2px",
    "sm": "4px",
    "md": "8px",
    "lg": "12px",
    "xl": "16px",
    "2xl": "24px",
    "full": "999px"
  },
  "shadow": {
    "z1": "0 1px 2px rgba(16, 20, 24, 0.12), 0 1px 1px rgba(16, 20, 24, 0.06)",
    "z2": "0 6px 12px rgba(16, 20, 24, 0.14), 0 2px 4px rgba(16, 20, 24, 0.08)",
    "z3": "0 16px 24px rgba(16, 20, 24, 0.16), 0 6px 8px rgba(16, 20, 24, 0.12)"
  },
  "motion": {
    "duration": {
      "fast": "120ms",
      "base": "200ms",
      "gentle": "320ms"
    },
    "easing": {
      "cubic": "cubic-bezier(0.4, 0, 0.2, 1)",
      "emphasized": "cubic-bezier(0.3, 0, 0.2, 1)",
      "entrance": "cubic-bezier(0.2, 0.8, 0.2, 1)",
      "exit": "cubic-bezier(0.4, 0, 1, 1)"
    }
  }
} as const;

export type Tokens = typeof tokens;
export type TokenPath = 'color.accent.magenta' | 'color.accent.orange' | 'color.accent.teal' | 'color.accent.violet' | 'color.accent.yellow' | 'color.bg.canvas' | 'color.bg.elevated' | 'color.bg.inverse' | 'color.bg.subtle' | 'color.bg.surface' | 'color.border.default' | 'color.border.emphasis' | 'color.border.focus' | 'color.border.inverse' | 'color.border.subtle' | 'color.brand.blue.050' | 'color.brand.blue.100' | 'color.brand.blue.200' | 'color.brand.blue.300' | 'color.brand.blue.400' | 'color.brand.blue.500' | 'color.brand.blue.600' | 'color.brand.blue.700' | 'color.brand.blue.800' | 'color.brand.blue.900' | 'color.fg.accent' | 'color.fg.default' | 'color.fg.inverse' | 'color.fg.muted' | 'color.fg.subtle' | 'color.neutral.000' | 'color.neutral.050' | 'color.neutral.100' | 'color.neutral.200' | 'color.neutral.300' | 'color.neutral.400' | 'color.neutral.500' | 'color.neutral.600' | 'color.neutral.700' | 'color.neutral.800' | 'color.neutral.900' | 'color.neutral.950' | 'color.status.alert' | 'color.status.info' | 'color.status.ok' | 'color.status.warn' | 'color.statusSurface.alert.bg' | 'color.statusSurface.alert.border' | 'color.statusSurface.alert.fg' | 'color.statusSurface.info.bg' | 'color.statusSurface.info.border' | 'color.statusSurface.info.fg' | 'color.statusSurface.ok.bg' | 'color.statusSurface.ok.border' | 'color.statusSurface.ok.fg' | 'color.statusSurface.warn.bg' | 'color.statusSurface.warn.border' | 'color.statusSurface.warn.fg' | 'dataviz.axis.label' | 'dataviz.axis.line' | 'dataviz.grid.major' | 'dataviz.grid.minor' | 'dataviz.semantic.negative' | 'dataviz.semantic.neutral' | 'dataviz.semantic.positive' | 'dataviz.series.1' | 'dataviz.series.10' | 'dataviz.series.11' | 'dataviz.series.12' | 'dataviz.series.2' | 'dataviz.series.3' | 'dataviz.series.4' | 'dataviz.series.5' | 'dataviz.series.6' | 'dataviz.series.7' | 'dataviz.series.8' | 'dataviz.series.9' | 'dataviz.size.marker.lg' | 'dataviz.size.marker.md' | 'dataviz.size.marker.sm' | 'dataviz.width.line' | 'font.family.mono' | 'font.family.sans' | 'font.family.serif' | 'font.lineHeight.body' | 'font.lineHeight.display' | 'font.lineHeight.headings' | 'font.numeric.tabular' | 'font.size.body' | 'font.size.caption' | 'font.size.display' | 'font.size.h1' | 'font.size.h2' | 'font.size.h3' | 'font.size.h4' | 'font.weight.bold' | 'font.weight.medium' | 'font.weight.regular' | 'font.weight.semibold' | 'motion.duration.base' | 'motion.duration.fast' | 'motion.duration.gentle' | 'motion.easing.cubic' | 'motion.easing.emphasized' | 'motion.easing.entrance' | 'motion.easing.exit' | 'radius.2xl' | 'radius.full' | 'radius.lg' | 'radius.md' | 'radius.sm' | 'radius.xl' | 'radius.xs' | 'shadow.z1' | 'shadow.z2' | 'shadow.z3' | 'space.0' | 'space.1' | 'space.10' | 'space.2' | 'space.3' | 'space.4' | 'space.5' | 'space.6' | 'space.7' | 'space.8' | 'space.9';

export const tokenPaths = [
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
  'color.brand.blue.050',
  'color.brand.blue.100',
  'color.brand.blue.200',
  'color.brand.blue.300',
  'color.brand.blue.400',
  'color.brand.blue.500',
  'color.brand.blue.600',
  'color.brand.blue.700',
  'color.brand.blue.800',
  'color.brand.blue.900',
  'color.fg.accent',
  'color.fg.default',
  'color.fg.inverse',
  'color.fg.muted',
  'color.fg.subtle',
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
  'dataviz.axis.label',
  'dataviz.axis.line',
  'dataviz.grid.major',
  'dataviz.grid.minor',
  'dataviz.semantic.negative',
  'dataviz.semantic.neutral',
  'dataviz.semantic.positive',
  'dataviz.series.1',
  'dataviz.series.10',
  'dataviz.series.11',
  'dataviz.series.12',
  'dataviz.series.2',
  'dataviz.series.3',
  'dataviz.series.4',
  'dataviz.series.5',
  'dataviz.series.6',
  'dataviz.series.7',
  'dataviz.series.8',
  'dataviz.series.9',
  'dataviz.size.marker.lg',
  'dataviz.size.marker.md',
  'dataviz.size.marker.sm',
  'dataviz.width.line',
  'font.family.mono',
  'font.family.sans',
  'font.family.serif',
  'font.lineHeight.body',
  'font.lineHeight.display',
  'font.lineHeight.headings',
  'font.numeric.tabular',
  'font.size.body',
  'font.size.caption',
  'font.size.display',
  'font.size.h1',
  'font.size.h2',
  'font.size.h3',
  'font.size.h4',
  'font.weight.bold',
  'font.weight.medium',
  'font.weight.regular',
  'font.weight.semibold',
  'motion.duration.base',
  'motion.duration.fast',
  'motion.duration.gentle',
  'motion.easing.cubic',
  'motion.easing.emphasized',
  'motion.easing.entrance',
  'motion.easing.exit',
  'radius.2xl',
  'radius.full',
  'radius.lg',
  'radius.md',
  'radius.sm',
  'radius.xl',
  'radius.xs',
  'shadow.z1',
  'shadow.z2',
  'shadow.z3',
  'space.0',
  'space.1',
  'space.10',
  'space.2',
  'space.3',
  'space.4',
  'space.5',
  'space.6',
  'space.7',
  'space.8',
  'space.9'
] as const;

export function getTokenValue(path) {
  const segments = path.split('.');
  return segments.reduce((result, segment) => (result ? result[segment] : undefined), tokens);
}
