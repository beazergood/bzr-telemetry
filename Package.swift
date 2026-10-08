// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "BzrTelemetry",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "BzrTelemetry", targets: ["BzrTelemetry"]),
    ],
    dependencies: [
        .package(url: "https://github.com/PostHog/posthog-ios.git", from: "3.90.0"),
    ],
    targets: [
        .target(name: "BzrTelemetry", dependencies: [.product(name: "PostHog", package: "posthog-ios")]),
        .testTarget(name: "BzrTelemetryTests", dependencies: ["BzrTelemetry"]),
    ]
)
