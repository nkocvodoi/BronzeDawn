// Everything drawn on top of the map, in plain HTML so text stays sharp at any zoom.
import { Building, Entity, ResourceNode, Unit } from "../core/entities";
import { isRanged, RES_ALL, RES_KEY, RES_LABEL } from "../core/rules";
import { clock } from "../core/sim";
import type { World } from "../core/world";
import { iconPic, playerColor, resourceIcons, stoneTexture } from "./art";

/** One command button: a hotkey, a label, a cost, and why it is greyed out. */
export interface Command {
  key: string; title: string; detail: string; blocker: string | null; action: () => void;
  /** A unit, building or tech id to draw on the button. */
  icon?: string;
  /** A longer line for the tooltip, such as what a technology does. */
  help?: string;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

export class HUD {
  private res = RES_ALL.map((r) => $(`#res-${RES_KEY[r]}`));
  private pop = $("#pop");
  private age = $("#age");
  private time = $("#clock");
  private speedLabel = $("#speed");
  private title = $("#info-title");
  private lines = [0, 1, 2, 3].map((i) => $(`#info-${i}`));
  private hp = $("#hp");
  private hpBar = $("#hp-bar");
  private progress = $("#progress");
  private progressBar = $("#progress-bar");
  private grid = $("#commands");
  private tip = $("#tooltip");
  private messages = $("#messages");
  private overlay = $("#overlay");
  readonly minimap = $<HTMLCanvasElement>("#minimap");
  commands: Command[] = [];
  private signature = "";

  private portraitCanvas = $<HTMLCanvasElement>("#portrait");
  private portraitSource: HTMLCanvasElement | null = null;

