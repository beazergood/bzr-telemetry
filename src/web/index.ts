import { posthog } from 'posthog-js';
import { Telemetry, type Properties, type TelemetryConfig, type TelemetryProvider } from '../index.js';

export interface WebTelemetryConfig extends TelemetryConfig {
  /** PostHog autocapture of clicks and inputs. Off by default: named events are the point of the exercise. */
  autocapture?: boolean;
  /** Session replay. Off by default; inputs are always masked when on. */
  sessionReplay?: boolean;
  /** Window errors and unhandled rejections. Frameworks that swallow errors (Angular) also need their own hook. */
  captureExceptions?: boolean;
}

export class PostHogBrowserProvider implements TelemetryProvider {
  init(config: TelemetryConfig, standard: Properties): void {
    const web = config as WebTelemetryConfig;
    posthog.init(config.apiKey as string, {
      api_host: config.host,
      person_profiles: 'identified_only',
      // Page views are captured by the adapter so SPA navigations count once, not per history push.
      capture_pageview: false,
      autocapture: web.autocapture ?? false,
      disable_session_recording: !(web.sessionReplay ?? false),
      session_recording: { maskAllInputs: true },
      capture_exceptions: web.captureExceptions ?? true,
    });
    // Registered as super properties too, so PostHog's own events ($exception, $autocapture) carry the app.
    posthog.register(standard);
  }

  capture(event: string, properties: Properties): void {
    posthog.capture(event, properties);
  }

  identify(distinctId: string, properties?: Properties): void {
    posthog.identify(distinctId, properties);
  }

  reset(): void {
    posthog.reset();
  }

  captureException(error: unknown, properties: Properties): void {
    posthog.captureException(error, properties);
  }
}

export function createWebTelemetry(config: WebTelemetryConfig): Telemetry {
  return new Telemetry({ app: 'web', ...config }, new PostHogBrowserProvider());
}

export * from '../index.js';
