import Foundation

/// What a context (right) click turned into, so the UI can give feedback.
public enum SmartResult {
    case moved, attacked, gathered, built, returned, nothing
}

struct Missile {
    let targetId: Int
    let damage: Double
    let attackerId: Int
    var remaining: Double
}

/// The whole simulation. No rendering in here: it runs the same with a window,
/// in tests, and in a headless AI-versus-AI match.
public final class World {
    public static let dt = 0.05      // 20 steps a second

    public let rules: Rules
    public let seed: UInt64
    public let map: GridMap
    public let pathfinder: Pathfinder
    public internal(set) var players: [Player] = []
    public internal(set) var units: [Unit] = []
    public internal(set) var buildings: [Building] = []
    public internal(set) var nodes: [ResourceNode] = []
    public internal(set) var fog: [Fog] = []
    public internal(set) var time = 0.0
    public internal(set) var tick = 0
    public internal(set) var winner: Int?
    public var events: [GameEvent] = []
    public var ais: [AIController] = []
    /// The start position of each player's town center, for the AI and the camera.
    public internal(set) var startTiles: [Tile] = []

    var rng: RNG
    var byId: [Int: Entity] = [:]
    var nextId = 1
    var missiles: [Missile] = []
    var alertTimer: [Double] = []

    public init(rules: Rules, seed: UInt64, playerNames: [String] = ["You", "Enemy"],
                size: Int = 72, generate: Bool = true) {
        self.rules = rules
        self.seed = seed
        self.rng = RNG(seed: seed)
        self.map = GridMap(width: size, height: size)
        self.pathfinder = Pathfinder(map: map)
        let start = ResBag(rules.economy.start)
        for (i, n) in playerNames.enumerated() {
            players.append(Player(id: i, name: n, res: start))
            fog.append(Fog(width: size, height: size))
            alertTimer.append(0)
        }
        if generate {
            MapGen.generate(self)
        }
        refreshPopulation()
        for p in players { fog[p.id].update(self, player: p.id) }
    }

    // MARK: lookup

    public func entity(_ id: Int) -> Entity? {
        guard let e = byId[id], e.alive else { return nil }
        return e
    }

    public func unit(_ id: Int) -> Unit? { entity(id) as? Unit }
    public func building(_ id: Int) -> Building? { entity(id) as? Building }
    public func node(_ id: Int) -> ResourceNode? { entity(id) as? ResourceNode }

    public func units(of player: Int) -> [Unit] { units.filter { $0.alive && $0.owner == player } }
    public func buildings(of player: Int) -> [Building] { buildings.filter { $0.alive && $0.owner == player } }

    public func isEnemy(_ a: Int, _ b: Int) -> Bool { a != b && a != gaia && b != gaia }

    // MARK: creating things

    @discardableResult
    public func spawnUnit(_ type: String, owner: Int, at pos: Vec2) -> Unit {
        let u = Unit(id: nextId, owner: owner, def: rules.units[type]!, pos: pos)
        nextId += 1
        units.append(u)
        byId[u.id] = u
        return u
    }

    @discardableResult
    public func addBuilding(_ type: String, owner: Int, origin: Tile, complete: Bool) -> Building {
        let b = Building(id: nextId, owner: owner, def: rules.buildings[type]!, origin: origin, complete: complete)
        nextId += 1
        buildings.append(b)
        byId[b.id] = b
        map.setOccupant(b.footprint, b.id)
        nudgeUnits(out: b.footprint)
        return b
    }

    @discardableResult
    func addNode(_ type: String, at tile: Tile) -> ResourceNode? {
        guard let def = rules.nodes[type], map.passable(tile) else { return nil }
        let n = ResourceNode(id: nextId, def: def, tile: tile)
        nextId += 1
        nodes.append(n)
        byId[n.id] = n
        map.setOccupant(Footprint(tile, 1), n.id)
        return n
    }

    private func nudgeUnits(out fp: Footprint) {
        for u in units where u.alive && fp.contains(u.pos.tile) {
            if let t = map.nearestPassable(to: u.pos.tile) {
                u.pos = t.center
                u.prevPos = u.pos
                u.path = []
            }
        }
    }

    // MARK: rules queries

