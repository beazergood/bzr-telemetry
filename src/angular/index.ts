import {
  ErrorHandler,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { EVENTS, type Telemetry } from '../index.js';
import { createWebTelemetry, type WebTelemetryConfig } from '../web/index.js';

export const BZR_TELEMETRY = new InjectionToken<Telemetry>('BZR_TELEMETRY');

/**
 * Angular routes errors to its ErrorHandler instead of letting them reach the
 * window, so PostHog's global exception capture never sees them. This keeps the
 * default console output and adds the capture.
 */
export class BzrTelemetryErrorHandler implements ErrorHandler {
  private readonly fallback = new ErrorHandler();

  constructor(private readonly telemetry: Telemetry) {}

  handleError(error: unknown): void {
    this.telemetry.captureException(error);
    this.fallback.handleError(error);
  }
}

/**
 * `provideBzrTelemetry({ product: 'scraps', env: 'prod', apiKey, host })` in
 * `app.config.ts`. Pass a factory when the key arrives at runtime (e.g. from
 * `environment.json`) so the build artefact stays environment-agnostic.
 */
export function provideBzrTelemetry(config: WebTelemetryConfig | (() => WebTelemetryConfig)): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: BZR_TELEMETRY, useFactory: () => createWebTelemetry(typeof config === 'function' ? config() : config) },
    { provide: ErrorHandler, useFactory: () => new BzrTelemetryErrorHandler(inject(BZR_TELEMETRY)) },
    provideAppInitializer(() => {
      const telemetry = inject(BZR_TELEMETRY);
      telemetry.capture(EVENTS.appLoaded);
      trackPageViews(telemetry, inject(Router, { optional: true }));
    }),
  ]);
}

function trackPageViews(telemetry: Telemetry, router: Router | null): void {
  if (!router) return;
  let last: string | undefined;
  router.events.subscribe((event) => {
    // Redirects and same-URL reloads emit NavigationEnd again; one view per distinct URL.
    if (!(event instanceof NavigationEnd) || event.urlAfterRedirects === last) return;
    last = event.urlAfterRedirects;
    telemetry.pageview(location.origin + last);
  });
}

export * from '../web/index.js';
