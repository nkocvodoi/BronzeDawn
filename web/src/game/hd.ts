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

// ---- people: villagers, foot soldiers, archers, priests

const SKIN = ramp(rgb(0xd29a6c)), SKIN_D = ramp(darken(rgb(0xd29a6c), 0.85)), HAIR = ramp(rgb(0x3e2616));
const TUNIC = ramp(rgb(0xb8a070)), TUNIC_D = ramp(rgb(0x947c52));
const LEATHER = ramp(rgb(0x6e4626)), LEATHER_D = ramp(darken(rgb(0x6e4626), 0.82)), SHOE = ramp(rgb(0x4a2e18));
const WOOD = ramp(rgb(0x8e5c30)), IRON = ramp(rgb(0x9aa2ac)), BRONZE = ramp(rgb(0xc08a3c)), BASKET = ramp(rgb(0xa47c44));
const ROBE = ramp(rgb(0xe6dcc6)), ROBE_D = ramp(rgb(0xc2b69c)), WHITE = ramp(rgb(0xece6d6));
const NET = rgb(0xdcd0b4), STRING = rgb(0xe8dcc0);

export interface Figure { type: string; owner: number; facing: "front" | "back"; pose: "idle" | "walk" | "work"; frame: number; tool: string; carry: number | null }

/** What a person wears and carries (the same names as the old drawing's kits, in art.ts). */
export interface Gear {
  helm: string; armor: string; shield: string; weapon: string;
  cape?: boolean; greaves?: boolean; robe?: boolean; quiver?: boolean; beard?: boolean; plume?: RGB;
}

/** Where the parts of a person are, for a pose: feet, knees, hips, shoulders; the head. */
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
type Skel = ReturnType<typeof skeleton>;

/** The working hand, and which way what it holds points (radians, 0 to the right, down positive). */
function hold(f: Figure, s: Skel, kind: string): { hand: number[]; angle: number } {
  const st = f.frame % 3, work = f.pose === "work";
  switch (kind) {
    case "hoe":
      if (!work) break;
      return [{ hand: [s.cx + 6, s.shY - 3], angle: -1.2 }, { hand: [s.cx + 8, s.shY + 4], angle: 0.35 }, { hand: [s.cx + 7, s.hipY], angle: 1.05 }][st];
    case "javelin": // overhead, then thrown forward
      if (!work) return { hand: [s.cx + 7, s.hipY - 4 + s.swing * 0.4], angle: -1.35 };
      return [{ hand: [s.cx + 2, s.shY - 5], angle: -0.25 }, { hand: [s.cx + 6, s.shY - 3], angle: -0.05 }, { hand: [s.cx + 9, s.shY], angle: 0.2 }][st];
    case "spear": case "lance": // carried upright; a thrust low and forward
      if (!work) return { hand: [s.cx + 7, s.shY + 6 + s.swing * 0.3], angle: -1.48 };
      return [{ hand: [s.cx + 4, s.shY + 4], angle: -0.1 }, { hand: [s.cx + 8, s.shY + 3], angle: -0.05 }, { hand: [s.cx + 12, s.shY + 2], angle: 0 }][st];
    case "staff":
      return { hand: [s.cx + 7, s.shY + 6], angle: work ? -1.75 : -1.6 };
    case "sling":
      if (!work) return { hand: [s.cx + 7, s.hipY - 3 + s.swing * 0.4], angle: 1.3 };
      return [{ hand: [s.cx + 4, s.shY - 7], angle: -2.6 }, { hand: [s.cx + 6, s.shY - 6], angle: -1.0 }, { hand: [s.cx + 9, s.shY - 1], angle: 0.1 }][st];
  }
  if (!work) return { hand: [s.cx + 7, s.hipY - 3 + s.swing * 0.4], angle: 1.25 }; // at the side, pointing down
  // A chop or a cut: raised over the head, coming down, struck.
  return [{ hand: [s.cx + 3, s.shY - 7], angle: -2.2 }, { hand: [s.cx + 8, s.shY - 2], angle: -0.6 }, { hand: [s.cx + 8, s.hipY - 4], angle: 0.75 }][st];
}

