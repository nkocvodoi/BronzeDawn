// The sprite gallery: every picture art.ts can draw, on grass, at 2x. Pick a section with ?section=.
import type { BuildingDef } from "./core/rules";
import { ARCHES, Arch, buildingPic, Facing, iconPic, nodePic, Pic, Pose, projectilePic, Tool, unitPic, UnitLook, wallPic } from "./game/art";

const params = new URLSearchParams(location.search);
const section = params.get("section") ?? "infantry";
const SCALE = Number(params.get("scale")) || 2;
const main = document.getElementById("main")!;

const INFANTRY = ["villager", "clubman", "axeman", "slinger", "short_swordsman", "broad_swordsman", "long_swordsman", "legion", "hoplite", "phalanx", "centurion", "bowman", "improved_bowman", "composite_bowman", "priest"];
const MOUNTED = ["scout", "cavalry", "heavy_cavalry", "cataphract", "horse_archer", "heavy_horse_archer", "camel_rider", "chariot", "scythe_chariot", "chariot_archer", "war_elephant", "armored_elephant", "elephant_archer"];
const SIEGE = ["stone_thrower", "catapult", "heavy_catapult", "ballista", "helepolis"];
const ANIMALS = ["gazelle", "elephant", "lion", "alligator"];
const BUILDINGS: [string, number][] = [
  ["town_center", 3], ["house", 2], ["granary", 3], ["storage_pit", 3], ["barracks", 3], ["archery_range", 3], ["stable", 3], ["market", 3], ["farm", 3],
  ["government_center", 3], ["temple", 3], ["academy", 3], ["siege_workshop", 3], ["wonder", 5], ["watch_tower", 2], ["sentry_tower", 2], ["guard_tower", 2], ["ballista_tower", 2],
];
const def = (id: string, size: number) => ({ id, size }) as BuildingDef;

const SECTIONS = ["infantry", "villager", "mounted", "siege", "animals", "nodes", "walls", "scene", "icons", ...ARCHES.map((a) => `b-${a}`), ...ARCHES.map((a) => `stages-${a}`)];
const nav = document.getElementById("nav")!;
for (const s of SECTIONS) {
  const a = document.createElement("a");
  a.href = `?section=${s}`; a.textContent = s;
  if (s === section) a.className = "on";
  nav.append(a);
}

function heading(text: string) { const h = document.createElement("h2"); h.textContent = text; main.append(h); }
function row(): HTMLElement { const d = document.createElement("div"); d.className = "grid"; main.append(d); return d; }

/** One sprite, scaled up, with a caption. */
function cell(into: HTMLElement, src: HTMLCanvasElement, label: string, flip = false) {
  const f = document.createElement("figure");
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d")!;
  if (flip) { g.translate(src.width, 0); g.scale(-1, 1); }
  g.drawImage(src, 0, 0);
  c.style.width = `${src.width * SCALE}px`; c.style.height = `${src.height * SCALE}px`;
  const cap = document.createElement("figcaption"); cap.textContent = label;
  f.append(c, cap); into.append(f);
}

const look = (type: string, owner: number, facing: Facing, pose: Pose, frame: number, tool: Tool = "none", carry: number | null = null): UnitLook =>
  ({ type, owner, facing, pose, frame, tool, carry });

/** Every frame of a unit: idle, 4 walk, 3 work; both facings for owner 0, the front for the others. */
function unitRows(types: string[], owners = [0, 1]) {
  const only = params.get("only")?.split(",");
  for (const t of types.filter((x) => !only || only.includes(x))) {
    heading(t);
    const r = row();
    owners.forEach((owner, i) => {
      for (const facing of (i === 0 ? ["front", "back"] : ["front"]) as Facing[]) {
        cell(r, unitPic(look(t, owner, facing, "idle", 0)).canvas, `p${owner} ${facing}`);
        for (let f = 0; f < 4; f++) cell(r, unitPic(look(t, owner, facing, "walk", f)).canvas, `walk${f}`);
        for (let f = 0; f < 3; f++) cell(r, unitPic(look(t, owner, facing, "work", f)).canvas, `work${f}`);
      }
    });
    cell(r, unitPic(look(t, owners[0], "front", "walk", 1)).canvas, "mirror", true);
  }
}

