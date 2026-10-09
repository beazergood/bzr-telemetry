# bzr-telemetry

One PostHog vocabulary for every personal app — web, Angular and Swift.

Every app reports into **one PostHog project**. Every event carries the same
standard properties, so a single query (or a PostHog MCP question) can compare
apps, and the State of Play front end can show usage per app.

| Property      | Meaning                                       |
| ------------- | --------------------------------------------- |
| `product`     | the app — `scraps`, `dosh`, `highview` …       |
| `app`         | the runtime speaking — `web`, `ios`, `api`     |
| `env`         | `prod`, `staging`, `test`, `dev`, `local`      |
| `app_version` | the deployed version, when known               |

Callers can add properties but never override these.

| Event            | When                              |
| ---------------- | --------------------------------- |
| `app_loaded`     | app started (Angular: automatic)  |
| `user_logged_in` | `identify()`                      |
| `user_logged_out`| `logout()`, captured before reset |
| `record_viewed` / `record_saved` / `record_deleted` | the app says so |
| `$pageview`      | Angular router, one per distinct URL |

Anything else is a free-form `capture("thing_happened", { … })`.

The names and properties deliberately match the PL telemetry standard, so what
I learn querying my own apps carries straight over to client work. The ideas
are shared; the code is not.

**No API key = hard no-op.** Local dev and forks never report.

Not for `premier-league/*` or `enable-sleep/*` — those have their own.

## Angular

```ts
// app.config.ts
import { provideBzrTelemetry } from 'bzr-telemetry/angular';

providers: [
  provideBzrTelemetry(() => ({
    product: 'scraps',
    env: 'prod',
    apiKey: runtimeConfig.posthogKey,
    host: 'https://eu.i.posthog.com',
    appVersion: runtimeConfig.version,
  })),
]
```

That alone gives `app_loaded`, page views, and exception capture through
Angular's `ErrorHandler`. For custom events, `inject(BZR_TELEMETRY).capture(...)`.

## Any other web app

```ts
import { createWebTelemetry, EVENTS } from 'bzr-telemetry/web';

const telemetry = createWebTelemetry({ product: 'dosh', env: 'prod', apiKey, host });
telemetry.capture(EVENTS.appLoaded);
```

Autocapture and session replay are off by default — opt in per app (`sessionReplay: true`
on both web and Swift). Replay always masks every input and every piece of text (and, on
iOS, images): you see the journey, never the content. Console logs are never
recorded, even if the PostHog project enables them.

## Swift (iOS / macOS)

Add the package by URL in Xcode, then:

```swift
import BzrTelemetry

let telemetry = BzrTelemetry(.init(product: "dosh", env: .prod, apiKey: key, host: "https://eu.i.posthog.com"))
telemetry.capture(BzrEvent.appLoaded)
telemetry.screen("Net worth")
```

`app_version` defaults to the bundle's short version.

## Installing in an app

```sh
npm install https://github.com/beazergood/bzr-telemetry/releases/download/v0.2.0/bzr-telemetry-0.2.0.tgz
```

Install from the release tarball, not `github:…`: a git dependency records a
`git+ssh` URL in the lockfile, which breaks `npm ci` in slim Docker images with
no git or SSH. Each release attaches the `npm pack` output.

## Development

```sh
npm install && npm test                                   # TypeScript
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test   # Swift
```

`DEVELOPER_DIR` is needed while `xcode-select` points at the Command Line Tools,
which ship without XCTest.