    public func canPlace(_ type: String, at origin: Tile, for player: Int? = nil) -> Bool {
        guard let def = rules.buildings[type] else { return false }
        for t in Footprint(origin, def.size).tiles {
            guard map.inside(t), map.terrain(at: t).walkable, map.occupant(at: t) == 0 else { return false }
            if let p = player, !fog[p].isExplored(t) { return false }
        }
        return true
    }

    /// Why the player cannot place or train this right now, or nil when they can.
    public func blocker(building type: String, for player: Int) -> String? {
        guard let def = rules.buildings[type] else { return "unknown building" }
        let p = players[player]
        if rules.ageIndex(def.age) > p.age { return "Needs \(rules.ages[rules.ageIndex(def.age)].name)" }
        for req in def.requires ?? [] where !buildings(of: player).contains(where: { $0.def.id == req && $0.complete }) {
            return "Needs a \(rules.buildings[req]?.name ?? req)"
        }
        if !p.res.covers(rules.cost(building: type)) { return "Not enough resources" }
        return nil
    }

    public func blocker(unit type: String, for player: Int) -> String? {
        guard let def = rules.units[type] else { return "unknown unit" }
        let p = players[player]
        if rules.ageIndex(def.age) > p.age { return "Needs \(rules.ages[rules.ageIndex(def.age)].name)" }
        if !p.res.covers(rules.cost(unit: type)) { return "Not enough resources" }
        return nil
    }

    /// Distinct building types from earlier ages the player has finished, the age-up requirement.
    public func ageRequirementCount(for player: Int) -> Int {
        let p = players[player]
        var kinds = Set<String>()
        for b in buildings(of: player) where b.complete && b.def.id != "town_center" && b.def.id != "house" {
            if rules.ageIndex(b.def.age) <= p.age { kinds.insert(b.def.id) }
        }
        return kinds.count
    }

    public func blockerForNextAge(_ player: Int) -> String? {
        let p = players[player]
        guard p.age + 1 < rules.ages.count else { return "Already in the last age" }
        if buildings.contains(where: { $0.alive && $0.owner == player && $0.researching != nil }) {
            return "Already advancing"
        }
        let next = rules.ages[p.age + 1]
        let need = next.requiresBuildings ?? 0
        let have = ageRequirementCount(for: player)
        if have < need { return "Needs \(need) different buildings (\(have) built)" }
        if !p.res.covers(ResBag(next.cost ?? [:])) { return "Not enough resources" }
        return nil
    }

    public func trainProgress(_ b: Building) -> Double {
        if let age = b.researching, let t = rules.ages[age].researchTime { return min(1, b.researchTimer / t) }
        guard let first = b.queue.first, let def = rules.units[first] else { return 0 }
        return min(1, b.queueTimer / def.trainTime)
    }

    // MARK: commands. The player and the AI both go through these.

    private func own(_ ids: [Int], _ player: Int) -> [Unit] {
        ids.compactMap { unit($0) }.filter { $0.owner == player }
    }

    public func move(_ player: Int, _ ids: [Int], to target: Vec2, attackMove: Bool = false) {
        let group = own(ids, player)
        let offsets = formation(group.count)
        for (i, u) in group.enumerated() {
            var dest = target + offsets[i]
            if !map.passable(dest.tile), let t = map.nearestPassable(to: dest.tile, maxRadius: 4) { dest = t.center }
            u.order = .move(dest, attackMove: attackMove && !u.isVillager)
            u.resumeMove = nil
            u.path = pathfinder.find(from: u.pos, toward: dest) { $0 == dest.tile }
            u.pathTarget = dest
            if !u.path.isEmpty { u.path[u.path.count - 1] = dest }
        }
    }

    public func stop(_ player: Int, _ ids: [Int]) {
        for u in own(ids, player) { u.order = .idle; u.path = []; u.resumeMove = nil }
    }

    public func attack(_ player: Int, _ ids: [Int], target: Int) {
        guard let t = entity(target), isEnemy(player, t.owner) else { return }
        for u in own(ids, player) {
            u.order = .attack(t.id)
            u.resumeMove = nil
            u.path = []
            u.repathTimer = 0
        }
    }

    public func gather(_ player: Int, _ ids: [Int], target: Int) {
        guard let e = entity(target) else { return }
        let res: Res
        if let n = e as? ResourceNode { res = n.res }
        else if let b = e as? Building, b.isFarm, b.owner == player { res = .food }
        else { return }
        for u in own(ids, player) where u.isVillager {
            u.order = .gather(e.id)
            u.lastGather = res
            u.path = []
            u.repathTimer = 0
        }
    }

