import AppKit
import DawnCore
import SpriteKit

/// The drawable side of one entity.
final class EntityNode {
    let root = SKNode()
    let sprite: SKSpriteNode
    let ring: SKShapeNode
    let hpBack = SKSpriteNode(color: .black, size: CGSize(width: 30, height: 4))
    let hpFront = SKSpriteNode(color: .green, size: CGSize(width: 30, height: 4))
    let isUnit: Bool

    init(sprite: SKSpriteNode, ring: SKShapeNode, isUnit: Bool, barY: CGFloat, barW: CGFloat) {
        self.sprite = sprite
        self.ring = ring
        self.isUnit = isUnit
        ring.isHidden = true
        ring.zPosition = -0.5
        root.addChild(ring)
        root.addChild(sprite)
        for b in [hpBack, hpFront] {
            b.anchorPoint = CGPoint(x: 0, y: 0.5)
            b.size.width = barW
            b.position = CGPoint(x: -barW / 2, y: barY)
            b.isHidden = true
            b.zPosition = 1
            root.addChild(b)
        }
    }

    func showHealth(_ e: Entity, _ on: Bool) {
        hpBack.isHidden = !on
        hpFront.isHidden = !on
        guard on else { return }
        let f = CGFloat(max(0, e.hp / e.maxHp))
        hpFront.size.width = hpBack.size.width * f
        hpFront.color = f > 0.5 ? .green : (f > 0.25 ? .yellow : .red)
    }
}

final class GameScene: SKScene {
    let rules: Rules
    var world: World
    let art = Art()
    let me = 0
    var difficulty: Difficulty = .normal
    var started = false
    var gamePaused = false

    let worldLayer = SKNode()
    let cam = SKCameraNode()
    var hud: HUD
    var terrain = SKSpriteNode()
    var fogSprite = SKSpriteNode()
    var fogRoot = SKNode()
    var nodes: [Int: EntityNode] = [:]

    var selection: [Int] = []
    var groups: [Int: [Int]] = [:]
    var placing: String?
    var ghost: SKSpriteNode?
    var attackMovePending = false
    var dragStart: CGPoint?
    let dragBox = SKShapeNode()
    var mouseInView = CGPoint(x: -1, y: -1)
    var keys = Set<UInt16>()
    var lastTime: TimeInterval = 0
    var accumulator = 0.0
    var fogStamp = -1
    var minimapStamp = -1
    var revealMap = false
    var lastIdleIndex = 0

    init(size: CGSize, rules: Rules, seed: UInt64) {
        self.rules = rules
        self.world = World(rules: rules, seed: seed, playerNames: ["You", "Enemy"])
        self.hud = HUD(mapSize: world.map.width)
        super.init(size: size)
        scaleMode = .resizeFill
        backgroundColor = .black
        anchorPoint = CGPoint(x: 0.5, y: 0.5)
        addChild(worldLayer)
        addChild(cam)
        camera = cam
        cam.addChild(hud.root)
        dragBox.strokeColor = .white
        dragBox.fillColor = NSColor.white.withAlphaComponent(0.08)
        dragBox.zPosition = 5000
        dragBox.isHidden = true
        worldLayer.addChild(dragBox)
        buildWorldNodes()
        showStartScreen()
    }

    required init?(coder: NSCoder) { fatalError() }

    // MARK: setup

    func newGame(seed: UInt64) {
        world = World(rules: rules, seed: seed, playerNames: ["You", "Enemy"])
        hud.root.removeFromParent()
        hud = HUD(mapSize: world.map.width)
        cam.addChild(hud.root)
        hud.layout(size)
        nodes.values.forEach { $0.root.removeFromParent() }
        nodes = [:]
        selection = []
        groups = [:]
        cancelPlacing()
        fogStamp = -1
        minimapStamp = -1
        buildWorldNodes()
    }

    private func buildWorldNodes() {
        terrain.removeFromParent()
        fogRoot.removeFromParent()
        let map = world.map
        terrain = SKSpriteNode(texture: art.terrain(map))
        terrain.anchorPoint = .zero
        terrain.position = CGPoint(x: -CGFloat(map.height) * Iso.halfW, y: -CGFloat(map.width + map.height) * Iso.halfH)
        terrain.zPosition = 0
        worldLayer.addChild(terrain)

        let g = Iso.gridNode()
        fogRoot = g.outer
        fogRoot.zPosition = 3000
        fogSprite = SKSpriteNode(color: .black, size: CGSize(width: map.width, height: map.height))
        fogSprite.anchorPoint = .zero
        g.inner.addChild(fogSprite)
        worldLayer.addChild(fogRoot)
        centerOn(world.startTiles[me].center)
    }

