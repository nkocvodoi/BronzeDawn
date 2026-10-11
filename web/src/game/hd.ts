// Pictures at the screen's own resolution, shaded as solid shapes lit from the upper left: the look of
// the original's sprites, which were rendered from models. Each part of a figure is a little solid (a
// ball, a limb, a torso), and each pixel takes the tone its surface would have under that light, from a
// ramp of six tones per material, dithered between tones. The outline is the darker tone of what it
// borders, not black. The old pictures are drawn at half resolution and doubled; these are not.
import { bayer, darken, mix, PixelCanvas, RGB, rgb } from "./pixel";

/** Six tones of a material, from the deepest shadow to the highlight. */
export type Ramp = readonly RGB[];

/** A material's tones: shadows a little cooler, highlights a little warmer, as lit things look. */
export function ramp(base: RGB): Ramp {
  const cool: RGB = [44, 30, 52], warm: RGB = [255, 244, 222];
  return [
    mix(darken(base, 0.3), cool, 0.32), mix(darken(base, 0.5), cool, 0.2), darken(base, 0.74),
    base, mix(base, warm, 0.26), mix(base, warm, 0.52),
  ];
}

// The light, from the upper left and in front.
const L = (() => { const v = [-0.66, -0.52, 0.54]; const n = Math.hypot(...v); return v.map((x) => x / n) as [number, number, number]; })();
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** The tone of a surface with this normal, at this pixel (dithered between neighbouring tones). */
function shade(r: Ramp, nx: number, ny: number, nz: number, x: number, y: number): RGB {
  const lambert = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
  // Dithered only a little between tones: more reads as noise on cloth, not as a rounded surface.
  const v = (0.06 + 0.94 * lambert) * (r.length - 1) + (bayer(x, y) - 0.5) * 0.45;
  return r[clamp(Math.round(v), 0, r.length - 1)];
}

/** A ball, or an egg: the head, a fist, a bundle. */
export function ellipsoid(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, r: Ramp) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
    if (d2 > 1) continue;
    p.set(x, y, shade(r, dx, dy, Math.sqrt(1 - d2), x, y));
  }
}

/** A limb, a shaft, a log: a cylinder with round ends from a to b. */
export function capsule(p: PixelCanvas, ax: number, ay: number, bx: number, by: number, rad: number, r: Ramp) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  for (let y = Math.floor(Math.min(ay, by) - rad); y <= Math.ceil(Math.max(ay, by) + rad); y++) {
    for (let x = Math.floor(Math.min(ax, bx) - rad); x <= Math.ceil(Math.max(ax, bx) + rad); x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
      const vx = px - (ax + t * dx), vy = py - (ay + t * dy), d = Math.hypot(vx, vy);
      if (d > rad) continue;
      const k = d / rad;
      p.set(x, y, shade(r, vx / rad, vy / rad, Math.sqrt(Math.max(0, 1 - k * k)), x, y));
    }
  }
}

/** A body: wider at the shoulders than the waist, round across, the shoulders rounded off. */
export function torso(p: PixelCanvas, cx: number, top: number, bottom: number, wTop: number, wBottom: number, r: Ramp, lean = 0) {
  for (let y = Math.floor(top); y < Math.ceil(bottom); y++) {
    const t = (y + 0.5 - top) / (bottom - top);
    const half = wTop / 2 + (wBottom - wTop) / 2 * t;
    const mid = cx + lean * t;
    for (let x = Math.floor(mid - half); x <= Math.ceil(mid + half); x++) {
      const nx = (x + 0.5 - mid) / half;
      if (Math.abs(nx) > 1) continue;
      // The shoulders round off at the top corners.
      if (t < 0.18 && nx * nx + ((0.18 - t) / 0.18) ** 2 > 1.05) continue;
      const ny = t < 0.25 ? -0.55 * (1 - t / 0.25) : 0.12;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny * 0.5));
      p.set(x, y, shade(r, nx, ny, nz, x, y));
    }
  }
}

/** A flat piece (a blade, a plank) in one tone per side of a fold: lit side and shadow side. */
export function flat(p: PixelCanvas, pts: readonly (readonly [number, number])[], r: Ramp, lit = true) {
  p.poly(pts, (x, y) => r[clamp((lit ? 4 : 2) + (bayer(x, y) < 0.3 ? -1 : 0), 0, r.length - 1)]);
}

