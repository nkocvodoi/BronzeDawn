// Everything drawn on top of the map, in plain HTML so text stays sharp at any zoom.
// Laid out like the original on an 800 x 600 screen and scaled to the window: resources along the
// top, and at the bottom a status box, two rows of command icons and the minimap.
import { Building, Entity, ResourceNode, Unit } from "../core/entities";
import { Res, RES_ALL, RES_KEY } from "../core/rules";
import { scores } from "../core/score";
import { clock } from "../core/sim";
import type { World } from "../core/world";
import { iconPic, playerColor, reliefTexture, resourceIcons, statIcons, stoneTexture, type Arch } from "./art";
import { ASSETS } from "./assets";

/** One command button: a hotkey, a label, a cost, and why it is greyed out. */
export interface Command {
  key: string; title: string; detail: string; blocker: string | null; action: () => void;
  /** A unit, building, tech or glyph id ("build", "stop", "delete", "back") to draw on the button. */
  icon?: string;
  /** A longer line for the tooltip, such as what a technology does. */
  help?: string;
  /** Shown on every page, at the end of the bottom row (Back, Cancel, Delete). */
  pin?: boolean;
  /** Which row it lives in, as in the original: training and orders on top, research and advancing below. */
  row?: 0 | 1;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const COLS = 6, SLOTS = COLS * 2; // two rows of six, as in the original

/** What a villager is called by the work it is doing, as the original renames them. */
export function jobName(u: Unit): string | null {
  if (!u.isVillager) return null;
  const o = u.order, node = u.lastNodeType ?? "";
  if (o.kind === "build") return "Builder";
  if (o.kind === "repair") return "Repairer";
  if (o.kind === "attack") return "Hunter";
  if (o.kind !== "gather" && o.kind !== "return") return null;
  if (node === "farm") return "Farmer";
  if (node === "fish") return "Fisherman";
  if (node.startsWith("carcass_")) return "Hunter";
  switch (u.lastGather) {
    case Res.wood: return "Woodcutter";
    case Res.food: return "Forager";
    case Res.gold: return "Gold Miner";
    case Res.stone: return "Stone Miner";
    default: return null;
  }
}

type ScoreMode = "pop" | "score" | "off";
const SCORE_MODES: ScoreMode[] = ["pop", "score", "off"];
/** Remembered settings; a private window may refuse them. */
const prefs = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

export class HUD {
  private res = RES_ALL.map((r) => $(`#res-${RES_KEY[r]}`));
  private pop = $("#pop");
  private age = $("#age");
  private time = $("#clock");
  /** Always shown: how long the match has gone, in game time, and the speed it runs at. */
  private matchTime = $("#match-time");
  private speedNow = 1;
  private title = $("#info-title");
  private owner = $("#owner-line");
  private stats = $("#stats");
  private lines = [0, 1].map((i) => $(`#info-${i}`));
  private hpBar = $("#hp-bar");
  private hpBox = $("#hp");
  private hpText = $("#hp-text");
  private queue = $("#queue");
  private status = $("#status");
  /** Several picked: each one's picture and hit points, instead of the first one's numbers. */
  private multi = $("#multi");
  private multiSig = "";
  private portraitBox = $("#portrait-box");
  private progress = $("#progress");
  private progressBar = $("#progress-bar");
  private progressText = $("#progress-text");
  private grid = $("#commands");
  private tip = $("#tooltip");
  private messages = $("#messages");
  private overlay = $("#overlay");
  private scores = $("#scores");
  readonly minimap = $<HTMLCanvasElement>("#minimap");
  /** Every command of the current menu, all pages: hotkeys reach the ones not on screen too. */
  commands: Command[] = [];
  /** The ones on screen, by button index; null for an empty slot. */
  private shown: (Command | null)[] = [];
  private page = 0;
  private menuKey = "";
  private signature = "";
  private statUrl = statIcons();
  private portraitCanvas = $<HTMLCanvasElement>("#portrait");
  private portraitSource: HTMLCanvasElement | null = null;
  private icons = new Map<string, string>();
  private reliefs = new Map<string, string>();
  private tipFromButton = false;
  /** Your civilization and its bonuses, and the enemy's, for the Diplomacy screen. */
  civInfo: { name: string | null; bonuses: string[]; enemy: string | null } = { name: null, bonuses: [], enemy: null };