    override func didChangeSize(_ oldSize: CGSize) {
        hud.layout(size)
    }

    override func didMove(to view: SKView) {
        hud.layout(size)
        view.window?.acceptsMouseMovedEvents = true
    }

    func centerOn(_ p: Vec2) {
        cam.position = Iso.screen(p)
        // Keep the view clear of the bottom panel.
        cam.position.y -= (HUD.panelH - HUD.topH) / 2 * cam.yScale
        clampCamera()
    }

    private func clampCamera() {
        let n = CGFloat(world.map.width)
        let minX = -n * Iso.halfW, maxX = n * Iso.halfW
        let minY = -2 * n * Iso.halfH - 100, maxY: CGFloat = 100
        cam.position.x = min(max(cam.position.x, minX), maxX)
        cam.position.y = min(max(cam.position.y, minY), maxY)
    }

    // MARK: start, end, help

    func showStartScreen() {
        started = false
        hud.showOverlay(title: "Bronze Dawn", lines: [
            "Grow a Stone Age village, advance to the Tool Age, and destroy the enemy.",
            "",
            "Press 1 for Easy,  2 for Normal,  3 for Hard",
            "",
            "F1 shows the controls at any time",
        ])
    }

    func start(_ d: Difficulty) {
        difficulty = d
        world.ais = [AIController(player: 1, difficulty: d)]
        started = true
        hud.hideOverlay()
        hud.message("Gather food and wood. Build houses. Good luck.", now: world.time)
        selectTownCenter()
    }

    func showHelp() {
        hud.showOverlay(title: "Controls", lines: [
            "Left click / drag: select      Shift: add to selection      Double click: all of that kind",
            "Right click: move, gather, build, attack, or set a rally point",
            "Villager build keys: Q House  W Granary  E Storage Pit  R Barracks  A Farm",
            "S Archery Range  D Stable  F Watch Tower  Z Town Center",
            "Buildings: Q W E R train, T advance age, X cancel.   Soldiers: A attack-move, S stop",
            "H town center   .  idle villager   Cmd+1-9 save group, 1-9 recall   Delete: destroy",
            "Arrows / trackpad / screen edge: scroll    Pinch or + -: zoom    P: pause",
            "Press F1 or Esc to close",
        ], color: Palette.hudText)
    }

    private func gameOver(_ winner: Int) {
        let won = winner == me
        let p = world.players[me], e = world.players[1]
        hud.showOverlay(title: won ? "Victory" : "Defeat", lines: [
            "Time \(Simulation.clock(world.time))",
            "You: gathered \(Int(p.stats.gathered.total)), trained \(p.stats.trained), killed \(p.stats.kills), lost \(p.stats.lost)",
            "Enemy: gathered \(Int(e.stats.gathered.total)), trained \(e.stats.trained), killed \(e.stats.kills), lost \(e.stats.lost)",
            "",
            "Press Return for a new map",
        ], color: won ? Palette.gold : .red)
    }

    // MARK: the loop

    override func update(_ currentTime: TimeInterval) {
        let dt = lastTime == 0 ? 0 : min(0.25, currentTime - lastTime)
        lastTime = currentTime
        scrollCamera(dt)
        if started && !gamePaused && world.winner == nil {
            accumulator += dt
            var steps = 0
            while accumulator >= World.dt && steps < 6 {
                world.step()
                accumulator -= World.dt
                steps += 1
            }
            handleEvents()
        }
        let alpha = started ? min(1, accumulator / World.dt) : 1
        sync(alpha: alpha)
        if world.tick != fogStamp && (world.tick % 5 == 0 || fogStamp < 0) { updateFog(); fogStamp = world.tick }
        if world.tick / 10 != minimapStamp { updateMinimap(); minimapStamp = world.tick / 10 }
        refreshHUD()
        hud.tick(now: world.time)
        updateGhost()
    }

