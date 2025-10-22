import * as Sentry from "@sentry/nextjs";

const tracesSampleRateValue = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0");

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
  tracesSampleRate: Number.isFinite(tracesSampleRateValue) ? tracesSampleRateValue : 0,
});
