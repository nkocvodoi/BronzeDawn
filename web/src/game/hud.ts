// Everything drawn on top of the map, in plain HTML so text stays sharp at any zoom.
// Laid out like the original: resources along the top, and at the bottom a status box,
// two rows of command icons and the minimap.
import { Building, Entity, ResourceNode, Unit } from "../core/entities";
import { RES_ALL, RES_KEY } from "../core/rules";
import { clock } from "../core/sim";
import type { World } from "../core/world";
import { iconPic, playerColor, resourceIcons, statIcons, stoneTexture, woodTexture } from "./art";

/** One command button: a hotkey, a label, a cost, and why it is greyed out. */
export interface Command {
  key: string; title: string; detail: string; blocker: string | null; action: () => void;
  /** A unit, building, tech or glyph id ("build", "stop", "delete", "back") to draw on the button. */
  icon?: string;
  /** A longer line for the tooltip, such as what a technology does. */
  help?: string;
  /** Shown on every page, at the end (Back, Cancel, Delete). */
  pin?: boolean;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const SLOTS = 14; // two rows of seven, as in the original

export class HUD {
  private res = RES_ALL.map((r) => $(`#res-${RES_KEY[r]}`));
  private pop = $("#pop");
  private age = $("#age");
  private time = $("#clock");
  private speedLabel = $("#speed");
  private civLabel = $("#civ-name");
  private title = $("#info-title");
  private owner = $("#owner-line");
  private stats = $("#stats");
  private lines = [0, 1].map((i) => $(`#info-${i}`));
  private hpBar = $("#hp-bar");
  private hpBox = $("#hp");
  private hpText = $("#hp-text");
  private queue = $("#queue");
  private multi = $("#multi");
  private statusText = $("#status-text");
  private portraitBox = $("#portrait-box");
  private progress = $("#progress");
  private progressBar = $("#progress-bar");
  private grid = $("#commands");
  private tip = $("#tooltip");
  private messages = $("#messages");
  private overlay = $("#overlay");
  readonly minimap = $<HTMLCanvasElement>("#minimap");
  /** Every command of the current menu, all pages: hotkeys reach the ones not on screen too. */
  commands: Command[] = [];
  /** The ones on screen, by button index. */
  private shown: Command[] = [];
  private page = 0;
  private menuKey = "";
  private signature = "";
  private statUrl = statIcons();
  private portraitCanvas = $<HTMLCanvasElement>("#portrait");
  private portraitSource: HTMLCanvasElement | null = null;
  private icons = new Map<string, string>();
  private statusKey = "";

