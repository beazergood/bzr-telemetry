import Foundation
import PostHog

/// The fleet vocabulary — same names and standard properties as the web side
/// (and as the PL standard), so one PostHog query covers every app.
public enum BzrEvent {
    public static let appLoaded = "app_loaded"
    public static let userLoggedIn = "user_logged_in"
    public static let userLoggedOut = "user_logged_out"
    public static let recordViewed = "record_viewed"
    public static let recordSaved = "record_saved"
    public static let recordDeleted = "record_deleted"
}

public enum BzrEnv: String {
    case prod, staging, test, dev, local
}

public struct BzrTelemetryConfig {
    public var product: String
    public var env: BzrEnv
    /// PostHog project key. Nil or empty means a hard no-op.
    public var apiKey: String?
    public var host: String
    public var app: String
    public var appVersion: String?
    /// Session replay. Off by default; when on, all text, inputs and images are masked — journeys, never content.
    public var sessionReplay: Bool

    public init(
        product: String,
        env: BzrEnv,
        apiKey: String?,
        host: String,
        app: String = "ios",
        appVersion: String? = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
        sessionReplay: Bool = false
    ) {
        self.product = product
        self.env = env
        self.apiKey = apiKey
        self.host = host
        self.app = app
        self.appVersion = appVersion
        self.sessionReplay = sessionReplay
    }

    var standardProperties: [String: Any] {
        var props: [String: Any] = ["product": product, "app": app, "env": env.rawValue]
        if let appVersion { props["app_version"] = appVersion }
        return props
    }
}

/// What an SDK adapter must do. App code talks to `BzrTelemetry`, never to this.
public protocol BzrTelemetryProvider {
    func setup(_ config: BzrTelemetryConfig, standard: [String: Any])
    func capture(_ event: String, properties: [String: Any])
    func screen(_ title: String, properties: [String: Any])
    func identify(_ distinctId: String, properties: [String: Any]?)
    func reset()
    func captureException(_ error: Error, properties: [String: Any])
}

public final class BzrTelemetry {
    public let config: BzrTelemetryConfig
    public let enabled: Bool
    private let provider: BzrTelemetryProvider
    private let standard: [String: Any]

    public init(_ config: BzrTelemetryConfig, provider: BzrTelemetryProvider = PostHogProvider()) {
        self.config = config
        self.provider = provider
        standard = config.standardProperties
        enabled = !(config.apiKey ?? "").isEmpty
        if enabled { provider.setup(config, standard: standard) }
    }

    public func capture(_ event: String, properties: [String: Any] = [:]) {
        guard enabled else { return }
        provider.capture(event, properties: withStandard(properties))
    }

    public func screen(_ title: String, properties: [String: Any] = [:]) {
        guard enabled else { return }
        provider.screen(title, properties: withStandard(properties))
    }

    public func identify(_ distinctId: String, properties: [String: Any]? = nil) {
        guard enabled else { return }
        provider.identify(distinctId, properties: properties)
        capture(BzrEvent.userLoggedIn)
    }

    /// Capture the logout before resetting, or the event is orphaned from the person who did it.
    public func logout() {
        guard enabled else { return }
        capture(BzrEvent.userLoggedOut)
        provider.reset()
    }

    public func captureException(_ error: Error, properties: [String: Any] = [:]) {
        guard enabled else { return }
        provider.captureException(error, properties: withStandard(properties))
    }

    /// Callers can add properties but never override the standard ones — otherwise one app could masquerade as another.
    private func withStandard(_ properties: [String: Any]) -> [String: Any] {
        properties.merging(standard) { _, standard in standard }
    }
}

public struct PostHogProvider: BzrTelemetryProvider {
    public init() {}

    public func setup(_ config: BzrTelemetryConfig, standard: [String: Any]) {
        let posthog = PostHogConfig(projectToken: config.apiKey ?? "", host: config.host)
        posthog.personProfiles = .identifiedOnly
        #if os(iOS)
        if config.sessionReplay {
            posthog.sessionReplay = true
            let replay = posthog.sessionReplayConfig
            // SwiftUI renders to drawing views the wireframe mode can't see; screenshots + masks can.
            replay.screenshotMode = true
            // In SwiftUI this masks every Text, not just inputs — money is plain text.
            replay.maskAllTextInputs = true
            replay.maskAllImages = true
            replay.maskAllSandboxedViews = true
            replay.captureNetworkTelemetry = false
        }
        #endif
        PostHogSDK.shared.setup(posthog)
        // Super properties too, so PostHog's own lifecycle and screen events carry the app.
        PostHogSDK.shared.register(standard)
    }

    public func capture(_ event: String, properties: [String: Any]) {
        PostHogSDK.shared.capture(event, properties: properties)
    }

    public func screen(_ title: String, properties: [String: Any]) {
        PostHogSDK.shared.screen(title, properties: properties)
    }

    public func identify(_ distinctId: String, properties: [String: Any]?) {
        PostHogSDK.shared.identify(distinctId, userProperties: properties)
    }

    public func reset() {
        PostHogSDK.shared.reset()
    }

    public func captureException(_ error: Error, properties: [String: Any]) {
        PostHogSDK.shared.captureException(error, properties: properties)
    }
}
