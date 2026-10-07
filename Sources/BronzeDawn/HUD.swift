import AppKit
import DawnCore
import SpriteKit

/// One command button: a hotkey, a label, a cost, and why it is greyed out.
struct Command {
    let key: String
    let title: String
    let detail: String
    let blocker: String?
    let action: () -> Void
}

func label(_ text: String = "", size: CGFloat = 13, bold: Bool = false, color: NSColor = Palette.hudText) -> SKLabelNode {
    let l = SKLabelNode(fontNamed: bold ? "AvenirNext-DemiBold" : "AvenirNext-Medium")
    l.text = text
    l.fontSize = size
    l.fontColor = color
    l.horizontalAlignmentMode = .left
    l.verticalAlignmentMode = .center
    return l
}

/// Everything drawn on top of the map. Children of the camera, so it never scrolls or zooms.
final class HUD {
    let root = SKNode()
    static let topH: CGFloat = 30
    static let panelH: CGFloat = 150

    private let top = SKShapeNode()
    private var resLabels: [SKLabelNode] = []
    private let popLabel = label(bold: true)
    private let ageLabel = label(bold: true, color: Palette.gold)
    private let clockLabel = label()
    private let panel = SKShapeNode()
    private let infoTitle = label(size: 16, bold: true)
    private let infoLines = (0..<4).map { _ in label(size: 12) }
    private let hpBack = SKSpriteNode(color: .darkGray, size: CGSize(width: 160, height: 7))
    private let hpFront = SKSpriteNode(color: .green, size: CGSize(width: 160, height: 7))
    private let progressBack = SKSpriteNode(color: .darkGray, size: CGSize(width: 160, height: 6))
    private let progressFront = SKSpriteNode(color: Palette.gold, size: CGSize(width: 160, height: 6))
    private var buttons: [SKShapeNode] = []
    private(set) var commands: [Command] = []
    private let tooltip = label(size: 12)
    private let tooltipBack = SKShapeNode()
    private var messages: [(SKLabelNode, Double)] = []
    private let overlay = SKNode()

    let minimapFrame = SKShapeNode()
    let minimapOuter: SKNode
    let minimapSprite: SKSpriteNode
    let minimapView = SKShapeNode()
    private var size = CGSize(width: 1280, height: 800)
    private let mapSize: Int

    init(mapSize: Int) {
        self.mapSize = mapSize
        root.zPosition = 10000

        top.fillColor = Palette.hudBack
        top.strokeColor = Palette.hudEdge
        root.addChild(top)
        for r in Res.allCases {
            let l = label(bold: true)
            l.text = r.label
            resLabels.append(l)
            top.addChild(l)
        }
        top.addChild(popLabel)
        top.addChild(ageLabel)
        top.addChild(clockLabel)

        panel.fillColor = Palette.hudBack
        panel.strokeColor = Palette.hudEdge
        root.addChild(panel)
        panel.addChild(infoTitle)
        for l in infoLines { panel.addChild(l) }
        for b in [hpBack, hpFront, progressBack, progressFront] {
            b.anchorPoint = CGPoint(x: 0, y: 0.5)
            panel.addChild(b)
        }

        let g = Iso.gridNode(scale: 210 / (CGFloat(mapSize) * 2 * Iso.halfW))
        minimapOuter = g.outer
        minimapSprite = SKSpriteNode(color: .black, size: CGSize(width: mapSize, height: mapSize))
        minimapSprite.anchorPoint = .zero
        minimapSprite.texture?.filteringMode = .nearest
        g.inner.addChild(minimapSprite)
        minimapView.strokeColor = .white
        minimapView.lineWidth = 0.4
        minimapSprite.addChild(minimapView)
        minimapFrame.fillColor = NSColor.black.withAlphaComponent(0.6)
        minimapFrame.strokeColor = Palette.hudEdge
        panel.addChild(minimapFrame)
        panel.addChild(minimapOuter)

        tooltipBack.fillColor = NSColor.black.withAlphaComponent(0.85)
        tooltipBack.strokeColor = Palette.hudEdge
        tooltipBack.isHidden = true
        tooltip.isHidden = true
        root.addChild(tooltipBack)
        root.addChild(tooltip)
        root.addChild(overlay)
    }