    public func build(_ player: Int, _ ids: [Int], target: Int) {
        guard let b = building(target), b.owner == player else { return }
        for u in own(ids, player) where u.isVillager {
            u.order = .build(b.id)
            u.path = []
            u.repathTimer = 0
        }
    }

    /// The right click: attack an enemy, gather a resource, build or farm your own building, or move.
    @discardableResult
    public func smart(_ player: Int, _ ids: [Int], target: Int?, at pos: Vec2) -> SmartResult {
        let group = own(ids, player)
        guard !group.isEmpty else { return .nothing }
        if let tid = target, let e = entity(tid) {
            if isEnemy(player, e.owner) {
                attack(player, ids, target: tid)
                return .attacked
            }
            let villagers = group.filter(\.isVillager).map(\.id)
            let others = group.filter { !$0.isVillager }.map(\.id)
            var result = SmartResult.moved
            if !villagers.isEmpty {
                if e is ResourceNode {
                    gather(player, villagers, target: tid); result = .gathered
                } else if let b = e as? Building, b.owner == player {
                    if !b.complete { build(player, villagers, target: tid); result = .built }
                    else if b.isFarm { gather(player, villagers, target: tid); result = .gathered }
                    else {
                        let carriers = villagers.filter { id in
                            guard let u = unit(id), let r = u.carryRes, u.carry > 0 else { return false }
                            return b.dropsOff(r)
                        }
                        for id in carriers { if let u = unit(id) { u.order = .returnGoods(resume: nil); u.path = [] } }
                        let rest = villagers.filter { !carriers.contains($0) }
                        if !rest.isEmpty { move(player, rest, to: pos) }
                        result = carriers.isEmpty ? .moved : .returned
                    }
                } else {
                    move(player, villagers, to: pos)
                }
            }
            if !others.isEmpty { move(player, others, to: pos) }
            return result
        }
        move(player, ids, to: pos)
        return .moved
    }

    /// Places a building and sends the builders. Returns the new building's id or why not.
    public func place(_ player: Int, _ type: String, at origin: Tile, builders: [Int]) -> Result<Int, PlaceError> {
        if let why = blocker(building: type, for: player) { return .failure(PlaceError(why)) }
        guard canPlace(type, at: origin, for: player) else { return .failure(PlaceError("Cannot build there")) }
        players[player].res.spend(rules.cost(building: type))
        let b = addBuilding(type, owner: player, origin: origin, complete: false)
        build(player, builders, target: b.id)
        return .success(b.id)
    }

    @discardableResult
    public func train(_ player: Int, building id: Int, unit type: String) -> String? {
        guard let b = building(id), b.owner == player, b.complete else { return "No building" }
        guard b.def.trains?.contains(type) == true else { return "Cannot train that here" }
        if let why = blocker(unit: type, for: player) { return why }
        if b.queue.count >= 5 { return "Queue is full" }
        players[player].res.spend(rules.cost(unit: type))
        b.queue.append(type)
        return nil
    }

    public func cancel(_ player: Int, building id: Int) {
        guard let b = building(id), b.owner == player else { return }
        if let age = b.researching {
            players[player].res.add(ResBag(rules.ages[age].cost ?? [:]))
            b.researching = nil
            b.researchTimer = 0
        } else if let last = b.queue.popLast() {
            players[player].res.add(rules.cost(unit: last))
            if b.queue.isEmpty { b.queueTimer = 0 }
        }
    }

    @discardableResult
    public func advanceAge(_ player: Int, building id: Int) -> String? {
        guard let b = building(id), b.owner == player, b.complete, b.def.id == "town_center" else {
            return "Only a Town Center can advance"
        }
        if let why = blockerForNextAge(player) { return why }
        let next = players[player].age + 1
        players[player].res.spend(ResBag(rules.ages[next].cost ?? [:]))
        b.researching = next
        b.researchTimer = 0
        return nil
    }

    /// The Delete key: the owner destroys one of their own units or buildings.
    public func destroy(_ player: Int, _ id: Int) {
        guard let e = entity(id), e.owner == player else { return }
        kill(e, by: 0)
    }

