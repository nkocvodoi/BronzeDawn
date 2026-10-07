import Foundation

/// The four resources, in the order the HUD shows them.
public enum Res: Int, CaseIterable, Codable {
    case food, wood, gold, stone

    public var key: String { ["food", "wood", "gold", "stone"][rawValue] }
    public var label: String { ["Food", "Wood", "Gold", "Stone"][rawValue] }

    public init?(key: String) {
        guard let r = Res.allCases.first(where: { $0.key == key }) else { return nil }
        self = r
    }
}

/// An amount of each resource.
public struct ResBag: Equatable {
    public var values: [Double] = [0, 0, 0, 0]

    public init() {}

    public init(_ dict: [String: Double]) {
        for (k, v) in dict { if let r = Res(key: k) { values[r.rawValue] = v } }
    }

    public subscript(r: Res) -> Double {
        get { values[r.rawValue] }
        set { values[r.rawValue] = newValue }
    }

    public func covers(_ cost: ResBag) -> Bool {
        Res.allCases.allSatisfy { self[$0] >= cost[$0] }
    }

    public mutating func spend(_ cost: ResBag) {
        for r in Res.allCases { self[r] -= cost[r] }
    }

    public mutating func add(_ cost: ResBag) {
        for r in Res.allCases { self[r] += cost[r] }
    }

    public var total: Double { values.reduce(0, +) }
    public var food: Double { self[.food] }
    public var wood: Double { self[.wood] }
    public var gold: Double { self[.gold] }
    public var stone: Double { self[.stone] }

    /// "50 food, 20 gold"
    public var text: String {
        Res.allCases.filter { self[$0] > 0 }.map { "\(Int(self[$0])) \($0.key)" }.joined(separator: ", ")
    }
}

public struct AgeDef: Decodable {
    public let id: String
    public let name: String
    public let cost: [String: Double]?
    public let researchTime: Double?
    public let requiresBuildings: Int?
}

public struct CombatDef: Decodable {
    public let minDamage: Double?
}

public struct EconomyDef: Decodable {
    public let carry: Double
    public let gatherRates: [String: Double]
    public let start: [String: Double]
    public let startVillagers: Int
    public let popMax: Int
}

public struct NodeDef: Decodable {
    public let id: String
    public let name: String
    public let resource: String
    public let amount: Double
}

public struct UnitDef: Decodable {
    public let id: String
    public let name: String
    public let unitClass: String
    public let age: String
    public let trainedAt: String
    public let cost: [String: Double]
    public let trainTime: Double
    public let hp: Double
    public let attack: Double
    public let armor: Double
    public let pierceArmor: Double
    public let range: Double
    public let attackCooldown: Double
    public let speed: Double
    public let los: Double
    public let pop: Int
    public let bonus: [String: Double]?

    enum CodingKeys: String, CodingKey {
        case id, name, unitClass = "class", age, trainedAt, cost, trainTime, hp, attack, armor
        case pierceArmor, range, attackCooldown, speed, los, pop, bonus
    }

    public var isWorker: Bool { unitClass == "worker" }
    public var isRanged: Bool { range > 0 }
}

public struct BuildingDef: Decodable {
    public let id: String
    public let name: String
    public let age: String
    public let cost: [String: Double]
    public let size: Int
    public let hp: Double
    public let buildTime: Double
    public let los: Double?
    public let popProvided: Int?
    public let dropOff: [String]?
    public let trains: [String]?
    public let requires: [String]?
    public let resource: [String: Double]?
    public let attack: Double?
    public let range: Double?
    public let attackCooldown: Double?
    public let armor: Double?
    public let pierceArmor: Double?
}

/// Everything the game reads from rules.json. Every number lives there.
public final class Rules {
    public let ages: [AgeDef]
    public let economy: EconomyDef
    public let minDamage: Double
    public let nodes: [String: NodeDef]
    public let nodeOrder: [String]
    public let units: [String: UnitDef]
    public let unitOrder: [String]
    public let buildings: [String: BuildingDef]
    public let buildingOrder: [String]

    private struct File: Decodable {
        let resources: [String]
        let ages: [AgeDef]
        let combat: CombatDef?
        let economy: EconomyDef
        let nodes: [NodeDef]
        let units: [UnitDef]
        let buildings: [BuildingDef]
    }

    public enum LoadError: Error, CustomStringConvertible {
        case notFound([String])
        case bad(String)

        public var description: String {
            switch self {
            case .notFound(let tried): return "rules.json not found. Tried:\n  " + tried.joined(separator: "\n  ")
            case .bad(let why): return "rules.json: \(why)"
            }
        }
    }

    public init(data: Data) throws {
        let dec = JSONDecoder()
        dec.keyDecodingStrategy = .convertFromSnakeCase
        let file: File
        do { file = try dec.decode(File.self, from: data) } catch { throw LoadError.bad("\(error)") }
        for r in file.resources where Res(key: r) == nil {
            throw LoadError.bad("unknown resource '\(r)', this build knows food, wood, gold, stone")
        }
        ages = file.ages
        economy = file.economy
        minDamage = file.combat?.minDamage ?? 1
        nodes = Dictionary(uniqueKeysWithValues: file.nodes.map { ($0.id, $0) })
        nodeOrder = file.nodes.map(\.id)
        units = Dictionary(uniqueKeysWithValues: file.units.map { ($0.id, $0) })
        unitOrder = file.units.map(\.id)
        buildings = Dictionary(uniqueKeysWithValues: file.buildings.map { ($0.id, $0) })
        buildingOrder = file.buildings.map(\.id)
        for id in ["town_center", "house", "farm"] where buildings[id] == nil {
            throw LoadError.bad("this build needs a '\(id)' building")
        }
        guard units["villager"] != nil else { throw LoadError.bad("this build needs a 'villager' unit") }
    }

    public convenience init(contentsOf url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    /// Finds rules.json: $BRONZE_DAWN_RULES, the app bundle's Resources, then
    /// data/rules.json in the current directory or any folder above the binary.
    public static func locate() throws -> Rules {
        var tried: [String] = []
        var candidates: [URL] = []
        if let env = ProcessInfo.processInfo.environment["BRONZE_DAWN_RULES"] {
            candidates.append(URL(fileURLWithPath: env))
        }
        if let res = Bundle.main.resourceURL {
            candidates.append(res.appendingPathComponent("rules.json"))
        }
        candidates.append(URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("data/rules.json"))
        var dir = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath().deletingLastPathComponent()
        for _ in 0..<6 {
            candidates.append(dir.appendingPathComponent("data/rules.json"))
            dir = dir.deletingLastPathComponent()
        }
        for url in candidates {
            tried.append(url.path)
            if FileManager.default.fileExists(atPath: url.path) { return try Rules(contentsOf: url) }
        }
        throw LoadError.notFound(tried)
    }

    public func ageIndex(_ id: String) -> Int { ages.firstIndex { $0.id == id } ?? 0 }
    public func cost(unit id: String) -> ResBag { ResBag(units[id]?.cost ?? [:]) }
    public func cost(building id: String) -> ResBag { ResBag(buildings[id]?.cost ?? [:]) }
    public func gatherRate(_ r: Res) -> Double { economy.gatherRates[r.key] ?? 0.4 }
}