    func layout(_ s: CGSize) {
        size = s
        let w = s.width, h = s.height
        top.path = CGPath(rect: CGRect(x: -w / 2, y: h / 2 - HUD.topH, width: w, height: HUD.topH), transform: nil)
        let ty = h / 2 - HUD.topH / 2
        for (i, l) in resLabels.enumerated() { l.position = CGPoint(x: -w / 2 + 14 + CGFloat(i) * 118, y: ty) }
        popLabel.position = CGPoint(x: -w / 2 + 14 + 4 * 118, y: ty)
        ageLabel.position = CGPoint(x: -w / 2 + 14 + 4 * 118 + 110, y: ty)
        clockLabel.horizontalAlignmentMode = .right
        clockLabel.position = CGPoint(x: w / 2 - 14, y: ty)

        panel.path = CGPath(rect: CGRect(x: -w / 2, y: -h / 2, width: w, height: HUD.panelH), transform: nil)
        let base = -h / 2
        minimapFrame.path = CGPath(roundedRect: CGRect(x: -w / 2 + 8, y: base + 8, width: 226, height: HUD.panelH - 16),
                                   cornerWidth: 6, cornerHeight: 6, transform: nil)
        // The diamond's top vertex is the grid origin.
        minimapOuter.position = CGPoint(x: -w / 2 + 8 + 113, y: base + HUD.panelH / 2 + 53)
        let ix = -w / 2 + 250
        infoTitle.position = CGPoint(x: ix, y: base + HUD.panelH - 24)
        for (i, l) in infoLines.enumerated() { l.position = CGPoint(x: ix, y: base + HUD.panelH - 66 - CGFloat(i) * 18) }
        hpBack.position = CGPoint(x: ix, y: base + HUD.panelH - 44)
        hpFront.position = hpBack.position
        progressBack.position = CGPoint(x: ix, y: base + 18)
        progressFront.position = progressBack.position
        layoutButtons()
    }

    /// Point in camera space is over the HUD.
    func contains(_ p: CGPoint) -> Bool {
        p.y > size.height / 2 - HUD.topH || p.y < -size.height / 2 + HUD.panelH
    }

    // MARK: per frame

