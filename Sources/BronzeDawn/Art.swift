import AppKit
import DawnCore
import SpriteKit

// MARK: projection

/// Isometric 2:1. A tile is a diamond 64 points wide and 32 tall.
enum Iso {
    static let halfW: CGFloat = 32
    static let halfH: CGFloat = 16

    static func screen(_ p: Vec2) -> CGPoint {
        CGPoint(x: CGFloat(p.x - p.y) * halfW, y: -CGFloat(p.x + p.y) * halfH)
    }

    static func world(_ s: CGPoint) -> Vec2 {
        let a = Double(s.x / halfW)          // x - y
        let b = Double(-s.y / halfH)         // x + y
        return Vec2((a + b) / 2, (b - a) / 2)
    }

    /// Draw order: further down the screen is in front.
    static func depth(_ p: Vec2) -> CGFloat { 100 + CGFloat(p.x + p.y) }

    /// A node whose children are laid out in tile coordinates and drawn as the iso diamond.
    /// Put a sprite of size (width, height) with anchor (0, 0) inside `inner`.
    static func gridNode(scale: CGFloat = 1) -> (outer: SKNode, inner: SKNode) {
        let outer = SKNode()
        outer.xScale = halfW * sqrt(2) * scale
        outer.yScale = halfH * sqrt(2) * scale
        let inner = SKNode()
        inner.yScale = -1
        inner.zRotation = -.pi / 4
        outer.addChild(inner)
        return (outer, inner)
    }
}

// MARK: colours

enum Palette {
    static let players: [NSColor] = [
        NSColor(calibratedRed: 0.20, green: 0.45, blue: 0.92, alpha: 1),
        NSColor(calibratedRed: 0.86, green: 0.22, blue: 0.20, alpha: 1),
        NSColor(calibratedRed: 0.95, green: 0.78, blue: 0.20, alpha: 1),
        NSColor(calibratedRed: 0.25, green: 0.70, blue: 0.30, alpha: 1),
    ]

    static func player(_ id: Int) -> NSColor { id >= 0 ? players[id % players.count] : .white }

    static let hudBack = NSColor(calibratedRed: 0.16, green: 0.12, blue: 0.08, alpha: 0.93)
    static let hudEdge = NSColor(calibratedRed: 0.62, green: 0.48, blue: 0.26, alpha: 1)
    static let hudText = NSColor(calibratedRed: 0.96, green: 0.90, blue: 0.76, alpha: 1)
    static let gold = NSColor(calibratedRed: 1.0, green: 0.84, blue: 0.35, alpha: 1)

    static func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> CGColor {
        CGColor(red: r, green: g, blue: b, alpha: a)
    }

    static func shade(_ c: NSColor, _ k: CGFloat) -> CGColor {
        let s = c.usingColorSpace(.deviceRGB) ?? c
        return CGColor(red: min(1, s.redComponent * k), green: min(1, s.greenComponent * k),
                       blue: min(1, s.blueComponent * k), alpha: 1)
    }
}

// MARK: textures, all drawn in code. No assets from anywhere.

final class Art {
    private var cache: [String: SKTexture] = [:]