  constructor() {
    // Pixel art for the frame: wooden bars, carved stone cards, resource icons.
    document.documentElement.style.setProperty("--stone", `url(${stoneTexture()})`);
    document.documentElement.style.setProperty("--wood", `url(${woodTexture()})`);
    resourceIcons().forEach((url, i) => { this.res[i].style.backgroundImage = `url(${url})`; });
    this.grid.addEventListener("mousemove", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      const c = b ? this.shown[Number(b.dataset.i)] : null;
      if (!c) { this.tip.hidden = true; return; }
      const key = c.key === "Escape" ? "Esc" : c.key === "Delete" ? "Del" : c.key;
      this.tip.innerHTML = `<b>${c.title}</b> (${key})${c.detail ? ` · ${c.detail}` : ""}${c.help ? `<br>${c.help}` : ""}${c.blocker ? `<br><span class="why">${c.blocker}</span>` : ""}`;
      this.tip.classList.toggle("blocked", !!c.blocker);
      this.tip.hidden = false;
    });
    this.grid.addEventListener("mouseleave", () => { this.tip.hidden = true; });
    this.grid.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      b.classList.remove("pressed"); void b.offsetWidth; b.classList.add("pressed");
      this.run(this.shown[Number(b.dataset.i)]);
    });
  }

  iconUrl(id: string) {
    let url = this.icons.get(id);
    if (!url) { url = iconPic(id).toDataURL(); this.icons.set(id, url); }
    return url;
  }

  /** Your civilization in the top bar; hovering it lists the bonuses, and the enemy's. */
  civ(name: string | null, bonuses: string[], enemy: string | null) {
    this.civLabel.hidden = !name;
    this.civLabel.textContent = name ?? "";
    this.civLabel.title = name ? `${name}: ${bonuses.join("; ") || "no bonuses"}${enemy ? `\nEnemy: ${enemy}` : ""}` : "";
  }

  speed(x: number) {
    this.speedLabel.textContent = `${x}x`;
    this.speedLabel.classList.toggle("fast", x > 1);
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
    this.pop.textContent = `pop ${Math.ceil(p.pop - 1e-9)}/${p.popCap}`;
    this.pop.classList.toggle("warn", p.pop >= p.popCap);
    this.age.textContent = w.rules.ages[p.age].name;
    // A Wonder countdown, as in the original: whoever's Wonder stands until the clock runs out wins.
    const wonder = w.players.find((x) => x.wonderAt !== null);
    this.time.textContent = wonder ? `Wonder (${wonder.name}) ${clock(Math.max(0, wonder.wonderAt! - w.time))} · ${clock(w.time)}` : clock(w.time);
    this.time.classList.toggle("warn", !!wonder && wonder.id !== me);
    this.status(w, me, sel);
  }

  // ---- the status box

  private stat(icon: string, base: number, now: number, title: string) {
    const r = (x: number) => Math.round(x * 10) / 10;
    const up = r(now - base);
    return `<span title="${title}" style="background-image:url(${this.statUrl[icon]})">${r(base)}${up ? `<b class="up">${up > 0 ? "+" : ""}${up}</b>` : ""}</span>`;
  }

  private status(w: World, me: number, sel: Entity[]) {
    const first = sel[0];
    const many = sel.length > 1;
    this.multi.hidden = !many;
    this.statusText.hidden = many || !first;
    this.portraitBox.hidden = many;
    this.portraitBox.style.visibility = first ? "visible" : "hidden";
    this.progress.hidden = true;
    if (!first) { this.title.textContent = ""; return; }
    if (many) {
      // A group: one small portrait per unit with its health, as in the original.
      const key = sel.map((e) => `${e.id}:${Math.ceil((e.hp / e.maxHp) * 10)}`).join(",");
      if (key !== this.statusKey) {
        this.statusKey = key;
        this.multi.innerHTML = sel.slice(0, 30).map((e) =>
          `<div title="${e.name}"><img src="${this.iconUrl(e.typeId)}" alt=""><i style="width:${Math.max(0, (e.hp / e.maxHp) * 26)}px"></i></div>`).join("");
      }
      return;
    }
    this.statusKey = "";
    const enemy = first.owner >= 0 && first.owner !== me;
    this.title.textContent = first.name;
    this.title.style.color = enemy ? playerColor(first.owner) : "";
    this.owner.textContent = first.owner >= 0 ? `${w.players[first.owner].civ?.name ?? w.players[first.owner].name}${enemy ? ` · ${w.players[first.owner].name}` : ""}` : "Gaia";
    this.stats.innerHTML = "";
    this.lines.forEach((l) => (l.textContent = ""));
    this.queue.innerHTML = "";
    const hpShown = !(first instanceof ResourceNode);
    this.hpBox.style.visibility = hpShown ? "visible" : "hidden";
    if (hpShown) {
      const f = Math.max(0, first.hp / first.maxHp);
      this.hpBar.style.width = `${f * 100}%`;
      this.hpBar.style.background = f > 0.5 ? "#3c3" : f > 0.25 ? "#dd3" : "#d33";
      this.hpText.textContent = `${Math.ceil(first.hp)}/${first.maxHp}`;
    } else this.hpText.textContent = "";

    if (first instanceof ResourceNode) {
      this.stats.innerHTML = `<span style="background-image:url(${this.statUrl.carry})">${Math.floor(first.amount)} ${first.decay > 0 ? "meat" : RES_KEY[first.res]}</span>`;
      if (first.decay > 0) this.lines[0].textContent = "Meat rots: gather it soon";
      return;
    }
    if (first instanceof Unit && first.isAnimal) {
      const a = first.animal!;
      this.stats.innerHTML = this.stat("attack", a.attack, a.attack, "Attack") + this.stat("carry", a.food, a.food, "Food when hunted");
      this.lines[0].textContent = a.behavior === "aggressive" ? "Dangerous: attacks anything near" : a.behavior === "defend" ? "Fights back when attacked" : "Runs when approached";
      return;
    }
    if (first instanceof Unit) {
      // The original's status box: each number as base + what upgrades and the civilization add.
      const d = first.def, st = w.stats(first);
      if (first.isPriest) {
        this.stats.innerHTML = this.stat("faith", 100, Math.floor(first.faith), "Faith") + this.stat("range", d.range, st.range, "Range");
      } else {
        this.stats.innerHTML = this.stat("attack", d.attack, st.attack, "Attack") + this.stat("armor", d.armor, st.armor, "Armor")
          + this.stat("pierce", d.pierce_armor, st.pierce_armor, "Pierce armor")
          + (d.range > 0 ? this.stat("range", d.range, st.range, "Range") : this.stat("los", d.los, st.los, "Line of sight"));
      }
      if (first.carry > 0 && first.carryRes !== null) this.lines[0].textContent = `Carrying ${Math.floor(first.carry)} ${first.carryKind === "meat" ? "meat" : RES_KEY[first.carryRes]}`;
      if (d.bonus) this.lines[1].textContent = "Bonus " + Object.entries(d.bonus).map(([k, v]) => `+${v} vs ${k}`).join(", ");
      return;
    }
    if (first instanceof Building) {
      if (first.def.attack) {
        const st = w.bstats(first);
        this.stats.innerHTML = this.stat("attack", first.def.attack, st.attack, "Attack") + this.stat("range", first.def.range ?? 0, st.range, "Range");
      }
      if (!first.complete) {
        this.lines[0].textContent = `Under construction ${Math.floor(first.progress * 100)}%`;
        this.showProgress(first.progress);
      } else if (first.queue.length) {
        // What it is working on, as icons: the first is in progress.
        const q = first.queue[0];
        const what = q.kind === "age" ? w.rules.ages[Number(q.id)].name : q.kind === "tech" ? w.rules.techs.get(q.id)?.name : w.rules.units.get(q.id)?.name;
        this.lines[0].textContent = `${q.kind === "unit" ? "Training" : q.kind === "age" ? "Advancing to" : "Researching"} ${what}`;
        this.queue.innerHTML = first.queue.map((x) => `<img src="${this.iconUrl(x.kind === "age" ? "age" : x.id)}" alt="">`).join("");
        this.showProgress(w.trainProgress(first));
      } else if (first.isFarm) this.lines[0].textContent = `${Math.floor(first.food)} food left`;
      else if ((first.def.pop_provided ?? 0) > 0 && first.owner === me) this.lines[0].textContent = `Houses ${first.def.pop_provided} people`;
      if (first.def.drop_off && first.owner === me && !first.queue.length) {
        const kinds = first.def.food_kinds;
        const what = first.def.drop_off.map((k) => (k === "food" && kinds ? (kinds.includes("meat") ? "meat" : "berries and farm food") : k));
        this.lines[1].textContent = `Drop off: ${what.join(", ")}`;
      }
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

  private showProgress(f: number) {
    this.progress.hidden = false;
    this.progressBar.style.width = `${f * 100}%`;
  }

  // ---- command icons

  /** Shows a menu. Pinned commands sit at the end of every page; long menus get a Next button. */
  setCommands(cmds: Command[]) {
    this.commands = cmds;
    const menu = cmds.map((c) => c.title).join("|");
    const fresh = menu !== this.menuKey;
    if (fresh) { this.menuKey = menu; this.page = 0; }
    const pinned = cmds.filter((c) => c.pin), rest = cmds.filter((c) => !c.pin);
    let shown: Command[];
    if (rest.length + pinned.length <= SLOTS) shown = [...rest, ...pinned];
    else {
      const per = SLOTS - pinned.length - 1;
      const pages = Math.ceil(rest.length / per);
      this.page %= pages;
      const next: Command = { key: "", title: `More (${this.page + 1}/${pages})`, detail: "next page", blocker: null, icon: "next",
        action: () => { this.page++; this.signature = ""; this.menuKey = menu; this.setCommands(this.commands); } };
      shown = [...rest.slice(this.page * per, this.page * per + per), next, ...pinned];
    }
    const sig = `${this.page}#` + shown.map((c) => `${c.key}|${c.title}|${c.blocker}`).join(";");
    if (sig === this.signature) { this.shown = shown; return; }
    this.signature = sig;
    this.shown = shown;
    const animate = fresh || sig.startsWith(`${this.page}#`) && this.grid.dataset.page !== String(this.page);
    this.grid.dataset.page = String(this.page);
    this.grid.innerHTML = shown.map((c, i) => {
      const key = c.key === "Escape" ? "Esc" : c.key === "Delete" ? "" : c.key;
      const icon = c.icon ? `<img src="${this.iconUrl(c.icon)}" alt="${c.title}">` : `<span>${c.title}</span>`;
      return `<button data-i="${i}" class="${c.blocker ? "off" : ""}${animate ? " pop" : ""}" style="--i:${i}" aria-label="${c.title}">${icon}${key ? `<b>${key}</b>` : ""}</button>`;
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

  showOverlay(title: string, lines: string[], kind = "") {
    this.overlay.innerHTML = `<div class="card ${kind}"><h1>${title}</h1>${lines.map((l) => `<p>${l}</p>`).join("")}</div>`;
    this.overlay.hidden = false;
  }

  hideOverlay() { this.overlay.hidden = true; }
  get overlayShown() { return !this.overlay.hidden; }
}
