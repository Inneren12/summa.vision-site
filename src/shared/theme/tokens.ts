/* eslint-disable */
/**
 * Do not edit directly
 * Generated on Tue, 21 Oct 2025 06:18:46 GMT
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
      "major": "#d3d9e1",
      "minor": "#e6eaf0"
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
  },
  "a11y": {
    "textOnCanvas": {
      "minRatio": 4.5
    }
  }
} as const;

export type Tokens = typeof tokens;
export type TokenPath = 'a11y.textOnCanvas.minRatio' | 'color.accent.magenta' | 'color.accent.orange' | 'color.accent.teal' | 'color.accent.violet' | 'color.accent.yellow' | 'color.bg.canvas' | 'color.bg.elevated' | 'color.bg.inverse' | 'color.bg.subtle' | 'color.bg.surface' | 'color.border.default' | 'color.border.emphasis' | 'color.border.focus' | 'color.border.inverse' | 'color.border.subtle' | 'color.brand.blue.500' | 'color.fg.accent' | 'color.fg.default' | 'color.fg.inverse' | 'color.fg.muted' | 'color.fg.subtle' | 'color.grid.major' | 'color.grid.minor' | 'color.neutral.000' | 'color.neutral.050' | 'color.neutral.100' | 'color.neutral.200' | 'color.neutral.300' | 'color.neutral.400' | 'color.neutral.500' | 'color.neutral.600' | 'color.neutral.700' | 'color.neutral.800' | 'color.neutral.900' | 'color.neutral.950' | 'color.series.1' | 'color.series.10' | 'color.series.11' | 'color.series.12' | 'color.series.2' | 'color.series.3' | 'color.series.4' | 'color.series.5' | 'color.series.6' | 'color.series.7' | 'color.series.8' | 'color.series.9' | 'color.status.alert' | 'color.status.info' | 'color.status.ok' | 'color.status.warn' | 'color.statusSurface.alert.bg' | 'color.statusSurface.alert.border' | 'color.statusSurface.alert.fg' | 'color.statusSurface.info.bg' | 'color.statusSurface.info.border' | 'color.statusSurface.info.fg' | 'color.statusSurface.ok.bg' | 'color.statusSurface.ok.border' | 'color.statusSurface.ok.fg' | 'color.statusSurface.warn.bg' | 'color.statusSurface.warn.border' | 'color.statusSurface.warn.fg' | 'font.family.mono' | 'font.family.sans' | 'font.lineHeight.normal' | 'font.lineHeight.relaxed' | 'font.lineHeight.snug' | 'font.lineHeight.tight' | 'font.size.body' | 'font.size.bodySm' | 'font.size.caption' | 'font.size.display' | 'font.size.h1' | 'font.size.h2' | 'font.size.h3' | 'font.size.h4' | 'font.size.h5' | 'font.size.h6' | 'font.weight.bold' | 'font.weight.medium' | 'font.weight.regular' | 'font.weight.semibold' | 'motion.duration.base' | 'motion.duration.fast' | 'motion.duration.gentle' | 'motion.easing.cubic' | 'motion.easing.emphasized' | 'motion.easing.entrance' | 'motion.easing.exit' | 'radius.2xl' | 'radius.full' | 'radius.lg' | 'radius.md' | 'radius.sm' | 'radius.xl' | 'radius.xs' | 'shadow.z1' | 'shadow.z2' | 'shadow.z3' | 'space.0' | 'space.1' | 'space.10' | 'space.2' | 'space.3' | 'space.4' | 'space.5' | 'space.6' | 'space.7' | 'space.8' | 'space.9';

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
