import Foundation

public enum Difficulty: String, CaseIterable {
    case easy, normal, hard

    var firstAttack: Double { [900.0, 660, 540][index] }
    var firstWave: Int { [6, 8, 10][index] }
    var villagerTarget: Int { [18, 24, 28][index] }
    /// How many military buildings it trains from at once.
    var producers: Int { [1, 2, 9][index] }
    /// Whether it reads the enemy army and trains the counter.
    var counters: Bool { self != .easy }
    private var index: Int { Difficulty.allCases.firstIndex(of: self)! }
}

/// The computer opponent. It plays by the same rules and through the same commands
/// as the player. It knows where the enemy base is, but not what is in it.
public final class AIController {
    public let player: Int
    public let difficulty: Difficulty
    var waveSize: Int
    var waves = 0
    var thinks = 0

    public init(player: Int, difficulty: Difficulty = .normal) {
        self.player = player
        self.difficulty = difficulty
        self.waveSize = difficulty.firstWave
    }

    // MARK: the plan, once a second

    func think(_ w: World) {
        let p = w.players[player]
        guard !p.defeated else { return }
        thinks += 1
        if difficulty == .easy && thinks % 2 == 0 { return }

        let mine = w.units(of: player)
        let villagers = mine.filter(\.isVillager)
        let army = mine.filter { !$0.isVillager }
        let bs = w.buildings(of: player)
        guard let tc = bs.first(where: { $0.def.id == "town_center" }) else {
            rebuildTownCenter(w, villagers)
            if !army.isEmpty { attackNearest(w, army) }
            return
        }
        let home = tc.center

        defend(w, home: home, army: army, villagers: villagers, buildings: bs)
        economy(w, tc: tc, villagers: villagers, buildings: bs)
        military(w, army: army, buildings: bs, villagers: villagers.count)
        attack(w, home: home, army: army)
    }

    private func count(_ bs: [Building], _ type: String) -> Int { bs.filter { $0.def.id == type }.count }

    private func economy(_ w: World, tc: Building, villagers: [Unit], buildings bs: [Building]) {
        let p = w.players[player]
        let home = tc.center
        let queued = bs.reduce(0) { $0 + $1.queue.count }

        // Advance as soon as we can.
        if tc.complete && tc.researching == nil && w.blockerForNextAge(player) == nil {
            w.advanceAge(player, building: tc.id)
        }

        // Villagers.
        let wantVillagers = difficulty.villagerTarget
        let ageBlock = w.blockerForNextAge(player)
        let saving = p.age == 0 && villagers.count >= 14 && (ageBlock == nil || ageBlock == "Not enough resources")
        if tc.complete && tc.researching == nil && tc.queue.count < 2 && villagers.count + tc.queue.count < wantVillagers
            && !saving && p.res.food >= 50 {
            w.train(player, building: tc.id, unit: "villager")
        }

        // Houses before we are capped.
        let houseBuilding = bs.contains { $0.def.id == "house" && !$0.complete }
        let room = p.popCap - p.pop - queued
        if p.popCap < w.rules.economy.popMax && room <= 3 && !houseBuilding && p.res.wood >= 30 {
            placeNear(w, "house", near: home, minR: 3, maxR: 12, villagers: villagers)
        }

        // Drop sites next to the resources.
        if count(bs, "storage_pit") == 0 && villagers.count >= 5 && p.res.wood >= 120 {
            let spot = w.nearestNode(.wood, near: home, within: 22)?.center ?? home
            placeNear(w, "storage_pit", near: spot, minR: 1, maxR: 6, villagers: villagers, margin: false)
        }
        if count(bs, "granary") == 0 && villagers.count >= 7 && p.res.wood >= 120 {
            let spot = w.nearestNode(.food, near: home, within: 14)?.center ?? home
            placeNear(w, "granary", near: spot, minR: 1, maxR: 6, villagers: villagers, margin: false)
        }
        if count(bs, "barracks") == 0 && villagers.count >= 9 && p.res.wood >= 125 {
            placeNear(w, "barracks", near: home, minR: 5, maxR: 14, villagers: villagers)
        }
        if p.age >= 1 {
            if count(bs, "archery_range") == 0 && p.res.wood >= 150 {
                placeNear(w, "archery_range", near: home, minR: 5, maxR: 15, villagers: villagers)
            } else if count(bs, "stable") == 0 && p.res.wood >= 150 {
                placeNear(w, "stable", near: home, minR: 5, maxR: 15, villagers: villagers)
            } else if count(bs, "watch_tower") < 2 && p.res.stone >= 150 {
                let enemy = enemyHome(w) ?? home
                let toward = home.lerp(to: enemy, 0.15)
                placeNear(w, "watch_tower", near: toward, minR: 1, maxR: 6, villagers: villagers)
            }
        }


        // Farms when the berries near home are gone.
        let foodNear = w.nearestNode(.food, near: home, within: 16) != nil
        let farms = bs.filter(\.isFarm)
        let wantFarms = max(0, Int(Double(villagers.count) * 0.4) - (foodNear ? 4 : 0))
        if farms.count < wantFarms && p.res.wood >= 75 && w.blocker(building: "farm", for: player) == nil {
            let granary = bs.first { $0.def.id == "granary" && $0.complete }?.center ?? home
            placeNear(w, "farm", near: granary, minR: 2, maxR: 9, villagers: villagers, margin: false)
        }

        assignIdle(w, home: home, villagers: villagers, farms: farms)
        finishAbandoned(w, villagers: villagers, buildings: bs)
        if thinks % 8 == 0 { rebalance(w, villagers: villagers, home: home) }
    }

