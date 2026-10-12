// Imports art, sound and exact numbers from a local Age of Empires (1997) / Rise of Rome install.
//
//   npm run import-aoe -- --aoe "C:/Games/AOE/Empires.exe"            (or the install folder)
//   npm run import-aoe -- --aoe /path/to/AOE --out ./assets-local
//
// Everything it writes goes to web/assets-local/ (gitignored, served only by the dev server). Nothing from the
// game is committed or published: the files stay on the machine that owns the copy of the game.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { convert, BUILDING_MAP, UNIT_MAP, ANIMAL_MAP, JOBS } from "./convert";
import { inflateDat, parseDat, type DatFile, type DatGraphic, type DatUnit } from "./dat";
import { readDrs, type DrsFile } from "./drs";
import { readJascPalette } from "./png";
import { slpFrame, slpFrameCount, slpIndex, still, unitSheet, type Anim, type Library } from "./sprites";
import { readStringTable } from "./strings";
import { tables } from "./tables";
import type { RulesFile } from "../../src/core/rules";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");

interface Args { aoe: string; out: string; noArt: boolean; noSound: boolean }

function args(): Args {
  const a = process.argv.slice(2);
  const get = (k: string) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const aoe = get("--aoe") ?? process.env.AOE_PATH;
  if (!aoe) {
    console.error("usage: npm run import-aoe -- --aoe <path to Empires.exe or the AoE folder> [--out <dir>] [--no-art] [--no-sound]");
    process.exit(1);
  }
  return { aoe, out: resolve(get("--out") ?? join(WEB, "assets-local")), noArt: a.includes("--no-art"), noSound: a.includes("--no-sound") };
}

/** Find a file in a folder whatever its letter case (the original install mixes "Empires.dat" and "empires.dat"). */
function find(dir: string, file: string): string | null {
  if (!existsSync(dir)) return null;
  const hit = readdirSync(dir).find((f) => f.toLowerCase() === file.toLowerCase());
  return hit ? join(dir, hit) : null;
}

function locate(path: string): { root: string; data: string; data2: string | null } {
  let root = resolve(path);
  if (existsSync(root) && statSync(root).isFile()) root = dirname(root);
  const data = find(root, "data");
  if (!data || !find(data, "empires.dat")) throw new Error(`no data/empires.dat under ${root}: point --aoe at Empires.exe or the game folder`);
  const data2 = find(root, "data2");
  return { root, data, data2: data2 && find(data2, "empires.dat") ? data2 : null };
}

const drsOf = (dir: string | null, file: string): DrsFile[] => {
  const p = dir ? find(dir, file) : null;
  return p ? readDrs(new Uint8Array(readFileSync(p))) : [];
};

