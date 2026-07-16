import * as Sentry from "@sentry/node";

let initialized = false;

/** Initialize Sentry for the Express API. No-op when SENTRY_DSN is unset. */
export function initSentry(): void {
  if (initialized) return;

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    initialized = true;
    return;
  }

  Sentry.init({
    dsn,
    enabled: true,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });

  initialized = true;
}

export { Sentry };
