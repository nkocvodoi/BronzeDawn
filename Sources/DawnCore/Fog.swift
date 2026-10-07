import Foundation

/// Fog of war for one player: what they can see now, and what they have ever seen.
public struct Fog {
    public let width: Int
    public let height: Int
    public private(set) var visible: [Bool]
    public private(set) var explored: [Bool]

    init(width: Int, height: Int) {
        self.width = width
        self.height = height
        visible = Array(repeating: false, count: width * height)
        explored = Array(repeating: false, count: width * height)
    }

    public func isVisible(_ t: Tile) -> Bool {
        t.x >= 0 && t.y >= 0 && t.x < width && t.y < height && visible[t.y * width + t.x]
    }

    public func isExplored(_ t: Tile) -> Bool {
        t.x >= 0 && t.y >= 0 && t.x < width && t.y < height && explored[t.y * width + t.x]
    }

    public mutating func revealAll() {
        for i in visible.indices { visible[i] = true; explored[i] = true }
    }

    mutating func update(_ w: World, player: Int) {
        for i in visible.indices { visible[i] = false }
        for u in w.units where u.alive && u.owner == player { reveal(u.pos, u.def.los) }
        for b in w.buildings where b.alive && b.owner == player {
            reveal(b.center, (b.def.los ?? 2) + Double(b.def.size) / 2)
        }
    }

    private mutating func reveal(_ c: Vec2, _ r: Double) {
        let r2 = r * r
        let x0 = max(0, Int(c.x - r)), x1 = min(width - 1, Int(c.x + r))
        let y0 = max(0, Int(c.y - r)), y1 = min(height - 1, Int(c.y + r))
        guard x0 <= x1, y0 <= y1 else { return }
        for y in y0...y1 {
            let dy = Double(y) + 0.5 - c.y
            for x in x0...x1 {
                let dx = Double(x) + 0.5 - c.x
                if dx * dx + dy * dy <= r2 {
                    let i = y * width + x
                    visible[i] = true
                    explored[i] = true
                }
            }
        }
    }
}
