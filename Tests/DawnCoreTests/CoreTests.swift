import XCTest
@testable import DawnCore

final class CoreTests: XCTestCase {
    static let rules: Rules = {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("data/rules.json")
        return try! Rules(contentsOf: url)
    }()

    var rules: Rules { CoreTests.rules }

    /// An empty grass map with one player, for tests that set up their own scene.
    func blank(size: Int = 24, players: [String] = ["A", "B"]) -> World {
        World(rules: rules, seed: 1, playerNames: players, size: size, generate: false)
    }

    func run(_ w: World, seconds: Double) {
        for _ in 0..<Int(seconds / World.dt) { w.step() }
    }

    func testRulesLoad() {
        XCTAssertEqual(rules.ages.count, 2)
        XCTAssertNotNil(rules.units["villager"])
        XCTAssertEqual(rules.buildings["town_center"]?.size, 3)
        XCTAssertEqual(rules.units["axeman"]?.bonus?["cavalry"], 4)
    }

    func testPathGoesAroundAWall() {
        let w = blank()
        for y in 2..<20 { w.map.terrain[w.map.index(Tile(10, y))] = .water }
        let path = w.pathfinder.find(from: Vec2(5.5, 10.5), toward: Vec2(15.5, 10.5)) { $0 == Tile(15, 10) }
        XCTAssertFalse(path.isEmpty)
        XCTAssertEqual(path.last?.tile, Tile(15, 10))
        var prev = Vec2(5.5, 10.5)
        for p in path {
            XCTAssertTrue(w.map.clearLine(prev, p), "segment \(prev) -> \(p) crosses water")
            prev = p
        }
    }

    func testUnreachableGoalWalksToClosestTile() {
        let w = blank()
        for y in 0..<24 { w.map.terrain[w.map.index(Tile(12, y))] = .water }
        let path = w.pathfinder.find(from: Vec2(3.5, 3.5), toward: Vec2(20.5, 3.5)) { $0 == Tile(20, 3) }
        XCTAssertEqual(path.last?.tile.x, 11)
    }

    func testGatherLoopDepositsAtTheTownCenter() {
        let w = blank()
        w.addBuilding("town_center", owner: 0, origin: Tile(5, 5), complete: true)
        let tree = w.addNode("tree", at: Tile(12, 6))!
        let v = w.spawnUnit("villager", owner: 0, at: Tile(9, 6).center)
        let before = w.players[0].res.wood
        w.gather(0, [v.id], target: tree.id)
        run(w, seconds: 90)
        XCTAssertGreaterThan(w.players[0].res.wood, before + 15)
        XCTAssertLessThan(tree.amount, 75)
    }

    func testVillagerMovesOnWhenANodeRunsOut() {
        let w = blank()
        w.addBuilding("town_center", owner: 0, origin: Tile(5, 5), complete: true)
        let a = w.addNode("berry_bush", at: Tile(10, 6))!
        let b = w.addNode("berry_bush", at: Tile(11, 6))!
        a.amount = 3
        let v = w.spawnUnit("villager", owner: 0, at: Tile(9, 7).center)
        w.gather(0, [v.id], target: a.id)
        run(w, seconds: 40)
        XCTAssertFalse(a.alive)
        XCTAssertLessThan(b.amount, 150)
    }

    func testTrainingSpendsAndSpawns() {
        let w = blank()
        let tc = w.addBuilding("town_center", owner: 0, origin: Tile(5, 5), complete: true)
        w.refreshPopulation()
        let food = w.players[0].res.food
        XCTAssertNil(w.train(0, building: tc.id, unit: "villager"))
        XCTAssertEqual(w.players[0].res.food, food - 50)
        run(w, seconds: 21)
        XCTAssertEqual(w.units(of: 0).count, 1)
    }

    func testHousingBlocksTraining() {
        let w = blank()
        let tc = w.addBuilding("town_center", owner: 0, origin: Tile(5, 5), complete: true)
        for i in 0..<5 { w.spawnUnit("villager", owner: 0, at: Tile(12 + i, 12).center) }
        w.refreshPopulation()
        XCTAssertEqual(w.players[0].popCap, 5)
        w.players[0].res[.food] = 500
        w.train(0, building: tc.id, unit: "villager")
        run(w, seconds: 30)
        XCTAssertEqual(w.units(of: 0).count, 5)
        XCTAssertTrue(w.events.contains { if case .message(_, let t) = $0 { return t == "Need more houses" }; return false })
    }