    func update(world w: World, me: Int, selection: [Entity]) {
        let p = w.players[me]
        for (i, r) in Res.allCases.enumerated() { resLabels[i].text = "\(r.label) \(Int(p.res[r]))" }
        popLabel.text = "Pop \(p.pop)/\(p.popCap)"
        popLabel.fontColor = p.pop >= p.popCap ? .orange : Palette.hudText
        ageLabel.text = w.rules.ages[p.age].name
        clockLabel.text = Simulation.clock(w.time)

        hpBack.isHidden = true; hpFront.isHidden = true
        progressBack.isHidden = true; progressFront.isHidden = true
        infoLines.forEach { $0.text = "" }
        guard let first = selection.first else {
            infoTitle.text = ""
            return
        }
        if selection.count > 1 {
            var counts: [String: Int] = [:]
            for e in selection { counts[e.name, default: 0] += 1 }
            infoTitle.text = "\(selection.count) selected"
            let parts = counts.sorted { $0.value > $1.value }.map { "\($0.value) \($0.key)" }
            infoLines[0].text = parts.prefix(3).joined(separator: ", ")
            if parts.count > 3 { infoLines[1].text = parts.dropFirst(3).joined(separator: ", ") }
            return
        }
        let ownerName = first.owner >= 0 ? w.players[first.owner].name : ""
        infoTitle.text = first.name + (first.owner >= 0 && first.owner != me ? "  (\(ownerName))" : "")
        infoTitle.fontColor = first.owner >= 0 ? (first.owner == me ? Palette.hudText : Palette.player(first.owner)) : Palette.hudText
        if let n = first as? ResourceNode {
            infoLines[0].text = "\(Int(n.amount)) \(n.res.key) left"
            return
        }
        hpBack.isHidden = false; hpFront.isHidden = false
        let frac = max(0, first.hp / first.maxHp)
        hpFront.size.width = 160 * CGFloat(frac)
        hpFront.color = frac > 0.5 ? .green : (frac > 0.25 ? .yellow : .red)
        infoLines[0].text = "HP \(Int(ceil(first.hp)))/\(Int(first.maxHp))"
        if let u = first as? DawnCore.Unit {
            let d = u.def
            infoLines[1].text = "Attack \(Int(d.attack))\(d.isRanged ? " (range \(Int(d.range)))" : "")   Armor \(Int(d.armor))/\(Int(d.pierceArmor))"
            if u.carry > 0, let r = u.carryRes { infoLines[2].text = "Carrying \(Int(u.carry)) \(r.key)" }
            if let b = d.bonus, !b.isEmpty {
                infoLines[3].text = "Bonus " + b.sorted { $0.key < $1.key }.map { "+\(Int($0.value)) vs \($0.key)" }.joined(separator: ", ")
            }
        } else if let b = first as? Building {
            if !b.complete {
                infoLines[1].text = "Under construction \(Int(b.progress * 100))%"
                showProgress(b.progress)
            } else if let age = b.researching {
                infoLines[1].text = "Advancing to \(w.rules.ages[age].name)"
                showProgress(w.trainProgress(b))
            } else if let q = b.queue.first {
                let more = b.queue.count > 1 ? "  (+\(b.queue.count - 1) queued)" : ""
                infoLines[1].text = "Training \(w.rules.units[q]?.name ?? q)\(more)"
                showProgress(w.trainProgress(b))
            }
            if b.isFarm { infoLines[2].text = "\(Int(b.food)) food left" }
            if let pop = b.def.popProvided, pop > 0, b.owner == me { infoLines[2].text = "Houses \(pop) people" }
            if let drop = b.def.dropOff, b.owner == me { infoLines[3].text = "Drop off: " + drop.joined(separator: ", ") }
        }
    }

    private func showProgress(_ f: Double) {
        progressBack.isHidden = false; progressFront.isHidden = false
        progressFront.size.width = 160 * CGFloat(f)
    }

    // MARK: buttons

    func setCommands(_ cmds: [Command]) {
        let same = cmds.count == commands.count && zip(cmds, commands).allSatisfy {
            $0.key == $1.key && $0.title == $1.title && $0.blocker == $1.blocker && $0.detail == $1.detail
        }
        commands = cmds
        if same { return }
        buttons.forEach { $0.removeFromParent() }
        buttons = []
        for (i, c) in cmds.enumerated() {
            let b = SKShapeNode(rect: CGRect(x: 0, y: 0, width: 88, height: 56), cornerRadius: 6)
            let enabled = c.blocker == nil
            b.fillColor = enabled ? NSColor(calibratedRed: 0.34, green: 0.25, blue: 0.14, alpha: 1)
                                  : NSColor(calibratedWhite: 0.22, alpha: 1)
            b.strokeColor = enabled ? Palette.hudEdge : NSColor(calibratedWhite: 0.4, alpha: 1)
            b.name = "btn:\(i)"
            let key = label(c.key, size: 11, bold: true, color: Palette.gold)
            key.position = CGPoint(x: 6, y: 46)
            let title = label(c.title, size: 11, bold: true, color: enabled ? Palette.hudText : .gray)
            title.position = CGPoint(x: 6, y: 28)
            if c.title.count > 13 { title.fontSize = 9.5 }
            let detail = label(c.detail, size: 9.5, color: enabled ? Palette.hudText.withAlphaComponent(0.8) : .gray)
            detail.position = CGPoint(x: 6, y: 11)
            [key, title, detail].forEach { $0.name = b.name; b.addChild($0) }
            panel.addChild(b)
            buttons.append(b)
        }
        layoutButtons()
    }