/** A tool or a weapon held at `hand`, pointing at angle a. */
function drawHeld(p: PixelCanvas, kind: string, hand: number[], a: number, f: Figure) {
  const along = (d: number, side = 0): [number, number] => [hand[0] + Math.cos(a) * d - Math.sin(a) * side, hand[1] + Math.sin(a) * d + Math.cos(a) * side];
  const shaft = (from: number, to: number, rad = 0.9, r = WOOD) => { const [x0, y0] = along(from), [x1, y1] = along(to); capsule(p, x0, y0, x1, y1, rad, r); };
  const blade = (from: number, to: number, w: number, r: Ramp) => flat(p, [along(from, -w), along(to - 1, -w * 0.7), along(to + 0.5, 0), along(to - 1, w * 0.7), along(from, w)], r);
  switch (kind) {
    case "axe": {
      shaft(-3, 12);
      flat(p, [along(9, 0.5), along(9, 4.5), along(12.5, 5.5), along(13, 0.5)], IRON);
      p.line(...along(9.5, 5), ...along(12.8, 5.6), IRON[5]);
      break;
    }
    case "pick": {
      shaft(-3, 11);
      for (let k = -5; k <= 5; k++) { const [x, y] = along(11 - Math.abs(k) * 0.35, k); capsule(p, x, y, x, y, k === 0 ? 1.4 : 0.9, IRON); }
      break;
    }
    case "hoe": shaft(-4, 14); flat(p, [along(13, 0), along(13, 3.5), along(15.5, 3), along(15, 0)], IRON); break;
    case "hammer": shaft(-2, 8); capsule(p, ...along(8.5, -2), ...along(8.5, 2.5), 1.8, IRON); break;
    case "club": shaft(-2, 9, 1.1); capsule(p, ...along(8), ...along(11), 2.2, WOOD); break;
    case "short": case "gladius": shaft(-2, 1, 1.0, LEATHER); capsule(p, ...along(0.5, -2.2), ...along(0.5, 2.2), 0.8, BRONZE); blade(1, 9, 1.3, kind === "short" ? BRONZE : IRON); break;
    case "broad": shaft(-2, 1, 1.0, LEATHER); capsule(p, ...along(0.5, -2.5), ...along(0.5, 2.5), 0.8, BRONZE); blade(1, 11, 1.6, IRON); break;
    case "long": shaft(-3, 1, 1.0, LEATHER); capsule(p, ...along(0.5, -2.8), ...along(0.5, 2.8), 0.8, IRON); blade(1, 14, 1.4, IRON); break;
    case "scimitar": {
      shaft(-2, 1, 1.0, LEATHER);
      for (let t = 1; t <= 11; t++) { const [x, y] = along(t, ((t - 1) * (t - 1)) / 22); capsule(p, x, y, x, y, 1.1, IRON); }
      break;
    }
    case "spear": case "lance": case "javelin": {
      const long = kind === "lance" ? 20 : kind === "spear" ? 17 : 13;
      shaft(-8, long, 0.75);
      flat(p, [along(long, -1.5), along(long + 4.5, 0), along(long, 1.5)], kind === "javelin" ? IRON : BRONZE);
      break;
    }
    case "staff": {
      shaft(-6, 18, 0.9);
      ellipsoid(p, ...along(19), 1.8, 1.8, ramp(rgb(0xe8c040)));
      if (f.pose === "work") { // a glow about the head of the staff as the priest chants
        const [gx, gy] = along(19), r = 3 + (f.frame % 3) * 1.6;
        for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
          const d = Math.hypot(x, y * 1.15);
          if (Math.abs(d - r) < 0.7 && bayer(x, y) < 0.7 && !p.alphaAt(gx + x, gy + y)) p.set(gx + x, gy + y, rgb(0xfff2a0), 210);
        }
      }
      break;
    }
    case "sling": {
      const [x, y] = along(5);
      p.line(hand[0], hand[1], x, y, STRING);
      ellipsoid(p, x, y, 1.4, 1.4, LEATHER);
      break;
    }
    default: break;
  }
}