    func testCannotTrainBeforeItsAge() {
        let w = blank()
        let b = w.addBuilding("barracks", owner: 0, origin: Tile(5, 5), complete: true)
        w.players[0].res[.gold] = 100
        XCTAssertEqual(w.train(0, building: b.id, unit: "axeman"), "Needs Tool Age")
        XCTAssertNil(w.train(0, building: b.id, unit: "clubman"))
    }

    func testPlacementRules() {
        let w = blank()
        w.addBuilding("town_center", owner: 0, origin: Tile(5, 5), complete: true)
        w.fog[0].revealAll()
        let v = w.spawnUnit("villager", owner: 0, at: Tile(10, 10).center)
        if case .success = w.place(0, "house", at: Tile(6, 6), builders: [v.id]) { XCTFail("placed on the town center") }
        if case .success = w.place(0, "farm", at: Tile(12, 12), builders: [v.id]) { XCTFail("farm needs a granary") }
        guard case .success(let id) = w.place(0, "house", at: Tile(12, 12), builders: [v.id]) else {
            return XCTFail("house should place")
        }
        run(w, seconds: 25)
        XCTAssertTrue(w.building(id)!.complete)
        w.refreshPopulation()
        XCTAssertEqual(w.players[0].popCap, 9)
    }

    func testDamageFormulaMatchesBalanceTool() {
        let w = blank()
        let axe = w.spawnUnit("axeman", owner: 0, at: Vec2(3, 3))
        let scout = w.spawnUnit("scout", owner: 1, at: Vec2(4, 3))
        let bow = w.spawnUnit("bowman", owner: 0, at: Vec2(5, 3))
        XCTAssertEqual(w.damage(attack: axe.def.attack, ranged: false, bonus: axe.def.bonus, vs: scout), 9)
        XCTAssertEqual(w.damage(attack: bow.def.attack, ranged: true, bonus: bow.def.bonus, vs: scout), 3)
    }

    func testFightToTheDeath() {
        let w = blank()
        let a = w.spawnUnit("axeman", owner: 0, at: Tile(5, 5).center)
        let s = w.spawnUnit("scout", owner: 1, at: Tile(9, 5).center)
        run(w, seconds: 20)    // idle soldiers find each other
        XCTAssertFalse(s.alive)
        XCTAssertTrue(a.alive)
        XCTAssertEqual(w.players[0].stats.kills, 1)
    }

    func testAgeUpNeedsTwoBuildingsAndFood() {
        let w = blank()
        let tc = w.addBuilding("town_center", owner: 0, origin: Tile(5, 5), complete: true)
        w.players[0].res[.food] = 600
        XCTAssertNotNil(w.advanceAge(0, building: tc.id))
        w.addBuilding("granary", owner: 0, origin: Tile(12, 5), complete: true)
        w.addBuilding("barracks", owner: 0, origin: Tile(12, 10), complete: true)
        XCTAssertNil(w.advanceAge(0, building: tc.id))
        run(w, seconds: 61)
        XCTAssertEqual(w.players[0].age, 1)
    }

    func testMapIsFairAndConnected() {
        let w = World(rules: rules, seed: 7)
        XCTAssertEqual(w.buildings.count, 2)
        for p in w.players {
            XCTAssertEqual(w.units(of: p.id).count, rules.economy.startVillagers)
            let home = w.startTiles[p.id].center
            for r in Res.allCases {
                XCTAssertNotNil(w.nearestNode(r, near: home, within: 16), "player \(p.id) has no \(r) nearby")
            }
        }
        let seen = w.map.reachable(from: Tile(w.startTiles[0].x + 2, w.startTiles[0].y + 2)) { w.building($0) != nil }
        let other = Tile(w.startTiles[1].x + 2, w.startTiles[1].y + 2)
        XCTAssertTrue(seen[w.map.index(other)])
    }

    func testSameSeedSameGame() {
        let a = Simulation.run(rules: rules, seed: 11, minutes: 6)
        let b = Simulation.run(rules: rules, seed: 11, minutes: 6)
        XCTAssertEqual(a.lines, b.lines)
    }

    /// The integration test: a full headless match must end, with the stronger AI winning.
    func testHeadlessMatchEnds() {
        let r = Simulation.run(rules: rules, seed: 1, minutes: 45, difficulties: [.hard, .easy])
        XCTAssertEqual(r.winner, 0, r.lines.joined(separator: "\n"))
        XCTAssertEqual(r.problems, [])
    }
}
