import Foundation

public enum Terrain: UInt8 {
    case grass, sand, water, dirt

    public var walkable: Bool { self != .water }
}

/// The tile grid shared by pathfinding, placement and fog of war.
public final class GridMap {
    public let width: Int
    public let height: Int
    public var terrain: [Terrain]
    /// Entity id of the building or resource on each tile, 0 for none.
    public var occupant: [Int]
    /// Small per-tile number for drawing variety. No effect on rules.
    public var shade: [UInt8]

    public init(width: Int, height: Int) {
        self.width = width
        self.height = height
        terrain = Array(repeating: .grass, count: width * height)
        occupant = Array(repeating: 0, count: width * height)
        shade = Array(repeating: 0, count: width * height)
    }

    @inline(__always) public func inside(_ t: Tile) -> Bool {
        t.x >= 0 && t.y >= 0 && t.x < width && t.y < height
    }

    @inline(__always) public func index(_ t: Tile) -> Int { t.y * width + t.x }

    public func terrain(at t: Tile) -> Terrain { inside(t) ? terrain[index(t)] : .water }

    public func occupant(at t: Tile) -> Int { inside(t) ? occupant[index(t)] : 0 }

    @inline(__always) public func passable(_ t: Tile) -> Bool {
        guard inside(t) else { return false }
        let i = index(t)
        return terrain[i].walkable && occupant[i] == 0
    }

    public func setOccupant(_ fp: Footprint, _ id: Int) {
        for t in fp.tiles where inside(t) { occupant[index(t)] = id }
    }

    /// True when a straight walk from a to b crosses only passable tiles.
    public func clearLine(_ a: Vec2, _ b: Vec2) -> Bool {
        let d = b - a
        let steps = Int((max(abs(d.x), abs(d.y)) * 3).rounded(.up))
        if steps == 0 { return true }
        // Check a little to each side so paths do not shave building corners.
        let len = max(d.length, 0.0001)
        let side = Vec2(-d.y / len * 0.3, d.x / len * 0.3)
        for i in 0...steps {
            let p = a + d * (Double(i) / Double(steps))
            if !passable(p.tile) || !passable((p + side).tile) || !passable((p - side).tile) { return false }
        }
        return true
    }

    /// The nearest passable tile to t, searching outward in rings.
    public func nearestPassable(to t: Tile, maxRadius: Int = 12) -> Tile? {
        if passable(t) { return t }
        for r in 1...maxRadius {
            var best: Tile?
            var bestD = Double.infinity
            for dy in -r...r {
                for dx in -r...r where max(abs(dx), abs(dy)) == r {
                    let c = Tile(t.x + dx, t.y + dy)
                    if passable(c) {
                        let d = Double(dx * dx + dy * dy)
                        if d < bestD { bestD = d; best = c }
                    }
                }
            }
            if let b = best { return b }
        }
        return nil
    }

    /// Tiles reachable on foot from start (4-connected through walkable terrain, ignoring occupants
    /// that are resources when ignoreResources is set).
    public func reachable(from start: Tile, ignoring: (Int) -> Bool = { _ in false }) -> [Bool] {
        var seen = Array(repeating: false, count: width * height)
        guard inside(start) else { return seen }
        var stack = [start]
        seen[index(start)] = true
        while let t = stack.popLast() {
            for d in [Tile(1, 0), Tile(-1, 0), Tile(0, 1), Tile(0, -1)] {
                let n = t + d
                guard inside(n) else { continue }
                let i = index(n)
                if seen[i] || !terrain[i].walkable { continue }
                if occupant[i] != 0 && !ignoring(occupant[i]) { continue }
                seen[i] = true
                stack.append(n)
            }
        }
        return seen
    }
}