/** The outline: each clear pixel beside the picture takes a deep tone of what it borders. */
export function selout(p: PixelCanvas, k = 0.36) {
  const add: [number, number, RGB][] = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (p.alphaAt(x, y)) continue;
    let n = 0, s: [number, number, number] = [0, 0, 0];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = p.alphaAt(x + dx, y + dy) === 255 ? p.get(x + dx, y + dy) : null;
      if (c) { n++; s = [s[0] + c[0], s[1] + c[1], s[2] + c[2]]; }
    }
    if (n) add.push([x, y, [s[0] / n * k, s[1] / n * k, s[2] / n * k]]);
  }
  for (const [x, y, c] of add) p.set(x, y, c);
}

/** A soft shadow on the ground under a figure, darker in the middle. */
export function groundShadow(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if (d > 1 || p.alphaAt(x, y)) continue;
    p.set(x, y, [10, 14, 6], Math.round(110 * (1 - d * 0.6)));
  }
}

// ---- the villager

const SKIN = ramp(rgb(0xd29a6c)), HAIR = ramp(rgb(0x3e2616)), TUNIC = ramp(rgb(0xb8a070)), TUNIC_D = ramp(rgb(0x947c52));
const LEATHER = ramp(rgb(0x6e4626)), WOOD = ramp(rgb(0x8e5c30)), IRON = ramp(rgb(0x8c939c)), BASKET = ramp(rgb(0xa47c44));
const NET = rgb(0xdcd0b4);

export interface Figure { type: string; owner: number; facing: "front" | "back"; pose: "idle" | "walk" | "work"; frame: number; tool: string; carry: number | null }

/** Where the parts of a villager are, for a pose: feet, knees, hips, shoulders, hands; the head. */
function skeleton(f: Figure) {
  const cx = 22, fy = 50, f4 = f.frame % 4;
  const walk = f.pose === "walk";
  const bob = walk && (f4 === 1 || f4 === 3) ? -1 : 0;
  // As tall as the old picture: the head's top 6 above the shoulders, the hips halfway down.
  const hipY = 34 + bob, shY = 21 + bob, headY = 13 + bob;
  // A stride: one foot forward as the other goes back, lifted as it passes.
  const ph = (f4 * Math.PI) / 2;
  const stride = walk ? Math.sin(ph) * 3.5 : 0, lift = walk ? Math.max(0, Math.cos(ph)) * 1.5 : 0;
  const near = { foot: [cx + 2 + stride, fy - (stride > 0 ? 0 : lift)], hip: [cx + 2, hipY] };
  const far = { foot: [cx - 2 - stride, fy - (stride < 0 ? 0 : lift)], hip: [cx - 2, hipY] };
  const knee = (hip: number[], foot: number[], fwd: number) => [(hip[0] + foot[0]) / 2 + fwd, (hip[1] + foot[1]) / 2 - 0.5];
  return {
    cx, fy, hipY, shY, headY,
    nearLeg: { hip: near.hip, knee: knee(near.hip, near.foot, 0.8), foot: near.foot },
    farLeg: { hip: far.hip, knee: knee(far.hip, far.foot, 0.8), foot: far.foot },
    nearShoulder: [cx + 6, shY + 1.5], farShoulder: [cx - 6, shY + 1.5],
    swing: walk ? Math.sin(ph) * 2.5 : 0,
  };
}

/** Where the working hand is, and which way the tool points (radians, 0 to the right, down positive). */
function toolHold(f: Figure, s: ReturnType<typeof skeleton>): { hand: number[]; angle: number } {
  const st = f.frame % 3;
  if (f.pose !== "work") return { hand: [s.cx + 7, s.hipY - 3 + s.swing * 0.4], angle: 1.25 }; // carried at the side, pointing down
  if (f.tool === "hoe") return [{ hand: [s.cx + 6, s.shY - 3], angle: -1.2 }, { hand: [s.cx + 8, s.shY + 4], angle: 0.35 }, { hand: [s.cx + 7, s.hipY], angle: 1.05 }][st];
  if (f.tool === "spear") return [{ hand: [s.cx + 2, s.shY - 5], angle: -0.25 }, { hand: [s.cx + 6, s.shY - 3], angle: -0.05 }, { hand: [s.cx + 9, s.shY], angle: 0.2 }][st];
  // A chop: raised over the head, coming down, struck.
  return [{ hand: [s.cx + 3, s.shY - 7], angle: -2.2 }, { hand: [s.cx + 8, s.shY - 2], angle: -0.6 }, { hand: [s.cx + 8, s.hipY - 4], angle: 0.75 }][st];
}