/** A bow held out in the far hand: drawn back, aimed, loosed. */
function drawBow(p: PixelCanvas, s: Skel, f: Figure, kind: string): number[] {
  const work = f.pose === "work", st = f.frame % 3;
  const hand = work ? [s.cx - 8, s.shY + 3] : [s.farShoulder[0] - 1 - s.swing * 0.6, s.shY + 11];
  const half = kind === "longbow" ? 10 : kind === "composite" ? 7.5 : 8.5;
  const pull = work ? [3, 5.5, 0.5][st] : 0;
  // The stave curves away from the archer; the string runs from tip to tip through the drawing hand.
  const tipA = [hand[0] + (work ? -2 : 1), hand[1] - half], tipB = [hand[0] + (work ? -2 : 1), hand[1] + half];
  for (let t = 0; t <= 20; t++) {
    const u = t / 20, yy = tipA[1] + (tipB[1] - tipA[1]) * u;
    const bend = Math.sin(u * Math.PI) * (kind === "composite" ? 3 : 2.5) - (kind === "composite" ? Math.sin(u * Math.PI * 2) * 0.8 : 0);
    capsule(p, tipA[0] - bend, yy, tipA[0] - bend, yy, 0.9, WOOD);
  }
  const nock = [hand[0] + pull + 1, hand[1]];
  if (work) {
    p.line(tipA[0], tipA[1], nock[0], nock[1], STRING); p.line(nock[0], nock[1], tipB[0], tipB[1], STRING);
    if (st < 2) capsule(p, hand[0] - 6, hand[1], nock[0], nock[1], 0.5, WOOD); // the arrow
  } else p.line(tipA[0] + 1, tipA[1], tipB[0] + 1, tipB[1], STRING);
  return hand;
}

/** A shield on the far arm, its face to the viewer; on the back, seen from behind. */
function drawShield(p: PixelCanvas, kind: string, at: number[], pc: Ramp) {
  const [x, y] = at;
  const rim = BRONZE;
  switch (kind) {
    case "small": ellipsoid(p, x, y, 3.6, 3.8, rim); ellipsoid(p, x, y, 2.8, 3, pc); ellipsoid(p, x, y, 0.9, 0.9, rim); break;
    case "round": ellipsoid(p, x, y, 5, 5.2, rim); ellipsoid(p, x, y, 4.1, 4.3, pc); ellipsoid(p, x, y, 1.2, 1.2, rim); break;
    case "aspis": ellipsoid(p, x, y, 6.6, 6.8, rim); ellipsoid(p, x, y, 5.4, 5.6, pc); ellipsoid(p, x - 1, y - 1, 1.6, 1.6, rim); break;
    case "oval": ellipsoid(p, x, y, 4.4, 7, rim); ellipsoid(p, x, y, 3.5, 6.1, pc); capsule(p, x, y - 4, x, y + 4, 0.6, rim); break;
    case "scutum":
      for (let j = -7; j <= 7; j++) for (let i = -4; i <= 4; i++) {
        const nx = i / 4.6, ny = j / 9;
        const r = Math.abs(i) >= 4 || Math.abs(j) >= 7 ? rim : pc;
        p.set(x + i, y + j, shadeAt(r, nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx)), x + i, y + j));
      }
      ellipsoid(p, x, y, 1.4, 1.4, rim);
      break;
    default: break;
  }
}

/** shade, for the shields' own shapes. */
const shadeAt = (r: Ramp, nx: number, ny: number, nz: number, x: number, y: number) => shade(r, nx, ny, nz, x, y);

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

