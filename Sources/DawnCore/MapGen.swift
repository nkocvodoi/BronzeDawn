import Foundation

/// Builds a skirmish map from the world's seed: lakes, forests, a start for each
/// player with a town center, villagers, berries, a forest, gold and stone close by.
enum MapGen {
    static func generate(_ w: World) {
        let map = w.map
        let n = map.width
        for i in map.shade.indices { map.shade[i] = UInt8(w.rng.int(0...255)) }

        let starts = startTiles(count: w.players.count, size: n)
        w.startTiles = starts

        func farFromStarts(_ t: Tile, _ d: Double) -> Bool {
            starts.allSatisfy { t.center.distance(to: $0.center) >= d }
        }

        // Lakes, away from the bases.
        for _ in 0..<3 {
            var c = Tile(0, 0)
            for _ in 0..<30 {
                c = Tile(w.rng.int(8...(n - 9)), w.rng.int(8...(n - 9)))
                if farFromStarts(c, 18) { break }
            }
            let r = Double(w.rng.int(3...6))
            blob(w, center: c, radius: r) { t in map.terrain[map.index(t)] = .water }
        }
        // Shore.
        for y in 0..<n {
            for x in 0..<n where map.terrain[y * n + x] != .water {
                let t = Tile(x, y)
                let wet = [Tile(1, 0), Tile(-1, 0), Tile(0, 1), Tile(0, -1)].contains { map.terrain(at: t + $0) == .water && map.inside(t + $0) }
                if wet { map.terrain[y * n + x] = .sand }
            }
        }

        // Bases.
        for (pid, s) in starts.enumerated() {
            for y in (s.y - 8)...(s.y + 8) {
                for x in (s.x - 8)...(s.x + 8) where map.inside(Tile(x, y)) {
                    let d = Tile(x, y).center.distance(to: s.center)
                    if d <= 8 { map.terrain[y * n + x] = d <= 3.2 ? .dirt : .grass }
                }
            }
            let tc = w.addBuilding("town_center", owner: pid, origin: Tile(s.x - 1, s.y - 1), complete: true)
            let spots = [Tile(2, 0), Tile(2, 1), Tile(-2, 1), Tile(0, 2), Tile(1, -2), Tile(-1, 2)]
            for i in 0..<w.rules.economy.startVillagers {
                let t = s + spots[i % spots.count]
                w.spawnUnit("villager", owner: pid, at: t.center)
            }
            _ = tc
        }

        for s in starts {
            let a = w.rng.unit() * 2 * .pi
            let at = { (angle: Double, dist: Double) -> Tile in
                Vec2(s.center.x + cos(angle) * dist, s.center.y + sin(angle) * dist).tile
            }
            cluster(w, "berry_bush", center: at(a, 6), count: 6, spread: 1)
            forest(w, center: at(a + 2.1, 10), radius: 3.2, density: 0.85)
            forest(w, center: at(a + 3.0, 12), radius: 2.2, density: 0.8)
            cluster(w, "gold_mine", center: at(a + 3.9, 9), count: 5, spread: 1)
            cluster(w, "stone_mine", center: at(a + 4.9, 10), count: 4, spread: 1)
            for _ in 0..<6 {
                let t = at(w.rng.unit() * 2 * .pi, Double(w.rng.int(6...9)))
                w.addNode("tree", at: t)
            }
        }

        // The rest of the map.
        for _ in 0..<16 {
            let c = Tile(w.rng.int(2...(n - 3)), w.rng.int(2...(n - 3)))
            if farFromStarts(c, 11) { forest(w, center: c, radius: Double(w.rng.int(2...4)), density: 0.75) }
        }
        for _ in 0..<70 {
            let c = Tile(w.rng.int(1...(n - 2)), w.rng.int(1...(n - 2)))
            if farFromStarts(c, 8) { w.addNode("tree", at: c) }
        }
        for kind in ["gold_mine", "gold_mine", "stone_mine", "stone_mine", "berry_bush", "berry_bush", "berry_bush"] {
            for _ in 0..<30 {
                let c = Tile(w.rng.int(6...(n - 7)), w.rng.int(6...(n - 7)))
                if farFromStarts(c, 15) {
                    cluster(w, kind, center: c, count: kind == "berry_bush" ? 5 : 4, spread: 1)
                    break
                }
            }
        }

        connect(w, starts)
        w.nodes.removeAll { !$0.alive }
    }

    static func startTiles(count: Int, size n: Int) -> [Tile] {
        let corners = [Tile(14, n - 15), Tile(n - 15, 14), Tile(14, 14), Tile(n - 15, n - 15)]
        return Array(corners.prefix(max(1, min(count, corners.count))))
    }

    private static func blob(_ w: World, center c: Tile, radius r: Double, _ body: (Tile) -> Void) {
        let ri = Int(r.rounded(.up)) + 1
        for y in (c.y - ri)...(c.y + ri) {
            for x in (c.x - ri)...(c.x + ri) {
                let t = Tile(x, y)
                guard w.map.inside(t) else { continue }
                let wobble = 0.75 + Double(w.map.shade[w.map.index(t)]) / 255 * 0.5
                if t.center.distance(to: c.center) <= r * wobble { body(t) }
            }
        }
    }

    private static func forest(_ w: World, center: Tile, radius: Double, density: Double) {
        blob(w, center: center, radius: radius) { t in
            if w.rng.chance(density) { w.addNode("tree", at: t) }
        }
    }

    private static func cluster(_ w: World, _ kind: String, center: Tile, count: Int, spread: Int) {
        var placed = 0
        var ring = 0
        while placed < count && ring <= spread + 2 {
            for dy in -ring...ring {
                for dx in -ring...ring where max(abs(dx), abs(dy)) == ring && placed < count {
                    if w.addNode(kind, at: Tile(center.x + dx, center.y + dy)) != nil { placed += 1 }
                }
            }
            ring += 1
        }
    }

    /// Makes sure every base can walk to every other: carves a path through trees and water if not.
    private static func connect(_ w: World, _ starts: [Tile]) {
        guard starts.count > 1 else { return }
        let from = Tile(starts[0].x + 2, starts[0].y + 2)
        for s in starts.dropFirst() {
            let seen = w.map.reachable(from: from) { id in w.building(id) != nil }
            let to = Tile(s.x + 2, s.y + 2)
            if w.map.inside(to) && seen[w.map.index(to)] { continue }
            let a = from.center, b = to.center
            let steps = Int(a.distance(to: b) * 2)
            for i in 0...steps {
                let p = a.lerp(to: b, Double(i) / Double(steps))
                for dy in -1...1 {
                    for dx in -1...1 {
                        let t = Tile(p.tile.x + dx, p.tile.y + dy)
                        guard w.map.inside(t) else { continue }
                        if let node = w.node(w.map.occupant(at: t)) {
                            node.alive = false
                            w.map.setOccupant(Footprint(t, 1), 0)
                        }
                        if w.map.terrain(at: t) == .water { w.map.terrain[w.map.index(t)] = .sand }
                    }
                }
            }
        }
    }
}