    private func handleEvents() {
        for e in world.events {
            switch e {
            case let .projectile(from, to, flight):
                guard fogVisible(from.tile) || fogVisible(to.tile) else { continue }
                let arrow = SKSpriteNode(color: NSColor(calibratedWhite: 0.15, alpha: 1), size: CGSize(width: 10, height: 1.5))
                let a = Iso.screen(from) + CGPoint(x: 0, y: 18), b = Iso.screen(to) + CGPoint(x: 0, y: 14)
                arrow.position = a
                arrow.zRotation = atan2(b.y - a.y, b.x - a.x)
                arrow.zPosition = 2900
                worldLayer.addChild(arrow)
                let rise = SKAction.customAction(withDuration: flight) { node, t in
                    let k = t / CGFloat(flight)
                    node.position = CGPoint(x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k + sin(k * .pi) * 14)
                }
                arrow.run(.sequence([rise, .removeFromParent()]))
            case let .died(id, owner, at, wasBuilding):
                if let n = nodes.removeValue(forKey: id) { n.root.removeFromParent() }
                selection.removeAll { $0 == id }
                if wasBuilding && fogExplored(at.tile) { puff(at, big: true) }
                else if owner >= 0 && fogVisible(at.tile) { puff(at, big: false) }
            case let .message(player, text):
                if player == me || player == -1 { hud.message(text, now: world.time) }
            case let .underAttack(player, at):
                if player == me && !fogVisibleOnScreen(at) {
                    hud.message("You are under attack!", color: .orange, now: world.time)
                    NSSound.beep()
                }
            case let .ageReached(player, age):
                if player != me { hud.message("The enemy reached the \(rules.ages[age].name)", color: .orange, now: world.time) }
            case let .completed(id, owner):
                if owner == me, let b = world.building(id) { hud.message("\(b.name) complete", now: world.time) }
            case .gameOver(let winner):
                gameOver(winner)
            case .trained, .hit:
                break
            }
        }
        world.events.removeAll(keepingCapacity: true)
    }

    private func puff(_ at: Vec2, big: Bool) {
        let n = SKShapeNode(circleOfRadius: big ? 26 : 9)
        n.fillColor = NSColor(calibratedRed: 0.55, green: 0.48, blue: 0.40, alpha: 0.7)
        n.strokeColor = .clear
        n.position = Iso.screen(at)
        n.zPosition = 2800
        worldLayer.addChild(n)
        n.run(.sequence([.group([.scale(to: 1.8, duration: 0.6), .fadeOut(withDuration: 0.6)]), .removeFromParent()]))
    }

    // MARK: drawing entities

    private func fogVisible(_ t: Tile) -> Bool { revealMap || world.fog[me].isVisible(t) }
    private func fogExplored(_ t: Tile) -> Bool { revealMap || world.fog[me].isExplored(t) }

    private func fogVisibleOnScreen(_ p: Vec2) -> Bool {
        let s = Iso.screen(p) - cam.position
        return abs(s.x) < size.width / 2 * cam.xScale && abs(s.y) < size.height / 2 * cam.yScale
    }

    private func makeNode(_ e: Entity) -> EntityNode {
        if let u = e as? DawnCore.Unit {
            let (tex, sz, anchor) = art.unit(u.def.id, owner: u.owner)
            let s = SKSpriteNode(texture: tex, size: sz)
            s.anchorPoint = anchor
            let ring = art.ring(u.def.id == "scout" ? 34 : 24, u.def.id == "scout" ? 16 : 12, u.owner == me ? .white : Palette.player(u.owner))
            return EntityNode(sprite: s, ring: ring, isUnit: true, barY: sz.height - 2, barW: 26)
        }
        if let b = e as? Building {
            let (tex, sz, anchor) = art.building(b.def, owner: b.owner)
            let s = SKSpriteNode(texture: tex, size: sz)
            s.anchorPoint = anchor
            let ring = art.diamond(size: b.def.size, b.owner == me ? .white : Palette.player(b.owner))
            let n = EntityNode(sprite: s, ring: ring, isUnit: false, barY: sz.height - 16, barW: CGFloat(b.def.size) * 22)
            return n
        }
        let r = e as! ResourceNode
        let (tex, sz, anchor) = art.node(r.def.id, variant: Int(world.map.shade[world.map.index(r.tile)]))
        let s = SKSpriteNode(texture: tex, size: sz)
        s.anchorPoint = anchor
        return EntityNode(sprite: s, ring: art.ring(30, 15, .yellow), isUnit: false, barY: sz.height, barW: 1)
    }