/** The head, its hair or helmet, the face. */
function drawHead(p: PixelCanvas, s: Skel, g: Gear, back: boolean, pc: Ramp) {
  const hx = s.cx + 0.3, hy = s.headY, rx = 4.6, ry = 5.2;
  const plume = g.plume ? ramp(g.plume) : pc;
  const over = (r: Ramp, keep: (dx: number, dy: number) => boolean, grow = 0) => {
    for (let y = Math.floor(hy - ry - grow); y <= hy + ry + grow; y++) for (let x = Math.floor(hx - rx - grow); x <= hx + rx + grow; x++) {
      const dx = (x + 0.5 - hx) / (rx + grow), dy = (y + 0.5 - hy) / (ry + grow);
      if (dx * dx + dy * dy > 1 || !keep(dx, dy)) continue;
      p.set(x, y, shade(r, dx, dy, Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy)), x, y));
    }
  };
  const hood = g.helm === "hood";
  ellipsoid(p, hx, hy, rx, ry, back ? (hood ? ROBE : HAIR) : SKIN);
  if (!back) {
    if (!hood) over(HAIR, (dx, dy) => dy < -0.38 || (Math.abs(dx) > 0.7 && dy < 0.25)); // hair, under any helmet
    if (g.beard) over(HAIR, (dx, dy) => dy > 0.35 && Math.abs(dx) < 0.85);
    p.set(hx - 2, hy + 0.5, rgb(0x2a1a10)); p.set(hx + 1.5, hy + 0.5, rgb(0x2a1a10)); // eyes
    p.set(hx - 0.2, hy + 1.8, SKIN[1]); // nose
    if (!g.beard) p.line(hx - 1, hy + 3.6, hx + 1, hy + 3.6, SKIN[1]); // mouth
  }
  const dome = (r: Ramp, low = -0.2) => over(r, (_dx, dy) => dy < low, 0.7);
  switch (g.helm) {
    case "band": p.line(hx - 4, hy - 2, hx + 4, hy - 2, back ? pc[2] : pc[3]); break;
    case "cap": dome(LEATHER, -0.35); break;
    case "leather": dome(LEATHER); over(LEATHER, (dx, dy) => Math.abs(dx) > 0.72 && dy < 0.55, 0.5); break;
    case "bronze": dome(BRONZE); break;
    case "cheek": dome(BRONZE); over(BRONZE, (dx, dy) => Math.abs(dx) > 0.6 && dy < 0.6, 0.6); break;
    case "crest": dome(BRONZE); ellipsoid(p, hx, hy - ry - 1.5, 2.2, 2.4, plume); capsule(p, hx - 3, hy - ry - 0.5, hx + 3, hy - ry - 1.5, 1.6, plume); break;
    case "corinth":
      over(BRONZE, (dx, dy) => back || dy < -0.25 || Math.abs(dx) > 0.35 || dy > 0.55, 0.7);
      if (!back) { p.line(hx - 2.5, hy - 0.5, hx + 2.5, hy - 0.5, rgb(0x20140c)); p.line(hx, hy - 0.5, hx, hy + 2.5, rgb(0x20140c)); }
      capsule(p, hx - 4, hy - ry - 1, hx + 4, hy - ry - 2, 1.8, plume);
      break;
    case "plume": dome(IRON); ellipsoid(p, hx, hy - ry - 2.5, 1.8, 3, plume); break;
    case "transverse": dome(IRON); capsule(p, hx - 6.5, hy - ry - 1.2, hx + 6.5, hy - ry - 1.2, 1.7, plume); break;
    case "roman": dome(IRON); over(IRON, (dx, dy) => (back ? dy < 0.6 : Math.abs(dx) > 0.65 && dy < 0.6), 0.6); ellipsoid(p, hx, hy - ry - 1.5, 1.4, 2.2, plume); break;
    case "pointed":
      for (let y = 0; y < 7; y++) for (let x = -5; x <= 5; x++) {
        const w = 1 + y * 0.75;
        if (Math.abs(x) > w) continue;
        const px = hx + x, py = hy - ry - 4 + y;
        p.set(px, py, shade(IRON, x / (w + 1), -0.3, 0.8, px, py));
      }
      over(IRON, (dx, dy) => Math.abs(dx) > 0.7 && dy < 0.7, 0.5);
      break;
    case "turban": over(WHITE, (_dx, dy) => dy < -0.15, 1.3); p.line(hx - 5, hy - 1.5, hx + 5, hy - 1.5, pc[3]); break;
    case "hood": over(ROBE, (dx, dy) => back || dy < -0.42 || Math.abs(dx) > 0.66, 0.9); break; // the face shows
    default: break;
  }
}