    public func setRally(_ player: Int, building id: Int, to pos: Vec2) {
        guard let b = building(id), b.owner == player else { return }
        b.rally = pos
    }

    private func formation(_ n: Int) -> [Vec2] {
        var out: [Vec2] = [Vec2(0, 0)]
        var ring = 1
        while out.count < n {
            let count = ring * 6
            for k in 0..<count where out.count < n {
                let a = Double(k) / Double(count) * 2 * .pi
                out.append(Vec2(cos(a), sin(a)) * (Double(ring) * 0.75))
            }
            ring += 1
        }
        return out
    }

    // MARK: the step

    public func step() {
        let dt = World.dt
        tick += 1
        time += dt
        for u in units where u.alive { u.prevPos = u.pos; u.busy = false }
        for i in alertTimer.indices { alertTimer[i] -= dt }

        if winner == nil {
            for ai in ais where tick % 20 == (ai.player * 7) % 20 { ai.think(self) }
        }
        for b in buildings where b.alive { updateBuilding(b, dt) }
        for u in units where u.alive { updateUnit(u, dt) }
        updateMissiles(dt)
        separate()
        compact()
        refreshPopulation()
        if tick % 5 == 0 { for p in players { fog[p.id].update(self, player: p.id) } }
        if tick % 20 == 0 { checkDefeat() }
    }

    public func refreshPopulation() {
        for p in players { p.pop = 0; p.popCap = 0 }
        for u in units where u.alive && u.owner >= 0 { players[u.owner].pop += u.def.pop }
        for b in buildings where b.alive && b.complete && b.owner >= 0 {
            players[b.owner].popCap += b.def.popProvided ?? 0
        }
        for p in players { p.popCap = min(p.popCap, rules.economy.popMax) }
    }

    private func compact() {
        if units.contains(where: { !$0.alive }) { units.removeAll { !$0.alive } }
        if buildings.contains(where: { !$0.alive }) { buildings.removeAll { !$0.alive } }
        if nodes.contains(where: { !$0.alive }) { nodes.removeAll { !$0.alive } }
    }

    private func checkDefeat() {
        guard winner == nil else { return }
        for p in players where !p.defeated {
            let hasUnits = units.contains { $0.alive && $0.owner == p.id }
            let canTrain = buildings.contains { $0.alive && $0.owner == p.id && $0.complete && !($0.def.trains ?? []).isEmpty }
            if !hasUnits && !canTrain {
                p.defeated = true
                events.append(.message(player: -1, text: "\(p.name) has been defeated"))
            }
        }
        let left = players.filter { !$0.defeated }
        if left.count <= 1 {
            winner = left.first?.id ?? -1
            events.append(.gameOver(winner: winner!))
        }
    }

    // MARK: buildings

    private func updateBuilding(_ b: Building, _ dt: Double) {
        guard b.complete, b.owner >= 0 else { return }
        let p = players[b.owner]
        if let age = b.researching {
            b.researchTimer += dt
            if b.researchTimer >= (rules.ages[age].researchTime ?? 60) {
                p.age = max(p.age, age)
                b.researching = nil
                b.researchTimer = 0
                events.append(.ageReached(player: p.id, age: age))
                events.append(.message(player: p.id, text: "\(p.name) reached the \(rules.ages[age].name)"))
            }
        } else if let type = b.queue.first, let def = rules.units[type] {
            if p.pop + def.pop > p.popCap {
                if !b.housingWarned {
                    b.housingWarned = true
                    events.append(.message(player: p.id, text: "Need more houses"))
                }
            } else {
                b.housingWarned = false
                b.queueTimer += dt
                if b.queueTimer >= def.trainTime {
                    b.queue.removeFirst()
                    b.queueTimer = 0
                    let u = spawnUnit(type, owner: p.id, at: exitTile(of: b, toward: b.rally).center)
                    p.pop += def.pop
                    p.stats.trained += 1
                    events.append(.trained(id: u.id, owner: p.id))
                    if let r = b.rally {
                        if u.isVillager, let node = node(map.occupant(at: r.tile)) {
                            gather(p.id, [u.id], target: node.id)
                        } else {
                            move(p.id, [u.id], to: r)
                        }
                    }
                }
            }
        }
        if let atk = b.def.attack, let range = b.def.range {
            b.cooldown -= dt
            if b.cooldown <= 0 {
                if let t = nearestEnemyUnit(of: b.owner, near: b.center, within: range + Double(b.def.size) / 2) {
                    fire(from: b.center, attackerId: b.id, at: t,
                         damage: damage(attack: atk, ranged: true, bonus: nil, vs: t))
                    b.cooldown = b.def.attackCooldown ?? 2
                }
            }
        }
    }