    /// How to split the villagers. A big stockpile of something pulls workers off it.
    func shares(_ p: Player) -> [Res: Double] {
        var want: [Res: Double]
        if p.age == 0 {
            want = p.pop >= 14 ? [.food: 0.7, .wood: 0.3, .gold: 0, .stone: 0] : [.food: 0.55, .wood: 0.45, .gold: 0, .stone: 0]
        } else {
            want = [.food: 0.5, .wood: 0.3, .gold: 0.14, .stone: 0.06]
        }
        for r in Res.allCases {
            let stock = p.res[r]
            if stock > 600 { want[r, default: 0] *= 0.15 } else if stock > 300 { want[r, default: 0] *= 0.5 }
        }
        if p.res.stone >= 150 { want[.stone] = 0 }
        let sum = want.values.reduce(0, +)
        return want.mapValues { $0 / max(sum, 0.0001) }
    }

    /// Every so often move one worker from the most over-staffed resource to the most under-staffed.
    private func rebalance(_ w: World, villagers: [Unit], home: Vec2) {
        let want = shares(w.players[player])
        var on: [Res: [Unit]] = [:]
        for u in villagers {
            if case .gather = u.order, let r = u.lastGather, u.carry < 1 { on[r, default: []].append(u) }
        }
        let total = Double(villagers.count)
        func gap(_ r: Res) -> Double { want[r, default: 0] * total - Double(on[r]?.count ?? 0) }
        guard let need = Res.allCases.max(by: { gap($0) < gap($1) }),
              let spare = Res.allCases.min(by: { gap($0) < gap($1) }),
              gap(need) >= 1.5, gap(spare) <= -1.5, let u = on[spare]?.first else { return }
        if need == .food, let f = w.buildings(of: player).first(where: { b in
            b.isFarm && b.complete && !villagers.contains { if case .gather(let id) = $0.order { return id == b.id }; return false }
        }) {
            w.gather(player, [u.id], target: f.id)
        } else if let n = w.nearestNode(need, near: home, within: 30) {
            w.gather(player, [u.id], target: n.id)
        }
    }

    /// A building nobody is working on gets the nearest villager.
    private func finishAbandoned(_ w: World, villagers: [Unit], buildings bs: [Building]) {
        for b in bs where !b.complete {
            let working = villagers.contains { if case .build(let id) = $0.order { return id == b.id }; return false }
            if !working, let v = pickBuilder(villagers, near: b.center) { w.build(player, [v.id], target: b.id) }
        }
    }