/** A person at the screen's own resolution, in a 52 x 56 picture with the feet at (22, 50): a villager
 *  (with the tool of its work and what it carries), a soldier, an archer or a priest. */
export function drawPersonHD(p: PixelCanvas, f: Figure, g: Gear, pcBase: RGB) {
  const s = skeleton(f), back = f.facing === "back", villager = f.type === "villager";
  const pc = ramp(pcBase), pcD = ramp(darken(pcBase, 0.78));
  const kind = villager ? (f.tool === "spear" ? "javelin" : f.tool === "none" ? "" : f.tool) : g.weapon === "none" ? "" : g.weapon;
  const bow = kind === "bow" || kind === "longbow" || kind === "composite";
  const basket = kind === "basket", net = kind === "net";
  const h = hold(f, s, kind);
  const workHand = basket ? [s.cx + 5, s.hipY - 2 + (f.pose === "work" ? f.frame % 2 : 0)] : net ? [s.cx + 7, s.shY + 6] : bow ? [s.cx + 4, s.shY + 4] : h.hand;
  const armored = g.armor !== "none" && g.armor !== "leather";
  const cloth = g.robe ? ROBE : villager ? TUNIC : pc, clothD = g.robe ? ROBE_D : villager ? TUNIC_D : pcD;
  groundShadow(p, s.cx, s.fy + 0.5, 9, 3);

  const leg = (l: { hip: number[]; knee: number[]; foot: number[] }, far: boolean) => {
    const r = villager ? (far ? LEATHER_D : LEATHER) : far ? SKIN_D : SKIN;
    capsule(p, l.hip[0], l.hip[1], l.knee[0], l.knee[1], 2.4, r);
    capsule(p, l.knee[0], l.knee[1], l.foot[0], l.foot[1] - 1.5, 2.0, g.greaves ? BRONZE : r);
    capsule(p, l.foot[0] - 0.5, l.foot[1] - 0.8, l.foot[0] + 2, l.foot[1] - 0.6, 1.2, SHOE);
  };
  const arm = (sh: number[], hand: number[], far: boolean) => {
    const elbow = [(sh[0] + hand[0]) / 2 + (far ? -1 : 1), (sh[1] + hand[1]) / 2 + 1];
    const skin = g.robe ? (far ? ROBE_D : ROBE) : far ? SKIN_D : SKIN;
    capsule(p, sh[0], sh[1], elbow[0], elbow[1], 2.0, far ? clothD : cloth); // sleeve
    capsule(p, elbow[0], elbow[1], hand[0], hand[1], 1.5, skin);
    ellipsoid(p, hand[0], hand[1], 1.8, 1.8, far ? SKIN_D : SKIN);
  };
  const freeHand = [s.farShoulder[0] - 0.5 - s.swing * 0.6, s.shY + 12];
  const shieldAt = [s.cx - 6, s.shY + 8];

  // Back to front. Seen from behind, the far side is the right one; the load, quiver and cape are in front.
  if (!back) {
    if (g.cape) torso(p, s.cx - 0.5, s.shY, s.fy - 9, 15, 17, pcD);
    if (g.quiver) capsule(p, s.cx - 5, s.shY - 3, s.cx - 3, s.shY + 7, 1.6, LEATHER);
    if (f.carry !== null) drawLoad(p, f.carry, s.cx - 5, s.shY + 3);
    if (!bow) arm(s.farShoulder, freeHand, true);
  }
  if (g.robe) {
    // A robe to the feet, swaying as the priest walks.
    const sway = f.pose === "walk" ? [0, 1, 0, -1][f.frame % 4] : 0;
    torso(p, s.cx, s.hipY - 2, s.fy, 12, 16, back ? ROBE_D : ROBE, sway);
  } else {
    leg(s.farLeg, true);
  }
  if (back && kind && !bow && !basket && !net) drawHeld(p, kind, h.hand, h.angle, f);
  if (back) arm(s.nearShoulder, workHand, true);
  if (!g.robe) leg(s.nearLeg, false);
  torso(p, s.cx, s.shY - 1, s.hipY + 2, 15, 11, back ? clothD : cloth);
  torso(p, s.cx, s.hipY - 1, s.hipY + 5, 12, 13.5, back ? clothD : cloth); // the skirt of the tunic
  // Armour over the chest.
  const chest = (r: Ramp, pattern?: (x: number, y: number) => boolean) => {
    torso(p, s.cx, s.shY - 0.5, s.hipY - 2, 14.5, 11.5, r);
    if (pattern) for (let y = Math.floor(s.shY); y < s.hipY - 2; y++) for (let x = s.cx - 7; x <= s.cx + 7; x++) {
      const c = p.get(x, y);
      if (c && pattern(x, y) && Math.abs(x + 0.5 - s.cx) < 6.5) p.set(x, y, darken(c, 0.78));
    }
  };
  switch (g.armor) {
    case "leather": chest(LEATHER, (x, y) => (y - s.shY) % 4 === 3 && x % 2 === 0); break;
    case "scale": chest(BRONZE, (x, y) => ((x >> 1) + (y >> 1)) % 2 === 0 && (y & 1) === 1); break;
    case "bronze": chest(BRONZE, (x, y) => !back && (x === s.cx || x === s.cx + 1) && y > s.shY + 4); break;
    case "iron": chest(IRON); break;
    case "lorica": chest(IRON, (_x, y) => (y - s.shY) % 3 === 2); break;
  }
  if (armored) for (let x = s.cx - 4; x <= s.cx + 4; x += 3) capsule(p, x, s.hipY - 1, x, s.hipY + 3, 0.9, LEATHER); // pteruges
  // A belt, or a villager's sash in the player's colour; a priest's stole.
  if (villager) torso(p, s.cx, s.hipY - 2.5, s.hipY - 0.5, 12, 12, pc);
  else if (!g.robe) torso(p, s.cx, s.hipY - 2.5, s.hipY - 1, 12, 12, LEATHER_D);
  if (g.robe && !back) capsule(p, s.cx + 0.5, s.shY, s.cx + 0.5, s.hipY + 6, 1.4, pc);
  if (!villager && !g.robe && g.armor !== "none") { ellipsoid(p, s.farShoulder[0], s.shY + 1, 2.6, 2.4, pcD); ellipsoid(p, s.nearShoulder[0], s.shY + 1, 2.6, 2.4, pc); }
  // Neck and head.
  capsule(p, s.cx, s.shY - 1, s.cx, s.headY + 3, 1.8, SKIN);
  drawHead(p, s, g, back, pc);
  if (back) {
    if (g.cape) torso(p, s.cx, s.shY, s.fy - 9, 15, 17, pc);
    if (g.quiver) { capsule(p, s.cx + 1, s.shY - 4, s.cx + 3, s.shY + 8, 1.7, LEATHER); p.set(s.cx + 1, s.shY - 5, rgb(0xf0ece0)); p.set(s.cx + 2, s.shY - 5, rgb(0xb8282a)); }
    if (f.carry !== null) drawLoad(p, f.carry, s.cx + 0.5, s.shY + 4);
    if (g.shield !== "none") drawShield(p, g.shield, [s.cx, s.shY + 7], pc);
    arm(s.farShoulder, freeHand, false);
  } else {
    if (bow) { const bh = drawBow(p, s, f, kind); arm(s.farShoulder, bh, true); }
    if (g.shield !== "none") drawShield(p, g.shield, shieldAt, pc);
    if (basket) {
      ellipsoid(p, workHand[0] - 1, workHand[1] + 2, 4.5, 3.2, BASKET);
      if (f.pose === "work") p.set(workHand[0] - 1, workHand[1] - 1, rgb(0xc8243a));
    }
    if (kind && !bow && !basket && !net) drawHeld(p, kind, h.hand, h.angle, f);
    arm(s.nearShoulder, workHand, false);
    if (net) {
      const st = f.frame % 3, nx = s.cx + 8 + (f.pose === "work" ? st * 2 : 0), ny = s.shY + (f.pose === "work" ? [-4, 0, 6][st] : 7);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0 && Math.abs(x - 2.5) + Math.abs(y - 2.5) < 4) p.set(nx + x, ny + y, NET);
    }
  }
  selout(p);
}