    private func exitTile(of b: Building, toward: Vec2?) -> Tile {
        let fp = b.footprint
        var best: Tile?
        var bestD = Double.infinity
        let aim = toward ?? Vec2(fp.maxX + 1, fp.maxY + 1)
        for y in (fp.origin.y - 1)...(fp.origin.y + fp.size) {
            for x in (fp.origin.x - 1)...(fp.origin.x + fp.size) {
                let t = Tile(x, y)
                if fp.contains(t) || !map.passable(t) { continue }
                let d = t.center.distance(to: aim)
                if d < bestD { bestD = d; best = t }
            }
        }
        return best ?? map.nearestPassable(to: fp.origin, maxRadius: 8) ?? fp.origin
    }

    // MARK: units

    enum Approach { case arrived, moving, blocked }

    /// Walks u toward entity e until within reach of its edge.
    func approach(_ u: Unit, _ e: Entity, reach: Double, _ dt: Double) -> Approach {
        if e.distance(to: u.pos) <= reach + 0.05 {
            u.path = []
            return .arrived
        }
        u.repathTimer -= dt
        let goal = e.center
        let stale = u.pathTarget.map { $0.distance(to: goal) > 1.0 } ?? true
        if u.path.isEmpty || (stale && u.repathTimer <= 0) {
            if u.repathTimer > 0 && u.path.isEmpty { return .moving }  // waiting out a failed search
            u.path = pathfinder.find(from: u.pos, toward: goal) { t in
                e.distance(to: t.center) <= reach
            }
            u.pathTarget = goal
            u.repathTimer = 0.6 + Double(u.id % 7) * 0.05
            if u.path.isEmpty {
                // Already on a goal tile: step to its center, which is in reach.
                let here = u.pos.tile
                guard map.passable(here), e.distance(to: here.center) <= reach else { return .blocked }
                u.path = [here.center]
            }
        }
        followPath(u, dt)
        return .moving
    }

    @discardableResult
    private func followPath(_ u: Unit, _ dt: Double) -> Bool {
        var budget = u.def.speed * dt
        while budget > 0, let next = u.path.first {
            if !map.passable(next.tile) && map.occupant(at: next.tile) != 0 {
                u.path = []
                u.repathTimer = 0
                return true
            }
            let d = next - u.pos
            let len = d.length
            if len <= budget {
                u.pos = next
                u.path.removeFirst()
                budget -= len
            } else {
                u.facing = d * (1 / len)
                u.pos = u.pos + d * (budget / len)
                budget = 0
            }
        }
        return u.path.isEmpty
    }

    private func face(_ u: Unit, _ p: Vec2) {
        let d = p - u.pos
        if d.length > 0.01 { u.facing = d * (1 / d.length) }
    }

