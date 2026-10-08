// Everything drawn on top of the map, in plain HTML so text stays sharp at any zoom.
import { Building, Entity, ResourceNode, Unit } from "../core/entities";
import { isRanged, RES_ALL, RES_KEY, RES_LABEL } from "../core/rules";
import { clock } from "../core/sim";
import type { World } from "../core/world";
import { playerColor } from "./art";

/** One command button: a hotkey, a label, a cost, and why it is greyed out. */
export interface Command { key: string; title: string; detail: string; blocker: string | null; action: () => void }

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

export class HUD {
  private res = RES_ALL.map((r) => $(`#res-${RES_KEY[r]}`));
  private pop = $("#pop");
  private age = $("#age");
  private time = $("#clock");
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

  constructor() {
    this.grid.addEventListener("mousemove", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      const c = b ? this.commands[Number(b.dataset.i)] : null;
      if (!c) { this.tip.hidden = true; return; }
      this.tip.textContent = `${c.title} (${c.key})${c.detail ? `: ${c.detail}` : ""}${c.blocker ? `  ${c.blocker}` : ""}`;
      this.tip.classList.toggle("blocked", !!c.blocker);
      this.tip.hidden = false;
    });
    this.grid.addEventListener("mouseleave", () => { this.tip.hidden = true; });
    this.grid.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (b) this.run(this.commands[Number(b.dataset.i)]);
    });
  }

  run(c: Command | undefined) {
    if (!c) return;
    if (c.blocker) this.message(c.blocker, "warn");
    else c.action();
  }

  update(w: World, me: number, sel: Entity[]) {
    const p = w.players[me];
    RES_ALL.forEach((r, i) => { this.res[i].textContent = `${RES_LABEL[r]} ${Math.floor(p.res.get(r))}`; });
    this.pop.textContent = `Pop ${p.pop}/${p.popCap}`;
    this.pop.classList.toggle("warn", p.pop >= p.popCap);
    this.age.textContent = w.rules.ages[p.age].name;
    this.time.textContent = clock(w.time);

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
      return;
    }
    const f = Math.max(0, first.hp / first.maxHp);
    this.hp.hidden = false;
    this.hpBar.style.width = `${f * 100}%`;
    this.hpBar.style.background = f > 0.5 ? "#3c3" : f > 0.25 ? "#dd3" : "#d33";
    this.lines[0].textContent = `HP ${Math.ceil(first.hp)}/${first.maxHp}`;
    if (first instanceof Unit) {
      const d = first.def;
      this.lines[1].textContent = `Attack ${d.attack}${isRanged(d) ? ` (range ${d.range})` : ""}   Armor ${d.armor}/${d.pierce_armor}`;
      if (first.carry > 0 && first.carryRes !== null) this.lines[2].textContent = `Carrying ${Math.floor(first.carry)} ${RES_KEY[first.carryRes]}`;
      if (d.bonus) this.lines[3].textContent = "Bonus " + Object.entries(d.bonus).map(([k, v]) => `+${v} vs ${k}`).join(", ");
    } else if (first instanceof Building) {
      if (!first.complete) {
        this.lines[1].textContent = `Under construction ${Math.floor(first.progress * 100)}%`;
        this.showProgress(first.progress);
      } else if (first.researching !== null) {
        this.lines[1].textContent = `Advancing to ${w.rules.ages[first.researching].name}`;
        this.showProgress(w.trainProgress(first));
      } else if (first.queue.length) {
        const more = first.queue.length > 1 ? `  (+${first.queue.length - 1} queued)` : "";
        this.lines[1].textContent = `Training ${w.rules.units.get(first.queue[0])?.name}${more}`;
        this.showProgress(w.trainProgress(first));
      }
      if (first.isFarm) this.lines[2].textContent = `${Math.floor(first.food)} food left`;
      if ((first.def.pop_provided ?? 0) > 0 && first.owner === me) this.lines[2].textContent = `Houses ${first.def.pop_provided} people`;
      if (first.def.drop_off && first.owner === me) this.lines[3].textContent = `Drop off: ${first.def.drop_off.join(", ")}`;
    }
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
    this.grid.innerHTML = cmds.map((c, i) =>
      `<button data-i="${i}" class="${c.blocker ? "off" : ""}"><b>${c.key}</b><span>${c.title}</span><small>${c.detail}</small></button>`).join("");
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