function main(): void {
  const opt = args();
  const where = locate(opt.aoe);
  console.log(`AoE install: ${where.root}${where.data2 ? " (with Rise of Rome)" : ""}`);
  const out = opt.out;
  mkdirSync(out, { recursive: true });

  // Strings.
  const strings = new Map<number, string>();
  for (const f of ["languagex.dll", "language.dll"]) {
    const p = find(where.root, f);
    if (!p) continue;
    for (const [k, v] of readStringTable(new Uint8Array(readFileSync(p)))) if (!strings.has(k)) strings.set(k, v);
  }
  const str = (id: number) => strings.get(id) ?? "";

  // Data files: Rise of Rome is the main one when present, the 1997 file is kept for comparison.
  const datBase = parseDat(inflateDat(new Uint8Array(readFileSync(find(where.data, "empires.dat")!))));
  const datRor = where.data2 ? parseDat(inflateDat(new Uint8Array(readFileSync(find(where.data2, "empires.dat")!)))) : null;
  const dat = datRor ?? datBase;
  console.log(`empires.dat: ${dat.civs.length - 1} civs, ${dat.techs.length} techs, ${dat.graphics.filter(Boolean).length} graphics, ${dat.sounds.length} sounds`);

  // 1. Raw data, with display names.
  const dataDir = join(out, "aoe-data");
  mkdirSync(dataDir, { recursive: true });
  const named = (d: DatFile) => ({
    ...d,
    civs: d.civs.map((c) => ({
      ...c,
      units: c.units.map((u) => (u ? { displayName: str(u.nameStringId), help: str(u.helpStringId), ...u } : null)),
    })),
    techs: d.techs.map((t) => ({ displayName: str(t.nameStringId), help: str(t.helpStringId), ...t })),
  });
  writeFileSync(join(dataDir, "empires-aoe1997.json"), JSON.stringify(named(datBase)));
  if (datRor) writeFileSync(join(dataDir, "empires-ror.json"), JSON.stringify(named(datRor)));
  writeFileSync(join(dataDir, "strings.json"), JSON.stringify(Object.fromEntries(strings), null, 1));

  // 2. Tables.
  const tableDir = join(dataDir, "tables");
  mkdirSync(tableDir, { recursive: true });
  for (const [title, d, sub] of [["Rise of Rome", datRor, "ror"], ["Age of Empires (1997)", datBase, "aoe1997"]] as const) {
    if (!d) continue;
    mkdirSync(join(tableDir, sub), { recursive: true });
    for (const [f, text] of Object.entries(tables(d, str, title))) writeFileSync(join(tableDir, sub, f), text);
  }

  // 3. Bronze Dawn rules with the original's numbers.
  const base = JSON.parse(readFileSync(resolve(WEB, "../data/rules.json"), "utf8")) as RulesFile;
  const { rules, notes } = convert(dat, base);
  writeFileSync(join(out, "rules.json"), JSON.stringify(rules, null, 1));
  writeFileSync(join(dataDir, "rules-notes.md"), `# What rules.json could not carry over exactly\n\n${notes.map((n) => `- ${n}`).join("\n")}\n`);
  console.log(`rules.json written (${notes.length} notes in aoe-data/rules-notes.md)`);

  // 4. Art and sound.
  const manifestPath = join(out, "manifest.json");
  const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "")) : {};
  if (existsSync(manifestPath) && !existsSync(join(out, "manifest.before-aoe.json"))) {
    writeFileSync(join(out, "manifest.before-aoe.json"), readFileSync(manifestPath));
  }
  const manifest: Record<string, unknown> = { ...old };
  if (!opt.noArt) Object.assign(manifest, art(where, dat, out));
  if (!opt.noSound) Object.assign(manifest, sound(where, dat, out));
  const credits = ((old.credits as { what: string }[] | undefined) ?? []).filter((c) => !c.what.startsWith("Age of Empires"));
  credits.push({ what: "Age of Empires / Rise of Rome art and sound (your own copy, local use only)", author: "Ensemble Studios / Microsoft", license: "Proprietary: do not publish" } as never);
  manifest.credits = credits;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`manifest.json written to ${out}`);
  console.log("Restart `npm run dev` so the game picks up the new files.");
}