    private func texture(_ key: String, _ w: CGFloat, _ h: CGFloat, scale: CGFloat = 2,
                         _ draw: (CGContext) -> Void) -> SKTexture {
        if let t = cache[key] { return t }
        let pw = Int(w * scale), ph = Int(h * scale)
        let ctx = CGContext(data: nil, width: pw, height: ph, bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.scaleBy(x: scale, y: scale)
        draw(ctx)
        let t = SKTexture(cgImage: ctx.makeImage()!)
        cache[key] = t
        return t
    }

    // MARK: terrain

    /// The whole map as one image. Pixel (0, 0) is screen point (-height * 32, -(w + h) * 16).
    func terrain(_ map: GridMap) -> SKTexture {
        let w = CGFloat(map.width), h = CGFloat(map.height)
        let W = (w + h) * Iso.halfW, H = (w + h) * Iso.halfH
        return texture("terrain-\(ObjectIdentifier(map).hashValue)", W, H, scale: 1) { ctx in
            ctx.setFillColor(Palette.rgb(0, 0, 0))
            ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
            let ox = h * Iso.halfW, oy = H
            for y in 0..<map.height {
                for x in 0..<map.width {
                    let t = Tile(x, y)
                    let s = CGFloat(map.shade[map.index(t)]) / 255
                    let color: CGColor
                    switch map.terrain(at: t) {
                    case .grass: color = Palette.rgb(0.34 + s * 0.06, 0.52 + s * 0.08, 0.22 + s * 0.04)
                    case .dirt: color = Palette.rgb(0.55 + s * 0.05, 0.45 + s * 0.05, 0.28)
                    case .sand: color = Palette.rgb(0.80 + s * 0.04, 0.72 + s * 0.04, 0.48)
                    case .water: color = Palette.rgb(0.16, 0.36 + s * 0.06, 0.62 + s * 0.06)
                    }
                    let c = Iso.screen(t.center)
                    let cx = c.x + ox, cy = c.y + oy
                    let e: CGFloat = 0.7   // overlap so neighbours leave no seams
                    ctx.setFillColor(color)
                    ctx.beginPath()
                    ctx.move(to: CGPoint(x: cx, y: cy + Iso.halfH + e))
                    ctx.addLine(to: CGPoint(x: cx + Iso.halfW + e, y: cy))
                    ctx.addLine(to: CGPoint(x: cx, y: cy - Iso.halfH - e))
                    ctx.addLine(to: CGPoint(x: cx - Iso.halfW - e, y: cy))
                    ctx.closePath()
                    ctx.fillPath()
                    // A few tufts and pebbles so grass is not a flat colour.
                    if map.terrain(at: t) == .grass && s > 0.55 {
                        ctx.setFillColor(Palette.rgb(0.28, 0.44, 0.17, 0.9))
                        for k in 0..<3 {
                            let dx = CGFloat((Int(s * 1000) + k * 37) % 30) - 15
                            let dy = CGFloat((Int(s * 777) + k * 23) % 12) - 6
                            ctx.fill(CGRect(x: cx + dx, y: cy + dy, width: 2, height: 3))
                        }
                    } else if map.terrain(at: t) == .water && s > 0.7 {
                        ctx.setStrokeColor(Palette.rgb(0.55, 0.72, 0.9, 0.5))
                        ctx.setLineWidth(1)
                        ctx.move(to: CGPoint(x: cx - 8, y: cy))
                        ctx.addLine(to: CGPoint(x: cx + 6, y: cy + 2))
                        ctx.strokePath()
                    }
                }
            }
        }
    }

    // MARK: resources

    func node(_ type: String, variant: Int) -> (SKTexture, CGSize, CGPoint) {
        switch type {
        case "tree":
            let v = variant % 3
            let size = CGSize(width: 44, height: 64)
            let t = texture("tree\(v)", size.width, size.height) { ctx in
                shadow(ctx, CGRect(x: 8, y: 3, width: 30, height: 10))
                ctx.setFillColor(Palette.rgb(0.40, 0.27, 0.15))
                ctx.fill(CGRect(x: 19, y: 6, width: 6, height: 22))
                let greens: [(CGFloat, CGFloat, CGFloat)] = [(0.16, 0.42, 0.18), (0.20, 0.48, 0.16), (0.13, 0.38, 0.22)]
                let g = greens[v]
                let blobs: [(CGFloat, CGFloat, CGFloat)] = v == 2
                    ? [(22, 26, 13), (22, 38, 11), (22, 50, 8)]      // conifer-ish stack
                    : [(14, 32, 11), (30, 32, 11), (22, 42, 14)]
                for (i, b) in blobs.enumerated() {
                    let k = 0.8 + CGFloat(i) * 0.12
                    ctx.setFillColor(Palette.rgb(g.0 * k, g.1 * k, g.2 * k))
                    ctx.fillEllipse(in: CGRect(x: b.0 - b.2, y: b.1 - b.2 * 0.85, width: b.2 * 2, height: b.2 * 1.7))
                }
                ctx.setFillColor(Palette.rgb(1, 1, 1, 0.12))
                ctx.fillEllipse(in: CGRect(x: 16, y: 44, width: 10, height: 7))
            }
            return (t, size, CGPoint(x: 0.5, y: 0.12))
        case "berry_bush":
            let size = CGSize(width: 40, height: 30)
            let t = texture("berry", size.width, size.height) { ctx in
                shadow(ctx, CGRect(x: 6, y: 2, width: 28, height: 9))
                ctx.setFillColor(Palette.rgb(0.18, 0.45, 0.20))
                ctx.fillEllipse(in: CGRect(x: 5, y: 6, width: 30, height: 20))
                ctx.setFillColor(Palette.rgb(0.24, 0.55, 0.24))
                ctx.fillEllipse(in: CGRect(x: 10, y: 12, width: 18, height: 12))
                ctx.setFillColor(Palette.rgb(0.85, 0.12, 0.22))
                for (x, y) in [(10, 12), (16, 18), (24, 14), (28, 20), (19, 10), (13, 20)] as [(CGFloat, CGFloat)] {
                    ctx.fillEllipse(in: CGRect(x: x, y: y, width: 4, height: 4))
                }
            }
            return (t, size, CGPoint(x: 0.5, y: 0.25))
        default:
            let gold = type == "gold_mine"
            let size = CGSize(width: 46, height: 32)
            let t = texture(type, size.width, size.height) { ctx in
                shadow(ctx, CGRect(x: 4, y: 2, width: 38, height: 10))
                let base = gold ? Palette.rgb(0.55, 0.45, 0.30) : Palette.rgb(0.50, 0.50, 0.52)
                let light = gold ? Palette.rgb(0.98, 0.80, 0.25) : Palette.rgb(0.78, 0.78, 0.80)
                for (x, y, r) in [(8, 6, 11), (20, 5, 13), (14, 13, 10), (28, 10, 9)] as [(CGFloat, CGFloat, CGFloat)] {
                    ctx.setFillColor(base)
                    rock(ctx, x, y, r)
                    ctx.setFillColor(light)
                    rock(ctx, x + 2, y + r * 0.45, r * 0.55)
                }
            }
            return (t, size, CGPoint(x: 0.5, y: 0.25))
        }
    }

    private func rock(_ ctx: CGContext, _ x: CGFloat, _ y: CGFloat, _ r: CGFloat) {
        ctx.beginPath()
        ctx.move(to: CGPoint(x: x, y: y))
        ctx.addLine(to: CGPoint(x: x + r, y: y))
        ctx.addLine(to: CGPoint(x: x + r * 1.1, y: y + r * 0.6))
        ctx.addLine(to: CGPoint(x: x + r * 0.5, y: y + r))
        ctx.addLine(to: CGPoint(x: x - r * 0.1, y: y + r * 0.55))
        ctx.closePath()
        ctx.fillPath()
    }

    private func shadow(_ ctx: CGContext, _ r: CGRect) {
        ctx.setFillColor(Palette.rgb(0, 0, 0, 0.28))
        ctx.fillEllipse(in: r)
    }

    // MARK: units

    func unit(_ type: String, owner: Int) -> (SKTexture, CGSize, CGPoint) {
        let pc = Palette.player(owner)
        let horse = type == "scout"
        let size = CGSize(width: horse ? 52 : 34, height: horse ? 50 : 44)
        let t = texture("u-\(type)-\(owner)", size.width, size.height) { ctx in
            let cx = size.width / 2
            shadow(ctx, CGRect(x: cx - (horse ? 20 : 11), y: 1, width: horse ? 40 : 22, height: 8))
            var baseY: CGFloat = 5
            if horse {
                ctx.setFillColor(Palette.rgb(0.45, 0.30, 0.18))
                for lx in [cx - 14, cx - 9, cx + 7, cx + 12] { ctx.fill(CGRect(x: lx, y: 4, width: 3, height: 12)) }
                ctx.fillEllipse(in: CGRect(x: cx - 18, y: 12, width: 34, height: 14))
                ctx.fill(CGRect(x: cx + 10, y: 18, width: 6, height: 12))
                ctx.fillEllipse(in: CGRect(x: cx + 10, y: 26, width: 13, height: 7))
                ctx.setFillColor(Palette.rgb(0.25, 0.16, 0.10))
                ctx.fill(CGRect(x: cx - 21, y: 14, width: 4, height: 9))
                baseY = 18
            } else {
                ctx.setFillColor(Palette.rgb(0.35, 0.24, 0.15))
                ctx.fill(CGRect(x: cx - 5, y: 4, width: 4, height: 11))
                ctx.fill(CGRect(x: cx + 1, y: 4, width: 4, height: 11))
            }
            // Body: villagers wear undyed cloth with a coloured sash, soldiers wear the player colour.
            let villager = type == "villager"
            let body = villager ? Palette.rgb(0.70, 0.58, 0.40) : Palette.shade(pc, 0.95)
            ctx.setFillColor(body)
            let bodyRect = CGRect(x: cx - 7, y: baseY + 9, width: 14, height: 15)
            ctx.addPath(CGPath(roundedRect: bodyRect, cornerWidth: 4, cornerHeight: 4, transform: nil))
            ctx.fillPath()
            ctx.setFillColor(villager ? Palette.shade(pc, 1) : Palette.shade(pc, 0.65))
            ctx.fill(CGRect(x: cx - 7, y: baseY + 14, width: 14, height: 3))
            // Head.
            ctx.setFillColor(Palette.rgb(0.88, 0.70, 0.52))
            ctx.fillEllipse(in: CGRect(x: cx - 5, y: baseY + 23, width: 10, height: 10))
            ctx.setFillColor(Palette.rgb(0.28, 0.18, 0.10))
            ctx.fillEllipse(in: CGRect(x: cx - 5, y: baseY + 29, width: 10, height: 5))
            // Gear.
            ctx.setLineCap(.round)
            switch type {
            case "villager":
                ctx.setStrokeColor(Palette.rgb(0.45, 0.32, 0.18)); ctx.setLineWidth(2)
                ctx.move(to: CGPoint(x: cx + 8, y: baseY + 8)); ctx.addLine(to: CGPoint(x: cx + 12, y: baseY + 24)); ctx.strokePath()
                ctx.setFillColor(Palette.rgb(0.6, 0.6, 0.62))
                ctx.fill(CGRect(x: cx + 9, y: baseY + 22, width: 7, height: 3))
            case "clubman":
                ctx.setStrokeColor(Palette.rgb(0.42, 0.28, 0.14)); ctx.setLineWidth(4)
                ctx.move(to: CGPoint(x: cx + 8, y: baseY + 12)); ctx.addLine(to: CGPoint(x: cx + 14, y: baseY + 30)); ctx.strokePath()
            case "axeman":
                ctx.setStrokeColor(Palette.rgb(0.42, 0.28, 0.14)); ctx.setLineWidth(2.5)
                ctx.move(to: CGPoint(x: cx + 8, y: baseY + 10)); ctx.addLine(to: CGPoint(x: cx + 12, y: baseY + 32)); ctx.strokePath()
                ctx.setFillColor(Palette.rgb(0.70, 0.72, 0.76))
                ctx.fillEllipse(in: CGRect(x: cx + 10, y: baseY + 25, width: 9, height: 9))
            case "bowman":
                ctx.setStrokeColor(Palette.rgb(0.50, 0.34, 0.16)); ctx.setLineWidth(2)
                ctx.addArc(center: CGPoint(x: cx + 6, y: baseY + 18), radius: 11, startAngle: -1.2, endAngle: 1.2, clockwise: false)
                ctx.strokePath()
                ctx.setStrokeColor(Palette.rgb(0.9, 0.9, 0.85)); ctx.setLineWidth(0.8)
                ctx.move(to: CGPoint(x: cx + 6 + 11 * cos(-1.2), y: baseY + 18 + 11 * sin(-1.2)))
                ctx.addLine(to: CGPoint(x: cx + 6 + 11 * cos(1.2), y: baseY + 18 + 11 * sin(1.2))); ctx.strokePath()
            case "scout":
                ctx.setStrokeColor(Palette.rgb(0.55, 0.40, 0.20)); ctx.setLineWidth(2)
                ctx.move(to: CGPoint(x: cx - 2, y: baseY + 12)); ctx.addLine(to: CGPoint(x: cx + 18, y: baseY + 30)); ctx.strokePath()
                ctx.setFillColor(Palette.rgb(0.72, 0.74, 0.78))
                ctx.fill(CGRect(x: cx + 16, y: baseY + 28, width: 4, height: 5))
            default: break
            }
        }
        return (t, size, CGPoint(x: 0.5, y: 0.1))
    }

    // MARK: buildings

    func building(_ def: BuildingDef, owner: Int) -> (SKTexture, CGSize, CGPoint) {
        let s = CGFloat(def.size)
        let W = s * Iso.halfW * 2, D = s * Iso.halfH * 2
        let wall: CGFloat
        switch def.id {
        case "farm": wall = 0
        case "watch_tower": wall = 58
        case "town_center": wall = 34
        case "house": wall = 18
        default: wall = 24
        }
        let roofH: CGFloat = def.id == "farm" ? 0 : (def.id == "watch_tower" ? 14 : 20)
        let size = CGSize(width: W, height: D + wall + roofH + 22)
        let pc = Palette.player(owner)
        let t = texture("b-\(def.id)-\(owner)", size.width, size.height) { ctx in
            let left = CGPoint(x: 0, y: D / 2), bottom = CGPoint(x: W / 2, y: 0)
            let right = CGPoint(x: W, y: D / 2), top = CGPoint(x: W / 2, y: D)
            func poly(_ pts: [CGPoint], _ c: CGColor) {
                ctx.setFillColor(c)
                ctx.beginPath()
                ctx.move(to: pts[0])
                for p in pts.dropFirst() { ctx.addLine(to: p) }
                ctx.closePath()
                ctx.fillPath()
            }
            func inset(_ k: CGFloat) -> [CGPoint] {
                let c = CGPoint(x: W / 2, y: D / 2)
                return [left, bottom, right, top].map { CGPoint(x: c.x + ($0.x - c.x) * k, y: c.y + ($0.y - c.y) * k) }
            }
            if def.id == "farm" {
                poly([left, bottom, right, top], Palette.rgb(0.50, 0.36, 0.20))
                ctx.setStrokeColor(Palette.rgb(0.38, 0.26, 0.14)); ctx.setLineWidth(1.5)
                for i in 1..<8 {
                    let k = CGFloat(i) / 8
                    ctx.move(to: CGPoint(x: left.x + (top.x - left.x) * k, y: left.y + (top.y - left.y) * k))
                    ctx.addLine(to: CGPoint(x: bottom.x + (right.x - bottom.x) * k, y: bottom.y + (right.y - bottom.y) * k))
                }
                ctx.strokePath()
                ctx.setFillColor(Palette.rgb(0.45, 0.65, 0.22))
                for i in 0..<18 {
                    let fx = W * 0.25 + CGFloat((i * 37) % 50) / 50 * W * 0.5
                    let fy = D * 0.3 + CGFloat((i * 53) % 40) / 40 * D * 0.4
                    ctx.fillEllipse(in: CGRect(x: fx, y: fy, width: 3, height: 3))
                }
                ctx.setFillColor(Palette.shade(pc, 1))
                ctx.fill(CGRect(x: W / 2 - 1, y: D / 2, width: 2, height: 14))
                ctx.fill(CGRect(x: W / 2 + 1, y: D / 2 + 9, width: 8, height: 5))
                return
            }
            // Foundation.
            poly([left, bottom, right, top], Palette.rgb(0.45, 0.38, 0.28))
            let k: CGFloat = def.id == "watch_tower" ? 0.62 : 0.84
            let b = inset(k)
            let (l, bt, r, tp) = (b[0], b[1], b[2], b[3])
            let up = { (p: CGPoint, h: CGFloat) in CGPoint(x: p.x, y: p.y + h) }
            let stone = def.id == "watch_tower"
            let wallLight = stone ? Palette.rgb(0.72, 0.70, 0.66) : Palette.rgb(0.80, 0.66, 0.46)
            let wallDark = stone ? Palette.rgb(0.52, 0.50, 0.48) : Palette.rgb(0.62, 0.48, 0.32)
            poly([l, bt, up(bt, wall), up(l, wall)], wallDark)
            poly([bt, r, up(r, wall), up(bt, wall)], wallLight)
            // Door.
            ctx.setFillColor(Palette.rgb(0.25, 0.16, 0.10))
            let dw: CGFloat = min(12, W * 0.12)
            ctx.beginPath()
            ctx.move(to: CGPoint(x: bt.x + dw * 0.4, y: bt.y + 1 + dw * 0.2))
            ctx.addLine(to: CGPoint(x: bt.x + dw * 1.4, y: bt.y + dw * 0.7))
            ctx.addLine(to: CGPoint(x: bt.x + dw * 1.4, y: bt.y + dw * 0.7 + min(wall * 0.6, 16)))
            ctx.addLine(to: CGPoint(x: bt.x + dw * 0.4, y: bt.y + 1 + dw * 0.2 + min(wall * 0.6, 16)))
            ctx.closePath(); ctx.fillPath()
            // An emblem on the right wall so the military buildings read apart at a glance.
            let em = CGPoint(x: (bt.x + r.x) / 2, y: (bt.y + r.y) / 2 + wall * 0.55)
            switch def.id {
            case "barracks":
                ctx.setStrokeColor(Palette.rgb(0.35, 0.22, 0.12)); ctx.setLineWidth(3); ctx.setLineCap(.round)
                ctx.move(to: CGPoint(x: em.x - 7, y: em.y - 7)); ctx.addLine(to: CGPoint(x: em.x + 7, y: em.y + 7))
                ctx.move(to: CGPoint(x: em.x + 7, y: em.y - 7)); ctx.addLine(to: CGPoint(x: em.x - 7, y: em.y + 7))
                ctx.strokePath()
            case "archery_range":
                for (rad, c) in [(9, Palette.rgb(0.9, 0.9, 0.85)), (6, Palette.rgb(0.8, 0.15, 0.15)), (3, Palette.rgb(0.9, 0.9, 0.85))] as [(CGFloat, CGColor)] {
                    ctx.setFillColor(c)
                    ctx.fillEllipse(in: CGRect(x: em.x - rad, y: em.y - rad, width: rad * 2, height: rad * 2))
                }
            case "stable":
                ctx.setStrokeColor(Palette.rgb(0.35, 0.22, 0.12)); ctx.setLineWidth(3)
                ctx.addArc(center: em, radius: 7, startAngle: 0.3, endAngle: .pi - 0.3, clockwise: true)
                ctx.strokePath()
                ctx.setFillColor(Palette.rgb(0.85, 0.72, 0.35))
                ctx.fill(CGRect(x: l.x + 6, y: l.y + 1, width: 14, height: 8))
            default: break
            }
            // Roof: thatch for most, the player's colour on the big ones.
            let roofColor: CGColor
            switch def.id {
            case "town_center", "barracks", "archery_range", "stable": roofColor = Palette.shade(pc, 0.85)
            case "watch_tower": roofColor = Palette.shade(pc, 0.8)
            default: roofColor = Palette.rgb(0.78, 0.64, 0.30)
            }
            let peak = CGPoint(x: W / 2, y: D / 2 + wall + roofH)
            let ul = up(l, wall), ub = up(bt, wall), ur = up(r, wall), ut = up(tp, wall)
            poly([ul, ub, peak], Palette.shade(NSColor(cgColor: roofColor) ?? pc, 0.78))
            poly([ub, ur, peak], roofColor)
            poly([ur, ut, peak], Palette.shade(NSColor(cgColor: roofColor) ?? pc, 1.1))
            poly([ut, ul, peak], Palette.shade(NSColor(cgColor: roofColor) ?? pc, 0.9))
            // Coloured band on thatched roofs so you can tell whose they are.
            if def.id == "house" || def.id == "granary" || def.id == "storage_pit" {
                ctx.setStrokeColor(Palette.shade(pc, 1)); ctx.setLineWidth(3)
                ctx.move(to: up(ul, 1)); ctx.addLine(to: up(ub, 1)); ctx.addLine(to: up(ur, 1)); ctx.strokePath()
            }
            if def.id == "granary" {
                ctx.setFillColor(Palette.rgb(0.85, 0.75, 0.40))
                ctx.fillEllipse(in: CGRect(x: r.x - 18, y: r.y - 4, width: 14, height: 9))
            }
            if def.id == "storage_pit" {
                ctx.setFillColor(Palette.rgb(0.50, 0.34, 0.18))
                for i in 0..<3 { ctx.fill(CGRect(x: l.x + 4 + CGFloat(i) * 5, y: l.y - 6 + CGFloat(i), width: 4, height: 10)) }
            }
            // Flag.
            ctx.setFillColor(Palette.rgb(0.3, 0.22, 0.14))
            ctx.fill(CGRect(x: peak.x - 1, y: peak.y - 2, width: 2, height: 20))
            ctx.setFillColor(Palette.shade(pc, 1.05))
            ctx.fill(CGRect(x: peak.x + 1, y: peak.y + 10, width: 11, height: 7))
        }
        return (t, size, CGPoint(x: 0.5, y: 0))
    }

    // MARK: small things

    func ring(_ w: CGFloat, _ h: CGFloat, _ color: NSColor) -> SKShapeNode {
        let n = SKShapeNode(ellipseOf: CGSize(width: w, height: h))
        n.strokeColor = color
        n.lineWidth = 1.5
        n.fillColor = .clear
        return n
    }

    func diamond(size s: Int, _ color: NSColor) -> SKShapeNode {
        let p = CGMutablePath()
        let w = CGFloat(s) * Iso.halfW, h = CGFloat(s) * Iso.halfH
        p.move(to: CGPoint(x: 0, y: 0))
        p.addLine(to: CGPoint(x: w, y: h))
        p.addLine(to: CGPoint(x: 0, y: 2 * h))
        p.addLine(to: CGPoint(x: -w, y: h))
        p.closeSubpath()
        let n = SKShapeNode(path: p)
        n.strokeColor = color
        n.lineWidth = 1.5
        n.fillColor = .clear
        return n
    }
}
