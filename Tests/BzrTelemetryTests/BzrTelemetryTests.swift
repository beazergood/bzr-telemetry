import XCTest
@testable import BzrTelemetry

final class Recorder: BzrTelemetryProvider {
    var calls: [(String, [String: Any])] = []
    func setup(_ config: BzrTelemetryConfig, standard: [String: Any]) { calls.append(("setup", standard)) }
    func capture(_ event: String, properties: [String: Any]) { calls.append((event, properties)) }
    func screen(_ title: String, properties: [String: Any]) { calls.append(("screen:\(title)", properties)) }
    func identify(_ distinctId: String, properties: [String: Any]?) { calls.append(("identify", [:])) }
    func reset() { calls.append(("reset", [:])) }
    func captureException(_ error: Error, properties: [String: Any]) { calls.append(("exception", properties)) }
}

final class BzrTelemetryTests: XCTestCase {
    let config = BzrTelemetryConfig(product: "dosh", env: .prod, apiKey: "phc_test", host: "https://eu.i.posthog.com", appVersion: "1.35.1")

    func testNoApiKeyIsAHardNoOp() {
        let recorder = Recorder()
        var off = config
        off.apiKey = nil
        let telemetry = BzrTelemetry(off, provider: recorder)
        telemetry.capture("anything")
        telemetry.identify("dave")
        telemetry.logout()
        XCTAssertFalse(telemetry.enabled)
        XCTAssertTrue(recorder.calls.isEmpty)
    }

    func testStandardPropertiesCannotBeOverridden() {
        let recorder = Recorder()
        let telemetry = BzrTelemetry(config, provider: recorder)
        telemetry.capture(BzrEvent.recordSaved, properties: ["is_new": true, "product": "impostor"])
        let (event, props) = recorder.calls.last!
        XCTAssertEqual(event, "record_saved")
        XCTAssertEqual(props["product"] as? String, "dosh")
        XCTAssertEqual(props["app"] as? String, "ios")
        XCTAssertEqual(props["app_version"] as? String, "1.35.1")
        XCTAssertEqual(props["is_new"] as? Bool, true)
    }

    func testLogoutCapturesBeforeReset() {
        let recorder = Recorder()
        let telemetry = BzrTelemetry(config, provider: recorder)
        telemetry.identify("dave")
        telemetry.logout()
        XCTAssertEqual(recorder.calls.dropFirst().map(\.0), ["identify", "user_logged_in", "user_logged_out", "reset"])
    }
}
