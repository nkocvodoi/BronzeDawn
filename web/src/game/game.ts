import { Application, Container, Graphics, Matrix, Sprite, Texture } from "pixi.js";
import { AIController, Difficulty } from "../core/ai";
import { Building, Entity, ResourceNode, Unit } from "../core/entities";
import { Tile, Vec2 } from "../core/geom";
import { Terrain } from "../core/grid";
import { Res, ResBag, Rules } from "../core/rules";
import { scores } from "../core/score";
import { clock } from "../core/sim";
import { MAP_TYPES, MapType } from "../core/mapgen";
import { World } from "../core/world";
import { Arch, buildingPic, CIV_RELIEFS, Facing, firePic, rubblePic, nodePic, Pic, playerColor, Pose, projectilePic, terrainChunks, Tool, unitPic, UnitLook, wallPic } from "./art";
import { CursorKind, cursors } from "./cursors";
import { drawTimeline } from "./timeline";
import { describe, describeCiv } from "./describe";
import { Command, HUD } from "./hud";
import { ASSETS, screenDirection } from "./assets";
import { FogFilter } from "./fog";
import { depth, fromIso, HALF_H, HALF_W, iso } from "./iso";
import { MouseLock } from "./mouselock";
import { Sfx, Sound, VoiceKind } from "./sound";

/** The drawable side of one entity. `workFrame` is the last work-animation frame, so a swing makes one sound. */
interface View { root: Container; sprite: Sprite; ring: Graphics; bar: Graphics; pic: Pic; isUnit: boolean; key: string; barW: number; tiles: Tile[]; workFrame: number;
  /** Flames on a damaged building, one more at each quarter of its hit points lost. */
  fire?: Container; farm?: boolean }

/** The original's limit on how many units one selection holds. */
const MAX_SELECTION = 25;

/** Where the Timeline is drawn, with the line that reads it under the pointer. */
const TIMELINE_HTML = `<canvas id="timeline"></canvas><div id="timeline-read"></div><div class="timeline-key">T Tool · B Bronze · I Iron · W Wonder · ✕ out</div>`;

/** How long something takes, in game seconds: "25s", or "2:40" from a minute on. */
const duration = (s: number) => (s < 60 ? `${Math.round(s)}s` : clock(s));

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

/** The sound of each tool striking, while a villager works. */
const TOOL_SOUND: Partial<Record<Tool, Sfx>> = { axe: "chop", pick: "mine", hammer: "hammer", basket: "forage", hoe: "farm", net: "fish", spear: "spear" };

/** What a building says when you pick it. */
const BUILDING_SOUND: Record<string, Sfx> = {
  barracks: "sword", academy: "sword", archery_range: "bow", siege_workshop: "hammer", temple: "heal",
  market: "forage", granary: "forage", storage_pit: "mine", house: "knock", town_center: "trained",
  government_center: "researched", watch_tower: "bow", wonder: "researched", farm: "farm",
};

/** Zoom steps where one art pixel covers a whole number of screen pixels: 4, 3, 2, 1. */
const ZOOMS = [0.5, 2 / 3, 1, 2];

/** Game speeds, as in the original's settings (1.0, 1.5, 2.0), plus 3x for long games. */
const SPEEDS = [1, 1.5, 2, 3];
/** Watching the computers, the game also runs faster. */
const WATCH_SPEEDS = [...SPEEDS, 5, 10];

/** Map sizes in tiles, after the original's Small to Huge. */
const MAP_SIZES: [string, number][] = [["Small", 72], ["Medium", 96], ["Large", 120], ["Huge", 144]];
/** The smallest map for a number of players, so every start has room: up to 4 fit any map. */
const minMapSize = (players: number) => (players <= 4 ? 0 : players <= 6 ? 96 : 120);

/** The original's build keys: B opens the build menu, then a letter places the building.
 *  In the original's order on the buttons: House, Barracks, Granary, Storage Pit, then the later ones. */
const BUILD_KEYS: Record<string, string> = {
  house: "E", barracks: "B", granary: "G", storage_pit: "S", market: "M", farm: "F",
  archery_range: "A", stable: "L", small_wall: "W", watch_tower: "T", government_center: "C", temple: "P",
  academy: "Y", siege_workshop: "K", town_center: "N", wonder: "O", dock: "D",
};

/** The original's train keys, by unit line (an upgraded unit keeps its line's key). */
const TRAIN_KEYS: Record<string, string> = {
  villager: "C", clubman: "T", axeman: "A", slinger: "L",
  short_swordsman: "Z", broad_swordsman: "Z", long_swordsman: "Z", legion: "Z",
  hoplite: "T", phalanx: "T", centurion: "T",
  bowman: "T", improved_bowman: "A", composite_bowman: "A", chariot_archer: "R", horse_archer: "C", heavy_horse_archer: "C", elephant_archer: "E",
  scout: "S", chariot: "R", scythe_chariot: "R", cavalry: "C", heavy_cavalry: "C", cataphract: "C", war_elephant: "E", armored_elephant: "E", camel_rider: "L",
  stone_thrower: "C", catapult: "C", heavy_catapult: "C", ballista: "B", helepolis: "B", priest: "T",
  fishing_boat: "F", fishing_ship: "F",
  light_transport: "T", heavy_transport: "T",
  scout_ship: "E", war_galley: "E", trireme: "E", catapult_trireme: "C", juggernaught: "C", fire_galley: "G",
};

/** Letters for whatever has no key of its own (technologies, advancing). H, P and digits stay global. */
const SPARE_KEYS = "QWERUIODFGJKXVNM";

const WALL_TIER: Record<string, 0 | 1 | 2> = { small_wall: 0, medium_wall: 1, fortification: 2 };


export class Game {
  world: World;
  /** The player whose eyes, resources and buildings the screen shows: you, or while watching, any of them. */
  me = 0;
  /** Watch mode: every player is a computer, and you only look. */
  watching = false;
  /** Watching, whether the whole map is shown, or only what the player you follow sees. */
  private watchAll = true;
  private get speeds() { return this.watching ? WATCH_SPEEDS : SPEEDS; }
  started = false;
  paused = false;
  revealMap = false;
  /** How many simulation seconds pass per real second. The simulation still steps at a fixed 20 Hz. */
  speed = 1;
  /** Whether spent farms are sown again (AoE2), remembered between games. On unless turned off. */
  reseed = store.get("bd-reseed") !== "off";
  /** How many computer players, and whether they fight as one team against you. Remembered between games. */
  opponents = Math.min(7, Math.max(1, Number(store.get("bd-opponents")) || 1));
  computersTeamUp = store.get("bd-teams") === "team";
  /** Farms block the way, as in the original; off, they are walked over as in the remaster. Remembered. */
  farmsBlock = store.get("bd-farms-block") === "on";
  /** The kind of map: Inland with lakes, or one with a sea. Remembered. */
  mapType: MapType = MAP_TYPES.some(([id]) => id === store.get("bd-map-type")) ? (store.get("bd-map-type") as MapType) : "inland";
  /** The game is over for you: won, or defeated while the others play on. */
  private ended = false;
  private seed: number;
  private mapSize = 72;
  private wallStart: Tile | null = null;
  private wallGhosts: Sprite[] = [];

  private hud = new HUD();
  private worldLayer = new Container();
  private terrain = new Container();
  private entities = new Container();
  private effects = new Container();
  private fogSprite = new Sprite();
  private fogCanvas = document.createElement("canvas");
  private fogFilter: FogFilter;
  private views = new Map<number, View>();
  /** Enemy buildings the player has seen. Under fog they are drawn as last seen, not as they are. */
  private seen = new Set<number>();
  /** Enemy buildings destroyed out of sight: still drawn until the player looks again. */
  private ghosts = new Map<number, { view: View; tiles: Tile[] }>();
  private cam = { x: 0, y: 0, zoom: 1 };
  private pinch = 0;

  selection: number[] = [];
  private groups = new Map<number, number[]>();
  private placing: string | null = null;
  private ghost: Sprite | null = null;
  private attackMovePending = false;
  /** Repair was chosen: the next click on a damaged building of yours repairs it. */
  private repairPending = false;
  /** Attack Ground was chosen: the next click is the spot the stone throwers hit. */
  private groundPending = false;
  /** Sacrifice was chosen: the next click on an enemy is where a priest gives its life (Martyrdom). */
  private sacrificePending = false;
  private dragStart: { x: number; y: number } | null = null;
  private mouse = { x: -1, y: -1, inside: false };
  private keys = new Set<string>();
  private accumulator = 0;
  private fogStamp = -1;
  private minimapStamp = -1;
  private idleIndex = 0;
  private miniBase = document.createElement("canvas");
  private dragBox = document.querySelector("#dragbox") as HTMLDivElement;
  readonly sound = new Sound();
  private cursor: CursorKind | "" = "";
  private cursorAt = 0;
  readonly lock = new MouseLock((on) => {
    this.cursorAt = 0;
    this.screenButtons();
    if (on) this.mouse.inside = true;
  });

  constructor(private app: Application, private rules: Rules, seed: number) {
    this.seed = seed;
    this.world = new World(rules, seed, ["You", "Enemy"]);
    this.entities.sortableChildren = true;
    this.worldLayer.addChild(this.terrain, this.entities, this.effects, this.fogSprite);
    // Hard black edges and a stipple over explored ground, drawn on the GPU from the smooth fog texture.
    this.fogFilter = new FogFilter(app.renderer.resolution);
    this.fogSprite.filters = [this.fogFilter.filter];
    app.stage.addChild(this.worldLayer);
    this.buildWorld();
    this.bindInput();
    app.ticker.add((t) => this.frame(t.deltaMS / 1000));
    this.showStart();
  }

  // ---- setup

  private newGame(seed: number, civs: (string | null)[] = [], size = this.mapSize, teams: number[] = []) {
    this.seed = seed;
    this.mapSize = size;
    this.ended = false;
    const n = Math.max(2, civs.length);
    const names = this.watching ? Array.from({ length: n }, (_, i) => `Computer ${i + 1}`)
      : ["You", ...Array.from({ length: n - 1 }, (_, i) => (n === 2 ? "Enemy" : `Enemy ${i + 1}`))];
    this.world = new World(this.rules, seed, names, size, true, { civs, teams, farmsBlock: this.farmsBlock, mapType: this.mapType });
    for (const v of this.views.values()) v.root.destroy({ children: true });
    this.views.clear();
    for (const g of this.ghosts.values()) g.view.root.destroy({ children: true });
    this.ghosts.clear();
    this.seen.clear();
    this.selection = [];
    this.groups.clear();
    this.cancelPlacing();
    this.fogStamp = this.minimapStamp = -1;
    this.buildWorld();
  }

