import type { PostHog } from 'posthog-js';
import { Telemetry, type Properties, type TelemetryConfig, type TelemetryProvider } from '../index.js';

export interface WebTelemetryConfig extends TelemetryConfig {
  /** PostHog autocapture of clicks and inputs. Off by default: named events are the point of the exercise. */
  autocapture?: boolean;
  /** Session replay. Off by default; inputs are always masked when on. */
  sessionReplay?: boolean;
  /** Window errors and unhandled rejections. Frameworks that swallow errors (Angular) also need their own hook. */
  captureExceptions?: boolean;
}

/**
 * posthog-js is ~90 kB gzipped, so it is loaded as its own chunk after
 * bootstrap rather than in the app's initial bundle — and not at all when
 * telemetry is disabled. Calls made before it arrives queue on the promise and
 * replay in order.
 */
export class PostHogBrowserProvider implements TelemetryProvider {
  private client?: Promise<PostHog>;

  init(config: TelemetryConfig, standard: Properties): void {
    const web = config as WebTelemetryConfig;
    this.client = import('posthog-js').then(({ posthog }) => {
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
      return posthog;
    });
  }

  capture(event: string, properties: Properties): void {
    this.with((p) => p.capture(event, properties));
  }

  identify(distinctId: string, properties?: Properties): void {
    this.with((p) => p.identify(distinctId, properties));
  }

  reset(): void {
    this.with((p) => p.reset());
  }

  captureException(error: unknown, properties: Properties): void {
    this.with((p) => p.captureException(error, properties));
  }

  private with(fn: (posthog: PostHog) => void): void {
    // A failed chunk load must never surface as an app error.
    this.client?.then(fn).catch(() => undefined);
  }
}

export function createWebTelemetry(config: WebTelemetryConfig): Telemetry {
  return new Telemetry({ app: 'web', ...config }, new PostHogBrowserProvider());
}

export * from '../index.js';