    private func place(_ n: EntityNode, _ e: Entity, alpha: Double) {
        if let u = e as? DawnCore.Unit {
            let p = u.prevPos.lerp(to: u.pos, alpha)
            n.root.position = Iso.screen(p)
            n.root.zPosition = Iso.depth(p) + 0.3
            let screenDX = u.facing.x - u.facing.y
            if abs(screenDX) > 0.2 { n.sprite.xScale = screenDX < 0 ? -1 : 1 }
            let moving = u.prevPos.distance(to: u.pos) > 0.001
            if moving || u.busy {
                let speed: Double = u.busy ? 10 : 14
                let phase: Double = world.time * speed + Double(u.id)
                let lift: Double = abs(sin(phase)) * (u.busy ? 2.0 : 2.5)
                n.sprite.position.y = CGFloat(lift)
                let tilt: Double = u.busy ? sin(world.time * 10 + Double(u.id)) * 0.08 : 0
                n.sprite.zRotation = CGFloat(tilt)
            } else {
                n.sprite.position.y = 0
                n.sprite.zRotation = 0
            }
        } else if let b = e as? Building {
            let fp = b.footprint
            n.root.position = Iso.screen(Vec2(fp.maxX, fp.maxY))
            n.root.zPosition = Iso.depth(fp.center)
            n.sprite.alpha = b.complete ? 1 : CGFloat(0.35 + 0.55 * b.progress)
            n.ring.position = .zero
        } else if let r = e as? ResourceNode {
            n.root.position = Iso.screen(r.center)
            n.root.zPosition = Iso.depth(r.center)
        }
    }

    private func sync(alpha: Double) {
        let selected = Set(selection)
        func show(_ e: Entity, visible: Bool) {
            if !visible {
                nodes[e.id]?.root.isHidden = true
                return
            }
            let n: EntityNode
            if let existing = nodes[e.id] { n = existing } else {
                n = makeNode(e)
                nodes[e.id] = n
                worldLayer.addChild(n.root)
            }
            n.root.isHidden = false
            place(n, e, alpha: alpha)
            let sel = selected.contains(e.id)
            n.ring.isHidden = !sel
            n.showHealth(e, sel && !(e is ResourceNode))
        }
        for u in world.units { show(u, visible: u.owner == me || fogVisible(u.pos.tile)) }
        for b in world.buildings { show(b, visible: b.owner == me || fogExplored(b.footprint.origin)) }
        for r in world.nodes { show(r, visible: fogExplored(r.tile)) }
    }

    // MARK: fog and minimap

    private func updateFog() {
        let f = world.fog[me]
        let w = f.width, h = f.height
        var data = [UInt8](repeating: 0, count: w * h * 4)
        for y in 0..<h {
            for x in 0..<w {
                let t = Tile(x, y)
                let a: UInt8 = revealMap ? 0 : (f.isVisible(t) ? 0 : (f.isExplored(t) ? 110 : 255))
                let i = (y * w + x) * 4
                data[i + 3] = a    // premultiplied black: only alpha matters
            }
        }
        let tex = SKTexture(data: Data(data), size: CGSize(width: w, height: h))
        tex.filteringMode = .linear
        fogSprite.texture = tex
        fogSprite.color = .white
        fogSprite.colorBlendFactor = 0
    }

