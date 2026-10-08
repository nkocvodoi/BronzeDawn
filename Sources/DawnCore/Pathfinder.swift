import Foundation

/// A* on the tile grid, 8 directions, no cutting corners past blocked tiles.
/// When the goal cannot be reached it returns the path to the closest tile it found,
/// so a unit ordered onto a lake walks to the shore.
public final class Pathfinder {
    private let map: GridMap
    private var gScore: [Float]
    private var parent: [Int32]
    private var stamp: [UInt32]
    private var closed: [UInt32]
    private var generation: UInt32 = 0
    public var maxExpanded = 9000
    /// Whether the last find() reached a goal tile, rather than the closest tile it could.
    public private(set) var reached = false

    public init(map: GridMap) {
        self.map = map
        let n = map.width * map.height
        gScore = Array(repeating: 0, count: n)
        parent = Array(repeating: -1, count: n)
        stamp = Array(repeating: 0, count: n)
        closed = Array(repeating: 0, count: n)
    }

    private struct Heap {
        var items: [(f: Float, i: Int32)] = []

        mutating func push(_ f: Float, _ i: Int32) {
            items.append((f, i))
            var c = items.count - 1
            while c > 0 {
                let p = (c - 1) / 2
                if items[p].f <= items[c].f { break }
                items.swapAt(p, c)
                c = p
            }
        }

        mutating func pop() -> Int32? {
            guard let first = items.first else { return nil }
            let last = items.removeLast()
            if !items.isEmpty {
                items[0] = last
                var p = 0
                while true {
                    let l = 2 * p + 1, r = l + 1
                    var m = p
                    if l < items.count && items[l].f < items[m].f { m = l }
                    if r < items.count && items[r].f < items[m].f { m = r }
                    if m == p { break }
                    items.swapAt(p, m)
                    p = m
                }
            }
            return first.i
        }
    }

    private static let dirs: [(Int, Int, Float)] = [
        (1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1),
        (1, 1, 1.4142), (1, -1, 1.4142), (-1, 1, 1.4142), (-1, -1, 1.4142),
    ]

    /// Path of waypoints (tile centers, smoothed) from `from` to a tile that passes `isGoal`.
    /// `toward` steers the heuristic and picks the fallback when no goal tile is reachable.
    public func find(from: Vec2, toward: Vec2, isGoal: (Tile) -> Bool) -> [Vec2] {
        let w = map.width
        var start = from.tile
        if !map.passable(start), let near = map.nearestPassable(to: start, maxRadius: 3) { start = near }
        reached = false
        guard map.inside(start) else { return [] }
        if isGoal(start) { reached = true; return [] }

        generation &+= 1
        let gen = generation
        let tx = Float(toward.x), ty = Float(toward.y)
        func h(_ x: Int, _ y: Int) -> Float {
            let dx = abs(Float(x) + 0.5 - tx), dy = abs(Float(y) + 0.5 - ty)
            return max(dx, dy) + 0.4142 * min(dx, dy)
        }

        var heap = Heap()
        let si = Int32(start.y * w + start.x)
        gScore[Int(si)] = 0
        parent[Int(si)] = -1
        stamp[Int(si)] = gen
        heap.push(h(start.x, start.y), si)
        var best = si
        var bestH = h(start.x, start.y)
        var found: Int32 = -1
        var expanded = 0

        while let cur = heap.pop() {
            let ci = Int(cur)
            if closed[ci] == gen { continue }
            closed[ci] = gen
            let cx = ci % w, cy = ci / w
            if isGoal(Tile(cx, cy)) { found = cur; break }
            let hc = h(cx, cy)
            if hc < bestH { bestH = hc; best = cur }
            expanded += 1
            if expanded > maxExpanded { break }
            for (dx, dy, cost) in Pathfinder.dirs {
                let nx = cx + dx, ny = cy + dy
                let nt = Tile(nx, ny)
                guard map.passable(nt) else { continue }
                if dx != 0 && dy != 0 && (!map.passable(Tile(cx + dx, cy)) || !map.passable(Tile(cx, cy + dy))) {
                    continue
                }
                let ni = ny * w + nx
                if closed[ni] == gen { continue }
                let g = gScore[ci] + cost
                if stamp[ni] != gen || g < gScore[ni] {
                    stamp[ni] = gen
                    gScore[ni] = g
                    parent[ni] = cur
                    heap.push(g + h(nx, ny), Int32(ni))
                }
            }
        }

        reached = found >= 0
        var node = found >= 0 ? found : best
        var tiles: [Tile] = []
        while node >= 0 && node != si {
            tiles.append(Tile(Int(node) % w, Int(node) / w))
            node = parent[Int(node)]
        }
        tiles.reverse()
        return smooth(from: from, tiles.map(\.center))
    }

    /// Drops waypoints that a straight line can skip.
    private func smooth(from: Vec2, _ pts: [Vec2]) -> [Vec2] {
        guard pts.count > 2 else { return pts }
        var out: [Vec2] = []
        var anchor = from
        var i = 0
        while i < pts.count {
            var j = pts.count - 1
            while j > i && !map.clearLine(anchor, pts[j]) { j -= 1 }
            out.append(pts[j])
            anchor = pts[j]
            i = j + 1
        }
        return out
    }
}
