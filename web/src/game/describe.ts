// Plain words for what technologies and civilization bonuses do, from their effects in rules.json.
import type { CivDef, Effect, Rules, TechDef } from "../core/rules";

/** Unit and building tags in words. */
const TAGS: Record<string, string> = {
  archery: "Archery Range units", stable: "Stable units", academy: "Academy units", barracks: "Barracks units",
  infantry: "infantry", melee: "melee units", missile: "missile units", siege: "siege", catapult: "Stone Throwers",
  chariot: "chariots", elephant: "elephants", mounted: "mounted units", priest: "priests", swordsman: "swordsmen",
  cavalry: "cavalry", military: "military units", tower: "towers", wall: "walls", "*": "buildings",
};
const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;

/** One line on what a list of effects does. */
export function describeEffects(effects: Effect[], rules: Rules): string[] {
  const name = (id: string) => rules.units.get(id)?.name ?? rules.buildings.get(id)?.name ?? id;
  const who = (e: Extract<Effect, { type: "stat" }>) => {
    const t2 = e.target;
    if (t2.units) return t2.units.map(name).join(", ");
    if (t2.tags) return t2.tags.map((x) => TAGS[x] ?? x).join(", ");
    if (t2.buildings) return t2.buildings.map(name).join(", ");
    if (t2.buildings_tags) {
      const pos = t2.buildings_tags.filter((x) => !x.startsWith("!")), neg = t2.buildings_tags.filter((x) => x.startsWith("!"));
      const base = pos.length ? pos.map((x) => TAGS[x] ?? x).join(" and ") : "buildings";
      return neg.length ? `${base} except ${neg.map((x) => TAGS[x.slice(1)] ?? x.slice(1)).join(", ")}` : base;
    }
    return "";
  };
  return effects.map((e) => {
    switch (e.type) {
      case "stat": {
        if (e.stat === "attack_cooldown" && e.op === "mul") return `${who(e)} attack ${pct(1 / e.value - 1)} faster`;
        if (e.stat === "cost" && e.op === "mul") return `${who(e)} cost ${pct(1 - e.value)} ${e.value < 1 ? "less" : "more"}`;
        if (e.stat === "train_time" && e.op === "mul" && e.value < 1) return `${who(e)} trained ${pct(1 / e.value - 1)} faster`;
        if (e.stat === "pop" && e.op === "mul") return `${who(e)} take ${e.value === 0.5 ? "half" : pct(e.value)} the population room`;
        const v = e.op === "add" ? `${e.value > 0 ? "+" : ""}${e.value}` : e.value < 1 ? `-${pct(1 - e.value)}` : `+${pct(e.value - 1)}`;
        const stat = { hp: "hit points", pierce_armor: "pierce armor", los: "line of sight", build_time: "build time" }[e.stat] ?? e.stat;
        return `${v} ${stat} for ${who(e)}`;
      }
      case "gather": {
        const what = e.resource === "all" ? "all gathering" : e.kind === "hunt" ? "hunting" : e.kind === "forage" ? "foraging" : `${e.resource} gathering`;
        return `${what} ${e.rate >= 1 ? "+" : "-"}${pct(e.rate - 1)}${e.carry ? `, carry +${e.carry}` : ""}`;
      }
      case "upgrade": return `${name(e.from)} becomes ${name(e.to)}`;
      case "farm_food": return `farms ${e.op === "add" ? `+${e.value}` : `x${e.value}`} food`;
      case "mine_yield": return `gold mines yield +${Math.round((e.value - 1) * 100)}%`;
      case "flag": return e.flag === "ballistics" ? "siege leads moving targets" : "priests convert buildings and priests";
      case "conversion":
        return e.stat === "resist" ? `units ${e.value}x harder to convert` : e.stat === "regen" ? `priests regain faith ${pct(e.value - 1)} faster` : `conversion ${pct(e.value - 1)} faster`;
      case "carry": return `villagers carry ${e.value}`;
      case "heal": return `priests heal x${e.value}`;
    }
  });
}

/** One line on what a technology does, for its tooltip. */
export function describe(t: TechDef, rules: Rules): string {
  const parts = describeEffects(t.effects, rules);
  const unlocks = [...rules.units.values(), ...rules.buildings.values()].filter((d) => d.requires_tech === t.id).map((d) => d.name);
  if (unlocks.length && !t.effects.some((e) => e.type === "upgrade")) parts.push(`unlocks ${unlocks.join(", ")}`);
  return parts.join("; ");
}

/** A civilization's bonuses, one per line, and what it cannot build. */
export function describeCiv(c: CivDef, rules: Rules): string[] {
  const name = (id: string) => rules.units.get(id)?.name ?? rules.buildings.get(id)?.name ?? rules.techs.get(id)?.name ?? id;
  const out = describeEffects(c.effects, rules);
  // A technology that only upgrades to or unlocks a missing unit or building goes without saying.
  const off = new Set(c.disabled);
  const implied = (id: string) => {
    const t = rules.techs.get(id);
    if (!t) return false;
    const unlocks = [...rules.units.values(), ...rules.buildings.values()].filter((d) => d.requires_tech === id);
    return t.effects.some((e) => e.type === "upgrade" && off.has(e.to)) || unlocks.some((d) => off.has(d.id));
  };
  const shown = [...new Set(c.disabled.filter((id) => !implied(id)).map(name))];
  if (shown.length) out.push(`no ${shown.join(", ")}`);
  return out;
}