    private func updateUnit(_ u: Unit, _ dt: Double) {
        u.cooldown -= dt
        u.scanTimer -= dt
        switch u.order {
        case .idle:
            if !u.isVillager && u.scanTimer <= 0 {
                u.scanTimer = 0.5
                if let t = nearestEnemy(of: u.owner, near: u.pos, within: u.def.los) {
                    u.order = .attack(t.id)
                }
            }

        case let .move(dest, attackMove):
            if attackMove && u.scanTimer <= 0 {
                u.scanTimer = 0.5
                if let t = nearestEnemy(of: u.owner, near: u.pos, within: u.def.los) {
                    u.resumeMove = dest
                    u.order = .attack(t.id)
                    u.path = []
                    return
                }
            }
            if u.path.isEmpty {
                if u.pos.distance(to: dest) > 0.15 && map.clearLine(u.pos, dest) {
                    u.path = [dest]
                } else {
                    u.order = .idle
                    return
                }
            }
            if followPath(u, dt) { u.order = .idle }

        case .gather(let id):
            updateGather(u, id, dt)

        case .returnGoods(let resume):
            updateReturn(u, resume, dt)

        case .build(let id):
            updateBuild(u, id, dt)

        case .attack(let id):
            guard let t = entity(id), isEnemy(u.owner, t.owner) else {
                if let m = u.resumeMove {
                    u.resumeMove = nil
                    move(u.owner, [u.id], to: m, attackMove: true)
                } else {
                    u.order = .idle
                    u.scanTimer = 0
                }
                return
            }
            // Hitting a building while soldiers attack you is how armies die: turn to face them.
            if t is Building && u.scanTimer <= 0 {
                u.scanTimer = 0.5
                if let threat = nearestEnemyUnit(of: u.owner, near: u.pos, within: u.def.los) {
                    u.order = .attack(threat.id)
                    u.path = []
                    u.repathTimer = 0
                    return
                }
            }
            let reach = u.def.isRanged ? u.def.range : 0.9
            switch approach(u, t, reach: reach, dt) {
            case .arrived:
                face(u, t.center)
                u.busy = true
                if u.cooldown <= 0 {
                    u.cooldown = u.def.attackCooldown
                    let dmg = damage(attack: u.def.attack, ranged: u.def.isRanged, bonus: u.def.bonus, vs: t)
                    if u.def.isRanged {
                        fire(from: u.pos, attackerId: u.id, at: t, damage: dmg)
                    } else {
                        applyDamage(t, dmg, by: u.id)
                    }
                }
            case .moving:
                break
            case .blocked:
                u.order = .idle
            }
        }
    }

    private func gatherSource(_ u: Unit, _ id: Int) -> (Entity, Res, Double)? {
        if let n = node(id), n.amount > 0 { return (n, n.res, n.amount) }
        if let b = building(id), b.isFarm, b.complete, b.owner == u.owner, b.food > 0 { return (b, .food, b.food) }
        return nil
    }

    private func updateGather(_ u: Unit, _ id: Int, _ dt: Double) {
        guard let source = gatherSource(u, id) else {
            // The node ran out or the farm is gone: find more of the same nearby.
            if let r = u.lastGather, let n = nearestNode(r, near: u.pos, within: 10) {
                u.order = .gather(n.id)
                u.path = []
                u.repathTimer = 0
            } else if u.carry > 0 {
                u.order = .returnGoods(resume: nil)
            } else {
                u.order = .idle
            }
            return
        }
        let (src, res, _) = source
        if u.carry > 0 && u.carryRes != res { u.carry = 0 }
        let capacity = rules.economy.carry
        if u.carry >= capacity {
            u.order = .returnGoods(resume: id)
            u.path = []
            return
        }
        switch approach(u, src, reach: 0.9, dt) {
        case .arrived:
            face(u, src.center)
            u.busy = true
            let rate = rules.gatherRate(res)
            if let n = src as? ResourceNode {
                let take = min(rate * dt, n.amount, capacity - u.carry)
                n.amount -= take
                u.carry += take
                if n.amount <= 0.0001 { removeNode(n) }
            } else if let b = src as? Building {
                let take = min(rate * dt, b.food, capacity - u.carry)
                b.food -= take
                u.carry += take
                if b.food <= 0.0001 {
                    b.alive = false
                    map.setOccupant(b.footprint, 0)
                    events.append(.died(id: b.id, owner: b.owner, at: b.center, wasBuilding: true))
                    events.append(.message(player: b.owner, text: "A farm ran out"))
                }
            }
            u.carryRes = res
            u.lastGather = res
        case .moving:
            break
        case .blocked:
            // Cannot reach this one (fenced in by trees): try another.
            if let n = nearestNode(res, near: u.pos, within: 10, excluding: id) {
                u.order = .gather(n.id)
                u.repathTimer = 0
            } else {
                u.order = .idle
            }
        }
    }