// ---- trees

const LEAF = ramp(rgb(0x4e8a32)), LEAF_PINE = ramp(rgb(0x3a7038)), BARK = ramp(rgb(0x7a5230)), PALM_LEAF = ramp(rgb(0x5a9a3a));

/** Foliage: a ball of leaves, lit as a ball, broken up into clumps (a clump is lit as one, with darker
 *  gaps between), so it reads as leaves and not as a smooth ball. */
function foliage(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, r: Ramp, salt: number) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
    // A ragged rim: leaves stick out of the ball here and there.
    const edge = 1 + (leafNoise(x, y, salt) - 0.5) * 0.28;
    if (d2 > edge) continue;
    const clump = leafNoise(x >> 1, y >> 1, salt + 3);
    const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
    let c = shade(r, dx, dy, nz, x, y);
    if (clump < 0.18) c = r[Math.max(0, r.indexOf(c) - 1)] ?? c; // a gap between clumps
    else if (clump > 0.86 && dx + dy < 0) c = r[Math.min(r.length - 1, r.indexOf(c) + 1)] ?? c; // a lit clump
    p.set(x, y, c);
  }
}
const leafNoise = (x: number, y: number, s: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** A tree at the screen's own resolution: variants 0, 2, 3 broadleaf, 1 a pine, 4 a palm, 5 the big lone
 *  tree. (cx, base) is the foot of the trunk; k the size (1, or 1.7 for the lone tree). Coordinates are those
 *  of the old drawing, doubled. */
export function drawTreeHD(p: PixelCanvas, v: number, cx: number, base: number, k: number) {
  groundShadow(p, cx + 2, base - 2, 16 * k, 4.8 * k);
  if (v === 4) {
    // A palm: a leaning ringed trunk, drooping fronds.
    let px = cx, py = base - 6;
    for (let i = 0; i < 24; i++) {
      const nx = cx + Math.sin(i / 9) * 6, ny = base - 6 - i * 2;
      capsule(p, px, py, nx, ny, 1.9, i % 3 === 0 ? ramp(darken(rgb(0x7a5230), 0.8)) : BARK);
      px = nx; py = ny;
    }
    const tx = px + 1, ty = py - 2;
    for (const [dx, dy] of [[-20, 8], [-14, -6], [0, -12], [14, -6], [20, 8], [-8, 14], [10, 14]]) {
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, x = tx + dx * t, y = ty + dy * t + Math.abs(dx) * 0.5 * t * t, w = 2.4 * (1 - t * 0.7);
        capsule(p, x, y, x, y, w, PALM_LEAF);
      }
    }
    ellipsoid(p, tx, ty + 1, 3, 2.4, ramp(rgb(0x6a4a24)));
    selout(p, 0.4);
    return;
  }
  const trunkTop = v === 1 ? base - 20 : base - 32 * k;
  capsule(p, cx, base - 4, cx, trunkTop, (v === 1 ? 2.6 : 2.8) * k, BARK);
  if (v === 1) {
    // A pine: three tiers of boughs, each a cone lit from the left, its underside in shadow.
    for (const [top, half, bot] of [[4, 8, 26], [16, 12, 40], [28, 16, 56]]) {
      for (let y = top; y < bot; y++) {
        const t = (y - top) / (bot - top), w = 1 + half * t;
        for (let x = Math.floor(cx - w - 1); x <= Math.ceil(cx + w + 1); x++) {
          const nx = (x + 0.5 - cx) / (w + 1);
          const rag = (leafNoise(x, y, 11) - 0.5) * 0.3;
          if (Math.abs(nx) > 1 + rag) continue;
          let c = shade(LEAF_PINE, nx, -0.35 + t * 0.6, Math.sqrt(Math.max(0, 1 - nx * nx)), x, y);
          if (leafNoise(x >> 1, y, 5) < 0.15) c = LEAF_PINE[1];
          p.set(x, y, c);
        }
      }
    }
    selout(p, 0.4);
    return;
  }
  const blobs: [number, number, number][] = v === 0 ? [[-4, 18, 6], [4, 18, 6], [0, 11, 7], [0, 20, 6]]
    : v === 2 ? [[0, 8, 4.5], [-2, 14, 5], [2, 18, 5], [0, 23, 4.5]]
    : v === 3 ? [[-6, 17, 5.5], [6, 16, 6], [-2, 10, 6], [3, 9, 5], [0, 19, 6]]
    : [[-11, 22, 9], [11, 21, 9], [-5, 12, 10], [6, 10, 9], [0, 22, 10], [0, 5, 7]];
  if (v === 5) { capsule(p, cx - 2, base - 36, cx - 16, base - 56, 2, BARK); capsule(p, cx + 4, base - 40, cx + 16, base - 60, 2, BARK); }
  // Back blobs first: the lower ones in front, as the crown is seen from above.
  const order = [...blobs].sort((a, b) => a[1] - b[1]);
  order.forEach(([dx, dy, r], i) => foliage(p, cx + dx * 2, (v === 5 ? 4 : 0) + dy * 2, r * 2, r * 2 * 0.88, LEAF, v * 10 + i));
  selout(p, 0.4);
}

