/**
 * The fleet vocabulary. Deliberately the same names and standard properties as
 * the PL telemetry standard, so a PostHog query or MCP habit learned on a
 * personal app transfers to client work unchanged.
 */
export const EVENTS = {
  appLoaded: 'app_loaded',
  userLoggedIn: 'user_logged_in',
  userLoggedOut: 'user_logged_out',
  recordViewed: 'record_viewed',
  recordSaved: 'record_saved',
  recordDeleted: 'record_deleted',
} as const;

export type TelemetryEnv = 'prod' | 'staging' | 'test' | 'dev' | 'local';

export type Properties = Record<string, unknown>;

export interface TelemetryConfig {
  /** The app's name as it should read in PostHog, e.g. `scraps`. One PostHog project holds every app; this is what separates them. */
  product: string;
  /** Which runtime is speaking: `web`, `ios`, `api`. Adapters fill it in. */
  app?: string;
  env: TelemetryEnv;
  appVersion?: string;
  /** PostHog project key. Absent or empty means a hard no-op, so local dev and forks never report. */
  apiKey?: string | null;
  /** PostHog ingestion host, e.g. `https://eu.i.posthog.com`. */
  host: string;
}

/** What an SDK adapter must do. Feature code talks to `Telemetry`, never to this. */
export interface TelemetryProvider {
  init(config: TelemetryConfig, standard: Properties): void;
  capture(event: string, properties: Properties): void;
  identify(distinctId: string, properties?: Properties): void;
  reset(): void;
  captureException(error: unknown, properties: Properties): void;
}

const RESERVED = ['product', 'app', 'env', 'app_version'] as const;

export class Telemetry {
  readonly enabled: boolean;
  private readonly standard: Properties;

  constructor(
    readonly config: TelemetryConfig,
    private readonly provider: TelemetryProvider,
  ) {
    this.enabled = Boolean(config.apiKey);
    this.standard = standardProperties(config);
    if (this.enabled) provider.init(config, this.standard);
  }

  capture(event: string, properties: Properties = {}): void {
    if (this.enabled) this.provider.capture(event, this.withStandard(properties));
  }

  pageview(url: string, properties: Properties = {}): void {
    this.capture('$pageview', { ...properties, $current_url: url });
  }

  identify(distinctId: string, properties?: Properties): void {
    if (!this.enabled) return;
    this.provider.identify(distinctId, properties);
    this.capture(EVENTS.userLoggedIn);
  }

  /** Capture the logout before resetting, or the event is orphaned from the person who did it. */
  logout(): void {
    if (!this.enabled) return;
    this.capture(EVENTS.userLoggedOut);
    this.provider.reset();
  }

  captureException(error: unknown, properties: Properties = {}): void {
    if (this.enabled) this.provider.captureException(error, this.withStandard(properties));
  }

  /** Callers can add properties but never override the standard ones — otherwise one app could masquerade as another. */
  private withStandard(properties: Properties): Properties {
    return { ...properties, ...this.standard };
  }
}

export function standardProperties(config: TelemetryConfig): Properties {
  const props: Properties = { product: config.product, app: config.app ?? 'web', env: config.env };
  if (config.appVersion) props.app_version = config.appVersion;
  return props;
}

export function isReserved(key: string): boolean {
  return (RESERVED as readonly string[]).includes(key);
}
