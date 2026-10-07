import Foundation

/// Runs a whole match with no window: one AI per player, a fixed seed, a time limit.
/// This is the integration test. It must end with a winner and nothing broken.
public struct SimReport {
    public let seed: UInt64
    public let winner: Int?
    public let seconds: Double
    public let lines: [String]
    public let problems: [String]
}

public enum Simulation {
    public static func run(rules: Rules, seed: UInt64, minutes: Double = 40,
                           difficulties: [Difficulty] = [.normal, .normal],
                           progress: ((World) -> Void)? = nil) -> SimReport {
        let w = World(rules: rules, seed: seed, playerNames: difficulties.indices.map { "AI \($0 + 1)" })
        w.ais = difficulties.enumerated().map { AIController(player: $0.offset, difficulty: $0.element) }
        var problems: [String] = []
        let limit = Int(minutes * 60 / World.dt)
        var ageTimes: [Int: Double] = [:]
        while w.winner == nil && w.tick < limit {
            w.step()
            for e in w.events {
                if case let .ageReached(p, _) = e { ageTimes[p] = w.time }
            }
            w.events.removeAll(keepingCapacity: true)
            if w.tick % 1200 == 0 {
                progress?(w)
                for p in w.players where Res.allCases.contains(where: { p.res[$0] < -0.001 }) {
                    problems.append("player \(p.id) went below zero at \(Int(w.time))s")
                }
                for u in w.units where !w.map.terrain(at: u.pos.tile).walkable {
                    problems.append("unit \(u.id) is standing in water at \(Int(w.time))s")
                }
            }
        }
        var lines: [String] = []
        for p in w.players {
            let units = w.units(of: p.id)
            let v = units.filter(\.isVillager).count
            let age = ageTimes[p.id].map { "Tool Age at \(clock($0))" } ?? "stayed in Stone Age"
            lines.append("\(p.name): \(p.defeated ? "defeated" : "standing"), \(v) villagers, "
                + "\(units.count - v) soldiers, \(w.buildings(of: p.id).count) buildings, \(age), "
                + "gathered \(Int(p.stats.gathered.total)), trained \(p.stats.trained), kills \(p.stats.kills)")
        }
        if w.winner == nil { problems.append("no winner after \(Int(minutes)) minutes") }
        return SimReport(seed: seed, winner: w.winner, seconds: w.time, lines: lines, problems: problems)
    }

    public static func clock(_ t: Double) -> String {
        let s = Int(t)
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}