function drawTool(p: PixelCanvas, tool: string, hand: number[], a: number) {
  const along = (d: number, side = 0): [number, number] => [hand[0] + Math.cos(a) * d - Math.sin(a) * side, hand[1] + Math.sin(a) * d + Math.cos(a) * side];
  const shaft = (from: number, to: number, rad = 0.9) => { const [x0, y0] = along(from), [x1, y1] = along(to); capsule(p, x0, y0, x1, y1, rad, WOOD); };
  switch (tool) {
    case "axe": {
      shaft(-3, 12);
      const pts = [along(9, 0.5), along(9, 4.5), along(12.5, 5.5), along(13, 0.5)];
      flat(p, pts, IRON);
      p.line(...along(9.5, 5), ...along(12.8, 5.6), IRON[5]);
      break;
    }
    case "pick": {
      shaft(-3, 11);
      for (let s = -5; s <= 5; s++) { const [x, y] = along(11 - Math.abs(s) * 0.35, s); capsule(p, x, y, x, y, s === 0 ? 1.4 : 0.9, IRON); }
      break;
    }
    case "hoe": {
      shaft(-4, 14);
      flat(p, [along(13, 0), along(13, 3.5), along(15.5, 3), along(15, 0)], IRON);
      break;
    }
    case "hammer": {
      shaft(-2, 8);
      const [x, y] = along(8.5);
      capsule(p, ...along(8.5, -2), ...along(8.5, 2.5), 1.8, IRON);
      void x; void y;
      break;
    }
    case "spear": {
      shaft(-8, 13, 0.75);
      flat(p, [along(13, -1.4), along(17.5, 0), along(13, 1.4)], IRON);
      break;
    }
    default: break;
  }
}

/** A load on the back: a bundle of logs, a sack of gold, stone in a sling, meat or berries in a basket. */
function drawLoad(p: PixelCanvas, carry: number, x: number, y: number) {
  if (carry === 1) {
    for (let i = 0; i < 3; i++) capsule(p, x - 4, y + i * 2.6, x + 5, y - 1 + i * 2.6, 1.4, WOOD);
    for (let i = 0; i < 3; i++) p.set(Math.round(x + 5), Math.round(y - 1 + i * 2.6), rgb(0xd8b07a)); // cut ends
  } else if (carry === 0) {
    ellipsoid(p, x, y + 2, 4.5, 3.5, BASKET);
    for (let i = 0; i < 4; i++) p.set(Math.round(x - 2 + i * 1.4), Math.round(y - 0.5 + (i % 2)), i % 2 ? rgb(0x6aa040) : rgb(0xc8243a));
  } else {
    ellipsoid(p, x, y + 2, 4, 4.2, ramp(rgb(0xa88a5a)));
    const lump = carry === 2 ? ramp(rgb(0xe8c040)) : ramp(rgb(0xa8a49c));
    ellipsoid(p, x - 1, y - 1, 2.2, 1.8, lump);
    ellipsoid(p, x + 1.5, y - 0.5, 1.8, 1.5, lump);
  }
}