/** Composes pictures into one canvas, like the renderer does: anchor at (x, y) in art px. */
function scene(w: number, h: number, items: [Pic, number, number, boolean?][]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5a8a38"; g.fillRect(0, 0, w, h);
  // Tile grid, faintly.
  g.strokeStyle = "rgba(0,0,0,0.08)";
  for (let i = -40; i < 40; i++) {
    g.beginPath(); g.moveTo(w / 2 + i * 16 - 400 * 2, -400 + 0); g.lineTo(w / 2 + i * 16 + 400 * 2, 400 + 0); g.stroke();
    g.beginPath(); g.moveTo(w / 2 + i * 16 + 400 * 2, -400); g.lineTo(w / 2 + i * 16 - 400 * 2, 400); g.stroke();
  }
  for (const [p, x, y, flip] of items) {
    const cw = p.canvas.width, ch = p.canvas.height;
    g.save();
    g.translate(Math.round(x), Math.round(y));
    if (flip) g.scale(-1, 1);
    g.drawImage(p.canvas, -Math.round(p.ax * cw), -Math.round(p.ay * ch));
    g.restore();
  }
  return c;
}
/** Screen art px of a tile corner (map x, y), with an origin. */
const iso = (x: number, y: number, ox: number, oy: number): [number, number] => [ox + (x - y) * 16, oy + (x + y) * 8];