  private buildWorld() {
    this.terrain.removeChildren().forEach((c) => c.destroy({ texture: true }));
    // The ground under a forest is dark, and a little darker around it.
    const map = this.world.map, forest = new Uint8Array(map.width * map.height);
    for (const r of this.world.nodes) {
      if (r.def.id !== "tree") continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = r.tile.x + dx, y = r.tile.y + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const i = y * map.width + x;
        forest[i] = dx === 0 && dy === 0 ? 1 : forest[i] || 2;
      }
    }
    for (const t of terrainChunks(this.world.map, forest)) {
      const ground = new Sprite(t.texture);
      ground.position.set(t.x, t.y);
      ground.width = t.w;
      ground.height = t.h;
      this.terrain.addChild(ground);
    }
    const n = this.world.map.width;
    // One extra tile of black on every side so the terrain's edge never peeks out. A fresh canvas and
    // texture for each map: resizing the old canvas leaves the GPU copy at the first map's size, and
    // a bigger map then draws no fog at all.
    const old = this.fogSprite.texture;
    this.fogCanvas = document.createElement("canvas");
    this.fogCanvas.width = n + 2;
    this.fogCanvas.height = n + 2;
    this.fogSprite.texture = Texture.from(this.fogCanvas);
    if (old && old !== Texture.EMPTY) old.destroy(true);
    this.fogSprite.setFromMatrix(new Matrix(HALF_W, HALF_H, -HALF_W, HALF_H, 0, -2 * HALF_H));
    this.miniBase.width = n;
    this.miniBase.height = n;
    this.centerOn(this.world.startTiles[this.me].center);
  }

  private centerOn(p: Vec2) {
    const s = iso(p);
    this.cam.x = s.x;
    this.cam.y = s.y + 40 * this.cam.zoom; // keep clear of the bottom panel
    this.clampCamera();
  }

  private clampCamera() {
    const n = this.world.map.width;
    this.cam.x = Math.min(Math.max(this.cam.x, -n * HALF_W), n * HALF_W);
    this.cam.y = Math.min(Math.max(this.cam.y, -100), 2 * n * HALF_H + 100);
  }

  /** Screen pixel to world screen-space (before iso inversion). */
  private toScene(sx: number, sy: number) {
    const w = this.app.screen.width, h = this.app.screen.height;
    return { x: (sx - w / 2) * this.cam.zoom + this.cam.x, y: (sy - h / 2) * this.cam.zoom + this.cam.y };
  }

  private toWorld(sx: number, sy: number) { const p = this.toScene(sx, sy); return fromIso(p.x, p.y); }

  // ---- screens

  showStart() {
    this.started = false;
    this.hud.playing(false);
    const civs = this.rules.civs.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    this.hud.showOverlay("Bronze Dawn", [
      "Lead a people from the Stone Age to the Iron Age: gather, build, research, and destroy the enemy, or raise a Wonder.",
      `Your civilization: <select id="civ"><option value="">Random</option>${civs}</select>`,
      `<span id="civ-info">A civilization picked at random. Its bonuses show at the top of the screen.</span>`,
      `Map: <select id="map-type">${MAP_TYPES.map(([id, name]) => `<option value="${id}"${id === this.mapType ? " selected" : ""}>${name}</option>`).join("")}</select>`,
      `Map size: <select id="map-size">${MAP_SIZES.map(([n, t]) => `<option value="${t}"${t === this.mapSize ? " selected" : ""}>${n} (${t} x ${t})</option>`).join("")}</select>`,
      `Computer players: <select id="opponents">${[1, 2, 3, 4, 5, 6, 7].map((k) => `<option value="${k}"${k === this.opponents ? " selected" : ""}>${k}</option>`).join("")}</select>`
        + ` <select id="teams"><option value="ffa"${this.computersTeamUp ? "" : " selected"}>each on its own</option>`
        + `<option value="team"${this.computersTeamUp ? " selected" : ""}>allied against you</option></select>`,
      `<span id="players-info">${this.playersNote(this.opponents)}</span>`,
      `Game speed: <select id="start-speed">${SPEEDS.map((x) => `<option value="${x}"${x === this.speed ? " selected" : ""}>${x}x</option>`).join("")}</select>`,
      `<label><input type="checkbox" id="farms-block"${this.farmsBlock ? " checked" : ""}> Farms block the way, as in the original (off: walk over them, as in the remaster)</label>`,
      `<label><input type="checkbox" id="watch"> Only watch: every player is a computer</label>`,
      `<span class="choices"><button data-start="easy">1 · Easy</button><button data-start="normal">2 · Normal</button><button data-start="hard">3 · Hard</button></span>`,
      "Hard: the computer gathers 20% faster.",
      "Press ? at any time for the controls",
    ]);
  }

  start(d: Difficulty) {
    this.watching = (document.querySelector("#watch") as HTMLInputElement | null)?.checked === true;
    const fb = document.querySelector("#farms-block") as HTMLInputElement | null;
    if (fb) { this.farmsBlock = fb.checked; store.set("bd-farms-block", fb.checked ? "on" : "off"); }
    this.me = 0;
    this.watchAll = true;
    // The same map, now with civilizations: yours, and one for the computer.
    const pick = (document.querySelector("#civ") as HTMLSelectElement | null)?.value || null;
    const civs = this.rules.civs;
    const mine = pick ?? (civs.length ? civs[Math.floor(Math.random() * civs.length)].id : null);
    const opp = Number((document.querySelector("#opponents") as HTMLSelectElement | null)?.value) || this.opponents;
    const teamUp = (document.querySelector("#teams") as HTMLSelectElement | null)?.value === "team";
    this.opponents = opp; this.computersTeamUp = teamUp;
    store.set("bd-opponents", String(opp)); store.set("bd-teams", teamUp ? "team" : "ffa");
    const theirs = Array.from({ length: opp }, (_, i) => (civs.length ? civs[(this.seed * 7 + 3 + i * 5) % civs.length].id : null));
    // More players need room: the map grows to fit them.
    const chosenSize = Number((document.querySelector("#map-size") as HTMLSelectElement | null)?.value) || this.mapSize;
    const mt = (document.querySelector("#map-type") as HTMLSelectElement | null)?.value as MapType | undefined;
    if (mt && MAP_TYPES.some(([id]) => id === mt)) { this.mapType = mt; store.set("bd-map-type", mt); }
    const size = Math.max(chosenSize, minMapSize(opp + 1));
    // Allied computers share team 1; you are on your own.
    this.newGame(this.seed, [mine, ...theirs], size, teamUp ? [0, ...theirs.map(() => 1)] : []);
    // The speed chosen on the start screen; + and - still change it during the game.
    const chosen = Number((document.querySelector("#start-speed") as HTMLSelectElement | null)?.value);
    if (this.speeds.includes(chosen)) { this.speed = chosen; this.hud.speed(chosen); }
    this.world.ais = this.world.players.filter((p) => this.watching || p.id !== this.me).map((p) => new AIController(p.id, d));
    this.revealMap = this.watching;
    for (const ai of this.world.ais) ai.attach(this.world);
    this.applyReseed();
    // Start zoomed so the map fills the screen as it did at 800 x 600, with the interface scaled to match.
    const u = Math.min(window.innerWidth / 800, window.innerHeight / 600);
    this.cam.zoom = ZOOMS.reduce((a, b) => (Math.abs(b - 1 / u) < Math.abs(a - 1 / u) ? b : a));
    this.started = true;
    this.paused = false;
    this.hud.playing(true);
    this.hud.hideOverlay();
    this.hud.clearMessages();
    // The interface is carved in your civilization's style: its own, or its architecture's.
    const myCiv = this.civId(this.me);
    this.hud.theme(myCiv && CIV_RELIEFS.includes(myCiv) ? myCiv : this.arch(this.me));
    this.sound.unlock();
    this.sound.startMusic();
    const civ = this.world.players[this.me].civ;
    const others = this.world.players.filter((p) => p.id !== this.me).map((p) => p.civ?.name ?? p.name);
    this.hud.civ(civ?.name ?? null, civ ? describeCiv(civ, this.rules) : [], others.join(", ") || null);
    if (size > chosenSize) this.hud.message(`The map was made ${MAP_SIZES.find(([, t]) => t === size)?.[0] ?? size} to fit ${opp + 1} players`);
    if (this.watching) this.hud.message(`Watching ${this.world.players.length} computers. V: follow a player or see everything · + and -: speed up to 10x`);
    else this.hud.message(`${civ ? `Your civilization: ${civ.name}. ` : ""}Gather food and wood. Build houses. Good luck.`);
    this.selectTownCenter();
  }

  private showHelp() {
    this.hud.showOverlay("Controls", [
      "Left click / drag: select · Shift: add · Double click: all of that kind on screen",
      "Right click: move, gather, hunt, build, repair, attack, convert or heal (priests), or set a rally point · Shift + right click: a waypoint",
      "Villagers: B opens the build menu, then E House · G Granary · S Storage Pit · B Barracks · D Dock (in the water at the shore) · M Market · F Farm",
      "A Archery Range · L Stable · W Wall · T Tower · C Government Center · P Temple · Y Academy · K Siege Workshop · N Town Center · O Wonder",
      "Transports (T at the Dock): right-click one with land units to go aboard, then right-click the land (or U) to put them ashore",
      "Train: F Fishing Boat at the Dock · C Villager · T Clubman, Bowman, Hoplite, Priest · Z swordsmen · S Scout · C Cavalry · R chariots · E elephants · Esc back or cancel",
      "Walls: choose Wall, then drag a line · Farms need a Market · Ages need two buildings of the age",
      "H town center · . idle villager · Space look at the selection · Ctrl+1-9 save group · 1-9 recall · Shift+1-9 add a group · Delete destroy",
      "Villagers: R repair · Soldiers: D stand ground · Stone throwers: T attack ground · Up to 25 units in one selection · The pointer shows what a right-click will do · Tab: the next unit of the selection · F4 or S: population, scores or nothing above the minimap · F10: menu",
      "In the menu: game speed, sound, music, keeping the mouse in the game (Alt+Tab or Esc lets go), farms that sow themselves again, full screen (hold Esc to leave)",
      "Arrows / trackpad / screen edge: scroll · Pinch, wheel or PageUp/PageDown: zoom",
      "+ / -: game speed 1x, 1.5x, 2x, 3x (or click the speed in the top bar), and 5x, 10x when watching · F3 pause",
      "Watching the computers: V follows one player (its fog, resources and panel), then the next, then everything",
      ...this.civLines(),
      "Press ? or Esc to close",
    ], "help");
  }

  /** Watching: everything, then each player in turn, seen through their eyes (fog, resources, panel). */
  private nextView() {
    const n = this.world.players.length;
    if (this.watchAll) { this.watchAll = false; this.me = 0; }
    else if (this.me + 1 < n) this.me++;
    else { this.watchAll = true; this.me = 0; }
    this.revealMap = this.watchAll;
    this.selection = [];
    this.fogStamp = this.minimapStamp = -1;
    const p = this.world.players[this.me];
    this.hud.message(this.watchAll ? "Seeing everything (V: follow a player)" : `Following ${p.name}${p.civ ? ` (${p.civ.name})` : ""}: what it sees, its resources and population`);
    if (!this.watchAll) this.selectTownCenter();
  }

  /** S or F4: the list above the minimap shows population, then scores, then nothing. */
  private scoresToggled() {
    const m = this.hud.toggleScores(this.world, this.me);
    this.hud.message(m === "pop" ? "Showing each player's population" : m === "score" ? "Showing scores" : "Player list hidden");
  }

  /** The reseeding setting holds for everyone in the game, the computer too, so it stays fair. */
  private applyReseed() {
    for (const p of this.world.players) this.world.setAutoReseed(p.id, this.reseed);
  }

  /** The game menu: options that the top bar used to hold, help, and leaving the game. */
  private showMenu() {
    const t = (id: string, label: string, on: boolean) => `<button id="${id}" class="toggle${on ? "" : " off"}">${label}</button>`;
    this.hud.showOverlay("Menu", [
      `<span class="stack">
        <button id="resume-btn">Return to game (Esc)</button>
        <button id="help-open">Controls (F1)</button>
        <button id="speed">Game speed ${this.speed}x</button>
        ${t("sfx-btn", "Sound effects", this.sound.sfxOn)}
        ${t("music-btn", "Music", this.sound.musicOn)}
        ${t("lock-btn", "Keep the mouse in the game", this.lock.wanted)}
        ${t("reseed-btn", "Farms sow themselves again", this.reseed)}
        <button id="fs-btn">${document.fullscreenElement ? "Leave full screen" : "Full screen"}</button>
        <button id="timeline-btn">Timeline</button>
        <button id="credits-btn">Credits</button>
        <button data-restart>Quit to a new map</button>
      </span>`,
    ], "menu");
  }

  /** The Timeline so far, from the menu. */
  private showTimeline() {
    this.hud.showOverlay("Timeline", [TIMELINE_HTML, `<span class="choices"><button id="resume-btn">Return to game (Esc)</button></span>`], "menu");
    this.paintTimeline();
  }

  private paintTimeline() {
    const c = document.querySelector("#timeline") as HTMLCanvasElement | null, r = document.querySelector("#timeline-read") as HTMLElement | null;
    if (c && r) drawTimeline(c, r, this.world);
  }

  /** Who made the art and sound from files, and under which licence; required by CC-BY. */
  private showCredits() {
    const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
    const list = ASSETS.manifest.credits ?? [];
    const rows = list.map((c) => `<tr><td>${esc(c.what)}</td><td>${esc(c.author)}</td><td>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener" style="color:inherit">${esc(c.license)}</a>` : esc(c.license)}</td></tr>`).join("");
    this.hud.showOverlay("Credits", [
      "Game, code, and everything not listed here: drawn and composed in code for Bronze Dawn.",
      rows ? `<table>${rows}</table>` : "No art or sound from files is in use.",
      `<span class="choices"><button id="resume-btn">Close (Esc)</button></span>`,
    ], "menu");
  }

  /** What the start screen says about the players chosen. */
  private playersNote(opp: number) {
    const min = minMapSize(opp + 1);
    return `${opp + 1} players.${min ? ` The map will be at least ${MAP_SIZES.find(([, t]) => t === min)?.[0]} (${min} x ${min}).` : ""}`;
  }

  /** The players and their civilizations, with what each civilization is good at. */
  private showDiplomacy() {
    const rows = this.world.players.map((p) => {
      const bonuses = p.civ ? describeCiv(p.civ, this.rules).join("; ") : "no bonuses";
      return `<tr><td style="color:${playerColor(p.id)}"><b>${p.name}</b></td><td>${p.civ?.name ?? "-"}</td><td>${this.watching ? "Computer" : p.id === this.me ? "You" : this.world.allied(this.me, p.id) ? "Ally" : "Enemy"}</td><td>${bonuses}</td></tr>`;
    }).join("");
    this.hud.showOverlay("Diplomacy", [`<table>${rows}</table>`, `<span class="choices"><button id="resume-btn">Close (Esc)</button></span>`], "menu");
  }

  /** Your civilization and its bonuses, and the enemy's, for the help screen. */
  private civLines(): string[] {
    const out: string[] = [];
    const mine = this.world.players[this.me].civ;
    if (mine) out.push(`<b>You: ${mine.name}</b> · ${describeCiv(mine, this.rules).join(" · ")}`);
    for (const p of this.world.players) {
      if (p.id === this.me || !p.civ) continue;
      out.push(`${p.name}: ${p.civ.name} · ${describeCiv(p.civ, this.rules).join(" · ")}`);
    }
    return out;
  }

  /** Victory or defeat, once. You lose as soon as you are out, even while the computers fight on. */
  private gameOver(winner: number, how: "conquest" | "wonder" = "conquest") {
    if (this.ended) return;
    this.ended = true;
    const won = !this.watching && winner >= 0 && this.world.allied(this.me, winner) && !this.world.players[this.me].defeated;
    this.sound.stopMusic();
    this.sound.play(won || this.watching ? "victory" : "defeat");
    // The original's end screen: each player's score in its five parts.
    const sc = scores(this.world);
    const head = `<tr><th></th><th>Military</th><th>Economy</th><th>Religion</th><th>Technology</th><th>Other</th><th>Total</th></tr>`;
    const rows = this.world.players.map((p) => {
      const s = sc[p.id];
      return `<tr><td style="color:${playerColor(p.id)}"><b>${p.name}</b>${p.civ ? ` (${p.civ.name})` : ""}</td>`
        + [s.military, s.economy, s.religion, s.technology, s.other].map((v) => `<td>${v}</td>`).join("") + `<td><b>${s.total}</b></td></tr>`;
    }).join("");
    const title = this.watching ? `${winner >= 0 ? this.world.players[winner].name : "Nobody"} wins` : won ? "Victory" : "Defeat";
    this.hud.showOverlay(title, [
      `${how === "wonder" ? "A Wonder stood its time. " : ""}Time ${clock(this.world.time)}`,
      `<span class="choices tabs"><button data-tab="timeline" class="on">Timeline</button><button data-tab="score">Score</button></span>`,
      `<div data-pane="timeline">${TIMELINE_HTML}</div>`,
      `<div data-pane="score" hidden><table class="score">${head}${rows}</table></div>`,
      `<span class="choices"><button data-restart>New map (Enter)</button></span>`,
    ], won || this.watching ? "win" : "lose");
    this.paintTimeline();
  }

  // ---- the loop

  private frame(dt: number) {
    dt = Math.min(dt, 0.25);
    this.scrollCamera(dt);
    const w = this.world;
    if (this.started && !this.paused && w.winner === null) {
      this.accumulator += dt * this.speed;
      let steps = 0;
      const maxSteps = Math.ceil(6 * this.speed);
      while (this.accumulator >= World.dt && steps < maxSteps) { w.step(); this.accumulator -= World.dt; steps++; }
      if (steps === maxSteps) this.accumulator = Math.min(this.accumulator, World.dt); // a slow machine falls behind rather than freezing
      this.handleEvents();
    }
    const alpha = this.started ? Math.min(1, this.accumulator / World.dt) : 1;
    const sw = this.app.screen.width, sh = this.app.screen.height;
    this.worldLayer.scale.set(1 / this.cam.zoom);
    // Whole screen pixels, so the pixel art never shimmers while scrolling.
    this.worldLayer.position.set(Math.round(sw / 2 - this.cam.x / this.cam.zoom), Math.round(sh / 2 - this.cam.y / this.cam.zoom));
    this.fogFilter.update(this.worldLayer.x, this.worldLayer.y, this.worldLayer.scale.x, this.app.canvas.height);
    this.sync(alpha);
    if (w.tick !== this.fogStamp && (w.tick % 5 === 0 || this.fogStamp < 0)) { this.updateFog(); this.fogStamp = w.tick; }
    if (Math.floor(w.tick / 10) !== this.minimapStamp) { this.updateMinimap(); this.minimapStamp = Math.floor(w.tick / 10); }
    this.selection = this.selection.filter((id) => w.entity(id));
    const sel = this.selectedEntities();
    this.hud.update(w, this.me, sel);
    // The status box shows the first of a group, so its picture too.
    const one = sel.length ? this.views.get(sel[0].id) : undefined;
    this.hud.portrait(one?.pic.canvas ?? null);
    this.hud.setCommands(this.commands(sel));
    this.updateGhost();
    this.updateCursor();
  }

  // ---- the pointer

  /** What a right-click here would do, shown by the pointer. */
  private cursorFor(sx: number, sy: number): CursorKind {
    if (!this.started || this.hud.overlayShown || this.placing || !this.mouse.inside) return "arrow";
    if (this.attackMovePending) return "sword";
    if (this.repairPending) return "hammer";
    if (this.groundPending) return "sword";
    if (this.sacrificePending) return "staff";
    const units = this.selectedEntities().filter((x): x is Unit => x instanceof Unit && x.owner === this.me);
    if (!units.length) return "arrow";
    const t = this.pick(sx, sy);
    const villagers = units.some((u) => u.isVillager), priests = units.some((u) => u.isPriest);
    if (villagers) {
      const at = this.toWorld(sx, sy);
      const foundation = this.world.buildingsOf(this.me).find((b) => !b.complete && b.footprint.distance(at) === 0);
      if (foundation) return "hammer";
    }
    if (!t) return "arrow";
    if (t instanceof ResourceNode) {
      if (!villagers) return "arrow";
      return t.res === Res.wood ? "axe" : t.res === Res.food ? "basket" : "pick";
    }
    if (t.owner === this.me) {
      if (villagers && t instanceof Building && t.isFarm && t.complete) return "basket";
      if (villagers && t instanceof Building && t.complete && t.hp < t.maxHp) return "hammer";
      if (priests && t instanceof Unit && t.hp < t.maxHp) return "staff";
      return "arrow";
    }
    if (t instanceof Unit && t.isAnimal) return villagers || units.some((u) => !u.isPriest) ? "sword" : "arrow";
    if (priests && t.owner >= 0) return "staff";
    return t.owner >= 0 ? "sword" : "arrow";
  }

  /** The help line for what is under the pointer, in the original's manner. */
  private rolloverText(k: CursorKind): string | null {
    if (!this.started || this.hud.overlayShown) return null;
    if (this.placing) return "Click to place the building. Right-click to cancel.";
    if (this.attackMovePending) return "Click where to attack-move.";
    if (this.repairPending) return "Click a damaged building of yours to repair it.";
    if (this.groundPending) return "Click the ground to bombard.";
    if (this.sacrificePending) return "Click an enemy for a priest to convert by giving its life.";
    const t = this.pick(this.mouse.x, this.mouse.y);
    const verb: Partial<Record<CursorKind, string>> = {
      sword: "Right-click to attack", axe: "Right-click to cut wood", pick: "Right-click to mine", basket: "Right-click to gather food",
      hammer: "Right-click to build", staff: "Right-click to convert or heal",
    };
    if (!t) return null;
    const what = t instanceof ResourceNode ? t.name : t.owner === this.me ? "" : `${t.owner >= 0 ? `${this.world.players[t.owner].name}'s ` : ""}${t.name}`;
    if (k === "hammer" && t instanceof Building && t.complete) return "Right-click to repair. It costs resources.";
    if (verb[k]) return `${verb[k]}${what ? ` ${what}` : ""}.`;
    if (t.owner === this.me) return t instanceof Building ? "Click to select this building." : "Click to select this unit.";
    return `${what}.`;
  }

  private updateCursor() {
    // Menus and the end screen need the real mouse back.
    if (this.lock.locked && this.hud.overlayShown) this.lock.unlock();
    const now = performance.now();
    if (now - this.cursorAt < 70) return; // a pick test is cheap, but not every frame
    this.cursorAt = now;
    const k = this.cursorFor(this.mouse.x, this.mouse.y);
    const overMap = document.elementFromPoint(this.mouse.x, this.mouse.y) === this.app.canvas;
    if (this.lock.locked) this.lock.show(overMap ? k : "arrow");
    this.hud.rollover(overMap ? this.rolloverText(k) : null);
    if (k === this.cursor) return;
    this.cursor = k;
    this.app.canvas.style.cursor = cursors()[k];
  }

  /** How loud a sound at p is, and from which side: full in the middle of the screen, fading past its edges. */
  private spot(p: Vec2): [number, number] | null {
    const s = this.screenOf(p), sw = this.app.screen.width, sh = this.app.screen.height;
    const dx = (s.x - sw / 2) / (sw / 2), dy = (s.y - sh / 2) / (sh / 2);
    const d = Math.hypot(dx, dy * 1.3);
    if (d > 1.6) return null;
    return [Math.min(1, 1.25 - d * 0.55), dx * 0.7];
  }

  /** Plays an effect where it happens, if the player could see it. */
  private sfx(name: Sfx, at: Vec2, vol = 1, gap?: number) {
    if (!this.visible(at.tile)) return;
    const s = this.spot(at);
    if (s) this.sound.play(name, s[0] * vol, s[1], gap);
  }

  private voiceOf(u: Unit): VoiceKind {
    if (u.isVillager) return "villager";
    if (u.isPriest) return "priest";
    const c = u.def.class;
    return c === "siege" ? "siege" : ["cavalry", "chariot", "horse_archer", "elephant", "camel"].includes(c) ? "rider" : "soldier";
  }

  /** The picked unit answers, or the picked building makes its sound. */
  private selectSound(ack: boolean) {
    const first = this.selectedEntities().find((x) => x.owner === this.me);
    if (!first) return;
    if (first instanceof Unit) {
      let h = 0;
      for (const ch of first.typeId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      this.sound.voice(this.voiceOf(first), h, ack);
    } else if (first instanceof Building && !ack) {
      const base = Object.keys(BUILDING_SOUND).find((k) => first.def.id === k || first.def.id.startsWith(k));
      this.sound.play(first.complete ? (base ? BUILDING_SOUND[base] : "click") : "hammer", 0.6, 0, 0.2);
    }
  }

  private handleEvents() {
    const w = this.world;
    if (this.started && !this.watching && !this.ended && w.winner === null && w.players[this.me].defeated) this.gameOver(-1);
    for (const e of w.events) {
      switch (e.kind) {
        case "hit":
          if (e.building) this.sfx("knock", e.at, e.melee ? 0.8 : 0.5);
          else if (e.melee) this.sfx("sword", e.at, 0.8, 0.09);
          else this.sfx("thud", e.at, 0.7);
          break;
        case "projectile": {
          if (!this.visible(e.from.tile) && !this.visible(e.to.tile)) break;
          this.sfx(e.projectile === "stone" ? "club" : e.projectile === "spear" ? "spear" : "bow", e.from, 0.7, 0.08);
          const a = iso(e.from), b = iso(e.to);
          const kind = (["arrow", "stone", "bolt", "spear", "fire"].includes(e.projectile) ? e.projectile : "arrow") as "arrow" | "stone" | "bolt" | "spear" | "fire";
          const pic = projectilePic(kind);
          const arrow = new Sprite(pic.texture);
          arrow.width = pic.w; arrow.height = pic.h;
          arrow.anchor.set(pic.ax, pic.ay);
          arrow.zIndex = 0;
          this.effects.addChild(arrow);
          const arc = kind === "stone" ? 40 : 14;
          let t = 0;
          const tick = (dt: { deltaMS: number }) => {
            t += dt.deltaMS / 1000;
            const k = Math.min(1, t / e.flight);
            const x = a.x + (b.x - a.x) * k, y = a.y - 18 + (b.y - a.y + 4) * k - Math.sin(k * Math.PI) * arc;
            // Point along the flight: rising, then falling.
            const vy = (b.y - a.y + 4) / e.flight - Math.cos(k * Math.PI) * Math.PI * arc / e.flight;
            arrow.rotation = kind === "stone" ? t * 8 : Math.atan2(vy, (b.x - a.x) / e.flight);
            arrow.position.set(x, y);
            if (k >= 1) { this.app.ticker.remove(tick); arrow.destroy(); }
          };
          this.app.ticker.add(tick);
          break;
        }
        case "died": {
          const v = this.views.get(e.id);
          if (v && e.wasBuilding && e.owner !== this.me && this.seen.has(e.id) && !this.anyVisible(this.footprintTiles(v))) {
            // Destroyed where the player cannot see: they find out when they look.
            this.ghosts.set(e.id, { view: v, tiles: this.footprintTiles(v) });
            v.bar.visible = false;
            v.ring.visible = false;
            this.views.delete(e.id);
            this.seen.delete(e.id);
            break;
          }
          this.seen.delete(e.id);
          if (e.wasBuilding) { if (v && this.anyVisible(v.tiles)) this.sfx("collapse", e.at, 1, 0.3); }
          else if (v?.isUnit && v.root.visible) this.sfx(e.owner >= 0 ? "die" : "thud", e.at, 0.8, 0.15);
          if (v) {
            if (v.isUnit && v.root.visible) this.corpse(v);
            if (e.wasBuilding && this.explored(e.at.tile)) this.rubble(v);
            v.root.destroy({ children: true });
            this.views.delete(e.id);
          }
          this.selection = this.selection.filter((id) => id !== e.id);
          if (e.wasBuilding && this.explored(e.at.tile)) this.puff(e.at, true);
          else if (e.owner >= 0 && this.visible(e.at.tile)) this.puff(e.at, false);
          break;
        }
        case "message":
          if (e.player === this.me || e.player === -1) this.hud.message(e.text);
          break;
        case "underAttack":
          if (e.player === this.me && !this.onScreen(e.at)) { this.hud.message("You are under attack!", "warn"); this.sound.play("alarm", 1, 0, 8); }
          break;
        case "ageReached":
          if (e.player !== this.me) { this.hud.message(`The enemy reached the ${this.rules.ages[e.age].name}`, "warn"); this.sound.play("researched", 0.7); }
          else this.sound.play("ageUp");
          break;
        case "completed": {
          const b = e.owner === this.me ? w.building(e.id) : null;
          if (b) { this.hud.message(`${b.name} complete`); this.sound.play("complete", 0.8, 0, 0.3); }
          break;
        }
        case "trained":
          if (e.owner === this.me) this.sound.play("trained", 0.6, 0, 0.6);
          break;
        case "researched":
          if (e.player === this.me) this.sound.play("researched", 0.7, 0, 0.5);
          break;
        case "gameOver":
          this.gameOver(e.winner, e.how);
          break;
        case "splash":
          if (this.visible(e.at.tile)) this.puff(e.at, e.radius > 1);
          this.sfx("boom", e.at, 0.9, 0.12);
          break;
        case "converted": {
          this.sfx("heal", e.at, 1, 0.5);
          // Redraw in the new owner's colours.
          const v = this.views.get(e.id);
          if (v) { v.root.destroy({ children: true }); this.views.delete(e.id); }
          if (e.from === this.me) this.selection = this.selection.filter((id) => id !== e.id);
          break;
        }
      }
    }
    w.events.length = 0;
  }

  /** The fallen unit lies on the ground and fades away over three seconds. */
  private corpse(v: View) {
    const c = new Sprite(v.sprite.texture);
    c.anchor.set(0.5, 0.75);
    c.width = v.pic.w;
    c.height = v.pic.h;
    c.scale.x *= Math.sign(v.sprite.scale.x) || 1;
    c.rotation = (Math.PI / 2) * (Math.sign(v.sprite.scale.x) || 1);
    c.tint = 0x9a8a7a;
    c.position.set(v.root.x, v.root.y - 4);
    c.zIndex = v.root.zIndex - 0.2;
    this.entities.addChild(c);
    let t = 0;
    const tick = (dt: { deltaMS: number }) => {
      t += dt.deltaMS / 1000;
      c.alpha = Math.max(0, 1 - t / 3);
      if (t >= 3) { this.app.ticker.remove(tick); c.destroy(); }
    };
    this.app.ticker.add(tick);
  }

  /** How a unit looks this frame: facing, pose, animation frame, the tool in hand, what it carries. */
  private unitLook(u: Unit, alpha: number): UnitLook {
    const time = this.world.time + alpha * World.dt;
    const facing: Facing = u.facing.x + u.facing.y < -0.2 ? "back" : "front"; // heading up the screen
    const moving = u.prevPos.distance(u.pos) > 0.001;
    const pose: Pose = u.busy ? "work" : moving ? "walk" : "idle";
    const frame = pose === "walk" ? Math.floor(time * 8 + u.id) % 4 : pose === "work" ? Math.floor(time * 5 + u.id) % 3 : 0;
    let tool: Tool = "none";
    if (u.isVillager) {
      const o = u.order;
      const node = u.lastNodeType ?? "";
      if (o.kind === "build" || o.kind === "repair") tool = "hammer";
      else if (o.kind === "attack") tool = "spear"; // hunting
      else if (o.kind === "gather" || o.kind === "return") {
        if (node === "farm") tool = "hoe";
        else if (node === "fish") tool = "net";
        else if (node.startsWith("carcass_")) tool = "spear";
        else tool = u.lastGather === Res.wood ? "axe" : u.lastGather === Res.food ? "basket" : u.lastGather === null ? "none" : "pick";
      }
    }
    const carry = u.isVillager && u.carry >= 1 && u.carryRes !== null && pose !== "work" ? u.carryRes : null;
    return { type: u.def.id, owner: u.owner, facing, pose, frame, tool, carry, dir: screenDirection(u.facing.x, u.facing.y), t: time + u.id * 0.37, civ: this.civId(u.owner) };
  }

  private puff(at: Vec2, big: boolean) {
    const p = iso(at);
    const g = new Graphics().circle(0, 0, big ? 26 : 9).fill({ color: 0x8c7a66, alpha: 0.7 });
    g.position.set(p.x, p.y);
    this.effects.addChild(g);
    let t = 0;
    const tick = (dt: { deltaMS: number }) => {
      t += dt.deltaMS / 1000;
      g.scale.set(1 + t * 1.4);
      g.alpha = Math.max(0, 1 - t / 0.6);
      if (t >= 0.6) { this.app.ticker.remove(tick); g.destroy(); }
    };
    this.app.ticker.add(tick);
  }

  // ---- drawing entities

  private visible(t: Tile) { return this.revealMap || this.world.fog[this.me].isVisible(t); }
  private explored(t: Tile) { return this.revealMap || this.world.fog[this.me].isExplored(t); }

  private anyVisible(tiles: Tile[]) { return tiles.some((t) => this.visible(t)); }

  private footprintTiles(v: View): Tile[] { return v.tiles; }

  private onScreen(p: Vec2) {
    const s = iso(p);
    return Math.abs(s.x - this.cam.x) < (this.app.screen.width / 2) * this.cam.zoom &&
      Math.abs(s.y - this.cam.y) < (this.app.screen.height / 2) * this.cam.zoom;
  }

  private makeView(e: Entity): View {
    let pic: Pic, ring: Graphics, barY: number, barW: number;
    const own = e.owner === this.me;
    const ringColor = own ? 0xffffff : e.owner >= 0 ? playerColor(e.owner) : 0xffee55;
    if (e instanceof Unit) {
      pic = unitPic(this.unitLook(e, 0));
      // A flat diamond on the ground under the unit, as the original marks what you picked.
      const big = pic.w > 48, rw = big ? 20 : 12, rh = rw / 2;
      ring = new Graphics().poly([-rw, 0, 0, -rh, rw, 0, 0, rh]).stroke({ width: 1.5, color: ringColor });
      barY = -pic.h * pic.ay - 6; barW = 26;
    } else if (e instanceof Building) {
      pic = this.buildingLook(e);
      const s = e.def.size, w = s * HALF_W, h = s * HALF_H;
      ring = new Graphics().poly([0, 0, w, -h, 0, -2 * h, -w, -h]).stroke({ width: 2, color: ringColor });
      barY = -pic.h + 34; barW = s * 22;
    } else {
      const r = e as ResourceNode;
      pic = nodePic(r.def.id, this.world.map.shade[this.world.map.index(r.tile)]);
      ring = new Graphics().ellipse(0, 0, 15, 7.5).stroke({ width: 1.5, color: ringColor });
      barY = -pic.h; barW = 0;
    }
    const root = new Container();
    const sprite = new Sprite(pic.texture);
    sprite.width = pic.w;
    sprite.height = pic.h;
    sprite.anchor.set(pic.ax, pic.ay);
    const bar = new Graphics();
    bar.position.set(-barW / 2, barY);
    ring.visible = false;
    bar.visible = false;
    root.addChild(ring, sprite, bar);
    this.entities.addChild(root);
    const v: View = { root, sprite, ring, bar, pic, isUnit: e instanceof Unit, key: "", barW, tiles: e instanceof Building ? e.footprint.tiles() : [], workFrame: -1,
      farm: e instanceof Building && e.isFarm };
    this.views.set(e.id, v);
    return v;
  }

  private setPic(v: View, pic: Pic) {
    if (v.pic === pic) return;
    v.pic = pic;
    v.sprite.texture = pic.texture;
    const flip = Math.sign(v.sprite.scale.x) || 1;
    v.sprite.width = pic.w;
    v.sprite.height = pic.h;
    v.sprite.scale.x = Math.abs(v.sprite.scale.x) * flip;
    v.sprite.anchor.set(pic.ax, pic.ay);
  }

  private civId(owner: number): string | undefined {
    return owner >= 0 ? this.world.players[owner]?.civ?.id : undefined;
  }

  private arch(owner: number): Arch {
    const a = owner >= 0 ? this.world.players[owner].civ?.arch : undefined;
    return (["egyptian", "greek", "babylonian", "asian", "roman"].includes(a ?? "") ? a : "greek") as Arch;
  }

  private buildingLook(b: Building): Pic {
    const stage = b.complete ? 3 : b.progress < 0.3 ? 0 : b.progress < 0.7 ? 1 : 2;
    const tier = WALL_TIER[b.def.id];
    if (tier !== undefined) {
      // Walls join their neighbours: bits for a wall of the same owner at x-1, x+1, y-1, y+1.
      const t = b.footprint.origin;
      const isWall = (x: number, y: number) => {
        const o = this.world.building(this.world.map.occupantAt(new Tile(x, y)));
        return !!o && o.isWall && o.owner === b.owner;
      };
      const mask = (isWall(t.x - 1, t.y) ? 1 : 0) | (isWall(t.x + 1, t.y) ? 2 : 0) | (isWall(t.x, t.y - 1) ? 4 : 0) | (isWall(t.x, t.y + 1) ? 8 : 0);
      return wallPic(tier, b.owner, mask, stage);
    }
    const farmLeft = b.isFarm ? b.food / Math.max(1, this.world.players[b.owner]?.mods.farmFood(b.def.resource?.food ?? 1) ?? 1) : 1;
    return buildingPic(b.def, b.owner, b.owner >= 0 ? this.world.players[b.owner].age : 0, stage, farmLeft, this.arch(b.owner), this.civId(b.owner));
  }

  private place(v: View, e: Entity, alpha: number) {
    if (e instanceof Unit) {
      const p = e.prevPos.lerp(e.pos, alpha);
      const s = iso(p);
      v.root.position.set(Math.round(s.x / 2) * 2, Math.round(s.y / 2) * 2);
      v.root.zIndex = depth(p) + 0.3;
      const look = this.unitLook(e, alpha);
      this.setPic(v, unitPic(look));
      // Each swing of a villager's tool makes its sound, as the axe, pick or hoe comes down.
      const wf = look.pose === "work" ? look.frame : -1;
      if (wf === 0 && v.workFrame > 0 && !this.paused) {
        const s = TOOL_SOUND[look.tool];
        if (s) this.sfx(s, p, 0.55, 0.05);
      }
      v.workFrame = wf;
      // A sprite sheet has its own directions and says which are mirrored; drawn units face left or right.
      const dx = e.facing.x - e.facing.y;
      if (v.pic.asset) v.sprite.scale.x = Math.abs(v.sprite.scale.x) * (v.pic.flip ? -1 : 1);
      else if (Math.abs(dx) > 0.2) v.sprite.scale.x = Math.abs(v.sprite.scale.x) * (dx < 0 ? -1 : 1);
    } else if (e instanceof Building) {
      const fp = e.footprint;
      const s = iso(new Vec2(fp.maxX, fp.maxY));
      v.root.position.set(s.x, s.y);
      v.root.zIndex = depth(fp.center);
      this.setPic(v, this.buildingLook(e));
      this.burn(v, e, alpha);
    } else if (e instanceof ResourceNode) {
      const s = iso(e.center);
      v.root.position.set(s.x, s.y);
      v.root.zIndex = depth(e.center);
    }
  }

  /** Where the flames of a damaged building sit, as shares of its picture: across, and up from the ground. */
  private static readonly FLAMES: [number, number][] = [[0.05, 0.62], [-0.22, 0.45], [0.26, 0.4]];

  /** A damaged building burns, as in the original: one flame below 3/4 of its hit points, two below
   *  half, three below a quarter. Repairs put them out. */
  private burn(v: View, b: Building, alpha: number) {
    const f = b.hp / b.maxHp;
    const n = !b.complete || v.farm ? 0 : f < 0.25 ? 3 : f < 0.5 ? 2 : f < 0.75 ? 1 : 0;
    if (!n && !v.fire) return;
    if (!v.fire) { v.fire = new Container(); v.root.addChild(v.fire); }
    while (v.fire.children.length > n) v.fire.children[v.fire.children.length - 1].destroy();
    while (v.fire.children.length < n) {
      const [fx, fy] = Game.FLAMES[v.fire.children.length];
      const s = new Sprite(firePic(0).texture);
      s.anchor.set(0.5, 1);
      s.position.set(Math.round(fx * v.pic.w), -Math.round(fy * v.pic.h * v.pic.ay));
      v.fire.addChild(s);
    }
    const time = this.world.time + alpha * World.dt;
    v.fire.children.forEach((c, i) => {
      const p = firePic(Math.floor(time * 7 + i * 1.7 + b.id));
      const s = c as Sprite;
      s.texture = p.texture; s.width = p.w; s.height = p.h;
    });
  }

  /** Stones and charred beams where a building fell, fading after a minute. */
  private rubble(v: View) {
    if (v.farm || !v.tiles.length) return;
    const size = Math.round(Math.sqrt(v.tiles.length));
    const p = rubblePic(size, v.tiles[0].x * 7 + v.tiles[0].y);
    const r = new Sprite(p.texture);
    r.anchor.set(p.ax, p.ay);
    r.width = p.w; r.height = p.h;
    r.position.set(v.root.x, v.root.y);
    r.zIndex = v.root.zIndex - 1000; // under everything that walks over it
    this.entities.addChild(r);
    let t = 0;
    const tick = (dt: { deltaMS: number }) => {
      t += dt.deltaMS / 1000;
      if (t > 50) r.alpha = Math.max(0, 1 - (t - 50) / 10);
      if (t >= 60) { this.app.ticker.remove(tick); r.destroy(); }
    };
    this.app.ticker.add(tick);
  }

  private sync(alpha: number) {
    const selected = new Set(this.selection);
    const show = (e: Entity, vis: boolean, frozen = false) => {
      let v = this.views.get(e.id);
      if (!vis) { if (v) v.root.visible = false; return; }
      if (!v) v = this.makeView(e);
      v.root.visible = true;
      if (!frozen) this.place(v, e, alpha);
      const sel = selected.has(e.id);
      v.ring.visible = sel;
      const bw = v.barW;
      v.bar.visible = sel && bw > 0 && !frozen;
      if (v.bar.visible) {
        const f = Math.max(0, e.hp / e.maxHp);
        v.bar.clear().rect(0, 0, bw, 4).fill(0x000000).rect(0, 0, bw * f, 4).fill(f > 0.5 ? 0x33cc33 : f > 0.25 ? 0xdddd33 : 0xdd3333);
      }
    };
    const w = this.world;
    // Passengers are inside their transport, off the map.
    for (const u of w.units) show(u, u.aboard === null && (u.owner === this.me || this.visible(u.pos.tile)));
    for (const b of w.buildings) {
      if (b.owner === this.me || this.revealMap) { show(b, true); continue; }
      const now = this.anyVisible(b.footprint.tiles());
      if (now) this.seen.add(b.id);
      show(b, now || this.seen.has(b.id), !now);
    }
    for (const [id, g] of this.ghosts) {
      if (this.anyVisible(g.tiles)) { g.view.root.destroy({ children: true }); this.ghosts.delete(id); }
    }
    for (const n of w.nodes) show(n, this.explored(n.tile));
  }

  // ---- fog and minimap

  private updateFog() {
    const f = this.world.fog[this.me];
    const n = f.width, m = n + 2;
    const c = this.fogCanvas.getContext("2d")!;
    const img = c.createImageData(m, m);
    img.data.fill(255);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        img.data[((y + 1) * m + x + 1) * 4 + 3] = this.revealMap ? 0 : f.visible[i] ? 0 : f.explored[i] ? 110 : 255;
      }
    }
    for (let i = 0; i < m * m; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 0; }
    c.putImageData(img, 0, 0);
    this.fogSprite.texture.source.update();
  }

  private updateMinimap() {
    const w = this.world, map = w.map, n = map.width, f = w.fog[this.me];
    const bc = this.miniBase.getContext("2d")!;
    const img = bc.createImageData(n, n);
    const put = (x: number, y: number, c: [number, number, number]) => {
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      const i = (y * n + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    };
    const hex = (h: string): [number, number, number] => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (!this.revealMap && !f.explored[i]) { put(x, y, [0, 0, 0]); continue; }
        let c: [number, number, number];
        switch (map.terrain[i] as Terrain) {
          case Terrain.grass: c = [78, 120, 52]; break;
          case Terrain.dirt: c = [130, 106, 66]; break;
          case Terrain.sand: c = [196, 176, 118]; break;
          default: c = [42, 88, 156];
        }
        if (!this.revealMap && !f.visible[i]) c = [c[0] / 2 + 10, c[1] / 2 + 10, c[2] / 2 + 10];
        put(x, y, c);
      }
    }
    const nodeColor: Record<Res, [number, number, number]> = { [Res.wood]: [28, 70, 30], [Res.food]: [200, 60, 80], [Res.gold]: [240, 200, 60], [Res.stone]: [170, 170, 175] };
    for (const r of w.nodes) if (this.explored(r.tile)) put(r.tile.x, r.tile.y, nodeColor[r.res]);
    for (const b of w.buildings) {
      if (b.owner !== this.me && !this.explored(b.footprint.origin)) continue;
      for (const t of b.footprint.tiles()) put(t.x, t.y, hex(playerColor(b.owner)));
    }
    for (const u of w.units) {
      if (u.aboard !== null || (u.owner !== this.me && !this.visible(u.pos.tile))) continue;
      const t = u.pos.tile;
      put(t.x, t.y, hex(playerColor(u.owner)));
      put(t.x + 1, t.y, hex(playerColor(u.owner)));
    }
    bc.putImageData(img, 0, 0);

    const mm = this.hud.minimap, c = mm.getContext("2d")!;
    const k = this.miniScale();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, mm.width, mm.height);
    c.imageSmoothingEnabled = false;
    c.setTransform(k * HALF_W, k * HALF_H, -k * HALF_W, k * HALF_H, mm.width / 2, (mm.height - n * 2 * HALF_H * k) / 2);
    c.drawImage(this.miniBase, 0, 0);
    // The camera's view.
    const sw = this.app.screen.width, sh = this.app.screen.height;
    const corners = [[0, 0], [sw, 0], [sw, sh], [0, sh]].map(([x, y]) => this.toWorld(x, y));
    c.strokeStyle = "white";
    c.lineWidth = 1 / (k * HALF_H);
    c.beginPath();
    corners.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.stroke();
  }

  private miniScale() {
    const mm = this.hud.minimap, n = this.world.map.width;
    return Math.min(mm.width / (n * 2 * HALF_W), mm.height / (n * 2 * HALF_H));
  }

  /** Minimap pixel to tile coordinates, or null outside the map. */
  private minimapToWorld(ev: MouseEvent): Vec2 | null {
    const mm = this.hud.minimap, rect = mm.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * mm.width;
    const py = ((ev.clientY - rect.top) / rect.height) * mm.height;
    const n = this.world.map.width, k = this.miniScale();
    const sx = (px - mm.width / 2) / k, sy = (py - (mm.height - n * 2 * HALF_H * k) / 2) / k;
    const p = fromIso(sx, sy);
    return p.x >= 0 && p.y >= 0 && p.x <= n && p.y <= n ? p : null;
  }

  // ---- commands

  selectedEntities() {
    // Units that went aboard a transport drop out of the selection.
    return this.selection.map((id) => this.world.entity(id)).filter((e): e is Entity => e !== null && !(e instanceof Unit && e.aboard !== null));
  }

  /** Which menu the villager panel shows: its actions, or the build menu (opened with B). */
  private menu: "main" | "build" = "main";
  private menuFor = "";

  private commands(sel: Entity[]): Command[] {
    const w = this.world, me = this.me;
    const mine = sel.filter((e) => e.owner === me);
    if (!mine.length || w.winner !== null || this.watching) return [];
    // A new selection starts at its main menu, as in the original.
    const selKey = mine.map((e) => e.id).join(",");
    if (selKey !== this.menuFor) { this.menuFor = selKey; this.menu = "main"; }
    const del: Command = { key: "Delete", title: "Delete", detail: "Del", blocker: null, icon: "delete", pin: true,
      action: () => { for (const id of this.selection) w.destroy(me, id); } };
    const units = mine.filter((e): e is Unit => e instanceof Unit);
    if (units.some((u) => u.isVillager)) {
      if (this.menu === "main") {
        return [
          { key: "B", title: "Build", detail: "open the build menu", blocker: null, icon: "build", action: () => { this.menu = "build"; } },
          { key: "R", title: "Repair", detail: "click a damaged building; costs resources", blocker: null, icon: "repair",
            action: () => { this.repairPending = true; this.hud.message("Click a damaged building to repair"); } },
          { key: "S", title: "Stop", detail: "", blocker: null, icon: "stop", action: () => w.stop(me, this.selection) },
          del,
        ];
      }      const out: Command[] = [];
      for (const base of Object.keys(BUILD_KEYS)) {
        const id = w.current(me, base);
        const def = this.rules.buildings.get(id);
        if (!def || !w.buildingShown(id, me)) continue;
        // As in the original, a building appears in the menu once your age allows it.
        if (this.rules.ages.findIndex((a) => a.id === def.age) > w.players[me].age) continue;
        out.push({ key: BUILD_KEYS[base], title: def.name, detail: w.buildingCost(me, id).text + (WALL_TIER[id] !== undefined ? " a tile, drag a line" : ` · ${duration(w.buildingStats(me, id).build_time)} for one villager`),
          blocker: w.blockerBuilding(id, me), icon: id, action: () => { this.beginPlacing(id); this.menu = "main"; } });
      }
      out.push({ key: "Escape", title: "Back", detail: "", blocker: null, icon: "back", pin: true, action: () => { this.menu = "main"; } });
      return out;
    }
    if (units.length) {
      const out: Command[] = [
        { key: "S", title: "Stop", detail: "", blocker: null, icon: "stop", action: () => w.stop(me, this.selection) },
      ];
      const soldiers = units.filter((u) => u.isSoldier);
      // Attack-move is for those who fight (and priests, who go along); boats that fish or carry have no use for it.
      if (soldiers.length || units.some((u) => u.isPriest)) {
        out.push({ key: "A", title: "Attack-move", detail: "click a point", blocker: null, icon: "attack_move", action: () => { this.attackMovePending = true; this.hud.message("Click where to attack-move"); } });
      }
      if (soldiers.length) {
        const on = soldiers.every((u) => u.standGround);
        out.push({ key: "D", title: on ? "Stand ground: on" : "Stand ground", detail: on ? "press again to let them chase" : "hold this spot, strike only what comes in reach",
          blocker: null, icon: "stand_ground", action: () => { w.setStandGround(me, this.selection, !on); this.hud.message(on ? "Units will chase enemies again" : "Standing ground"); } });
      }
      const loaded = units.filter((u) => u.isTransport && u.cargo.length);
      if (loaded.length) {
        out.push({ key: "U", title: "Unload", detail: "put everyone ashore at the nearest landing (or right-click the land)", blocker: null, icon: "unload",
          action: () => { for (const t of loaded) w.unload(me, [t.id], t.pos); } });
      }
      if (units.some((u) => w.canAttackGround(u))) {
        out.push({ key: "T", title: "Attack ground", detail: "click a spot to bombard", blocker: null, icon: "attack_ground",
          action: () => { this.groundPending = true; this.hud.message("Click the ground to bombard"); } });
      }
      if (units.some((u) => u.isPriest) && w.players[me].mods.flags.has("martyrdom")) {
        out.push({ key: "Q", title: "Sacrifice", detail: "Martyrdom: a priest dies to convert an enemy at once (not priests)", blocker: null, icon: "temple",
          action: () => { this.sacrificePending = true; this.hud.message("Click an enemy to convert at the cost of a priest"); } });
      }
      if (units.some((u) => u.isPriest)) out.push({ key: "V", title: "Convert", detail: "right-click an enemy", blocker: null, icon: "temple", action: () => this.hud.message("Right-click an enemy to convert it, or a hurt unit of yours to heal it") });
      out.push(del);
      return out;
    }
    const b = mine[0];
    if (mine.length !== 1 || !(b instanceof Building)) return [];
    if (!b.complete) return [del];
    const out: Command[] = [];
    const used = new Set<string>(["H", "P"]);
    const spare = () => { const k = [...SPARE_KEYS].find((x) => !used.has(x)) ?? ""; used.add(k); return k; };
    for (const t of b.def.trains ?? []) {
      const def = this.rules.units.get(t);
      if (!def || !w.unitShown(t, me)) continue;
      let key = TRAIN_KEYS[t] ?? "";
      if (!key || used.has(key)) key = spare();
      used.add(key);
      out.push({ key, title: def.name, detail: `${w.unitCost(me, t).text} · ${duration(w.unitStats(me, t).train_time)}`, blocker: w.blockerUnit(t, me), icon: t, action: () => {
        const why = w.train(me, b.id, t);
        if (why) this.hud.message(why, "warn");
      } });
    }
    const p = w.players[me];
    if (b.def.id === "town_center" && p.age + 1 < this.rules.ages.length) {
      const next = this.rules.ages[p.age + 1];
      used.add("A");
      out.push({ key: "A", title: `Advance to the ${next.name}`, detail: `${ResBag.of(next.cost).text} · ${duration(next.research_time ?? 60)}`, blocker: w.blockerForNextAge(me), icon: "age", row: 1, action: () => {
        const why = w.advanceAge(me, b.id);
        if (why) this.hud.message(why, "warn");
      } });
    }
    for (const t of w.techsAt(b, me)) {
      out.push({ key: spare(), title: t.name, detail: `${ResBag.of(t.cost).text} · ${duration(t.time ?? 30)}`, blocker: w.blockerTech(t.id, me), icon: t.id, help: describe(t, this.rules), row: 1, action: () => {
        const why = w.research(me, b.id, t.id);
        if (why) this.hud.message(why, "warn");
      } });
    }
    if (b.queue.length) out.push({ key: "Escape", title: "Cancel", detail: "the last in the queue", blocker: null, icon: "back", pin: true, action: () => w.cancel(me, b.id) });
    out.push(del);
    return out;
  }


  private selectTownCenter() {
    const tc = this.world.buildingsOf(this.me).find((b) => b.def.id === "town_center");
    if (tc) { this.selection = [tc.id]; this.centerOn(tc.center); }
  }

  private beginPlacing(type: string) {
    const why = this.world.blockerBuilding(type, this.me);
    if (why) { this.hud.message(why, "warn"); return; }
    this.cancelPlacing();
    this.placing = type;
    const tier = WALL_TIER[type];
    const pic = tier !== undefined ? wallPic(tier, this.me, 0, 3)
      : buildingPic(this.rules.buildings.get(type)!, this.me, this.world.players[this.me].age, 3, 1, this.arch(this.me), this.civId(this.me));
    const g = new Sprite(pic.texture);
    g.width = pic.w; g.height = pic.h;
    g.anchor.set(pic.ax, pic.ay);
    g.alpha = 0.6;
    g.zIndex = 100000;
    this.entities.addChild(g);
    this.ghost = g;
  }

  private cancelPlacing() {
    this.placing = null;
    this.ghost?.destroy();
    this.ghost = null;
    this.wallStart = null;
    this.clearWallGhosts();
  }

  private clearWallGhosts() {
    for (const g of this.wallGhosts) g.destroy();
    this.wallGhosts = [];
  }

  private placementOrigin(type: string, sx: number, sy: number) {
    const size = this.rules.buildings.get(type)!.size;
    const w = this.toWorld(sx, sy);
    return new Vec2(w.x - size / 2 + 0.5, w.y - size / 2 + 0.5).tile;
  }

  private updateGhost() {
    if (!this.placing || !this.ghost) return;
    const o = this.placementOrigin(this.placing, this.mouse.x, this.mouse.y);
    const tier = WALL_TIER[this.placing];
    if (tier !== undefined && this.wallStart) {
      // A dragged wall: one ghost per tile along the line.
      this.ghost.visible = false;
      this.clearWallGhosts();
      const tiles = this.world.wallTiles(this.wallStart, o);
      const has = (x: number, y: number) => tiles.some((t) => t.x === x && t.y === y);
      for (const t of tiles) {
        const mask = (has(t.x - 1, t.y) ? 1 : 0) | (has(t.x + 1, t.y) ? 2 : 0) | (has(t.x, t.y - 1) ? 4 : 0) | (has(t.x, t.y + 1) ? 8 : 0);
        const pic = wallPic(tier, this.me, mask, 3);
        const g = new Sprite(pic.texture);
        g.width = pic.w; g.height = pic.h;
        g.anchor.set(pic.ax, pic.ay);
        g.alpha = 0.6;
        const sp = iso(new Vec2(t.x + 1, t.y + 1));
        g.position.set(sp.x, sp.y);
        g.zIndex = 100000 + t.x + t.y;
        g.tint = this.world.canPlace(this.placing, t, this.me) ? 0xbbffbb : 0xff5555;
        this.entities.addChild(g);
        this.wallGhosts.push(g);
      }
      return;
    }
    this.ghost.visible = true;
    const size = this.rules.buildings.get(this.placing)!.size;
    const s = iso(new Vec2(o.x + size, o.y + size));
    this.ghost.position.set(s.x, s.y);
    this.ghost.tint = this.world.canPlace(this.placing, o, this.me) ? 0xbbffbb : 0xff5555;
  }

  // ---- picking

  /** The entity drawn under a screen point. Units win over what is behind them. */
  /** Pixels of each sprite canvas, read once, for hit tests on what is actually drawn. */
  private pixels = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();

  /** Whether the sprite has a visible pixel at scene point (x, y). */
  private opaqueAt(v: View, x: number, y: number) {
    const pic = v.pic;
    const x0 = v.root.x - pic.ax * pic.w, y0 = v.root.y + v.sprite.y - pic.ay * pic.h;
    let u = (x - x0) / pic.w, t = (y - y0) / pic.h;
    if (u < 0 || u >= 1 || t < 0 || t >= 1) return false;
    if (v.sprite.scale.x < 0) u = 1 - u; // mirrored units
    const c = pic.canvas;
    let data = this.pixels.get(c);
    if (!data) { data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data; this.pixels.set(c, data); }
    const px = Math.floor(u * c.width), py = Math.floor(t * c.height);
    // A pixel of slack around small sprites, so a thin spear or a little unit is still easy to click.
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const qx = px + dx, qy = py + dy;
      if (qx < 0 || qy < 0 || qx >= c.width || qy >= c.height) continue;
      if (data[(qy * c.width + qx) * 4 + 3] > 40) return true;
    }
    return false;
  }

  /** The entity under a screen point: whatever is drawn on top there. Units win over what is behind
   *  them; a building or foundation also counts when you click its own ground, so a flat foundation
   *  next to a tall Town Center can always be clicked. */
  private pick(sx: number, sy: number): Entity | null {
    const p = this.toScene(sx, sy);
    const wp = fromIso(p.x, p.y);
    let best: Entity | null = null, bestScore = -Infinity;
    for (const [id, v] of this.views) {
      if (!v.root.visible) continue;
      const e = this.world.entity(id);
      if (!e) continue;
      const drawn = this.opaqueAt(v, p.x, p.y);
      const ground = e instanceof Building && e.footprint.distance(wp) === 0;
      if (!drawn && !ground) continue;
      // Drawn pixels beat bare ground; among those, the one drawn in front wins.
      const score = v.root.zIndex + (e instanceof Unit ? 1000 : 0) + (drawn ? 500 : 0);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }


  // ---- input

  private bindInput() {
    const canvas = this.app.canvas;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    // The start screen describes the chosen civilization as you pick it.
    document.addEventListener("change", (e) => {
      const t = e.target as HTMLSelectElement;
      if (t.id === "opponents") {
        const note = document.querySelector("#players-info");
        if (note) note.textContent = this.playersNote(Number(t.value) || 1);
        return;
      }
      if (t.id !== "civ") return;
      const info = document.querySelector("#civ-info");
      const c = this.rules.civs.find((x) => x.id === t.value);
      if (info) info.textContent = c ? `${c.name}: ${describeCiv(c, this.rules).join("; ")}` : "A civilization picked at random. Its bonuses show at the top of the screen.";
    });
    // Browsers start sound only after the first click or key.
    window.addEventListener("pointerdown", () => this.sound.unlock(), { capture: true });
    window.addEventListener("keydown", () => this.sound.unlock(), { capture: true });
    document.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("button, #speed")) this.sound.play("click", 0.7, 0, 0.03);
      if (t.closest("#sfx-btn")) { const on = this.sound.toggleSfx(); this.soundButtons(); this.hud.message(on ? "Sound on" : "Sound off"); return; }
      if (t.closest("#music-btn")) { const on = this.sound.toggleMusic(); if (on && this.started) this.sound.startMusic(); this.soundButtons(); this.hud.message(on ? "Music on" : "Music off"); return; }
      if (t.closest("#lock-btn")) {
        const on = this.lock.toggle();
        this.screenButtons();
        this.hud.message(on ? "Mouse lock on: click the map to keep the mouse in the game. Alt+Tab or Esc lets go." : "Mouse lock off");
        return;
      }
      if (t.closest("#reseed-btn")) {
        this.reseed = !this.reseed;
        store.set("bd-reseed", this.reseed ? "on" : "off");
        this.applyReseed();
        document.querySelector("#reseed-btn")?.classList.toggle("off", !this.reseed);
        this.hud.message(this.reseed ? "Spent farms are sown again for a farm's price in wood, while there is the wood" : "Spent farms are gone, as in the original: build new ones");
        return;
      }
      if (t.closest("#fs-btn")) { this.toggleFullscreen(); return; }
      if (t.closest("#timeline-btn")) { this.showTimeline(); return; }
      const tab = t.closest("[data-tab]") as HTMLElement | null;
      if (tab) {
        document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b === tab));
        document.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
        if (tab.dataset.tab === "timeline") this.paintTimeline();
        return;
      }
      if (t.closest("#speed")) { this.setSpeed(0, (this.speeds.indexOf(this.speed) + 1) % this.speeds.length); return; }
      // Menu, Diplomacy and ? open their screens and pause, as the original's did.
      if (this.started) {
        const open = (show: () => void) => {
          if (this.hud.overlayShown) { this.hud.hideOverlay(); this.paused = false; } else { show(); this.paused = true; }
        };
        if (t.closest("#menu-btn")) { open(() => this.showMenu()); return; }
        if (t.closest("#help-btn")) { open(() => this.showHelp()); return; }
        if (t.closest("#diplomacy-btn")) { open(() => this.showDiplomacy()); return; }
        if (t.closest("#score-btn")) { this.scoresToggled(); return; }
        if (t.closest("#resume-btn")) { this.hud.hideOverlay(); this.paused = false; return; }
        if (t.closest("#help-open")) { this.showHelp(); return; }
        if (t.closest("#credits-btn")) { this.showCredits(); return; }
      }
      const s = t.closest("[data-start]") as HTMLElement | null;
      if (s) this.start(s.dataset.start as Difficulty);
      if (t.closest("[data-restart]")) this.restart();
    });
    window.addEventListener("mousemove", (e) => {
      this.mouse = { x: e.clientX, y: e.clientY, inside: true };
      if (this.dragStart) {
        const a = this.dragStart;
        const r = { x: Math.min(a.x, e.clientX), y: Math.min(a.y, e.clientY), w: Math.abs(a.x - e.clientX), h: Math.abs(a.y - e.clientY) };
        Object.assign(this.dragBox.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
        this.dragBox.hidden = r.w < 4 && r.h < 4;
      }
    });
    document.addEventListener("mouseleave", () => { this.mouse.inside = false; });
    canvas.addEventListener("mousedown", (e) => this.mouseDown(e));
    window.addEventListener("mouseup", (e) => this.mouseUp(e));
    const mm = this.hud.minimap;
    const miniMove = (e: MouseEvent) => {
      const p = this.minimapToWorld(e);
      if (!p) return;
      if (e.button === 2) {
        const sel = this.selectedEntities().filter((x) => x.owner === this.me);
        if (sel.length === 1 && sel[0] instanceof Building) this.world.setRally(this.me, sel[0].id, p);
        else this.world.smart(this.me, this.selection, null, p);
      }
      else this.centerOn(p);
    };
    mm.addEventListener("mousedown", (e) => { e.preventDefault(); miniMove(e); });
    mm.addEventListener("mousemove", (e) => { if (e.buttons & 1) miniMove(e); });
    mm.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey) {                                           // trackpad pinch, in steps
        this.pinch += e.deltaY;
        if (Math.abs(this.pinch) > 40) { this.zoom(this.pinch < 0 ? 0.5 : 2); this.pinch = 0; }
      }
      else { this.cam.x += e.deltaX * this.cam.zoom; this.cam.y += e.deltaY * this.cam.zoom; this.clampCamera(); }
    }, { passive: false });
    window.addEventListener("keydown", (e) => this.keyDown(e));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key));
    window.addEventListener("blur", () => this.keys.clear());
    document.body.style.cursor = cursors().arrow;
    document.addEventListener("fullscreenchange", () => {
      // In full screen Chrome lets the game have Esc (hold it to leave), so Esc still cancels orders.
      const kb = (navigator as unknown as { keyboard?: { lock?: (k: string[]) => Promise<void>; unlock?: () => void } }).keyboard;
      if (document.fullscreenElement) kb?.lock?.(["Escape"]).catch(() => {});
      else kb?.unlock?.();
      this.screenButtons();
    });
    this.soundButtons();
    this.screenButtons();
  }

  private toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => this.hud.message("Full screen is not allowed here", "warn"));
  }

  /** The mouse lock and full screen switches show their state. */
  private screenButtons() {
    const lockBtn = document.querySelector("#lock-btn"), fs = document.querySelector("#fs-btn");
    lockBtn?.classList.toggle("off", !this.lock.wanted);
    lockBtn?.classList.toggle("active", this.lock.locked);
    if (fs) fs.textContent = document.fullscreenElement ? "Leave full screen" : "Full screen";
  }

  /** The two sound switches in the top bar show whether they are on. */
  private soundButtons() {
    const sfx = document.querySelector("#sfx-btn"), music = document.querySelector("#music-btn");
    sfx?.classList.toggle("off", !this.sound.sfxOn);
    music?.classList.toggle("off", !this.sound.musicOn);
  }

  /** Sets the selection, keeping to the original's limit of 25, and lets the first unit answer. */
  private select(ids: number[], speak = true) {
    const before = this.selection.join();
    this.selection = ids.slice(0, MAX_SELECTION);
    if (speak && this.selection.length && this.selection.join() !== before) this.selectSound(false);
  }

  private restart() {
    this.watching = false;
    this.me = 0;
    this.revealMap = false;
    this.newGame(Math.floor(Math.random() * 999_999) + 1);
    this.showStart();
  }

  private mouseDown(e: MouseEvent) {
    if (!this.started || this.hud.overlayShown) return;
    // The first click on the map takes the mouse, if the player wants it kept in the game. The click still counts.
    if (e.isTrusted && !this.lock.locked) this.lock.lock(e.clientX, e.clientY);
    if (e.button === 2) { this.rightClick(e); return; }
    if (e.button !== 0) return;
    if (this.placing) {
      const o = this.placementOrigin(this.placing, e.clientX, e.clientY);
      if (WALL_TIER[this.placing] !== undefined) { this.wallStart = o; return; } // drag to lay a wall
      const builders = this.selectedEntities().filter((x): x is Unit => x instanceof Unit && x.isVillager && x.owner === this.me).map((u) => u.id);
      const r = this.world.place(this.me, this.placing, o, builders);
      if ("error" in r) this.hud.message(r.error, "warn");
      else if (!e.shiftKey) this.cancelPlacing();
      return;
    }
    if (this.sacrificePending) {
      this.sacrificePending = false;
      const t = this.pick(e.clientX, e.clientY);
      const priest = this.selectedEntities().find((x): x is Unit => x instanceof Unit && x.isPriest && x.owner === this.me);
      if (t && priest && this.world.sacrifice(this.me, priest.id, t.id)) { this.sound.play("convert", 0.9, 0, 1.5); this.flash(t, 0xffd659); }
      else this.hud.message("Choose an enemy that is not a priest", "warn");
      return;
    }
    if (this.groundPending) {
      this.groundPending = false;
      this.world.attackGround(this.me, this.selection, this.toWorld(e.clientX, e.clientY));
      this.selectSound(true);
      this.marker(e.clientX, e.clientY, 0xff3333);
      return;
    }
    if (this.repairPending) {
      this.repairPending = false;
      const t = this.pick(e.clientX, e.clientY);
      if (t instanceof Building && t.owner === this.me && t.complete && t.hp < t.maxHp) {
        this.world.repair(this.me, this.selection, t.id);
        this.selectSound(true);
        this.flash(t, 0x33ff66);
      } else this.hud.message("Choose a damaged building of yours", "warn");
      return;
    }
    if (this.attackMovePending) {
      this.attackMovePending = false;
      this.world.move(this.me, this.selection, this.toWorld(e.clientX, e.clientY), true);
      this.marker(e.clientX, e.clientY, 0xff3333);
      return;
    }
    this.dragStart = { x: e.clientX, y: e.clientY };
  }

  private mouseUp(e: MouseEvent) {
    if (this.placing && this.wallStart && e.button === 0) {
      const builders = this.selectedEntities().filter((x): x is Unit => x instanceof Unit && x.isVillager && x.owner === this.me).map((u) => u.id);
      const r = this.world.placeWall(this.me, this.placing, this.wallStart, this.placementOrigin(this.placing, e.clientX, e.clientY), builders);
      if ("error" in r) this.hud.message(r.error, "warn");
      this.wallStart = null;
      this.clearWallGhosts();
      if (!e.shiftKey) this.cancelPlacing();
      return;
    }
    const a = this.dragStart;
    if (!a || e.button !== 0) return;
    this.dragStart = null;
    this.dragBox.hidden = true;
    const w = this.world, me = this.me;
    if (Math.hypot(a.x - e.clientX, a.y - e.clientY) < 6) {
      const hit = this.pick(e.clientX, e.clientY);
      if (!hit) { if (!e.shiftKey) this.selection = []; return; }
      if (e.detail >= 2 && hit.owner === me) {
        this.select([hit.id, ...[...this.views.keys()].filter((id) => {
          const o = w.entity(id);
          return id !== hit.id && !!o && o.owner === me && o.typeId === hit.typeId && this.onScreen(o.center);
        })], false);
        return;
      }
      if (e.shiftKey && hit.owner !== me) return; // shift only adds your own things
      if (e.shiftKey) {
        const i = this.selection.indexOf(hit.id);
        if (i >= 0) this.selection.splice(i, 1);
        else if (this.selection.length < MAX_SELECTION) { this.selection.push(hit.id); this.selectSound(false); }
      } else this.select([hit.id]);
      return;
    }
    const p0 = this.toScene(Math.min(a.x, e.clientX), Math.min(a.y, e.clientY));
    const p1 = this.toScene(Math.max(a.x, e.clientX), Math.max(a.y, e.clientY));
    const inside = w.unitsOf(me).filter((u) => {
      const s = iso(u.pos);
      return s.x >= p0.x && s.x <= p1.x && s.y >= p0.y && s.y <= p1.y;
    }).map((u) => u.id);
    if (!inside.length) { if (!e.shiftKey) this.selection = []; return; }
    this.select(e.shiftKey ? [...new Set([...this.selection, ...inside])] : inside);
  }

  private rightClick(e: MouseEvent) {
    if (this.world.winner !== null || this.watching) return;
    if (this.placing) { this.cancelPlacing(); return; }
    this.attackMovePending = false;
    this.repairPending = false;
    this.groundPending = false;
    this.sacrificePending = false;
    const at = this.toWorld(e.clientX, e.clientY);
    const sel = this.selectedEntities().filter((x) => x.owner === this.me);
    if (sel.length === 1 && sel[0] instanceof Building) {
      this.world.setRally(this.me, sel[0].id, at);
      this.marker(e.clientX, e.clientY, playerColor(this.me));
      return;
    }
    // Shift + right-click on the ground: a waypoint, walked to after the ones before it.
    if (e.shiftKey && sel.some((x) => x instanceof Unit)) {
      this.world.waypoint(this.me, this.selection, at);
      this.selectSound(true);
      this.marker(e.clientX, e.clientY, 0x33ff66);
      return;
    }
    let target = this.pick(e.clientX, e.clientY);
    // Foundations lie flat and hide behind taller buildings. With villagers selected, a click on the
    // ground of your own unfinished building always means "build this", whatever is drawn over it.
    if (sel.some((x) => x instanceof Unit && x.isVillager)) {
      const foundation = this.world.buildingsOf(this.me).find((b) => !b.complete && b.footprint.distance(at) === 0);
      if (foundation) target = foundation;
    }
    const r = this.world.smart(this.me, this.selection, target?.id ?? null, at);
    if (r === "converted") this.sound.play("convert", 0.9, 0, 1.5);
    else if (r !== "nothing") this.selectSound(true);
    const color = r === "attacked" ? 0xff3333 : r === "converted" || r === "healed" ? 0xffd659 : 0x33ff66;
    // As in the original: the tree, bush, mine, animal, foundation or enemy you ordered them onto flashes.
    if (target && r !== "moved" && r !== "nothing") this.flash(target, color);
    else if (r !== "nothing") this.marker(e.clientX, e.clientY, color);
  }

  /** How many target flashes are running (for the smoke test). */
  flashes = 0;

  /** Blinks the targeted thing a few times and rings it, so you see what your units were sent to. */
  private flash(e: Entity, color: number) {
    const v = this.views.get(e.id);
    if (!v) return;
    const ring = new Graphics();
    if (e instanceof Building) {
      const sz = e.def.size, w = sz * HALF_W, h = sz * HALF_H;
      ring.poly([0, 0, w, -h, 0, -2 * h, -w, -h]).stroke({ width: 2, color });
    } else {
      const rx = Math.max(14, v.pic.w * 0.42), ry = rx / 2;
      ring.poly([-rx, 0, 0, -ry, rx, 0, 0, ry]).stroke({ width: 2, color });
    }
    ring.zIndex = -0.4;
    v.root.addChild(ring);
    this.flashes++;
    let t = 0;
    const blinks = 3, period = 0.22;
    const tick = (dt: { deltaMS: number }) => {
      t += dt.deltaMS / 1000;
      const on = Math.floor(t / (period / 2)) % 2 === 0;
      if (!v.root.destroyed) {
        v.sprite.alpha = on ? 1 : 0.35;
        ring.alpha = on ? 1 : 0.3;
        ring.scale.set(1 + 0.12 * Math.sin((t / period) * Math.PI));
      }
      if (t >= blinks * period || v.root.destroyed) {
        this.app.ticker.remove(tick);
        this.flashes--;
        if (!v.root.destroyed) { v.sprite.alpha = 1; ring.destroy(); }
      }
    };
    this.app.ticker.add(tick);
  }

  private marker(sx: number, sy: number, color: number | string) {
    const p = this.toScene(sx, sy);
    const g = new Graphics().ellipse(0, 0, 13, 6.5).stroke({ width: 2, color });
    g.position.set(p.x, p.y);
    this.effects.addChild(g);
    let t = 0;
    const tick = (dt: { deltaMS: number }) => {
      t += dt.deltaMS / 1000;
      g.scale.set(Math.max(0.3, 1 - t * 1.75));
      g.alpha = Math.max(0, 1 - t / 0.4);
      if (t >= 0.4) { this.app.ticker.remove(tick); g.destroy(); }
    };
    this.app.ticker.add(tick);
  }

  /** Steps through the whole-pixel zoom levels; k < 1 zooms in. */
  private zoom(k: number) {
    const i = ZOOMS.indexOf(this.cam.zoom);
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + (k < 1 ? -1 : 1)))];
    this.cam.zoom = next;
    this.clampCamera();
  }

  private keyDown(e: KeyboardEvent) {
    const key = e.key;
    if (key.startsWith("Arrow")) { this.keys.add(key); e.preventDefault(); return; }
    const ch = key.length === 1 ? key.toUpperCase() : key;
    if (!this.started) {
      const d = ({ "1": "easy", "2": "normal", "3": "hard" } as Record<string, Difficulty>)[ch];
      if (d) this.start(d);
      return;
    }
    if (this.world.winner !== null) { if (key === "Enter") this.restart(); return; }
    if (key === "?" || key === "F1" || key === "F10") {
      e.preventDefault();
      if (this.hud.overlayShown) { this.hud.hideOverlay(); this.paused = false; }
      else { if (key === "F10") this.showMenu(); else this.showHelp(); this.paused = true; }
      return;
    }
    if (key === "F4") { e.preventDefault(); this.scoresToggled(); return; }
    if (this.watching && ch === "V") { this.nextView(); return; }
    // Tab: the next unit of the selection comes first, so its status and orders show.
    if (key === "Tab") {
      e.preventDefault();
      if (this.started && this.selection.length > 1) this.selection = [...this.selection.slice(1), this.selection[0]];
      return;
    }
    if (key === "Escape") {
      if (this.hud.overlayShown) { this.hud.hideOverlay(); this.paused = false; return; }
      const cancel = this.hud.commands.find((c) => c.key === "Escape");
      const pending = this.attackMovePending || this.repairPending || this.groundPending || this.sacrificePending;
      if (!this.placing && !pending && cancel) { cancel.action(); return; }
      if (this.placing) this.cancelPlacing();
      else if (pending) this.attackMovePending = this.repairPending = this.groundPending = this.sacrificePending = false;
      else this.selection = [];
      return;
    }
    if (this.hud.overlayShown) return;
    if (key === "Delete" || key === "Backspace") { for (const id of this.selection) this.world.destroy(this.me, id); return; }
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) {
      const d = Number(digit[1]);
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
        this.groups.set(d, [...this.selection]);
        this.hud.message(`Group ${d} saved`);
      } else {
        const g = (this.groups.get(d) ?? []).filter((id) => this.world.entity(id));
        if (e.shiftKey) { this.select([...new Set([...this.selection, ...g])]); return; } // Shift adds the group to what is picked
        if (g.length && g.join() === this.selection.join()) this.centerOn(this.world.entity(g[0])!.center);
        this.select(g);
      }
      return;
    }
    if (e.metaKey || e.ctrlKey) return; // leave browser shortcuts alone
    if (key === " ") {
      // Space looks at what is picked, as in the original.
      e.preventDefault();
      const first = this.selectedEntities()[0];
      if (first) this.centerOn(first.center);
      return;
    }
    switch (ch) {
      case "H": this.selectTownCenter(); return;
      case ".": this.selectIdleVillager(); return;
      case "F3": case "Pause": this.paused = !this.paused; this.hud.message(this.paused ? "Paused (F3 to resume)" : "Resumed"); return;
      case "+": case "=": this.setSpeed(1); return;   // game speed, as in the original
      case "-": case "_": this.setSpeed(-1); return;
      case "PageUp": this.zoom(0.85); return;
      case "PageDown": this.zoom(1.15); return;
      case "`": this.revealMap = !this.revealMap; this.fogStamp = -1; return; // debugging aid
    }
    // Rebuild the commands now: the selection may have changed since the last frame.
    this.hud.setCommands(this.commands(this.selectedEntities()));
    this.hud.run(this.hud.commands.find((c) => c.key === ch));
  }

  /** Steps the game speed up or down, or to a given index. */
  setSpeed(step: number, to?: number) {
    const sp = this.speeds, i = Math.max(0, sp.indexOf(this.speed));
    const next = to !== undefined ? to : Math.min(sp.length - 1, Math.max(0, i + step));
    this.speed = sp[next];
    this.hud.speed(this.speed);
    this.hud.message(`Game speed ${this.speed}x`);
  }

  private selectIdleVillager() {
    const idle = this.world.unitsOf(this.me).filter((u) => u.isVillager && u.order.kind === "idle");
    if (!idle.length) { this.hud.message("No idle villagers"); return; }
    this.idleIndex = (this.idleIndex + 1) % idle.length;
    this.selection = [idle[this.idleIndex].id];
    this.centerOn(idle[this.idleIndex].pos);
  }

  private scrollCamera(dt: number) {
    let dx = 0, dy = 0;
    if (this.keys.has("ArrowLeft")) dx--;
    if (this.keys.has("ArrowRight")) dx++;
    if (this.keys.has("ArrowUp")) dy--;
    if (this.keys.has("ArrowDown")) dy++;
    const m = this.mouse, edge = 6, sw = window.innerWidth, sh = window.innerHeight;
    if (m.inside && !this.dragStart && document.hasFocus() && this.started) {
      if (m.x <= edge) dx--;
      if (m.x >= sw - edge) dx++;
      if (m.y <= edge) dy--;
      if (m.y >= sh - edge) dy++;
    }
    if (dx || dy) {
      const speed = 900 * dt * this.cam.zoom;
      this.cam.x += dx * speed;
      this.cam.y += dy * speed;
      this.clampCamera();
    }
  }

  // ---- for the snapshot and smoke tests

  /** Where a world point is on screen, in CSS pixels. */
  screenOf(p: Vec2) {
    const s = iso(p);
    return { x: (s.x - this.cam.x) / this.cam.zoom + this.app.screen.width / 2, y: (s.y - this.cam.y) / this.cam.zoom + this.app.screen.height / 2 };
  }

  look(p: Vec2) { this.centerOn(p); }

  /** Fast-forwards with an AI on both sides. */
  fastForward(seconds: number) {
    this.world.ais.push(new AIController(this.me, "normal"));
    for (let i = 0; i < seconds / World.dt; i++) this.world.step();
    this.world.events.length = 0;
  }
}