    private func updateMinimap() {
        let map = world.map
        let n = map.width
        var data = [UInt8](repeating: 0, count: n * n * 4)
        func put(_ t: Tile, _ c: (UInt8, UInt8, UInt8)) {
            guard map.inside(t) else { return }
            let i = (t.y * n + t.x) * 4
            data[i] = c.0; data[i + 1] = c.1; data[i + 2] = c.2; data[i + 3] = 255
        }
        let f = world.fog[me]
        for y in 0..<n {
            for x in 0..<n {
                let t = Tile(x, y)
                guard revealMap || f.isExplored(t) else { put(t, (0, 0, 0)); continue }
                var c: (UInt8, UInt8, UInt8)
                switch map.terrain(at: t) {
                case .grass: c = (78, 120, 52)
                case .dirt: c = (130, 106, 66)
                case .sand: c = (196, 176, 118)
                case .water: c = (42, 88, 156)
                }
                if !revealMap && !f.isVisible(t) { c = (c.0 / 2 + 10, c.1 / 2 + 10, c.2 / 2 + 10) }
                put(t, c)
            }
        }
        for r in world.nodes where revealMap || f.isExplored(r.tile) {
            switch r.res {
            case .wood: put(r.tile, (28, 70, 30))
            case .food: put(r.tile, (200, 60, 80))
            case .gold: put(r.tile, (240, 200, 60))
            case .stone: put(r.tile, (170, 170, 175))
            }
        }
        func colour(_ owner: Int) -> (UInt8, UInt8, UInt8) {
            let c = Palette.player(owner).usingColorSpace(.deviceRGB)!
            return (UInt8(c.redComponent * 255), UInt8(c.greenComponent * 255), UInt8(c.blueComponent * 255))
        }
        for b in world.buildings where b.owner == me || revealMap || f.isExplored(b.footprint.origin) {
            for t in b.footprint.tiles { put(t, colour(b.owner)) }
        }
        for u in world.units where u.owner == me || revealMap || f.isVisible(u.pos.tile) {
            put(u.pos.tile, colour(u.owner))
            put(u.pos.tile + Tile(1, 0), colour(u.owner))
        }
        let tex = SKTexture(data: Data(data), size: CGSize(width: n, height: n))
        tex.filteringMode = .nearest
        hud.minimapSprite.texture = tex
        hud.minimapSprite.size = CGSize(width: n, height: n)

        // The camera's view, drawn on the minimap.
        let hw: CGFloat = size.width / 2 * cam.xScale
        let hh: CGFloat = size.height / 2 * cam.yScale
        let c0: CGPoint = cam.position
        let screenCorners: [CGPoint] = [
            CGPoint(x: c0.x - hw, y: c0.y - hh), CGPoint(x: c0.x + hw, y: c0.y - hh),
            CGPoint(x: c0.x + hw, y: c0.y + hh), CGPoint(x: c0.x - hw, y: c0.y + hh),
        ]
        let corners: [Vec2] = screenCorners.map { Iso.world($0) }
        let path = CGMutablePath()
        path.move(to: CGPoint(x: corners[0].x, y: corners[0].y))
        for c in corners.dropFirst() { path.addLine(to: CGPoint(x: c.x, y: c.y)) }
        path.closeSubpath()
        hud.minimapView.path = path
    }

    // MARK: HUD

    func selectedEntities() -> [Entity] { selection.compactMap { world.entity($0) } }

    private func refreshHUD() {
        selection.removeAll { world.entity($0) == nil }
        let sel = selectedEntities()
        hud.update(world: world, me: me, selection: sel)
        hud.setCommands(commands(for: sel))
    }

    static let buildKeys: [(String, String)] = [
        ("house", "Q"), ("granary", "W"), ("storage_pit", "E"), ("barracks", "R"),
        ("farm", "A"), ("archery_range", "S"), ("stable", "D"), ("watch_tower", "F"), ("town_center", "Z"),
    ]

    private func commands(for sel: [Entity]) -> [Command] {
        let mine = sel.filter { $0.owner == me }
        guard !mine.isEmpty, world.winner == nil else { return [] }
        let units = mine.compactMap { $0 as? DawnCore.Unit }
        if units.contains(where: \.isVillager) {
            return GameScene.buildKeys.compactMap { (id, key) in
                guard let def = rules.buildings[id] else { return nil }
                return Command(key: key, title: def.name, detail: rules.cost(building: id).text,
                               blocker: world.blocker(building: id, for: me)) { [weak self] in self?.beginPlacing(id) }
            } + [Command(key: "X", title: "Stop", detail: "", blocker: nil) { [weak self] in self?.stopSelected() }]
        }
        if !units.isEmpty {
            return [
                Command(key: "A", title: "Attack-move", detail: "click a point", blocker: nil) { [weak self] in
                    self?.attackMovePending = true
                    self?.hud.message("Click where to attack-move", now: self?.world.time ?? 0)
                },
                Command(key: "S", title: "Stop", detail: "", blocker: nil) { [weak self] in self?.stopSelected() },
            ]
        }
        guard mine.count == 1, let b = mine.first as? Building, b.complete else { return [] }
        var out: [Command] = []
        for (i, t) in (b.def.trains ?? []).enumerated() {
            guard let def = rules.units[t] else { continue }
            let key = ["Q", "W", "E", "R"][min(i, 3)]
            out.append(Command(key: key, title: def.name, detail: rules.cost(unit: t).text,
                               blocker: world.blocker(unit: t, for: me)) { [weak self] in
                guard let self else { return }
                if let why = self.world.train(self.me, building: b.id, unit: t) { self.hud.message(why, color: .orange, now: self.world.time) }
            })
        }
        if b.def.id == "town_center", world.players[me].age + 1 < rules.ages.count {
            let next = rules.ages[world.players[me].age + 1]
            out.append(Command(key: "T", title: "Advance: \(next.name)", detail: ResBag(next.cost ?? [:]).text,
                               blocker: world.blockerForNextAge(me)) { [weak self] in
                guard let self else { return }
                if let why = self.world.advanceAge(self.me, building: b.id) { self.hud.message(why, color: .orange, now: self.world.time) }
            })
        }
        if !b.queue.isEmpty || b.researching != nil {
            out.append(Command(key: "X", title: "Cancel", detail: "refund", blocker: nil) { [weak self] in
                guard let self else { return }
                self.world.cancel(self.me, building: b.id)
            })
        }
        return out
    }