    private func assignIdle(_ w: World, home: Vec2, villagers: [Unit], farms: [Building]) {
        let idle = villagers.filter { $0.order == .idle }
        guard !idle.isEmpty else { return }
        var working: [Res: Int] = [:]
        var farmed = Set<Int>()
        for u in villagers {
            switch u.order {
            case .gather(let id):
                if let r = u.lastGather { working[r, default: 0] += 1 }
                if w.building(id) != nil { farmed.insert(id) }
            case .returnGoods:
                if let r = u.carryRes { working[r, default: 0] += 1 }
            default: break
            }
        }
        let want = shares(w.players[player])
        for u in idle {
            let total = Double(villagers.count)
            let pick = Res.allCases.max { a, b in
                (want[a, default: 0] * total - Double(working[a, default: 0]))
                    < (want[b, default: 0] * total - Double(working[b, default: 0]))
            } ?? .wood
            var target: Int?
            if pick == .food, let f = farms.first(where: { $0.complete && !farmed.contains($0.id) }) {
                target = f.id
                farmed.insert(f.id)
            }
            if target == nil { target = w.nearestNode(pick, near: home, within: 30)?.id }
            if target == nil { target = w.nearestNode(.wood, near: u.pos, within: 40)?.id }
            if let t = target {
                w.gather(player, [u.id], target: t)
                working[pick, default: 0] += 1
            }
        }
    }

    // MARK: army

    /// Equal-spend strength of a against b (Lanchester square law), the same formula as balance.py.
    static func strength(_ a: UnitDef, _ b: UnitDef, _ rules: Rules) -> Double {
        let armor = a.isRanged ? b.pierceArmor : b.armor
        let dmg = max(rules.minDamage, a.attack - armor) + (a.bonus?[b.unitClass] ?? 0)
        let cost = max(1, ResBag(a.cost).total)
        return dmg / a.attackCooldown * a.hp / (cost * cost)
    }

    private func military(_ w: World, army: [Unit], buildings bs: [Building], villagers: Int) {
        let p = w.players[player]
        guard villagers >= 10 || !army.isEmpty || w.time > 360 else { return }
        // Before the next age, keep 500 food for it unless under pressure.
        let reserve: Double = p.age == 0 ? 520 : 60

        let enemyArmy = w.units.filter { $0.alive && w.isEnemy(player, $0.owner) && !$0.isVillager }
        let producing = bs.filter { $0.complete && $0.def.id != "town_center" && !$0.queue.isEmpty }.count
        var slots = difficulty.producers - producing
        for b in bs where b.complete && !(b.def.trains ?? []).isEmpty && b.def.id != "town_center" && b.queue.count < 2 {
            if b.queue.isEmpty { if slots <= 0 { continue }; slots -= 1 }
            let options = (b.def.trains ?? []).filter { w.blocker(unit: $0, for: player) == nil }
            guard !options.isEmpty else { continue }
            let seen = difficulty.counters ? enemyArmy : []
            let pick = difficulty.counters
                ? options.max { a, c in score(w, a, against: seen) < score(w, c, against: seen) }!
                : options[(thinks / 7) % options.count]
            let cost = w.rules.cost(unit: pick)
            if p.res[.food] - cost[.food] >= reserve || p.age > 0 {
                w.train(player, building: b.id, unit: pick)
            }
        }
    }

    private func score(_ w: World, _ type: String, against enemies: [Unit]) -> Double {
        guard let me = w.rules.units[type] else { return 0 }
        if enemies.isEmpty { return ResBag(me.cost).total + (me.isRanged ? 15 : 0) }
        var s = 0.0
        for e in enemies {
            let mine = AIController.strength(me, e.def, w.rules)
            let theirs = AIController.strength(e.def, me, w.rules)
            s += log(max(0.01, mine / max(0.0001, theirs)))
        }
        return s
    }

    private func defend(_ w: World, home: Vec2, army: [Unit], villagers: [Unit], buildings bs: [Building]) {
        var threats: [Unit] = []
        for e in w.units where e.alive && w.isEnemy(player, e.owner) {
            if bs.contains(where: { $0.distance(to: e.pos) < 10 }) { threats.append(e) }
        }
        guard !threats.isEmpty else { return }
        for u in army {
            if case .attack = u.order { continue }
            let t = threats.min { $0.pos.distance(to: u.pos) < $1.pos.distance(to: u.pos) }!
            if t.pos.distance(to: u.pos) < 30 { w.attack(player, [u.id], target: t.id) }
        }
        // Outnumbered at home: villagers next to the fight join in.
        let soldiers = threats.filter { !$0.isVillager }.count
        if soldiers > army.count {
            for v in villagers {
                if let t = threats.min(by: { $0.pos.distance(to: v.pos) < $1.pos.distance(to: v.pos) }),
                   t.pos.distance(to: v.pos) < 5 {
                    w.attack(player, [v.id], target: t.id)
                }
            }
        }
    }

