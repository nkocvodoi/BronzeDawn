import Foundation

/// A point in world space, measured in tiles. Tile (3, 4) spans 3..4 by 4..5.
public struct Vec2: Equatable, Hashable {
    public var x: Double
    public var y: Double

    public init(_ x: Double, _ y: Double) { self.x = x; self.y = y }

    public static func + (a: Vec2, b: Vec2) -> Vec2 { Vec2(a.x + b.x, a.y + b.y) }
    public static func - (a: Vec2, b: Vec2) -> Vec2 { Vec2(a.x - b.x, a.y - b.y) }
    public static func * (a: Vec2, k: Double) -> Vec2 { Vec2(a.x * k, a.y * k) }

    public var length: Double { (x * x + y * y).squareRoot() }
    public func distance(to o: Vec2) -> Double { (self - o).length }
    public var tile: Tile { Tile(Int(floor(x)), Int(floor(y))) }

    public func lerp(to o: Vec2, _ t: Double) -> Vec2 { Vec2(x + (o.x - x) * t, y + (o.y - y) * t) }
}

public struct Tile: Equatable, Hashable {
    public var x: Int
    public var y: Int

    public init(_ x: Int, _ y: Int) { self.x = x; self.y = y }

    public var center: Vec2 { Vec2(Double(x) + 0.5, Double(y) + 0.5) }

    public static func + (a: Tile, b: Tile) -> Tile { Tile(a.x + b.x, a.y + b.y) }

    public func chebyshev(_ o: Tile) -> Int { max(abs(x - o.x), abs(y - o.y)) }
}

/// An axis aligned rectangle in tiles: what a building or a resource covers.
public struct Footprint: Equatable {
    public var origin: Tile
    public var size: Int

    public init(_ origin: Tile, _ size: Int) { self.origin = origin; self.size = size }

    public var minX: Double { Double(origin.x) }
    public var minY: Double { Double(origin.y) }
    public var maxX: Double { Double(origin.x + size) }
    public var maxY: Double { Double(origin.y + size) }
    public var center: Vec2 { Vec2(minX + Double(size) / 2, minY + Double(size) / 2) }

    public var tiles: [Tile] {
        var out: [Tile] = []
        for dy in 0..<size { for dx in 0..<size { out.append(Tile(origin.x + dx, origin.y + dy)) } }
        return out
    }

    public func contains(_ t: Tile) -> Bool {
        t.x >= origin.x && t.y >= origin.y && t.x < origin.x + size && t.y < origin.y + size
    }

    /// Distance from a point to the nearest edge of the rectangle, 0 inside.
    public func distance(to p: Vec2) -> Double {
        let dx = max(minX - p.x, 0, p.x - maxX)
        let dy = max(minY - p.y, 0, p.y - maxY)
        return (dx * dx + dy * dy).squareRoot()
    }
}

/// SplitMix64. Seeded per match so a seed always gives the same map and the same game.
public struct RNG {
    private var state: UInt64

    public init(seed: UInt64) { state = seed &+ 0x9E37_79B9_7F4A_7C15 }

    public mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    /// 0 ..< 1
    public mutating func unit() -> Double { Double(next() >> 11) / Double(1 << 53) }

    public mutating func int(_ range: ClosedRange<Int>) -> Int {
        range.lowerBound + Int(next() % UInt64(range.upperBound - range.lowerBound + 1))
    }

    public mutating func chance(_ p: Double) -> Bool { unit() < p }
}