  constructor() {
    document.documentElement.style.setProperty("--stone", `url(${stoneTexture()})`);
    this.theme("egyptian");
    resourceIcons().forEach((url, i) => { this.res[i].style.backgroundImage = `url(${url})`; });
    // One unit is a pixel of an 800 x 600 screen, so the interface keeps the original's proportions.
    const fit = () => {
      const u = Math.max(0.75, Math.min(3, Math.min(window.innerWidth / 800, window.innerHeight / 600)));
      document.documentElement.style.setProperty("--u", `${u}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    this.grid.addEventListener("mousemove", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      const c = b ? this.shown[Number(b.dataset.i)] : null;
      this.tipFromButton = !!c;
      if (!c) { this.tip.hidden = true; return; }
      const key = c.key === "Escape" ? "Esc" : c.key === "Delete" ? "Del" : c.key;
      this.tip.innerHTML = `<b>${c.title}</b>${key ? ` (${key})` : ""}${c.detail ? ` · ${c.detail}` : ""}${c.help ? `<br>${c.help}` : ""}${c.blocker ? `<br><span class="why">${c.blocker}</span>` : ""}`;
      this.tip.classList.toggle("blocked", !!c.blocker);
      this.tip.hidden = false;
    });
    this.grid.addEventListener("mouseleave", () => { this.tip.hidden = true; this.tipFromButton = false; });
    this.grid.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      b.classList.remove("pressed"); void b.offsetWidth; b.classList.add("pressed");
      this.run(this.shown[Number(b.dataset.i)] ?? undefined);
    });
  }

  /** The carved stone of the top bar and panel, in the style of an architecture. */
  theme(arch: string) {
    const get = (plain: boolean) => {
      const k = `${arch}:${plain}`;
      let url = this.reliefs.get(k);
      if (!url) { url = reliefTexture(arch, plain); this.reliefs.set(k, url); }
      return url;
    };
    document.documentElement.style.setProperty("--relief", `url(${get(false)})`);
    document.documentElement.style.setProperty("--relief-plain", `url(${get(true)})`); // the top bar, behind its numbers
  }

  /** The line at the bottom left of the map that says what is under the pointer. */
  rollover(text: string | null) {
    if (this.tipFromButton) return;
    if (!text) { this.tip.hidden = true; return; }
    if (this.tip.textContent !== text) { this.tip.textContent = text; this.tip.classList.remove("blocked"); }
    this.tip.hidden = false;
  }

  /** The age, architecture and civilization the building icons are drawn for: the player's own, so a
   *  button shows the building that will go up. */
  private iconLook: { age: number; arch: Arch; civ?: string } = { age: 2, arch: "greek" };
  private iconLookKey = "";
  setIconLook(age: number, arch: Arch, civ?: string) {
    // With whether the civilization's own pictures are in: the buttons are drawn again once they are.
    const key = `${age}/${arch}/${civ ?? ""}${civ && ASSETS.civLoaded(civ) ? "+" : ""}`;
    if (key === this.iconLookKey) return;
    this.iconLook = { age, arch, civ };
    this.iconLookKey = key;
    this.signature = ""; // redraw the buttons
  }

  iconUrl(id: string) {
    const key = `${id}@${this.iconLookKey}`;
    let url = this.icons.get(key);
    if (!url) { url = iconPic(id, this.iconLook.age, this.iconLook.arch, this.iconLook.civ).toDataURL(); this.icons.set(key, url); }
    return url;
  }

  /** Your civilization and the enemy's, for the Diplomacy screen. */
  civ(name: string | null, bonuses: string[], enemy: string | null) {
    this.civInfo = { name, bonuses, enemy };
  }

  /** The speed switch lives in the menu; it is updated when the menu is open. */
  speed(x: number) {
    this.speedNow = x;
    const s = document.querySelector("#speed");
    if (s) s.textContent = `Game speed ${x}x`;
  }

  /** The panels slide in when a game starts and out on the start screen. */
  playing(on: boolean) { document.body.classList.toggle("playing", on); }

  run(c: Command | undefined) {
    if (!c) return;
    if (c.blocker) this.message(c.blocker, "warn");
    else c.action();
  }

  update(w: World, me: number, sel: Entity[]) {
    const p = w.players[me];
    RES_ALL.forEach((r, i) => { this.res[i].textContent = String(Math.floor(p.res.get(r))); });
    this.pop.textContent = `${Math.ceil(p.pop - 1e-9)}/${p.popCap}`;
    this.pop.classList.toggle("warn", p.pop >= p.popCap);
    const t = `${clock(w.time)} · x${this.speedNow}`;
    if (this.matchTime.textContent !== t) this.matchTime.textContent = t;
    // While a Town Center advances, the top bar counts it down, as the age is what everyone waits for.
    const up = w.buildingsOf(me).find((b) => b.complete && b.queue[0]?.kind === "age");
    this.age.textContent = up ? `${w.rules.ages[p.age].name} → ${w.rules.ages[Number(up.queue[0].id)].name} ${clock(w.queueTimeLeft(up).current)}`
      : w.rules.ages[p.age].name;
    // Beside the age, the original shows only the countdown while a Wonder stands (the match time, by the
    // population, is Bronze Dawn's). A time limit counts down too, and a score target shows what it is.
    // So do all the Ruins or all the Artifacts in one side's hands: the clock nearest to winning shows.
    const v = w.victory;
    const clocks: { what: string; player: number; at: number }[] = [];
    if (v.kind === "standard") {
      for (const x of w.players) if (x.wonderAt !== null) clocks.push({ what: "Wonder", player: x.id, at: x.wonderAt });
      if (w.relicHold.ruins) clocks.push({ what: "Ruins", ...w.relicHold.ruins });
      if (w.relicHold.artifact) clocks.push({ what: "Artifacts", ...w.relicHold.artifact });
    }
    const soon = clocks.sort((a, b) => a.at - b.at)[0];
    this.time.hidden = !soon && v.kind !== "time" && v.kind !== "score";
    if (soon) this.time.textContent = `${soon.what} (${w.players[soon.player].name}) ${clock(Math.max(0, soon.at - w.time))}`;
    else if (v.kind === "time") this.time.textContent = `Time left ${clock(Math.max(0, v.target - w.time))}`;
    else if (v.kind === "score") this.time.textContent = `First to ${v.target}`;
    this.time.classList.toggle("warn", (!!soon && !w.allied(soon.player, me)) || (v.kind === "time" && v.target - w.time < 120));
    this.statusBox(w, me, sel);
    if (this.scoreMode !== "off") this.updateScores(w, me);
  }

  // ---- the player list above the minimap

  /** What the list shows: every player's population, their scores, or nothing. S or F4 steps through. */
  scoreMode: ScoreMode = SCORE_MODES.includes(prefs.get("bd-scores") as ScoreMode) ? (prefs.get("bd-scores") as ScoreMode) : "pop";
  private scoresHtml = "";
  private scoreCache: number[] = [];
  private scoreTick = -1;

  toggleScores(w: World, me = 0) {
    this.scoreMode = SCORE_MODES[(SCORE_MODES.indexOf(this.scoreMode) + 1) % SCORE_MODES.length];
    prefs.set("bd-scores", this.scoreMode);
    this.scores.hidden = this.scoreMode === "off";
    if (this.scoreMode !== "off") this.updateScores(w, me);
    return this.scoreMode;
  }

  /** One line a player, in their colour: name, civilization, and population (now / room) or score.
   *  A simple score: what was gathered, built up and won. Players who are out are dimmed. */
  private updateScores(w: World, me: number) {
    const pop = this.scoreMode === "pop";
    // The original's score, in five parts; worked out twice a second, not every frame.
    if (!pop && (this.scoreTick < 0 || w.tick - this.scoreTick >= 10 || w.tick < this.scoreTick)) { this.scoreCache = scores(w).map((s) => s.total); this.scoreTick = w.tick; }
    const rows = w.players.map((p) => {
      const value = p.defeated ? "out" : pop ? `${Math.ceil(p.pop - 1e-9)}/${p.popCap}` : String(this.scoreCache[p.id] ?? 0);
      const ally = p.id !== me && w.allied(me, p.id) ? " · ally" : "";
      return `<div class="${p.defeated ? "out" : ""}" style="color:${playerColor(p.id)}">${p.name}${p.civ ? ` (${p.civ.name})` : ""}${ally}: <b>${value}</b></div>`;
    });
    const html = `<div class="head">${pop ? "Population" : "Score"}</div>${rows.join("")}`;
    if (html !== this.scoresHtml) { this.scoresHtml = html; this.scores.innerHTML = html; }
    this.scores.hidden = false;
  }

  // ---- the status box

  private stat(icon: string, base: number, now: number, title: string) {
    const r = (x: number) => Math.round(x * 10) / 10;
    const up = r(now - base);
    return `<span title="${title}" style="background-image:url(${this.statUrl[icon]})">${r(base)}${up ? `<b class="up">${up > 0 ? "+" : ""}${up}</b>` : ""}</span>`;
  }

  /** As in the original, a group shows its first member. */
  /** More than one picked, as in the original: how many of each kind, then a picture for each with its
   *  hit points under it. Clicking one picks it alone; with Shift, leaves it out. True when shown. */
  private manyBox(sel: Entity[]): boolean {
    const many = sel.length > 1;
    this.multi.hidden = !many;
    for (const el of [this.portraitBox, this.hpBox, this.hpText, this.title]) el.style.display = many ? "none" : "";
    this.lines[0].classList.toggle("wrap", many);
    if (!many) { this.multiSig = ""; return false; }
    const kinds = new Map<string, { name: string; n: number }>();
    for (const e of sel) {
      const name = (e instanceof Unit ? jobName(e) : null) ?? e.name;
      const k = kinds.get(name) ?? { name, n: 0 };
      k.n++;
      kinds.set(name, k);
    }
    this.owner.textContent = `${sel.length} selected`;
    this.title.style.color = "";
    // How many of each kind, on as many lines as it takes, above the pictures.
    this.title.textContent = "";
    this.stats.innerHTML = "";
    this.queue.innerHTML = "";
    this.lines.forEach((l) => (l.textContent = ""));
    this.lines[0].textContent = [...kinds.values()].map((k) => `${k.n} ${k.name}`).join(" · ");
    // Drawn again only when the picked or their hit points (in steps of 5%) change.
    const cells = sel.map((e) => ({ e, f: Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp))) }));
    const sig = cells.map(({ e, f }) => `${e.id}:${Math.round(f * 20)}`).join(",");
    if (sig !== this.multiSig) {
      this.multiSig = sig;
      this.multi.innerHTML = cells.map(({ e, f }) => {
        const type = e instanceof Unit ? e.def.id : e instanceof Building ? e.def.id : "";
        const hp = f > 0.66 ? "#0c0" : f > 0.33 ? "#e8c020" : "#e02818";
        const name = (e instanceof Unit ? jobName(e) : null) ?? e.name;
        return `<button data-pick="${e.id}" title="${name}: ${Math.ceil(e.hp)}/${e.maxHp}"><img src="${this.iconUrl(type)}" alt=""><i style="width:${Math.round(f * 100)}%;background:${hp}"></i></button>`;
      }).join("");
    }
    return true;
  }

  private statusBox(w: World, me: number, sel: Entity[]) {
    const first = sel[0];
    this.status.style.visibility = first ? "visible" : "hidden";
    this.progress.hidden = true;
    if (!first) return;
    if (this.manyBox(sel)) return;
    const enemy = first.owner >= 0 && first.owner !== me;
    this.title.textContent = (first instanceof Unit ? jobName(first) : null) ?? first.name;
    this.title.style.color = enemy ? playerColor(first.owner) : "";
    this.owner.textContent = first.owner >= 0 ? `${w.players[first.owner].civ?.name ?? w.players[first.owner].name}` : "Gaia";
    this.stats.innerHTML = "";
    this.lines.forEach((l) => (l.textContent = ""));
    this.queue.innerHTML = "";
    this.portraitBox.style.visibility = "visible";
    const hpShown = !(first instanceof ResourceNode);
    this.hpBox.style.visibility = hpShown ? "visible" : "hidden";
    if (hpShown) {
      const f = Math.max(0, first.hp / first.maxHp);
      this.hpBar.style.width = `${f * 100}%`;
      this.hpText.textContent = `${Math.ceil(first.hp)}/${first.maxHp}`;
    } else this.hpText.textContent = "";

    if (first instanceof ResourceNode) {
      this.stats.innerHTML = `<span style="background-image:url(${this.statUrl.carry})">${Math.floor(first.amount)}</span>`;
      if (first.decay > 0) this.lines[0].textContent = "Meat rots: gather it soon";
      return;
    }
    if (first instanceof Unit && first.isRelic) {
      this.hpBox.style.visibility = "hidden";
      const moves = first.def.speed > 0;
      this.lines[0].textContent = first.owner < 0 ? "Nobody's yet: bring a unit to it to take it" : moves ? "Its holder can move it; an enemy beside it takes it" : "Held until an enemy comes near with nobody of yours there";
      const h = w.relicHold[moves ? "artifact" : "ruins"];
      this.lines[1].textContent = h && w.victory.kind === "standard" ? `${w.players[h.player].name} holds them all: ${clock(Math.max(0, h.at - w.time))} left`
        : "Hold every one for 15 minutes to win · 10 points each";
      return;
    }
    if (first instanceof Unit && first.isAnimal) {
      const a = first.animal!;
      this.stats.innerHTML = this.stat("attack", a.attack, a.attack, "Attack") + this.stat("carry", a.food, a.food, "Food when hunted");
      return;
    }
    if (first instanceof Unit) {
      // The original's status box: each number as base + what upgrades and the civilization add.
      const d = first.def, st = w.stats(first);
      if (first.isPriest) {
        this.stats.innerHTML = this.stat("faith", 100, Math.floor(first.faith), "Faith") + this.stat("range", d.range, st.range, "Range");
      } else if (first.isBoat && !first.isSoldier) {
        this.stats.innerHTML = ""; // a fishing boat or a transport has nothing to fight with
      } else {
        this.stats.innerHTML = this.stat("attack", d.attack, st.attack, "Attack")
          + (d.armor || st.armor ? this.stat("armor", d.armor, st.armor, "Armor") : "")
          + (d.pierce_armor || st.pierce_armor ? this.stat("pierce", d.pierce_armor, st.pierce_armor, "Pierce armor") : "")
          + (d.range > 0 ? this.stat("range", d.range, st.range, "Range") : "");
      }
      if (first.isTrader) {
        const o = first.order;
        this.lines[0].textContent = o.kind === "trade" ? (o.loaded ? `Bringing ${Math.round(first.carry)} gold home` : "Sailing for goods")
          : "Right-click another player's Dock to trade";
      } else if (first.isTransport) this.lines[0].textContent = `Carrying ${first.cargo.length}/${first.def.capacity}${first.unloadAt ? " · putting in" : ""}`;
      else if (first.carry > 0 && first.carryRes !== null) this.lines[0].textContent = `Carrying ${Math.floor(first.carry)} ${first.carryKind === "meat" ? "meat" : RES_KEY[first.carryRes]}`;
      return;
    }
    if (first instanceof Building) {
      if (first.def.attack) {
        const st = w.bstats(first);
        this.stats.innerHTML = this.stat("attack", first.def.attack, st.attack, "Attack") + this.stat("range", first.def.range ?? 0, st.range, "Range");
      }
      if (!first.complete) {
        const left = w.buildTimeLeft(first);
        this.showProgress(first.progress, `${Math.floor(first.progress * 100)}% · ${left === null ? "no builder" : `${clock(left)} left`}`);
      } else if (first.queue.length) {
        // What it is working on, as icons: the first is in progress.
        const q = first.queue[0];
        const what = q.kind === "age" ? w.rules.ages[Number(q.id)].name : q.kind === "tech" ? w.rules.techs.get(q.id)?.name : w.rules.units.get(q.id)?.name;
        // The bar says what and how long, in game seconds; a unit waiting for room says so instead.
        const t = w.queueTimeLeft(first);
        const housing = q.kind === "unit" && first.housingWarned;
        this.title.textContent = `${q.kind === "unit" ? "Training" : q.kind === "age" ? "Advancing to" : "Researching"} ${what}`;
        this.queue.innerHTML = first.queue.map((x) => `<img src="${this.iconUrl(x.kind === "age" ? "age" : x.id)}" alt="">`).join("");
        this.showProgress(w.trainProgress(first), housing ? "need more houses"
          : `${clock(t.current)} left${first.queue.length > 1 ? ` · all ${clock(t.total)}` : ""}`);
      } else if (first.isFarm) this.lines[0].textContent = `${Math.floor(first.food)} food left`;
    }
  }

  /** The selected entity's picture, scaled up with hard pixels. */
  portrait(src: HTMLCanvasElement | null) {
    if (src === this.portraitSource) return;
    this.portraitSource = src;
    const c = this.portraitCanvas, g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    if (!src) return;
    const k = Math.max(1, Math.floor(Math.min(c.width / src.width, c.height / src.height)));
    g.imageSmoothingEnabled = false;
    g.drawImage(src, (c.width - src.width * k) / 2, (c.height - src.height * k) / 2, src.width * k, src.height * k);
  }

  private showProgress(f: number, text: string) {
    this.progress.hidden = false;
    this.progressBar.style.width = `${f * 100}%`;
    if (this.progressText.textContent !== text) this.progressText.textContent = text;
  }

  // ---- command icons

  /** Places a menu on the 6 x 2 grid. Top-row and bottom-row commands keep their rows, pinned ones sit at
   *  the right end of the bottom row; a menu too long for that is paged with a More button. */
  private layout(cmds: Command[], menu: string): (Command | null)[] {
    const pinned = cmds.filter((c) => c.pin), rest = cmds.filter((c) => !c.pin);
    const top = rest.filter((c) => c.row !== 1), bottom = rest.filter((c) => c.row === 1);
    const slots: (Command | null)[] = Array(SLOTS).fill(null);
    if (top.length <= COLS && bottom.length + pinned.length <= COLS) {
      top.forEach((c, i) => (slots[i] = c));
      bottom.forEach((c, i) => (slots[COLS + i] = c));
      pinned.forEach((c, i) => (slots[SLOTS - pinned.length + i] = c));
      return slots;
    }
    const per = SLOTS - pinned.length - 1;
    const pages = Math.ceil(rest.length / per);
    this.page %= pages;
    const next: Command = { key: "", title: `More (${this.page + 1}/${pages})`, detail: "next page", blocker: null, icon: "next",
      action: () => { this.page++; this.signature = ""; this.menuKey = menu; this.setCommands(this.commands); } };
    [...rest.slice(this.page * per, this.page * per + per), next].forEach((c, i) => (slots[i] = c));
    pinned.forEach((c, i) => (slots[SLOTS - pinned.length + i] = c));
    return slots;
  }

  /** Whether the buttons show their keys. */
  private showKeys = true;
  get hotkeys() { return this.showKeys; }
  set hotkeys(on: boolean) { this.showKeys = on; this.signature = ""; this.setCommands(this.commands); }

  setCommands(cmds: Command[]) {
    this.commands = cmds;
    const menu = cmds.map((c) => c.title).join("|");
    if (menu !== this.menuKey) { this.menuKey = menu; this.page = 0; }
    const shown = this.layout(cmds, menu);
    const sig = `${this.page}#${this.hotkeys}#` + shown.map((c) => (c ? `${c.key}|${c.title}|${c.blocker}` : "-")).join(";");
    this.shown = shown;
    if (sig === this.signature) return;
    this.signature = sig;
    // The key in the corner of each button, unless the player keeps the original's bare buttons (Settings).
    const keyName = (k: string) => ({ Escape: "Esc", Delete: "Del" } as Record<string, string>)[k] ?? k;
    this.grid.innerHTML = shown.map((c, i) => {
      if (!c) return `<button class="empty" tabindex="-1" aria-hidden="true"></button>`;
      const icon = c.icon ? `<img src="${this.iconUrl(c.icon)}" alt="${c.title}">` : `<span>${c.title}</span>`;
      const key = this.hotkeys && c.key ? `<kbd class="hk">${keyName(c.key)}</kbd>` : "";
      return `<button data-i="${i}" class="${c.blocker ? "off" : ""}" aria-label="${c.title}">${icon}${key}</button>`;
    }).join("");
  }

  message(text: string, kind: "info" | "warn" = "info") {
    const d = document.createElement("div");
    d.textContent = text;
    d.className = kind;
    this.messages.appendChild(d);
    while (this.messages.children.length > 4) this.messages.firstChild!.remove();
    setTimeout(() => d.classList.add("fade"), 5000);
    setTimeout(() => d.remove(), 6000);
  }

  /** A line of chat from another player (or your own), with their name in their color. Shown longer than
   *  a message; written as text, never as markup, whatever it says. */
  chat(from: string, color: string, text: string) {
    const d = document.createElement("div");
    d.className = "chat";
    const who = document.createElement("b");
    who.textContent = `${from}: `;
    who.style.color = color;
    d.append(who, document.createTextNode(text));
    this.messages.appendChild(d);
    while (this.messages.children.length > 6) this.messages.firstChild!.remove();
    setTimeout(() => d.classList.add("fade"), 10000);
    setTimeout(() => d.remove(), 11000);
  }

  /** Clears the messages, as when a game starts. */
  clearMessages() { this.messages.innerHTML = ""; }

  showOverlay(title: string, lines: string[], kind = "") {
    this.overlay.innerHTML = `<div class="card ${kind}"><h1>${title}</h1>${lines.map((l) => (l.startsWith("<div") ? l : `<p>${l}</p>`)).join("")}</div>`;
    this.overlay.hidden = false;
  }

  hideOverlay() { this.overlay.hidden = true; }
  get overlayShown() { return !this.overlay.hidden; }
}
