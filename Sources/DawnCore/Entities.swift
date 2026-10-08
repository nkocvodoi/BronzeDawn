import Foundation

public let gaia = -1

/// Anything on the map. Entities refer to each other by id, never by reference,
/// so a dead target is a lookup that fails instead of a dangling pointer.
public class Entity {
    public let id: Int
    public let owner: Int
    public var hp: Double
    public let maxHp: Double
    public var alive = true

    init(id: Int, owner: Int, hp: Double) {
        self.id = id
        self.owner = owner
        self.hp = hp
        self.maxHp = hp
    }

    public var center: Vec2 { fatalError("override") }
    /// Distance from p to this entity's edge.
    public func distance(to p: Vec2) -> Double { fatalError("override") }
    public var typeId: String { fatalError("override") }
    public var name: String { fatalError("override") }
}

public enum Order: Equatable {
    case idle
    case move(Vec2, attackMove: Bool)
    case gather(Int)
    case returnGoods(resume: Int?)
    case build(Int)
    case attack(Int)
}

public final class Unit: Entity {
    public let def: UnitDef
    public var pos: Vec2
    /// Position at the start of the last step, for smooth drawing between steps.
    public var prevPos: Vec2
    public var order: Order = .idle
    /// Where an attack-move was heading before it stopped to fight.
    public var resumeMove: Vec2?
    public var path: [Vec2] = []
    public var pathTarget: Vec2?
    public var repathTimer = 0.0
    public var scanTimer = 0.0
    public var cooldown = 0.0
    public var carryRes: Res?
    public var carry = 0.0
    /// The resource this villager was last told to gather, to find more when a node runs out.
    public var lastGather: Res?
    public var facing = Vec2(1, 0)
    public var busy = false   // gathering, building or striking this step (for animation)

    init(id: Int, owner: Int, def: UnitDef, pos: Vec2) {
        self.def = def
        self.pos = pos
        self.prevPos = pos
        super.init(id: id, owner: owner, hp: def.hp)
    }

    public override var center: Vec2 { pos }
    public override func distance(to p: Vec2) -> Double { max(0, pos.distance(to: p) - 0.3) }
    public override var typeId: String { def.id }
    public override var name: String { def.name }
    public var isVillager: Bool { def.isWorker }
}

public final class Building: Entity {
    public let def: BuildingDef
    public let footprint: Footprint
    public var progress: Double
    public var complete: Bool
    public var queue: [String] = []
    public var queueTimer = 0.0
    public var researching: Int?   // age index being researched
    public var researchTimer = 0.0
    public var rally: Vec2?
    public var food: Double         // farms: food left
    public var cooldown = 0.0
    public var housingWarned = false

    init(id: Int, owner: Int, def: BuildingDef, origin: Tile, complete: Bool) {
        self.def = def
        self.footprint = Footprint(origin, def.size)
        self.progress = complete ? 1 : 0
        self.complete = complete
        self.food = def.resource?["food"] ?? 0
        super.init(id: id, owner: owner, hp: def.hp)
        if !complete { hp = 1 }
    }

    public override var center: Vec2 { footprint.center }
    public override func distance(to p: Vec2) -> Double { footprint.distance(to: p) }
    public override var typeId: String { def.id }
    public override var name: String { def.name }
    public var isFarm: Bool { def.resource?["food"] != nil }
    public func dropsOff(_ r: Res) -> Bool { def.dropOff?.contains(r.key) ?? false }

}

public final class ResourceNode: Entity {
    public let def: NodeDef
    public let tile: Tile
    public let res: Res
    public var amount: Double

    init(id: Int, def: NodeDef, tile: Tile) {
        self.def = def
        self.tile = tile
        self.res = Res(key: def.resource) ?? .food
        self.amount = def.amount
        super.init(id: id, owner: gaia, hp: 1)
    }

    public override var center: Vec2 { tile.center }
    public override func distance(to p: Vec2) -> Double { Footprint(tile, 1).distance(to: p) }
    public override var typeId: String { def.id }
    public override var name: String { def.name }
}

public struct PlayerStats {
    public var gathered = ResBag()
    public var trained = 0
    public var kills = 0
    public var lost = 0
    public var built = 0
}

public final class Player {
    public let id: Int
    public let name: String
    public var res: ResBag
    public var age = 0
    public var pop = 0
    public var popCap = 0
    public var defeated = false
    /// Gather speed multiplier. 1 for people; the hard AI gets an announced bonus.
    public var gatherBonus = 1.0
    public var stats = PlayerStats()

    init(id: Int, name: String, res: ResBag) {
        self.id = id
        self.name = name
        self.res = res
    }
}

public enum GameEvent {
    case projectile(from: Vec2, to: Vec2, flight: Double)
    case hit(Vec2)
    case died(id: Int, owner: Int, at: Vec2, wasBuilding: Bool)
    case completed(id: Int, owner: Int)
    case trained(id: Int, owner: Int)
    case message(player: Int, text: String)
    case underAttack(player: Int, at: Vec2)
    case ageReached(player: Int, age: Int)
    case gameOver(winner: Int)
}
