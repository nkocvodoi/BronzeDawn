// Human-readable tables (Markdown) of everything in empires.dat that matters for balance.

import type { DatFile, DatUnit } from "./dat";
import { describe } from "./convert";
import { ARMOR_CLASSES, UNIT_CLASSES, name } from "./names";

export type Strings = (id: number) => string;

const RES = ["food", "wood", "stone", "gold"];
const costText = (c: { type: number; amount: number }[]) =>
  c.filter((x) => x.type >= 0 && x.type <= 3 && x.amount > 0).map((x) => `${x.amount} ${RES[x.type]}`).join(", ") || "-";
const cls = (list: { class: number; amount: number }[] | undefined) =>
  (list ?? []).map((a) => `${name(ARMOR_CLASSES, a.class)}:${a.amount}`).join(" ") || "-";
const esc = (s: string) => s.replace(/\|/g, "\\|");

export function unitLabel(u: DatUnit | null | undefined, str: Strings): string {
  if (!u) return "?";
  const shown = str(u.nameStringId);
  return shown && shown !== u.name ? `${shown} (${u.name})` : u.name;
}

export function tables(dat: DatFile, str: Strings, title: string): Record<string, string> {
  const civ = dat.civs[1];
  const all = new Map<number, DatUnit>();
  for (const c of [dat.civs[0], civ]) for (const u of c.units) if (u && !all.has(u.id)) all.set(u.id, u);
  const units = [...all.values()].sort((a, b) => a.id - b.id);
  const label = (id: number) => unitLabel(all.get(id), str);
  const techName = (id: number) => (dat.techs[id] ? str(dat.techs[id].nameStringId) || dat.techs[id].name : `#${id}`);
  const out: Record<string, string> = {};

  const head = (t: string) => `# ${title}: ${t}\n\nExtracted from empires.dat (${dat.version}). Units: tiles, seconds, hit points.\n\n`;

  // Creatable units.
  {
    let s = head("units");
    s += "| id | unit | class | cost | train s | trained at | HP | attack | armor | base armor | range | min range | reload s | speed | LOS | blast | accuracy % | projectile |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";
    for (const u of units) {
      if (u.type !== 70 || !u.creatable) continue;
      const c = u.combat;
      s += `| ${u.id} | ${esc(label(u.id))} | ${name(UNIT_CLASSES, u.class)} | ${costText(u.creatable.costs)} | ${u.creatable.trainTime} | ${u.creatable.trainLocationId >= 0 ? esc(label(u.creatable.trainLocationId)) : "-"} | ${u.hitPoints} | ${cls(c?.attacks)} | ${cls(c?.armors)} | ${c?.baseArmor ?? "-"} | ${c?.maxRange ?? "-"} | ${c?.minRange ?? "-"} | ${c?.reloadTime ?? "-"} | ${u.speed ?? "-"} | ${u.lineOfSight} | ${c?.blastWidth ?? "-"} | ${c?.accuracyPercent ?? "-"} | ${c && c.projectileUnitId >= 0 ? esc(label(c.projectileUnitId)) : "-"} |\n`;
    }
    s += "\nAttack and armor are lists of `class:amount`. Damage of one hit = the sum, over every attack class the target also has in its armor list, of `attack - armor` (a negative armor is a weakness: that class does extra damage); at least 1. Class 3 is pierce, class 4 is melee; the other classes are the bonus classes of the original (for example a unit with armor `class 9:-5` takes 5 extra from attacks carrying class 9).\n";
    out["units.md"] = s;
  }

  // Buildings.
  {
    let s = head("buildings");
    s += "| id | building | cost | build s | HP | armor | attack | range | reload s | LOS | provides | size |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n";
    for (const u of units) {
      if (u.type !== 80) continue;
      const c = u.combat;
      const pop = u.resourceStorages.filter((r) => r.type === 4 && r.amount > 0).map((r) => `${r.amount} pop`).join(", ");
      s += `| ${u.id} | ${esc(label(u.id))} | ${u.creatable ? costText(u.creatable.costs) : "-"} | ${u.creatable?.trainTime ?? "-"} | ${u.hitPoints} | ${cls(c?.armors)} | ${cls(c?.attacks)} | ${c?.maxRange || "-"} | ${c?.reloadTime || "-"} | ${u.lineOfSight} | ${pop || "-"} | ${u.clearanceSize.map((v) => v * 2).join("×")} |\n`;
    }
    out["buildings.md"] = s;
  }

  // Economy: villager jobs, resources, animals.
  {
    let s = head("economy");
    s += "## Starting resources (every civ)\n\n";
    s += `food ${civ.resources[0]}, wood ${civ.resources[1]}, stone ${civ.resources[2]}, gold ${civ.resources[3]}\n\n`;
    s += "## Villager jobs\n\nA villager becomes one of these units when it starts a job. Work rate is resource per second while working; carry is the load it walks back with.\n\n";
    s += "| id | job | work rate /s | carry | speed | HP | attack | tasks (action → resource, range, working graphic) |\n|---|---|---|---|---|---|---|---|\n";
    for (const id of [83, 118, 156, 120, 122, 259, 119, 123, 251, 124, 127, 13, 14, 15, 16]) {
      const u = all.get(id);
      if (!u) continue;
      const tasks = (u.action?.tasks ?? []).map((t) => `${t.actionType}${t.resourceIn >= 0 ? `→${RES[t.resourceIn] ?? `res ${t.resourceIn}`}` : ""}${t.workRange ? ` r${t.workRange}` : ""}${t.workValue1 ? ` v${t.workValue1}` : ""}`).join("; ");
      s += `| ${id} | ${esc(label(id))} | ${u.action?.workRate ?? "-"} | ${u.resourceCapacity} | ${u.speed ?? "-"} | ${u.hitPoints} | ${cls(u.combat?.attacks)} | ${esc(tasks) || "-"} |\n`;
    }
    s += "\n## Resource objects\n\n| id | object | resource | amount | decay /s | HP |\n|---|---|---|---|---|---|\n";
    for (const u of units) {
      const r = u.resourceStorages.find((x) => x.type >= 0 && x.type <= 3 && x.amount > 0);
      if (!r || u.type === 70 || u.type === 80) continue;
      s += `| ${u.id} | ${esc(label(u.id))} | ${RES[r.type]} | ${r.amount} | ${u.resourceDecay || "-"} | ${u.hitPoints} |\n`;
    }
    s += "\n## Animals\n\n| id | animal | HP | attack | armor | reload s | speed | LOS | food | carcass | carcass decay /s |\n|---|---|---|---|---|---|---|---|---|---|---|\n";
    for (const u of units) {
      if (u.type !== 70 || (u.class !== 9 && u.class !== 10)) continue;
      const food = u.resourceStorages.find((x) => x.type === 0);
      const dead = all.get(u.deadUnitId);
      s += `| ${u.id} | ${esc(label(u.id))} | ${u.hitPoints} | ${cls(u.combat?.attacks)} | ${cls(u.combat?.armors)} | ${u.combat?.reloadTime ?? "-"} | ${u.speed ?? "-"} | ${u.lineOfSight} | ${food?.amount ?? "-"} | ${dead ? esc(label(dead.id)) : "-"} | ${dead?.resourceDecay ?? "-"} |\n`;
    }
    out["economy.md"] = s;
  }

  // Techs.
  {
    let s = head("technologies");
    s += "| id | tech | at | cost | time s | requires | effects |\n|---|---|---|---|---|---|---|\n";
    for (const t of dat.techs) {
      const eff = dat.effects[t.effectId];
      const shown = str(t.nameStringId) || t.name;
      if (!shown) continue;
      const req = t.requiredTechs.filter((r) => r >= 0).map((r) => esc(techName(r)));
      const need = t.requiredTechCount < req.length ? `${t.requiredTechCount} of: ` : "";
      const effects = (eff?.commands ?? []).filter((k) => !(k.type === 1 && k.a === 21)).map((k) => esc(describe(k, label, techName))).join("<br>");
      s += `| ${t.id} | ${esc(shown)}${shown !== t.name ? ` (${esc(t.name)})` : ""} | ${t.locationId >= 0 ? esc(label(t.locationId)) : "-"} | ${costText(t.costs)} | ${t.researchTime} | ${need}${req.join(", ") || "-"} | ${effects || "-"} |\n`;
    }
    out["techs.md"] = s;
  }

  // Civs.
  {
    let s = head("civilizations");
    for (const c of dat.civs.slice(1)) {
      const eff = dat.effects[c.techTreeEffect];
      const cmds = eff?.commands ?? [];
      const bonus = cmds.filter((k) => k.type !== 102).map((k) => describe(k, label, techName));
      const off = cmds.filter((k) => k.type === 102).map((k) => techName(k.d));
      s += `## ${c.name}\n\nArchitecture set ${c.iconSet}. Tech tree effect #${c.techTreeEffect}.\n\n**Bonuses**\n\n${bonus.map((b) => `- ${b}`).join("\n") || "- none"}\n\n**Cannot research**\n\n${off.join(", ") || "-"}\n\n`;
    }
    out["civs.md"] = s;
  }

  // Ages.
  {
    let s = head("ages");
    for (const id of [100, 101, 102, 103]) {
      const t = dat.techs[id];
      if (!t) continue;
      const eff = dat.effects[t.effectId];
      s += `## ${str(t.nameStringId) || t.name}\n\nCost ${costText(t.costs)}, ${t.researchTime} s, requires ${t.requiredTechCount} of ${t.requiredTechs.filter((r) => r >= 0).map(techName).join(", ") || "-"}.\n\n${(eff?.commands ?? []).map((k) => `- ${describe(k, label, techName)}`).join("\n")}\n\n`;
    }
    out["ages.md"] = s;
  }
  return out;
}