    private func updateReturn(_ u: Unit, _ resume: Int?, _ dt: Double) {
        guard u.carry > 0, let r = u.carryRes else {
            if let id = resume, gatherSource(u, id) != nil { u.order = .gather(id) } else { u.order = .idle }
            return
        }
        guard let drop = nearestDropOff(r, owner: u.owner, near: u.pos) else {
            u.order = .idle
            events.append(.message(player: u.owner, text: "No place to drop off \(r.key)"))
            return
        }
        switch approach(u, drop, reach: 0.9, dt) {
        case .arrived:
            players[u.owner].res[r] += u.carry
            players[u.owner].stats.gathered[r] += u.carry
            u.carry = 0
            if let id = resume, gatherSource(u, id) != nil {
                u.order = .gather(id)
            } else if let n = nearestNode(r, near: drop.center, within: 10) {
                u.order = .gather(n.id)
            } else {
                u.order = .idle
            }
            u.path = []
            u.repathTimer = 0
        case .moving:
            break
        case .blocked:
            u.order = .idle
        }
    }

    private func updateBuild(_ u: Unit, _ id: Int, _ dt: Double) {
        guard let b = building(id), b.owner == u.owner else { u.order = .idle; return }
        if b.complete {
            afterBuild(u, b)
            return
        }
        switch approach(u, b, reach: 0.9, dt) {
        case .arrived:
            face(u, b.center)
            u.busy = true
            let step = dt / b.def.buildTime
            b.progress = min(1, b.progress + step)
            b.hp = min(b.maxHp, b.hp + b.maxHp * step)
            if b.progress >= 1 {
                b.complete = true
                players[b.owner].stats.built += 1
                events.append(.completed(id: b.id, owner: b.owner))
                afterBuild(u, b)
            }
        case .moving:
            break
        case .blocked:
            u.order = .idle
        }
    }

    /// What a villager does after finishing a building: farm it, or gather next to a new drop-off.
    private func afterBuild(_ u: Unit, _ b: Building) {
        u.path = []
        u.repathTimer = 0
        if b.isFarm {
            u.order = .gather(b.id)
            u.lastGather = .food
            return
        }
        if let kinds = b.def.dropOff, b.def.id != "town_center" {
            let prefs = kinds.compactMap(Res.init(key:))
            let ordered = (u.lastGather.map { prefs.contains($0) ? [$0] : [] } ?? []) + prefs
            for r in ordered {
                if let n = nearestNode(r, near: b.center, within: 7) {
                    u.order = .gather(n.id)
                    u.lastGather = r
                    return
                }
            }
        }
        u.order = .idle
    }

    private func removeNode(_ n: ResourceNode) {
        n.alive = false
        n.amount = 0
        map.setOccupant(Footprint(n.tile, 1), 0)
        events.append(.died(id: n.id, owner: gaia, at: n.center, wasBuilding: false))
    }

    // MARK: combat

    public func damage(attack: Double, ranged: Bool, bonus: [String: Double]?, vs target: Entity) -> Double {
        var armor = 0.0
        var cls = "building"
        if let t = target as? Unit {
            armor = ranged ? t.def.pierceArmor : t.def.armor
            cls = t.def.unitClass
        } else if let b = target as? Building {
            armor = ranged ? (b.def.pierceArmor ?? 3) : (b.def.armor ?? 0)
        }
        return max(rules.minDamage, attack - armor) + (bonus?[cls] ?? 0)
    }

    private func fire(from: Vec2, attackerId: Int, at t: Entity, damage: Double) {
        let flight = max(0.15, from.distance(to: t.center) / 12)
        missiles.append(Missile(targetId: t.id, damage: damage, attackerId: attackerId, remaining: flight))
        events.append(.projectile(from: from, to: t.center, flight: flight))
    }

    private func updateMissiles(_ dt: Double) {
        guard !missiles.isEmpty else { return }
        var keep: [Missile] = []
        for var m in missiles {
            m.remaining -= dt
            if m.remaining > 0 { keep.append(m); continue }
            if let t = entity(m.targetId) { applyDamage(t, m.damage, by: m.attackerId) }
        }
        missiles = keep
    }

    func applyDamage(_ t: Entity, _ amount: Double, by attackerId: Int) {
        guard t.alive, t.owner != gaia else { return }
        t.hp -= amount
        events.append(.hit(t.center))
        if t.owner >= 0 && alertTimer[t.owner] <= 0 {
            alertTimer[t.owner] = 10
            events.append(.underAttack(player: t.owner, at: t.center))
        }
        // Idle soldiers hit back. Villagers keep working unless told otherwise.
        if let u = t as? Unit, !u.isVillager, u.order == .idle, let a = entity(attackerId), isEnemy(u.owner, a.owner) {
            u.order = .attack(a.id)
        }
        if t.hp <= 0 { kill(t, by: attackerId) }
    }

