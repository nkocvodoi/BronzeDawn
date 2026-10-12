// Meaning of the numeric codes inside empires.dat (AoE / Rise of Rome).
// Names marked "?" are inferred from how the data uses them and are not certain.

/** Unit classes (DatUnit.class, and the class field of effect commands). */
export const UNIT_CLASSES: Record<number, string> = {
  0: "Archer", 1: "Artifact", 2: "Trade Boat", 3: "Building", 4: "Civilian", 5: "Sea Fish", 6: "Infantry",
  7: "Berry Bush", 8: "Stone Mine", 9: "Prey Animal", 10: "Predator Animal", 11: "Other", 12: "Cavalry",
  13: "Siege Weapon", 14: "Terrain", 15: "Tree", 16: "Tree Stump", 18: "Priest", 19: "Fishing Boat?",
  20: "Transport Boat", 21: "Fishing Boat", 22: "War Boat", 23: "Chariot Archer", 24: "War Elephant",
  25: "Hero", 26: "Elephant Archer", 27: "Wall", 28: "Phalanx", 29: "Domestic Animal", 30: "Flag",
  32: "Gold Mine", 33: "Shore Fish", 34: "Cliff", 35: "Chariot", 36: "Cavalry Archer", 37: "Doppelganger",
  38: "Bird", 39: "Slinger",
};

/** Unit types (DatUnit.type): which data blocks a unit has. */
export const UNIT_TYPES: Record<number, string> = {
  10: "eye candy", 15: "tree (AoE)", 20: "flag", 25: "unused", 30: "moving (dead/fish)", 40: "action (bird)",
  50: "combat", 60: "projectile", 70: "creatable (unit)", 80: "building", 90: "tree",
};

/** Attack and armour classes: the high byte of an attack/armour value, or the class of an attack entry. */
export const ARMOR_CLASSES: Record<number, string> = {
  1: "class 1?", 2: "class 2?", 3: "pierce", 4: "melee", 5: "class 5?", 6: "siege/stone?", 7: "class 7?",
};

/** Unit attributes changed by effect commands (field c). */
export const ATTRIBUTES: Record<number, string> = {
  0: "hit points", 1: "line of sight", 2: "garrison capacity", 3: "size x", 4: "size y", 5: "movement speed",
  6: "rotation speed", 8: "armor", 9: "attack", 10: "reload time", 11: "accuracy %", 12: "max range",
  13: "work rate", 14: "carry capacity", 15: "base armor", 16: "projectile unit", 17: "graphics angle (age look)",
  18: "terrain defense bonus", 19: "smart projectiles", 20: "min range", 21: "first resource storage",
  22: "blast width", 23: "search radius", 100: "resource cost", 101: "attribute 101 (population cost?)",
};

/** Player resources (civ resource list, and the resource field of effect commands). */
export const RESOURCES: Record<number, string> = {
  0: "food", 1: "wood", 2: "stone", 3: "gold", 4: "population headroom", 5: "conversion range?",
  6: "current age", 7: "relics captured", 8: "trade bonus?", 9: "trade goods", 10: "trade production?",
  11: "current population", 12: "corpse decay time", 13: "remarkable discovery", 14: "ruins captured",
  15: "meat storage", 16: "berry storage", 17: "fish storage", 19: "total units owned", 20: "units killed",
  21: "technology count", 22: "% map explored", 23: "bronze age tech id?", 24: "iron age tech id?",
  25: "tool age tech id?", 26: "attack warning sound?", 27: "enable priest conversion",
  28: "enable building conversion", 30: "building limit?", 31: "food limit?", 32: "unit limit (pop cap)",
  33: "food maintenance?", 34: "faith", 35: "faith recharging rate", 36: "farm food amount",
  37: "civilian population", 39: "all techs achieved", 40: "military population", 41: "conversions",
  42: "standing wonders", 43: "razings", 44: "kill ratio", 45: "survival to finish", 46: "tribute inefficiency",
  47: "gold mining productivity", 48: "town center unavailable", 49: "gold counter", 50: "reveal ally",
  52: "temples?", 53: "tribute sent", 54: "all ruins captured", 55: "all relics captured",
};

/** Effect command types (field type). */
export const COMMANDS: Record<number, string> = {
  0: "set attribute", 1: "change resource", 2: "enable/disable unit", 3: "upgrade unit", 4: "add to attribute",
  5: "multiply attribute", 6: "multiply resource", 101: "change tech cost?", 102: "disable tech",
  103: "change tech time?",
};

/** Tech locations and unit train locations are unit ids (a building). */
export const name = (table: Record<number, string>, id: number): string => table[id] ?? `#${id}`;
