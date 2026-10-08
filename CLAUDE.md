# bzr-telemetry

PostHog wrapper for my personal apps. See README.md for the vocabulary and usage.

- Two halves, one contract: TypeScript (`src/` — core, `web`, `angular` subpaths) and Swift (`Sources/BzrTelemetry`). A change to event names or standard properties lands in **both** in the same commit.
- Event names and standard properties mirror the PL telemetry standard on purpose. Copy ideas from `premier-league/pl-telemetry`, never code — it belongs to PL.
- Feature code never imports `posthog-js` / `PostHog` directly; it goes through `Telemetry` / `BzrTelemetry`.
- No API key must stay a hard no-op. Standard properties must stay un-overridable. Both are tested on each side.
- Tests: `npm test`; `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test`.
- Never instrument `premier-league/*` or `enable-sleep/*` with this.