    private func kill(_ t: Entity, by attackerId: Int) {
        t.alive = false
        t.hp = 0
        if let b = t as? Building { map.setOccupant(b.footprint, 0) }
        if t.owner >= 0 { players[t.owner].stats.lost += 1 }
        if let a = entity(attackerId), a.owner >= 0 { players[a.owner].stats.kills += 1 }
        events.append(.died(id: t.id, owner: t.owner, at: t.center, wasBuilding: t is Building))
    }

    // MARK: queries

    public func nearestEnemy(of player: Int, near p: Vec2, within r: Double) -> Entity? {
        var best: Entity?
        var bestD = r
        for u in units where u.alive && isEnemy(player, u.owner) {
            let d = u.pos.distance(to: p)
            if d <= bestD { bestD = d; best = u }
        }
        if best != nil { return best }
        for b in buildings where b.alive && isEnemy(player, b.owner) {
            let d = b.distance(to: p)
            if d <= bestD { bestD = d; best = b }
        }
        return best
    }

    func nearestEnemyUnit(of player: Int, near p: Vec2, within r: Double) -> Unit? {
        var best: Unit?
        var bestD = r
        for u in units where u.alive && isEnemy(player, u.owner) {
            let d = u.pos.distance(to: p)
            if d <= bestD { bestD = d; best = u }
        }
        return best
    }

    public func nearestNode(_ r: Res, near p: Vec2, within radius: Double, excluding: Int? = nil) -> ResourceNode? {
        var best: ResourceNode?
        var bestD = radius
        for n in nodes where n.alive && n.res == r && n.id != excluding {
            let d = n.center.distance(to: p)
            if d < bestD { bestD = d; best = n }
        }
        return best
    }

    public func nearestDropOff(_ r: Res, owner: Int, near p: Vec2) -> Building? {
        var best: Building?
        var bestD = Double.infinity
        for b in buildings where b.alive && b.complete && b.owner == owner && b.dropsOff(r) {
            let d = b.distance(to: p)
            if d < bestD { bestD = d; best = b }
        }
        return best
    }

    /// Topmost entity at a world point, own units first.
    public func entity(at p: Vec2, radius: Double = 0.45) -> Entity? {
        var best: Entity?
        var bestD = radius
        for u in units where u.alive {
            let d = u.pos.distance(to: p)
            if d < bestD { bestD = d; best = u }
        }
        if best != nil { return best }
        let id = map.occupant(at: p.tile)
        return id != 0 ? entity(id) : nil
    }

    // MARK: separation

    /// Pushes overlapping units apart. Units at work are not pushed, and units walking a path
    /// are not pushed either: they pass through, or a crowd at a berry bush could hold them forever.
    private func separate() {
        let minD = 0.42
        let n = units.count
        guard n > 1 else { return }
        // Bucket by tile so this stays cheap with a few hundred units.
        var buckets: [Int: [Int]] = [:]
        for (i, u) in units.enumerated() where u.alive {
            let t = u.pos.tile
            buckets[t.y * map.width + t.x, default: []].append(i)
        }
        for (i, a) in units.enumerated() where a.alive {
            let t = a.pos.tile
            for dy in -1...1 {
                for dx in -1...1 {
                    guard let list = buckets[(t.y + dy) * map.width + (t.x + dx)] else { continue }
                    for j in list where j > i {
                        let b = units[j]
                        let d = b.pos - a.pos
                        let len = d.length
                        if len >= minD { continue }
                        let dir = len > 0.0001 ? d * (1 / len) : Vec2(Double((a.id * 37) % 7) - 3, 1) * 0.2
                        let push = (minD - len) * 0.5
                        let aFree = !a.busy && a.path.isEmpty, bFree = !b.busy && b.path.isEmpty
                        if aFree {
                            let np = a.pos - dir * (bFree ? push : push * 2)
                            if map.passable(np.tile) { a.pos = np }
                        }
                        if bFree {
                            let np = b.pos + dir * (aFree ? push : push * 2)
                            if map.passable(np.tile) { b.pos = np }
                        }
                    }
                }
            }
        }
    }
}

public struct PlaceError: Error, CustomStringConvertible {
    public let description: String
    init(_ d: String) { description = d }
}