/** A villager at the screen's own resolution, in a 52 x 56 picture with the feet at (22, 50). */
export function drawVillagerHD(p: PixelCanvas, f: Figure, pc: RGB) {
  const s = skeleton(f), back = f.facing === "back";
  const PC = ramp(pc);
  const work = f.pose === "work";
  const hold = toolHold(f, s);
  const tool = f.tool === "none" ? "" : f.tool;
  groundShadow(p, s.cx, s.fy + 0.5, 9, 3);

  const leg = (l: { hip: number[]; knee: number[]; foot: number[] }, far: boolean) => {
    const r = far ? ramp(darken(rgb(0x6e4626), 0.82)) : LEATHER;
    capsule(p, l.hip[0], l.hip[1], l.knee[0], l.knee[1], 2.4, r);
    capsule(p, l.knee[0], l.knee[1], l.foot[0], l.foot[1] - 1.5, 2.0, r);
    capsule(p, l.foot[0] - 0.5, l.foot[1] - 0.8, l.foot[0] + 2, l.foot[1] - 0.6, 1.2, ramp(rgb(0x4a2e18))); // shoe
  };
  const arm = (sh: number[], hand: number[], far: boolean) => {
    const elbow = [(sh[0] + hand[0]) / 2 + (far ? -1 : 1), (sh[1] + hand[1]) / 2 + 1];
    const r = far ? ramp(darken(rgb(0xd29a6c), 0.85)) : SKIN;
    capsule(p, sh[0], sh[1], elbow[0], elbow[1], 2.0, far ? TUNIC_D : TUNIC); // sleeve
    capsule(p, elbow[0], elbow[1], hand[0], hand[1], 1.5, r);
    ellipsoid(p, hand[0], hand[1], 1.8, 1.8, r);
  };
  const freeHand = [s.farShoulder[0] - 0.5 - s.swing * 0.6, s.shY + 12];
  const basket = tool === "basket", net = tool === "net";
  const workHand = basket ? [s.cx + 5, s.hipY - 2 + (work ? f.frame % 2 : 0)] : net ? [s.cx + 7, s.shY + 6] : hold.hand;

  // Back to front. Seen from behind, the far side is the right one and the load is in front of the body.
  if (f.carry !== null && !back) drawLoad(p, f.carry, s.cx - 5, s.shY + 3);
  if (!back) arm(s.farShoulder, freeHand, true);
  leg(s.farLeg, true);
  if (back && tool && !basket && !net) drawTool(p, tool, hold.hand, hold.angle);
  if (back) arm(s.nearShoulder, workHand, true);
  leg(s.nearLeg, false);
  torso(p, s.cx, s.shY - 1, s.hipY + 2, 15, 11, back ? TUNIC_D : TUNIC);
  // Skirt of the tunic over the hips, and a sash in the player's colour.
  torso(p, s.cx, s.hipY - 1, s.hipY + 5, 12, 13.5, back ? TUNIC_D : TUNIC);
  torso(p, s.cx, s.hipY - 2.5, s.hipY - 0.5, 12, 12, PC);
  // Neck and head.
  capsule(p, s.cx, s.shY - 1, s.cx, s.headY + 3, 1.8, SKIN);
  const hx = s.cx + 0.3, hy = s.headY;
  ellipsoid(p, hx, hy, 4.6, 5.2, back ? HAIR : SKIN);
  if (!back) {
    // Hair over the crown and down the sides, a band of the player's colour, the face.
    for (let y = Math.floor(hy - 5.2); y <= hy + 1; y++) for (let x = Math.floor(hx - 4.6); x <= hx + 4.6; x++) {
      const dx = (x + 0.5 - hx) / 4.6, dy = (y + 0.5 - hy) / 5.2;
      if (dx * dx + dy * dy > 1) continue;
      if (dy < -0.38 || (Math.abs(dx) > 0.7 && dy < 0.25)) p.set(x, y, shade(HAIR, dx, dy, Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy)), x, y));
    }
    p.line(hx - 4, hy - 2, hx + 4, hy - 2, PC[3]);
    p.set(hx - 2, hy + 0.5, rgb(0x2a1a10)); p.set(hx + 1.5, hy + 0.5, rgb(0x2a1a10)); // eyes
    p.set(hx - 0.2, hy + 1.8, SKIN[1]); p.set(hx - 0.2, hy + 2.5, SKIN[2]); // nose
    p.line(hx - 1, hy + 3.6, hx + 1, hy + 3.6, SKIN[1]); // mouth
  } else {
    p.line(hx - 4, hy - 2, hx + 4, hy - 2, PC[2]);
  }
  if (back && f.carry !== null) drawLoad(p, f.carry, s.cx + 0.5, s.shY + 4);
  if (back) arm(s.farShoulder, freeHand, false);
  if (!back) {
    if (basket) {
      ellipsoid(p, workHand[0] - 1, workHand[1] + 2, 4.5, 3.2, BASKET);
      if (work) p.set(workHand[0] - 1, workHand[1] - 1, rgb(0xc8243a));
    }
    if (tool && !basket && !net) drawTool(p, tool, hold.hand, hold.angle);
    arm(s.nearShoulder, workHand, false);
    if (net) {
      const st = f.frame % 3, nx = s.cx + 8 + (work ? st * 2 : 0), ny = s.shY + (work ? [-4, 0, 6][st] : 7);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0 && Math.abs(x - 2.5) + Math.abs(y - 2.5) < 4) p.set(nx + x, ny + y, NET);
    }
  }
  selout(p);
}