    private func attack(_ w: World, home: Vec2, army: [Unit]) {
        let idle = army.filter { $0.order == .idle }
        // Units that already took a base apart keep going to the next building.
        let away = idle.filter { $0.pos.distance(to: home) > 18 }
        if !away.isEmpty { attackNearest(w, away) }

        guard w.time >= difficulty.firstAttack else { return }
        let ready = idle.filter { $0.pos.distance(to: home) <= 18 }
        let pop = w.players[player]
        let maxed = pop.pop >= pop.popCap - 2 && ready.count >= 6
        let theirArmy = w.units.filter { $0.alive && w.isEnemy(player, $0.owner) && !$0.isVillager }.count
        let weak = ready.count >= 6 && theirArmy * 2 <= ready.count
        guard ready.count >= waveSize || maxed || weak, let target = enemyHome(w) else { return }
        w.move(player, ready.map(\.id), to: target, attackMove: true)
        waves += 1
        waveSize = min(waveSize + 2, 14)
    }

    private func attackNearest(_ w: World, _ group: [Unit]) {
        guard let c = group.first?.pos else { return }
        let targets = w.buildings.filter { $0.alive && w.isEnemy(player, $0.owner) }
        if let t = targets.min(by: { $0.distance(to: c) < $1.distance(to: c) }) {
            w.move(player, group.map(\.id), to: t.center, attackMove: true)
        } else if let u = w.units.first(where: { $0.alive && w.isEnemy(player, $0.owner) }) {
            w.move(player, group.map(\.id), to: u.pos, attackMove: true)
        }
    }

    private func enemyHome(_ w: World) -> Vec2? {
        let enemies = w.players.filter { w.isEnemy(player, $0.id) && !$0.defeated }
        guard let e = enemies.first else { return nil }
        if let tc = w.buildings.first(where: { $0.alive && $0.owner == e.id && $0.def.id == "town_center" }) {
            return tc.center
        }
        return w.buildings.first { $0.alive && $0.owner == e.id }?.center ?? w.startTiles[e.id].center
    }

    private func rebuildTownCenter(_ w: World, _ villagers: [Unit]) {
        guard let v = villagers.first, w.blocker(building: "town_center", for: player) == nil else { return }
        placeNear(w, "town_center", near: v.pos, minR: 2, maxR: 12, villagers: villagers)
    }

    // MARK: placement

    private func placeNear(_ w: World, _ type: String, near: Vec2, minR: Int, maxR: Int,
                           villagers: [Unit], margin: Bool = true) {
        guard w.blocker(building: type, for: player) == nil,
              let builder = pickBuilder(villagers, near: near),
              let spot = findSpot(w, type, near: near, minR: minR, maxR: maxR, margin: margin) else { return }
        _ = w.place(player, type, at: spot, builders: [builder.id])
    }

    private func pickBuilder(_ villagers: [Unit], near: Vec2) -> Unit? {
        let free = villagers.filter { u in
            if case .build = u.order { return false }
            return u.carry < 5
        }
        return free.first { $0.order == .idle }
            ?? free.min { $0.pos.distance(to: near) < $1.pos.distance(to: near) }
    }

    func findSpot(_ w: World, _ type: String, near: Vec2, minR: Int, maxR: Int, margin: Bool) -> Tile? {
        guard let size = w.rules.buildings[type]?.size else { return nil }
        let c = near.tile
        for r in minR...maxR {
            for dy in -r...r {
                for dx in -r...r where max(abs(dx), abs(dy)) == r {
                    let origin = Tile(c.x + dx - size / 2, c.y + dy - size / 2)
                    guard w.canPlace(type, at: origin) else { continue }
                    if hasGap(w, origin, size, checkNodes: margin) { return origin }
                }
            }
        }
        return nil
    }

    /// Keeps a one-tile lane around new buildings so the base never walls itself in.
    private func hasGap(_ w: World, _ origin: Tile, _ size: Int, checkNodes: Bool) -> Bool {
        for y in (origin.y - 1)...(origin.y + size) {
            for x in (origin.x - 1)...(origin.x + size) {
                let t = Tile(x, y)
                if Footprint(origin, size).contains(t) { continue }
                guard w.map.inside(t), w.map.terrain(at: t).walkable else { return false }
                let id = w.map.occupant(at: t)
                if id == 0 { continue }
                if w.building(id) != nil { return false }
                if checkNodes { return false }
            }
        }
        return true
    }
}