function art(where: ReturnType<typeof locate>, dat: DatFile, out: string): Record<string, unknown> {
  const inter = [...drsOf(where.data, "interfac.drs"), ...drsOf(where.data2, "interfac.drs")];
  const pal = inter.find((f) => f.id === 50500 && f.ext === "bin");
  if (!pal) throw new Error("interfac.drs has no palette 50500");
  const lib: Library = {
    dat,
    palette: readJascPalette(pal.data),
    slps: slpIndex(drsOf(where.data, "graphics.drs"), drsOf(where.data, "terrain.drs"), inter, drsOf(where.data2, "graphics.drs")),
  };
  const civ = dat.civs[1];
  const all = new Map<number, DatUnit>();
  for (const c of [civ, dat.civs[0]]) for (const u of c.units) if (u && !all.has(u.id)) all.set(u.id, u);
  const g = (id: number | undefined): DatGraphic | null => (id !== undefined && id >= 0 ? dat.graphics[id] ?? null : null);
  const write = (rel: string, png: Buffer) => {
    mkdirSync(dirname(join(out, rel)), { recursive: true });
    writeFileSync(join(out, rel), png);
  };

  const units: Record<string, unknown> = {};
  const sheet = (key: string, file: string, anims: Anim[]) => {
    const s = unitSheet(lib, anims.filter((a) => a.graphic));
    if (!s) return;
    write(file, s.png);
    units[key] = { file, frame: s.frame, anchor: s.anchor, directions: s.directions, anims: s.anims };
  };
  const animsOf = (u: DatUnit, work?: DatGraphic | null): Anim[] => [
    { name: "idle", graphic: g(u.standingGraphic)! },
    { name: "walk", graphic: g(u.moving?.walkingGraphic)! },
    { name: work ? "work" : "attack", graphic: (work ?? g(u.combat?.attackGraphic))! },
    { name: "die", graphic: g(u.dyingGraphic)! },
  ];

  for (const [id, aoe] of Object.entries(UNIT_MAP)) {
    const u = all.get(aoe);
    if (u) sheet(id, `aoe/units/${id}.png`, animsOf(u));
  }
  // Villager by job: Bronze Dawn picks "villager:<tool>".
  const tools: Record<string, number> = { axe: JOBS.wood, pick: JOBS.gold, basket: JOBS.forage, hoe: JOBS.farm, hammer: JOBS.build, spear: JOBS.hunt, net: JOBS.fish };
  for (const [tool, aoe] of Object.entries(tools)) {
    const u = all.get(aoe);
    if (!u) continue;
    // The woodcutter and the hunter have a working graphic; the forager, miners, farmer, builder and
    // fisherman work in their task's proceeding graphic ("Man Forager", "Man Ore"...).
    const tasks = u.action?.tasks ?? [];
    const worked = tasks.find((t) => t.workingGraphic >= 0);
    const work = worked ? g(worked.workingGraphic) : g(tasks.find((t) => t.proceedingGraphic >= 0)?.proceedingGraphic);
    sheet(`villager:${tool}`, `aoe/units/villager-${tool}.png`, animsOf(u, work));
  }
  for (const [id, m] of Object.entries(ANIMAL_MAP)) {
    const u = all.get(m.live);
    if (u) sheet(id, `aoe/units/${id}.png`, animsOf(u));
  }
  for (const [key, aoe] of [["ruins", 158], ["artifact", 159]] as const) {
    const u = all.get(aoe);
    if (u) sheet(key, `aoe/units/${key}.png`, [{ name: "idle", graphic: g(u.standingGraphic)! }]);
  }

  // Buildings: one picture per architecture and age.
  const arches: Record<string, number> = { egyptian: 1, greek: 2, babylonian: 3, asian: 10, roman: 13 };
  const ageKeys = ["stone", "tool", "bronze", "iron"];
  const buildings: Record<string, Record<string, unknown>> = {};
  const looks = buildingLooks(dat);
  for (const [id, aoe] of Object.entries(BUILDING_MAP)) {
    for (const [arch, ci] of Object.entries(arches)) {
      const c = dat.civs[ci];
      if (!c) continue;
      const byAge: Record<string, unknown> = {};
      let last = "";
      ageKeys.forEach((age, ai) => {
        const look = looks(aoe, ai);
        const u = c.units[look.unit] ?? all.get(look.unit);
        const gr = g(u?.standingGraphic);
        if (!gr) return;
        const angle = Math.min(look.angle, Math.max(0, gr.angleCount - 1));
        const key = `${gr.id}:${angle}`;
        if (key === last) return; // same picture as the age before: the loader falls back to it
        last = key;
        const pic = still(lib, gr, { angle });
        if (!pic) return;
        const file = `aoe/buildings/${id}/${arch}-${age}.png`;
        write(file, pic.png);
        // The original's hotspot is the middle of the building's tiles, not the bottom corner Bronze Dawn places it by.
        byAge[age] = { file, anchor: pic.anchor, anchorAt: "center" };
      });
      if (Object.keys(byAge).length) (buildings[id] ??= {})[arch] = byAge;
    }
  }

  // Resources: every frame of the object's picture is a variant.
  const resources: Record<string, unknown> = {};
  const variants = (key: string, ids: number[]) => {
    const list: unknown[] = [];
    for (const aoe of ids) {
      const u = all.get(aoe);
      const gr = g(u?.standingGraphic);
      if (!gr) continue;
      const n = Math.max(1, gr.slp >= 0 ? slpFrameCount(lib, gr.slp) : gr.frameCount);
      for (let f = 0; f < Math.min(n, 12); f++) {
        const pic = still(lib, gr, { frame: f });
        if (!pic) continue;
        const file = `aoe/resources/${key}-${aoe}-${f}.png`;
        write(file, pic.png);
        list.push({ file, anchor: pic.anchor });
      }
    }
    if (list.length) resources[key] = list;
  };
  variants("tree", [113, 114, 121, 129, 161, 198, 203, 226]);
  variants("lone_tree", [134, 135, 136, 137, 138, 139, 140, 141, 144, 145]);
  variants("palm", [149, 150, 151, 152]);
  variants("berry_bush", [59]);
  variants("gold_mine", [66]);
  variants("stone_mine", [102]);
  variants("fish", [260, 263]);
  variants("deep_fish", [52, 53]);
  for (const [id, m] of Object.entries(ANIMAL_MAP)) variants(`carcass_${id}`, [m.dead]);

  // Terrain: 64x32 diamonds straight from terrain.drs.
  const terrain: Record<string, string[]> = {};
  for (const [key, ti] of [["grass", 0], ["water", 1], ["sand", 6]] as const) {
    const t = dat.map.terrains[ti];
    if (!t || t.slp < 0) continue;
    const n = slpFrameCount(lib, t.slp);
    const files: string[] = [];
    for (let f = 0; f < n; f++) {
      const png = slpFrame(lib, t.slp, f);
      if (!png) continue;
      const file = `aoe/terrain/${key}-${f}.png`;
      write(file, png);
      files.push(file);
    }
    if (files.length) terrain[key] = files;
  }

  // Icons: units from 50730, buildings from the architecture's building sheet.
  const icons: Record<string, string> = {};
  for (const [id, aoe] of Object.entries(UNIT_MAP)) {
    const u = all.get(aoe);
    if (!u || u.iconId < 0) continue;
    const png = slpFrame(lib, 50730, u.iconId);
    if (!png) continue;
    write(`aoe/icons/${id}.png`, png);
    icons[id] = `aoe/icons/${id}.png`;
  }
  for (const [id, aoe] of Object.entries(BUILDING_MAP)) {
    const u = all.get(aoe);
    if (!u || u.iconId < 0) continue;
    const png = slpFrame(lib, 50704, u.iconId);
    if (!png) continue;
    write(`aoe/icons/${id}.png`, png);
    icons[id] = `aoe/icons/${id}.png`;
  }
  console.log(`art: ${Object.keys(units).length} unit sheets, ${Object.keys(buildings).length} buildings, ${Object.keys(resources).length} resources, ${Object.keys(terrain).length} terrains, ${Object.keys(icons).length} icons`);
  return { units, buildings, resources, terrain, icons };
}

