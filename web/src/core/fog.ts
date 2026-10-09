import { Tile, Vec2 } from "./geom";
import type { World } from "./world";

/** Fog of war for one player: what they see now, and what they have ever seen. */
export class Fog {
  readonly visible: Uint8Array;
  readonly explored: Uint8Array;
  /** How many tiles have ever been seen. */
  exploredCount = 0;

  constructor(readonly width: number, readonly height: number) {
    this.visible = new Uint8Array(width * height);
    this.explored = new Uint8Array(width * height);
  }

  isVisible(t: Tile) {
    return t.x >= 0 && t.y >= 0 && t.x < this.width && t.y < this.height && this.visible[t.y * this.width + t.x] === 1;
  }

  isExplored(t: Tile) {
    return t.x >= 0 && t.y >= 0 && t.x < this.width && t.y < this.height && this.explored[t.y * this.width + t.x] === 1;
  }

  revealAll() { this.visible.fill(1); this.explored.fill(1); this.exploredCount = this.explored.length; }

  /** The share of the map ever seen, 0 to 1. */
  get exploredShare() { return this.exploredCount / this.explored.length; }

  update(w: World, player: number) {
    this.visible.fill(0);
    for (const u of w.units) if (u.alive && u.owner === player) this.reveal(u.pos, u.def.los);
    for (const b of w.buildings) {
      if (b.alive && b.owner === player) this.reveal(b.center, (b.def.los ?? 2) + b.def.size / 2);
    }
  }

  private reveal(c: Vec2, r: number) {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(c.x - r)), x1 = Math.min(this.width - 1, Math.floor(c.x + r));
    const y0 = Math.max(0, Math.floor(c.y - r)), y1 = Math.min(this.height - 1, Math.floor(c.y + r));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - c.y;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - c.x;
        if (dx * dx + dy * dy <= r2) {
          const i = y * this.width + x;
          this.visible[i] = 1;
          if (!this.explored[i]) { this.explored[i] = 1; this.exploredCount++; }
        }
      }
    }
  }
}