    // MARK: actions

    func selectTownCenter() {
        if let tc = world.buildings(of: me).first(where: { $0.def.id == "town_center" }) {
            selection = [tc.id]
            centerOn(tc.center)
        }
    }

    func stopSelected() { world.stop(me, selection) }

    func beginPlacing(_ type: String) {
        if let why = world.blocker(building: type, for: me) {
            hud.message(why, color: .orange, now: world.time)
            return
        }
        cancelPlacing()
        placing = type
        let def = rules.buildings[type]!
        let (tex, sz, anchor) = art.building(def, owner: me)
        let g = SKSpriteNode(texture: tex, size: sz)
        g.anchorPoint = anchor
        g.alpha = 0.6
        g.zPosition = 2950
        worldLayer.addChild(g)
        ghost = g
        updateGhost()
    }

    func cancelPlacing() {
        placing = nil
        ghost?.removeFromParent()
        ghost = nil
    }

    private func placementOrigin(_ type: String, at p: CGPoint) -> Tile {
        let size = rules.buildings[type]!.size
        let w = Iso.world(p)
        // Centre the footprint on the cursor.
        let o = Vec2(w.x - Double(size) / 2 + 0.5, w.y - Double(size) / 2 + 0.5)
        return o.tile
    }

    private func updateGhost() {
        guard let type = placing, let g = ghost, let view else { return }
        let p = convertPoint(fromView: mouseInView)
        _ = view
        let o = placementOrigin(type, at: p)
        let size = rules.buildings[type]!.size
        g.position = Iso.screen(Vec2(Double(o.x + size), Double(o.y + size)))
        let ok = world.canPlace(type, at: o, for: me)
        g.color = ok ? .green : .red
        g.colorBlendFactor = ok ? 0.15 : 0.6
    }

    // MARK: picking

    /// The entity drawn under a scene point. Units win over what is behind them.
    func pick(_ p: CGPoint) -> Entity? {
        var best: (Entity, CGFloat)?
        for (id, n) in nodes where !n.root.isHidden {
            guard let e = world.entity(id) else { continue }
            var f = n.sprite.frame
            f.origin.x += n.root.position.x
            f.origin.y += n.root.position.y
            if let b = e as? Building {
                // Buildings: the footprint diamond and the walls above it.
                let w = Iso.world(p)
                let inFoot = b.footprint.distance(to: w) == 0
                if !inFoot && !f.insetBy(dx: f.width * 0.15, dy: 0).contains(p) { continue }
            } else if !f.insetBy(dx: f.width * 0.12, dy: f.height * 0.05).contains(p) {
                continue
            }
            let score = n.root.zPosition + (e is DawnCore.Unit ? 1000 : 0)
            if best == nil || score > best!.1 { best = (e, score) }
        }
        return best?.0
    }

    // MARK: mouse

    override func mouseMoved(with event: NSEvent) {
        mouseInView = event.locationInWindow
        let hp = event.location(in: cam)
        hud.hover(hud.contains(hp) ? hud.button(at: hp, in: self) : nil, at: hp)
    }

    override func mouseDown(with event: NSEvent) {
        mouseInView = event.locationInWindow
        guard started, !hud.overlayShown else { return }
        let hp = event.location(in: cam)
        if hud.contains(hp) {
            if let i = hud.button(at: hp, in: self), i < hud.commands.count {
                let c = hud.commands[i]
                if let why = c.blocker { hud.message(why, color: .orange, now: world.time) } else { c.action() }
            } else if minimapHit(event) {
                dragStart = nil
            }
            return
        }
        let p = event.location(in: self)
        if let type = placing {
            let o = placementOrigin(type, at: p)
            let builders = selectedEntities().compactMap { $0 as? DawnCore.Unit }.filter { $0.isVillager && $0.owner == me }.map(\.id)
            switch world.place(me, type, at: o, builders: builders) {
            case .success:
                if !event.modifierFlags.contains(.shift) { cancelPlacing() }
            case .failure(let e):
                hud.message(e.description, color: .orange, now: world.time)
            }
            return
        }
        if attackMovePending {
            attackMovePending = false
            world.move(me, selection, to: Iso.world(p), attackMove: true)
            marker(at: p, color: .red)
            return
        }
        dragStart = p
    }

