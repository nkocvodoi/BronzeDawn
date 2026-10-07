// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "BronzeDawn",
    platforms: [.macOS(.v13)],
    targets: [
        .target(name: "DawnCore"),
        .executableTarget(name: "BronzeDawn", dependencies: ["DawnCore"]),
        .testTarget(name: "DawnCoreTests", dependencies: ["DawnCore"]),
    ]
)