switch (section) {
  case "infantry": unitRows(INFANTRY); break;
  case "mounted": unitRows(MOUNTED); break;
  case "siege": unitRows(SIEGE); break;
  case "animals": unitRows(ANIMALS, [-1]); break;
  case "villager": {
    const tools: Tool[] = ["none", "axe", "pick", "basket", "hoe", "hammer", "spear", "net"];
    for (const tool of tools) {
      heading(`villager: ${tool}`);
      const r = row();
      for (const facing of ["front", "back"] as Facing[]) {
        cell(r, unitPic(look("villager", 0, facing, "idle", 0, tool)).canvas, `${facing} idle`);
        for (let f = 0; f < 3; f++) cell(r, unitPic(look("villager", 0, facing, "work", f, tool)).canvas, `work ${f}`);
      }
    }
    heading("villager carrying food, wood, gold, stone");
    const r = row();
    for (let carry = 0; carry < 4; carry++) for (const facing of ["front", "back"] as Facing[]) for (let f = 0; f < 4; f++) {
      cell(r, unitPic(look("villager", 1, facing, "walk", f, "none", carry)).canvas, `${carry} ${facing} ${f}`);
    }
    break;
  }
  case "nodes": {
    heading("trees (variants 0..3), palm, lone tree");
    let r = row();
    for (let v = 0; v < 4; v++) cell(r, nodePic("tree", v).canvas, `tree ${v}`);
    cell(r, nodePic("palm", 0).canvas, "palm");
    cell(r, nodePic("lone_tree", 0).canvas, "lone_tree");
    heading("berry bush, gold, stone, fish");
    r = row();
    for (const t of ["berry_bush", "gold_mine", "stone_mine"]) cell(r, nodePic(t, 0).canvas, t);
    for (let v = 0; v < 2; v++) {
      const f = nodePic("fish", v).canvas;
      const c = document.createElement("canvas"); c.width = f.width; c.height = f.height;
      const g = c.getContext("2d")!; g.fillStyle = "#2e64a4"; g.fillRect(0, 0, c.width, c.height); g.drawImage(f, 0, 0);
      cell(r, c, `fish ${v} (on water)`);
    }
    heading("carcasses");
    r = row();
    for (const a of ["gazelle", "elephant", "lion", "alligator"]) cell(r, nodePic(`carcass_${a}`, 0).canvas, `carcass_${a}`);
    heading("projectiles (pointing right)");
    r = row();
    for (const k of ["arrow", "stone", "bolt", "spear"] as const) cell(r, projectilePic(k).canvas, k);
    break;
  }
  case "walls": {
    for (const tier of [0, 1, 2] as const) {
      heading(`wall tier ${tier}: masks 0..15 (bits 1 x-1, 2 x+1, 4 y-1, 8 y+1)`);
      let r = row();
      for (let m = 0; m < 16; m++) cell(r, wallPic(tier, 0, m, 3).canvas, `mask ${m}`);
      r = row();
      for (let st = 0; st < 4; st++) for (const m of [3, 12, 15]) cell(r, wallPic(tier, 1, m, st).canvas, `stage ${st} mask ${m}`);
    }
    heading("walls laid out on the map: lines, corners, a T and a cross");
    const cells = new Set<string>();
    const add = (x: number, y: number) => cells.add(`${x},${y}`);
    for (let x = 0; x < 8; x++) add(x, 0);
    for (let y = 0; y < 8; y++) add(0, y);
    for (let y = 0; y < 6; y++) add(7, y);
    for (let x = 3; x < 8; x++) add(x, 5);
    for (let y = 2; y < 8; y++) add(4, y);
    add(5, 3); add(3, 3);
    const items: [Pic, number, number][] = [];
    for (const tier of [0, 1, 2] as const) {
      const ox = 150 + tier * 280, oy = 30;
      const list = [...cells].map((k) => k.split(",").map(Number)).sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
      for (const [x, y] of list) {
        const has = (dx: number, dy: number) => cells.has(`${x + dx},${y + dy}`);
        const mask = (has(-1, 0) ? 1 : 0) | (has(1, 0) ? 2 : 0) | (has(0, -1) ? 4 : 0) | (has(0, 1) ? 8 : 0);
        const [sx, sy] = iso(x + 1, y + 1, ox, oy);
        items.push([wallPic(tier, tier, mask, 3), sx, sy]);
      }
    }
    cell(row(), scene(900, 200, items), "tiers 0, 1, 2");
    break;
  }
  case "scene": {
    const arch = (params.get("arch") ?? "greek") as Arch;
    const age = Number(params.get("age") ?? 2);
    for (const a of params.has("arch") ? [arch] : ARCHES) {
      heading(`${a}, age ${age}: buildings and units together`);
      const items: [Pic, number, number, boolean?][] = [];
      const ox = 420, oy = 40;
      const put = (id: string, size: number, x: number, y: number, owner = 0) => { const [sx, sy] = iso(x + size, y + size, ox, oy); items.push([buildingPic(def(id, size), owner, age, 3, 1, a), sx, sy]); };
      put("town_center", 3, 4, 4); put("house", 2, 0, 4); put("house", 2, 1, 7); put("barracks", 3, 8, 3); put("granary", 3, 4, 0);
      put("farm", 3, 0, 9); put("guard_tower", 2, 9, 7); put("temple", 3, 4, 9, 1); put("market", 3, 8, -1);
      const units: [string, number, number, number][] = [["villager", 3.2, 8.2, 0], ["villager", 2.4, 10.4, 0], ["clubman", 8.4, 6.8, 0], ["hoplite", 9.4, 6.4, 0], ["cavalry", 7.6, 7.8, 0], ["bowman", 3.3, 3.4, 1], ["war_elephant", 12.5, 6, 1], ["catapult", 12, 9.5, 1]];
      for (const [t, x, y, owner] of units) { const [sx, sy] = iso(x, y, ox, oy); items.push([unitPic(look(t, owner, "front", "idle", 0, t === "villager" ? "axe" : "none")), sx, sy]); }
      const [tx, ty] = iso(1.5, 1.5, ox, oy); items.push([nodePic("tree", 0), tx, ty]);
      const [t2x, t2y] = iso(2.5, 0.8, ox, oy); items.push([nodePic("tree", 1), t2x, t2y]);
      items.sort((p, q) => p[2] - q[2]);
      cell(row(), scene(840, 330, items), "");
    }
    break;
  }
  case "icons": {
    const ids = [...INFANTRY, ...MOUNTED, ...SIEGE, ...BUILDINGS.map(([id]) => id), "small_wall", "medium_wall", "fortification",
      "tool_working", "metal_working", "leather_armor_infantry", "bronze_shield", "alchemy", "wheel", "coinage", "plow", "watch_tower_upgrade", "masonry", "astrology", "woodworking", "bronze_age", "writing"];
    const r = row();
    for (const id of ids) cell(r, iconPic(id), id);
    break;
  }
  default: {
    const [kind, a] = section.split("-") as [string, Arch];
    if (kind === "b") {
      for (const [id, size] of BUILDINGS.filter(([b]) => !params.get("only") || params.get("only")!.split(",").includes(b))) {
        heading(`${a} ${id}: ages 0..3 (done), owner 0 and 1`);
        const r = row();
        for (let age = 0; age < 4; age++) cell(r, buildingPic(def(id, size), age % 2, age, 3, 1, a).canvas, `age ${age}`);
        if (id === "farm") for (const left of [0.5, 0.1]) cell(r, buildingPic(def(id, size), 0, 1, 3, left, a).canvas, `farmLeft ${left}`);
      }
    } else {
      const age = Number(params.get("age") ?? 2);
      for (const [id, size] of BUILDINGS.filter(([b]) => !params.get("only") || params.get("only")!.split(",").includes(b))) {
        heading(`${a} ${id}: stages 0..3 at age ${age}`);
        const r = row();
        for (let st = 0; st < 4; st++) cell(r, buildingPic(def(id, size), 0, age, st, 1, a).canvas, `stage ${st}`);
      }
    }
  }
}