    private func minimapHit(_ event: NSEvent) -> Bool {
        let local = event.location(in: hud.minimapSprite)
        let n = Double(world.map.width)
        let w = Vec2(Double(local.x), Double(local.y))
        guard w.x >= 0, w.y >= 0, w.x <= n, w.y <= n else { return false }
        centerOn(w)
        return true
    }

    override func mouseDragged(with event: NSEvent) {
        mouseInView = event.locationInWindow
        guard started else { return }
        if hud.contains(event.location(in: cam)) && dragStart == nil {
            _ = minimapHit(event)
            return
        }
        guard let a = dragStart else { return }
        let b = event.location(in: self)
        let r = CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y))
        dragBox.path = CGPath(rect: r, transform: nil)
        dragBox.isHidden = r.width < 4 && r.height < 4
    }

    override func mouseUp(with event: NSEvent) {
        guard started, let a = dragStart else { return }
        dragStart = nil
        dragBox.isHidden = true
        let b = event.location(in: self)
        let shift = event.modifierFlags.contains(.shift)
        if hypot(a.x - b.x, a.y - b.y) < 6 {
            guard let e = pick(b) else {
                if !shift { selection = [] }
                return
            }
            if event.clickCount >= 2, e.owner == me {
                // Everything of this kind on screen.
                selection = nodes.compactMap { id, n -> Int? in
                    guard !n.root.isHidden, let o = world.entity(id), o.owner == me, o.typeId == e.typeId,
                          fogVisibleOnScreen(o.center) else { return nil }
                    return id
                }
                return
            }
            if shift && e.owner == me {
                if let i = selection.firstIndex(of: e.id) { selection.remove(at: i) } else { selection.append(e.id) }
            } else {
                selection = [e.id]
            }
            return
        }
        let r = CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y))
        let inside = world.units(of: me).filter { r.contains(Iso.screen($0.pos)) }.map(\.id)
        if inside.isEmpty { if !shift { selection = [] }; return }
        selection = shift ? Array(Set(selection + inside)) : inside
    }

    override func rightMouseDown(with event: NSEvent) {
        guard started, !hud.overlayShown, world.winner == nil else { return }
        if placing != nil { cancelPlacing(); return }
        attackMovePending = false
        let hp = event.location(in: cam)
        if hud.contains(hp) {
            // Right click on the minimap sends the selection there.
            let local = event.location(in: hud.minimapSprite)
            let n = Double(world.map.width)
            if local.x >= 0, local.y >= 0, Double(local.x) <= n, Double(local.y) <= n {
                world.smart(me, selection, target: nil, at: Vec2(Double(local.x), Double(local.y)))
            }
            return
        }
        let p = event.location(in: self)
        let w = Iso.world(p)
        let sel = selectedEntities().filter { $0.owner == me }
        if sel.count == 1, let b = sel.first as? Building {
            world.setRally(me, building: b.id, to: w)
            marker(at: p, color: Palette.player(me))
            return
        }
        let target = pick(p)
        let result = world.smart(me, selection, target: target?.id, at: w)
        switch result {
        case .attacked: marker(at: p, color: .red)
        case .nothing: break
        default: marker(at: p, color: .green)
        }
    }

    private func marker(at p: CGPoint, color: NSColor) {
        let m = art.ring(26, 13, color)
        m.lineWidth = 2
        m.position = p
        m.zPosition = 2990
        worldLayer.addChild(m)
        m.run(.sequence([.group([.scale(to: 0.3, duration: 0.4), .fadeOut(withDuration: 0.4)]), .removeFromParent()]))
    }

    override func scrollWheel(with event: NSEvent) {
        if event.hasPreciseScrollingDeltas {
            cam.position.x -= event.scrollingDeltaX * cam.xScale
            cam.position.y += event.scrollingDeltaY * cam.yScale
            clampCamera()
        } else {
            zoom(by: event.scrollingDeltaY > 0 ? 0.9 : 1.1)
        }
    }

    override func magnify(with event: NSEvent) {
        zoom(by: 1 - event.magnification)
    }

    func zoom(by k: CGFloat) {
        let s = min(2.2, max(0.6, cam.xScale * k))
        cam.setScale(s)
        clampCamera()
    }

    // MARK: keyboard

    override func keyDown(with event: NSEvent) {
        keys.insert(event.keyCode)
        let ch = (event.charactersIgnoringModifiers ?? "").uppercased()
        let cmd = event.modifierFlags.contains(.command) || event.modifierFlags.contains(.control)

        if !started {
            switch ch {
            case "1": start(.easy)
            case "2": start(.normal)
            case "3": start(.hard)
            default: break
            }
            return
        }
        if world.winner != nil {
            if event.keyCode == 36 {
                newGame(seed: UInt64.random(in: 1...999_999))
                showStartScreen()
            }
            return
        }
        if event.keyCode == 122 || ch == "?" {   // F1
            if hud.overlayShown { hud.hideOverlay(); gamePaused = false } else { showHelp(); gamePaused = true }
            return
        }
        if event.keyCode == 53 {                 // Esc
            if hud.overlayShown { hud.hideOverlay(); gamePaused = false; return }
            if placing != nil { cancelPlacing() } else if attackMovePending { attackMovePending = false } else { selection = [] }
            return
        }
        if hud.overlayShown { return }
        if event.keyCode == 51 || event.keyCode == 117 {   // Delete
            for id in selection { world.destroy(me, id) }
            return
        }
        if let d = Int(ch), d >= 1, d <= 9 {
            if cmd { groups[d] = selection; hud.message("Group \(d) saved", now: world.time) }
            else if let g = groups[d] {
                let alive = g.filter { world.entity($0) != nil }
                if alive == selection, let first = alive.first, let e = world.entity(first) { centerOn(e.center) }
                selection = alive
            }
            return
        }
        switch ch {
        case "H": selectTownCenter(); return
        case ".": selectIdleVillager(); return
        case "P":
            gamePaused.toggle()
            hud.message(gamePaused ? "Paused (P to resume)" : "Resumed", now: world.time)
            return
        case "+", "=": zoom(by: 0.85); return
        case "-": zoom(by: 1.15); return
        case "`":
            revealMap.toggle()   // debugging aid: see the whole map
            fogStamp = -1
            return
        default: break
        }
        if let c = hud.commands.first(where: { $0.key == ch }) {
            if let why = c.blocker { hud.message(why, color: .orange, now: world.time) } else { c.action() }
        }
    }

    override func keyUp(with event: NSEvent) {
        keys.remove(event.keyCode)
    }

    private func selectIdleVillager() {
        let idle = world.units(of: me).filter { $0.isVillager && $0.order == .idle }
        guard !idle.isEmpty else { hud.message("No idle villagers", now: world.time); return }
        lastIdleIndex = (lastIdleIndex + 1) % idle.count
        let u = idle[lastIdleIndex]
        selection = [u.id]
        centerOn(u.pos)
    }

    private func scrollCamera(_ dt: Double) {
        var d = CGPoint.zero
        if keys.contains(123) { d.x -= 1 }
        if keys.contains(124) { d.x += 1 }
        if keys.contains(125) { d.y -= 1 }
        if keys.contains(126) { d.y += 1 }
        if let v = view, let win = v.window, win.isKeyWindow, NSApp.isActive, dragStart == nil {
            let m = mouseInView, b = v.bounds
            let edge: CGFloat = 4
            if m.x >= 0 && m.y >= 0 && m.x <= b.width && m.y <= b.height && win.styleMask.contains(.fullScreen) {
                if m.x < edge { d.x -= 1 }
                if m.x > b.width - edge { d.x += 1 }
                if m.y < edge { d.y -= 1 }
                if m.y > b.height - edge { d.y += 1 }
            }
        }
        if d != .zero {
            let speed = 900 * CGFloat(dt) * cam.xScale
            cam.position.x += d.x * speed
            cam.position.y += d.y * speed
            clampCamera()
        }
    }
}

extension CGPoint {
    static func + (a: CGPoint, b: CGPoint) -> CGPoint { CGPoint(x: a.x + b.x, y: a.y + b.y) }
    static func - (a: CGPoint, b: CGPoint) -> CGPoint { CGPoint(x: a.x - b.x, y: a.y - b.y) }
}