// ---- mines and bushes

/** A rock: a lumpy, faceted boulder lit from the upper left (a ball, flattened, its facets in steps). */
function rock(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, r: Ramp, salt: number) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry * 0.6); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    const lump = 1 + (leafNoise(x >> 2, y >> 2, salt) - 0.5) * 0.35;
    if (dx * dx + dy * dy > lump || dy > 0.6) continue;
    // Facets: the normal snapped to a few directions, so the stone looks chipped, not smooth.
    const fx = Math.round(dx * 2.5) / 2.5, fy = Math.round(dy * 2.5) / 2.5;
    p.set(x, y, shade(r, fx, fy, Math.sqrt(Math.max(0.05, 1 - fx * fx - fy * fy)), x, y));
  }
}

/** A gold or stone mine at the screen's own resolution: a heap of boulders, gold glinting in it. */
export function drawMineHD(p: PixelCanvas, gold: boolean) {
  groundShadow(p, 28, 30, 24, 5);
  const r = ramp(gold ? rgb(0x8c7656) : rgb(0xa8a49c));
  const rocks: [number, number, number][] = [[14, 24, 10], [32, 22, 12], [22, 16, 11], [42, 26, 8.5], [24, 28, 8]];
  rocks.forEach(([x, y, s], i) => rock(p, x, y, s, s * 0.85, r, i + (gold ? 20 : 0)));
  if (gold) for (const [x, y] of [[16, 18], [28, 12], [34, 18], [22, 10], [42, 22], [26, 24], [36, 25]]) {
    ellipsoid(p, x, y, 1.8, 1.4, ramp(rgb(0xe8c040)));
    p.set(x - 1, y - 1, rgb(0xfff6c0));
  }
  else for (const [x, y] of [[12, 20], [28, 14], [38, 22], [20, 24]]) p.set(x, y, r[5]);
  selout(p, 0.38);
}

/** A berry bush: a low mound of leaves dotted with red berries. */
export function drawBushHD(p: PixelCanvas) {
  groundShadow(p, 20, 25, 16, 4);
  for (const [x, y, s] of [[12, 16, 9], [26, 16, 9], [20, 12, 10]] as [number, number, number][]) foliage(p, x, y, s, s * 0.85, LEAF, x + y);
  for (const [x, y] of [[10, 12], [16, 8], [22, 14], [28, 10], [14, 18], [20, 20], [8, 18], [30, 18], [24, 8], [18, 14]]) {
    ellipsoid(p, x, y, 1.6, 1.5, ramp(rgb(0xc8243a)));
    p.set(x - 1, y - 1, rgb(0xff9aa8));
  }
  selout(p, 0.38);
}