  constructor() {
    // Pixel art for the frame: carved stone panels and resource icons.
    document.documentElement.style.setProperty("--stone", `url(${stoneTexture()})`);
    resourceIcons().forEach((url, i) => { this.res[i].style.backgroundImage = `url(${url})`; });
    this.grid.addEventListener("mousemove", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      const c = b ? this.commands[Number(b.dataset.i)] : null;
      if (!c) { this.tip.hidden = true; return; }
      const key = c.key === "Escape" ? "Esc" : c.key;
      this.tip.textContent = `${c.title} (${key})${c.detail ? `: ${c.detail}` : ""}${c.help ? `. ${c.help}` : ""}${c.blocker ? `  ${c.blocker}` : ""}`;
      this.tip.classList.toggle("blocked", !!c.blocker);
      this.tip.hidden = false;
    });
    this.grid.addEventListener("mouseleave", () => { this.tip.hidden = true; });
    this.grid.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (b) this.run(this.commands[Number(b.dataset.i)]);
    });
  }

  private icons = new Map<string, string>();
  private iconUrl(id: string) {
    let url = this.icons.get(id);
    if (!url) { url = iconPic(id).toDataURL(); this.icons.set(id, url); }
    return url;
  }

  speed(x: number) {
    this.speedLabel.textContent = `${x}x`;
    this.speedLabel.classList.toggle("fast", x > 1);
  }

  run(c: Command | undefined) {
    if (!c) return;
    if (c.blocker) this.message(c.blocker, "warn");
    else c.action();
  }

  update(w: World, me: number, sel: Entity[]) {
    const p = w.players[me];
    RES_ALL.forEach((r, i) => { this.res[i].textContent = `${RES_LABEL[r]} ${Math.floor(p.res.get(r))}`; });
    this.pop.textContent = `Pop ${Math.ceil(p.pop - 1e-9)}/${p.popCap}`;
    this.pop.classList.toggle("warn", p.pop >= p.popCap);
    this.age.textContent = w.rules.ages[p.age].name;
    // A Wonder countdown, as in the original: whoever's Wonder stands until the clock runs out wins.
    const wonder = w.players.find((x) => x.wonderAt !== null);
    this.time.textContent = wonder ? `Wonder (${wonder.name}) ${clock(Math.max(0, wonder.wonderAt! - w.time))} · ${clock(w.time)}` : clock(w.time);
    this.time.classList.toggle("warn", !!wonder && wonder.id !== me);

    this.hp.hidden = true;
    this.progress.hidden = true;
    this.lines.forEach((l) => (l.textContent = ""));
    this.title.style.color = "";
    const first = sel[0];
    if (!first) { this.title.textContent = ""; return; }
    if (sel.length > 1) {
      const counts = new Map<string, number>();
      for (const e of sel) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
      this.title.textContent = `${sel.length} selected`;
      const parts = [...counts].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${c} ${n}`);
      this.lines[0].textContent = parts.slice(0, 3).join(", ");
      this.lines[1].textContent = parts.slice(3).join(", ");
      return;
    }
    const enemy = first.owner >= 0 && first.owner !== me;
    this.title.textContent = first.name + (enemy ? `  (${w.players[first.owner].name})` : "");
    if (enemy) this.title.style.color = playerColor(first.owner);
    if (first instanceof ResourceNode) {
      this.lines[0].textContent = `${Math.floor(first.amount)} ${RES_KEY[first.res]} left`;
      if (first.decay > 0) this.lines[1].textContent = "Meat rots: gather it soon";
      return;
    }
    if (first instanceof Unit && first.isAnimal) {
      const a = first.animal!;
      this.title.style.color = "";
      this.lines[0].textContent = `HP ${Math.ceil(first.hp)}/${first.maxHp}`;
      this.lines[1].textContent = `${a.food} food when hunted by villagers`;
      this.lines[2].textContent = a.behavior === "aggressive" ? "Dangerous: attacks anything near" : a.behavior === "defend" ? "Fights back when attacked" : "Runs when approached";
      return;
    }
    const f = Math.max(0, first.hp / first.maxHp);
    this.hp.hidden = false;
    this.hpBar.style.width = `${f * 100}%`;
    this.hpBar.style.background = f > 0.5 ? "#3c3" : f > 0.25 ? "#dd3" : "#d33";
    this.lines[0].textContent = `HP ${Math.ceil(first.hp)}/${first.maxHp}`;
    if (first instanceof Unit) {
      // The numbers after this player's techs and civilization, as the original's status box shows.
      const d = first.def, st = w.stats(first);
      const r = (x: number) => Math.round(x * 10) / 10;
      this.lines[1].textContent = first.isPriest
        ? `Faith ${Math.floor(first.faith)}%   Range ${r(st.range)}`
        : `Attack ${r(st.attack)}${isRanged(d) ? ` (range ${r(st.range)})` : ""}   Armor ${r(st.armor)}/${r(st.pierce_armor)}`;
      if (first.carry > 0 && first.carryRes !== null) this.lines[2].textContent = `Carrying ${Math.floor(first.carry)} ${first.carryKind === "meat" ? "meat" : RES_KEY[first.carryRes]}`;
      if (d.bonus) this.lines[3].textContent = "Bonus " + Object.entries(d.bonus).map(([k, v]) => `+${v} vs ${k}`).join(", ");
      if (first.owner >= 0 && first.owner === me && w.players[me].civ && !first.isVillager && !d.bonus) this.lines[3].textContent = w.players[me].civ!.name;
    } else if (first instanceof Building) {
      if (!first.complete) {
        this.lines[1].textContent = `Under construction ${Math.floor(first.progress * 100)}%`;
        this.showProgress(first.progress);
      } else if (first.queue[0]?.kind === "age") {
        this.lines[1].textContent = `Advancing to ${w.rules.ages[Number(first.queue[0].id)].name}`;
        this.showProgress(w.trainProgress(first));
      } else if (first.queue[0]?.kind === "tech") {
        const more = first.queue.length > 1 ? `  (+${first.queue.length - 1} queued)` : "";
        this.lines[1].textContent = `Researching ${w.rules.techs.get(first.queue[0].id)?.name}${more}`;
        this.showProgress(w.trainProgress(first));
      } else if (first.queue.length) {
        const more = first.queue.length > 1 ? `  (+${first.queue.length - 1} queued)` : "";
        this.lines[1].textContent = `Training ${w.rules.units.get(first.queue[0].id)?.name}${more}`;
        this.showProgress(w.trainProgress(first));
      }
      if (first.isFarm) this.lines[2].textContent = `${Math.floor(first.food)} food left`;
      if ((first.def.pop_provided ?? 0) > 0 && first.owner === me) this.lines[2].textContent = `Houses ${first.def.pop_provided} people`;
      if (first.def.drop_off && first.owner === me) this.lines[3].textContent = `Drop off: ${first.def.drop_off.join(", ")}`;
    }
  }

  /** The selected entity's picture, scaled up with hard pixels. */
  portrait(src: HTMLCanvasElement | null) {
    if (src === this.portraitSource) return;
    this.portraitSource = src;
    const c = this.portraitCanvas, g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    c.hidden = !src;
    if (!src) return;
    const k = Math.max(1, Math.floor(Math.min(c.width / src.width, c.height / src.height)));
    g.imageSmoothingEnabled = false;
    g.drawImage(src, (c.width - src.width * k) / 2, (c.height - src.height * k) / 2, src.width * k, src.height * k);
  }

  private showProgress(f: number) {
    this.progress.hidden = false;
    this.progressBar.style.width = `${f * 100}%`;
  }

  setCommands(cmds: Command[]) {
    this.commands = cmds;
    const sig = cmds.map((c) => `${c.key}|${c.title}|${c.detail}|${c.blocker}`).join(";");
    if (sig === this.signature) return;
    this.signature = sig;
    this.grid.innerHTML = cmds.map((c, i) => {
      const key = c.key === "Escape" ? "Esc" : c.key;
      const icon = c.icon ? `<img src="${this.iconUrl(c.icon)}" alt="">` : "";
      return `<button data-i="${i}" class="${c.blocker ? "off" : ""}">${icon}<b>${key}</b><span>${c.title}</span><small>${c.detail}</small></button>`;
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