    private func layoutButtons() {
        let cols = 5
        let x0 = size.width / 2 - CGFloat(cols) * 94 - 8
        let base = -size.height / 2
        for (i, b) in buttons.enumerated() {
            let row = i / cols, col = i % cols
            b.position = CGPoint(x: x0 + CGFloat(col) * 94, y: base + HUD.panelH - 66 - CGFloat(row) * 62)
        }
    }

    func button(at p: CGPoint, in scene: SKScene) -> Int? {
        for n in scene.nodes(at: scene.convert(p, from: root)) {
            if let name = n.name, name.hasPrefix("btn:"), let i = Int(name.dropFirst(4)) { return i }
        }
        return nil
    }

    func hover(_ index: Int?, at p: CGPoint) {
        guard let i = index, i < commands.count else {
            tooltip.isHidden = true; tooltipBack.isHidden = true
            return
        }
        let c = commands[i]
        tooltip.text = "\(c.title) (\(c.key)): \(c.detail)" + (c.blocker.map { "   \($0)" } ?? "")
        tooltip.fontColor = c.blocker == nil ? Palette.hudText : .orange
        let w = tooltip.frame.width + 16
        let x = min(p.x, size.width / 2 - w - 4)
        let y = -size.height / 2 + HUD.panelH + 18
        tooltip.position = CGPoint(x: x + 8, y: y)
        tooltipBack.path = CGPath(roundedRect: CGRect(x: x, y: y - 12, width: w, height: 24),
                                  cornerWidth: 4, cornerHeight: 4, transform: nil)
        tooltip.isHidden = false; tooltipBack.isHidden = false
    }

    // MARK: messages

    func message(_ text: String, color: NSColor = Palette.hudText, now: Double) {
        let l = label(text, size: 15, bold: true, color: color)
        l.horizontalAlignmentMode = .center
        root.addChild(l)
        messages.append((l, now + 6))
        if messages.count > 4 { messages.removeFirst().0.removeFromParent() }
        relayoutMessages()
    }

    func tick(now: Double) {
        let before = messages.count
        messages.removeAll { m in
            if m.1 < now { m.0.removeFromParent(); return true }
            m.0.alpha = CGFloat(min(1, m.1 - now))
            return false
        }
        if messages.count != before { relayoutMessages() }
    }

    private func relayoutMessages() {
        for (i, m) in messages.enumerated() {
            m.0.position = CGPoint(x: 0, y: size.height / 2 - HUD.topH - 22 - CGFloat(i) * 22)
        }
    }

    // MARK: overlays

    func showOverlay(title: String, lines: [String], color: NSColor = Palette.gold) {
        overlay.removeAllChildren()
        let back = SKShapeNode(rect: CGRect(x: -330, y: -CGFloat(lines.count) * 12 - 70,
                                            width: 660, height: CGFloat(lines.count) * 24 + 130), cornerRadius: 12)
        back.fillColor = NSColor.black.withAlphaComponent(0.82)
        back.strokeColor = Palette.hudEdge
        back.lineWidth = 2
        overlay.addChild(back)
        let t = label(title, size: 34, bold: true, color: color)
        t.horizontalAlignmentMode = .center
        t.position = CGPoint(x: 0, y: CGFloat(lines.count) * 12 + 22)
        overlay.addChild(t)
        for (i, line) in lines.enumerated() {
            let l = label(line, size: 15)
            l.horizontalAlignmentMode = .center
            l.position = CGPoint(x: 0, y: CGFloat(lines.count) * 12 - 18 - CGFloat(i) * 24)
            overlay.addChild(l)
        }
        overlay.isHidden = false
    }

    func hideOverlay() { overlay.isHidden = true }
    var overlayShown: Bool { !overlay.isHidden && !overlay.children.isEmpty }
}