/**
 * Which unit and graphics angle a building shows in each age. The age techs upgrade buildings to their later
 * units (Barracks1 -> Barracks2) and set attribute 17, the picture's angle, which is how one SLP holds several
 * looks of a building.
 */
function buildingLooks(dat: DatFile): (aoe: number, age: number) => { unit: number; angle: number } {
  const ageTechs = [100, 101, 102, 103];
  const memo = new Map<number, { unit: number; angle: number }[]>();
  return (aoe, age) => {
    let states = memo.get(aoe);
    if (!states) {
      states = [];
      let unit = aoe;
      let angle = 0;
      const ids = new Set([aoe]);
      for (const t of ageTechs) {
        const eff = dat.effects[dat.techs[t]?.effectId ?? -1];
        for (const k of eff?.commands ?? []) {
          if (k.type === 3 && ids.has(k.a)) { unit = k.b; ids.add(k.b); angle = 0; }
          if (k.type === 0 && k.c === 17 && ids.has(k.a)) angle = k.d;
        }
        states.push({ unit, angle });
      }
      memo.set(aoe, states);
    }
    return states[age];
  };
}

function sound(where: ReturnType<typeof locate>, dat: DatFile, out: string): Record<string, unknown> {
  const wavs = new Map<number, Uint8Array>();
  for (const f of [...drsOf(where.data, "sounds.drs"), ...drsOf(where.data, "interfac.drs"), ...drsOf(where.data2, "sounds.drs"), ...drsOf(where.data2, "interfac.drs")]) {
    if (f.ext === "wav") wavs.set(f.id, f.data);
  }
  const all = new Map<number, DatUnit>();
  for (const c of [dat.civs[1], dat.civs[0]]) for (const u of c.units) if (u && !all.has(u.id)) all.set(u.id, u);
  const dir = join(out, "aoe/sfx");
  mkdirSync(dir, { recursive: true });
  // Every sound the data names, kept by its empires.dat id.
  const files = (soundId: number | undefined): string[] => {
    const s = soundId !== undefined && soundId >= 0 ? dat.sounds[soundId] : null;
    if (!s) return [];
    const list: string[] = [];
    for (const item of s.items) {
      const data = wavs.get(item.resource);
      if (!data) continue;
      const rel = `aoe/sfx/${item.resource}.wav`;
      writeFileSync(join(out, rel), data);
      list.push(rel);
    }
    return list;
  };
  const task = (unit: number) => all.get(unit)?.action?.tasks.find((t) => t.gatherSound >= 0 || t.depositSound >= 0);
  const sfx: Record<string, string[]> = {};
  const put = (key: string, list: string[]) => { if (list.length) sfx[key] = list; };
  put("chop", files(task(JOBS.wood)?.gatherSound));
  put("mine", files(task(JOBS.gold)?.gatherSound));
  put("forage", files(task(JOBS.forage)?.gatherSound));
  put("farm", files(task(JOBS.farm)?.gatherSound));
  put("fish", files(task(JOBS.fish)?.gatherSound));
  put("hammer", files(task(JOBS.build)?.gatherSound));
  put("club", files(all.get(UNIT_MAP.clubman)?.action?.attackSound));
  put("sword", files(all.get(UNIT_MAP.short_swordsman)?.action?.attackSound));
  put("spear", files(all.get(UNIT_MAP.hoplite)?.action?.attackSound));
  put("bow", files(all.get(UNIT_MAP.bowman)?.action?.attackSound));
  put("boom", files(all.get(UNIT_MAP.catapult)?.action?.attackSound));
  put("convert", files(all.get(UNIT_MAP.priest)?.action?.attackSound));
  put("die", files(all.get(UNIT_MAP.villager)?.dyingSound));
  put("collapse", files(all.get(BUILDING_MAP.barracks)?.dyingSound));
  put("trained", files(all.get(UNIT_MAP.villager)?.trainSound));
  put("complete", files(all.get(BUILDING_MAP.house)?.building?.constructionSound));
  for (const [kind, id] of [["villager", UNIT_MAP.villager], ["soldier", UNIT_MAP.clubman], ["rider", UNIT_MAP.cavalry], ["priest", UNIT_MAP.priest], ["siege", UNIT_MAP.catapult]] as const) {
    const u = all.get(id);
    put(`voice-${kind}`, files(u?.selectionSound));
    put(`voice-${kind}-ack`, files(u?.action?.moveSound));
  }
  // The full sound list, for remapping by hand.
  const index = dat.sounds.map((s, i) => (s ? { id: i, files: s.items.map((x) => ({ wav: x.resource, name: x.file, probability: x.probability })) } : null));
  writeFileSync(join(out, "aoe-data", "sounds.json"), JSON.stringify(index, null, 1));
  for (const [id, data] of wavs) writeFileSync(join(dir, `${id}.wav`), data);
  console.log(`sound: ${Object.keys(sfx).length} game sounds mapped, ${wavs.size} wav files copied`);
  return { sfx };
}

main();
