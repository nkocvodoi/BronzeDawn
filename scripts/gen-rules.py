#!/usr/bin/env python3
"""Writes data/rules.json, the four-age ruleset of the web build.

The numbers follow the 1997 game and The Rise of Rome as collected in
replica/game/aoe1-research.md (mechanics and numbers only). Edit here and rerun:

    python3 scripts/gen-rules.py && python3 <replica-skill>/replica-game-design/balance.py data/rules.json
"""

import json
import os

F, W, G, S = "food", "wood", "gold", "stone"


def cost(f=0, w=0, g=0, s=0):
    return {k: v for k, v in ((F, f), (W, w), (G, g), (S, s)) if v}


# ---------------------------------------------------------------- units

def unit(id, name, cls, age, at, c, t, hp, atk, arm, pa, rng, cd, spd, los, tags, **kw):
    u = {"id": id, "name": name, "class": cls, "age": age, "trained_at": at, "cost": c, "train_time": t,
         "hp": hp, "attack": atk, "armor": arm, "pierce_armor": pa, "range": rng, "attack_cooldown": cd,
         "speed": spd, "los": los, "pop": 1, "tags": tags}
    u.update(kw)
    return u


INF = ["barracks", "infantry", "melee"]
ACA = ["academy", "infantry", "melee"]
ARC = ["archery", "missile"]
STB = ["stable", "mounted", "melee"]

units = [
    unit("villager", "Villager", "worker", "stone", "town_center", cost(f=50), 20, 25, 3, 0, 0, 0, 1.5, 1.1, 4, ["villager"]),
    # Barracks
    unit("clubman", "Clubman", "infantry", "stone", "barracks", cost(f=50), 26, 40, 3, 0, 0, 0, 1.5, 1.2, 4, INF),
    unit("axeman", "Axeman", "infantry", "tool", "barracks", cost(f=50), 27, 50, 5, 0, 0, 0, 1.5, 1.2, 4, INF, requires_tech="battle_axe"),
    unit("slinger", "Slinger", "slinger", "tool", "barracks", cost(f=40, s=10), 24, 25, 2, 0, 2, 4, 1.5, 1.2, 5,
         ["barracks", "infantry", "missile"], bonus={"archer": 2, "tower": 7, "wall": 7}, projectile="stone"),
    unit("short_swordsman", "Short Swordsman", "infantry", "bronze", "barracks", cost(f=35, g=15), 27, 60, 7, 1, 0, 0, 1.5, 1.2, 4,
         INF + ["swordsman"], requires_tech="short_sword"),
    unit("broad_swordsman", "Broad Swordsman", "infantry", "bronze", "barracks", cost(f=35, g=15), 27, 70, 9, 1, 0, 0, 1.5, 1.2, 4,
         INF + ["swordsman"], requires_tech="broad_sword"),
    unit("long_swordsman", "Long Swordsman", "infantry", "iron", "barracks", cost(f=35, g=15), 27, 80, 11, 2, 0, 0, 1.5, 1.2, 4,
         INF + ["swordsman"], requires_tech="long_sword"),
    unit("legion", "Legion", "infantry", "iron", "barracks", cost(f=35, g=15), 27, 160, 13, 2, 0, 0, 1.5, 1.2, 4,
         INF + ["swordsman"], requires_tech="legion_tech"),
    # Academy
    unit("hoplite", "Hoplite", "hoplite", "bronze", "academy", cost(f=60, g=40), 36, 120, 17, 5, 0, 0, 1.5, 0.9, 4, ACA),
    unit("phalanx", "Phalanx", "hoplite", "iron", "academy", cost(f=60, g=40), 36, 120, 20, 7, 0, 0, 1.5, 0.9, 4, ACA, requires_tech="phalanx_tech"),
    unit("centurion", "Centurion", "hoplite", "iron", "academy", cost(f=60, g=40), 36, 160, 30, 8, 0, 0, 1.5, 0.9, 4, ACA, requires_tech="centurion_tech"),
    # Archery Range
    unit("bowman", "Bowman", "archer", "tool", "archery_range", cost(f=40, w=20), 30, 35, 3, 0, 0, 5, 1.4, 1.2, 7, ARC + ["foot_archer"]),
    unit("improved_bowman", "Improved Bowman", "archer", "bronze", "archery_range", cost(f=40, g=20), 30, 40, 4, 0, 0, 6, 1.4, 1.2, 8,
         ARC + ["foot_archer"], requires_tech="improved_bow"),
    unit("composite_bowman", "Composite Bowman", "archer", "bronze", "archery_range", cost(f=40, g=20), 30, 45, 5, 0, 0, 7, 1.4, 1.2, 9,
         ARC + ["foot_archer"], requires_tech="composite_bow"),
    unit("chariot_archer", "Chariot Archer", "chariot", "bronze", "archery_range", cost(f=40, w=70), 40, 70, 4, 0, 0, 7, 1.5, 2.0, 9,
         ARC + ["mounted", "chariot"], requires_tech="wheel", bonus={"priest": 8}, convert_resist=8),
    unit("horse_archer", "Horse Archer", "horse_archer", "iron", "archery_range", cost(f=50, g=70), 40, 60, 7, 0, 2, 7, 1.5, 2.2, 9,
         ARC + ["mounted"]),
    unit("heavy_horse_archer", "Heavy Horse Archer", "horse_archer", "iron", "archery_range", cost(f=50, g=70), 40, 90, 8, 0, 2, 7, 1.5, 2.5, 9,
         ARC + ["mounted"], requires_tech="heavy_horse_archer_tech"),
    unit("elephant_archer", "Elephant Archer", "elephant", "iron", "archery_range", cost(f=180, g=60), 50, 600, 5, 0, 0, 7, 1.5, 0.9, 9,
         ARC + ["elephant"]),
    # Stable
    unit("scout", "Scout", "cavalry", "tool", "stable", cost(f=100), 30, 60, 3, 0, 0, 0, 0.9, 2.0, 8, STB + ["cavalry"], ignores_villagers=True),
    unit("chariot", "Chariot", "chariot", "bronze", "stable", cost(f=40, w=60), 40, 100, 7, 0, 0, 0, 1.4, 2.0, 4,
         STB + ["chariot"], requires_tech="wheel", bonus={"priest": 7}, convert_resist=8),
    unit("scythe_chariot", "Scythe Chariot", "chariot", "iron", "stable", cost(f=40, w=60), 40, 120, 9, 2, 0, 0, 1.4, 2.0, 4,
         STB + ["chariot"], requires_tech="scythe_chariot_tech", bonus={"priest": 9}, convert_resist=8, trample=1.0),
    unit("cavalry", "Cavalry", "cavalry", "bronze", "stable", cost(f=70, g=80), 40, 150, 8, 0, 0, 0, 1.3, 2.0, 4,
         STB + ["cavalry"], bonus={"infantry": 5}),
    unit("heavy_cavalry", "Heavy Cavalry", "cavalry", "iron", "stable", cost(f=70, g=80), 40, 150, 10, 1, 1, 0, 1.3, 2.0, 4,
         STB + ["cavalry"], bonus={"infantry": 5}, requires_tech="heavy_cavalry_tech"),
    unit("cataphract", "Cataphract", "cavalry", "iron", "stable", cost(f=70, g=80), 40, 180, 12, 3, 1, 0, 1.3, 2.0, 4,
         STB + ["cavalry"], bonus={"infantry": 5}, requires_tech="cataphract_tech"),
    unit("war_elephant", "War Elephant", "elephant", "iron", "stable", cost(f=170, g=40), 50, 600, 15, 0, 0, 0, 1.5, 0.9, 5,
         STB + ["elephant"], trample=1.0),
    unit("armored_elephant", "Armored Elephant", "elephant", "iron", "stable", cost(f=170, g=40), 50, 600, 18, 2, 1, 0, 1.5, 0.8, 5,
         STB + ["elephant"], trample=1.0, bonus={"building": 40, "wall": 40}, requires_tech="armored_elephant_tech"),
    unit("camel_rider", "Camel Rider", "camel", "bronze", "stable", cost(f=70, g=60), 30, 125, 6, 0, 0, 0, 1.5, 2.0, 4,
         STB, bonus={"cavalry": 8, "horse_archer": 8, "chariot": 4}),
    # Siege Workshop
    unit("stone_thrower", "Stone Thrower", "siege", "bronze", "siege_workshop", cost(w=180, g=80), 60, 75, 50, 0, 0, 10, 5.0, 0.8, 13,
         ["siege", "catapult"], min_range=2, area=0.5, damage="melee", projectile="stone", convert_resist=1),
    unit("catapult", "Catapult", "siege", "iron", "siege_workshop", cost(w=180, g=80), 60, 75, 60, 0, 0, 12, 5.0, 0.8, 15,
         ["siege", "catapult"], min_range=2, area=1.5, damage="melee", projectile="stone", requires_tech="catapult_tech"),
    unit("heavy_catapult", "Heavy Catapult", "siege", "iron", "siege_workshop", cost(w=180, g=80), 60, 150, 60, 0, 0, 13, 5.0, 0.8, 16,
         ["siege", "catapult"], min_range=2, area=1.5, damage="melee", projectile="stone", requires_tech="heavy_catapult_tech",
         clears_trees=True),
    unit("ballista", "Ballista", "siege", "iron", "siege_workshop", cost(w=100, g=80), 50, 55, 40, 0, 0, 9, 3.0, 0.8, 11,
         ["siege", "bolt_thrower"], min_range=3, projectile="bolt"),
    unit("helepolis", "Helepolis", "siege", "iron", "siege_workshop", cost(w=100, g=80), 50, 55, 40, 0, 0, 10, 1.5, 0.8, 12,
         ["siege", "bolt_thrower"], min_range=3, projectile="bolt", requires_tech="helepolis_tech"),
    # Temple
    unit("priest", "Priest", "priest", "bronze", "temple", cost(g=125), 50, 25, 0, 0, 0, 10, 1.5, 0.8, 12, ["priest"],
         converts=True, heal=3),
]
# "Military" is everything trained to fight: not villagers, not priests.
for u in units:
    if u["id"] not in ("villager", "priest"):
        u["tags"] = u["tags"] + ["military"]

# ---------------------------------------------------------------- buildings

def building(id, name, age, c, hp, size, t, los, **kw):
    b = {"id": id, "name": name, "age": age, "cost": c, "hp": hp, "size": size, "build_time": t, "los": los}
    b.update(kw)
    return b


trains = {}
for u in units:
    trains.setdefault(u["trained_at"], []).append(u["id"])

buildings = [
    building("town_center", "Town Center", "stone", cost(w=200), 600, 3, 60, 7, pop_provided=4,
             drop_off=[F, W, G, S], trains=trains["town_center"], requires=[], tags=["town_center"]),
    building("house", "House", "stone", cost(w=30), 75, 2, 20, 3, pop_provided=4),
    building("granary", "Granary", "stone", cost(w=120), 350, 3, 30, 5, drop_off=[F], food_kinds=["plant"]),
    building("storage_pit", "Storage Pit", "stone", cost(w=120), 350, 3, 30, 4, drop_off=[F, W, G, S], food_kinds=["meat"]),
    building("barracks", "Barracks", "stone", cost(w=125), 350, 3, 30, 5, trains=trains["barracks"]),
    building("archery_range", "Archery Range", "tool", cost(w=150), 350, 3, 40, 4, requires=["barracks"], trains=trains["archery_range"]),
    building("stable", "Stable", "tool", cost(w=150), 350, 3, 40, 4, requires=["barracks"], trains=trains["stable"]),
    building("market", "Market", "tool", cost(w=150), 350, 3, 40, 5, requires=["granary"]),
    building("farm", "Farm", "tool", cost(w=75), 50, 3, 30, 4, requires=["market"], resource={F: 250}),
    building("small_wall", "Small Wall", "tool", cost(s=5), 200, 1, 8, 3, requires_tech="small_wall_tech", tags=["wall"]),
    building("medium_wall", "Medium Wall", "bronze", cost(s=5), 300, 1, 8, 3, requires_tech="medium_wall_tech", tags=["wall"]),
    building("fortification", "Fortification", "iron", cost(s=5), 400, 1, 8, 3, requires_tech="fortification_tech", tags=["wall"]),
    building("watch_tower", "Watch Tower", "tool", cost(s=150), 100, 2, 80, 8, requires_tech="watch_tower_tech",
             attack=3, range=5, attack_cooldown=1.5, tags=["tower"]),
    building("sentry_tower", "Sentry Tower", "bronze", cost(s=150), 150, 2, 80, 9, requires_tech="sentry_tower_tech",
             attack=4, range=6, attack_cooldown=1.5, tags=["tower"]),
    building("guard_tower", "Guard Tower", "iron", cost(s=150), 200, 2, 80, 10, requires_tech="guard_tower_tech",
             attack=6, range=7, attack_cooldown=1.5, tags=["tower"]),
    building("ballista_tower", "Ballista Tower", "iron", cost(s=150), 200, 2, 80, 10, requires_tech="ballista_tower_tech",
             attack=20, range=7, attack_cooldown=3.0, projectile="bolt", tags=["tower"]),
    building("government_center", "Government Center", "bronze", cost(w=175), 350, 3, 60, 6, requires=["market"]),
    building("temple", "Temple", "bronze", cost(w=200), 350, 3, 60, 5, requires=["market"], trains=trains["temple"]),
    building("academy", "Academy", "bronze", cost(w=200), 350, 3, 60, 5, requires=["stable"], trains=trains["academy"]),
    building("siege_workshop", "Siege Workshop", "bronze", cost(w=200), 350, 3, 60, 5, requires=["archery_range"], trains=trains["siege_workshop"]),
    building("wonder", "Wonder", "iron", cost(w=1000, g=1000, s=1000), 500, 5, 4000, 4, tags=["wonder"]),
]

# ---------------------------------------------------------------- technologies

def tech(id, name, age, at, c, t, effects, requires=()):
    return {"id": id, "name": name, "age": age, "building": at, "cost": c, "time": t,
            "requires": list(requires), "effects": effects}


def stat(stat, value, op="add", **target):
    return {"type": "stat", "stat": stat, "op": op, "value": value, "target": target}


def gather(res, rate=1.0, carry=0, kind=None):
    e = {"type": "gather", "resource": res, "rate": rate, "carry": carry}
    if kind:
        e["kind"] = kind
    return e


def upgrade(frm, to):
    return {"type": "upgrade", "from": frm, "to": to}


def armor_line(prefix, label, tags, costs):
    out, prev = [], None
    for (lvl, age, c, t) in zip(["leather", "scale", "chain"], ["tool", "bronze", "iron"], costs, [30, 60, 75]):
        tid = "%s_armor_%s" % (lvl, prefix)
        out.append(tech(tid, "%s Armor %s" % (lvl.capitalize(), label), age, "storage_pit", c, t,
                        [stat("armor", 2, tags=tags)], [prev] if prev else []))
        prev = tid
    return out


techs = [
    # Storage Pit
    tech("toolworking", "Toolworking", "tool", "storage_pit", cost(f=100), 30, [stat("attack", 2, tags=["melee"])]),
    tech("metalworking", "Metalworking", "bronze", "storage_pit", cost(f=200, g=120), 85, [stat("attack", 2, tags=["melee"])], ["toolworking"]),
    tech("metallurgy", "Metallurgy", "iron", "storage_pit", cost(f=300, g=180), 100, [stat("attack", 3, tags=["melee"])], ["metalworking"]),
    tech("bronze_shield", "Bronze Shield", "bronze", "storage_pit", cost(f=150, g=180), 50, [stat("pierce_armor", 1, tags=["infantry"])]),
    tech("iron_shield", "Iron Shield", "iron", "storage_pit", cost(f=200, g=320), 75, [stat("pierce_armor", 1, tags=["infantry"])], ["bronze_shield"]),
    tech("tower_shield", "Tower Shield", "iron", "storage_pit", cost(f=250, g=400), 90, [stat("pierce_armor", 1, tags=["infantry"])], ["iron_shield"]),
] + armor_line("infantry", "Infantry", ["infantry"], [cost(f=75), cost(f=100, g=50), cost(f=125, g=100)]) \
  + armor_line("archers", "Archers", ["archery"], [cost(f=100), cost(f=125, g=50), cost(f=150, g=100)]) \
  + armor_line("cavalry", "Cavalry", ["stable"], [cost(f=125), cost(f=150, g=50), cost(f=175, g=100)]) + [
    # Granary: walls and towers
    tech("small_wall_tech", "Small Wall", "tool", "granary", cost(f=50), 10, []),
    tech("watch_tower_tech", "Watch Tower", "tool", "granary", cost(f=50), 10, []),
    tech("medium_wall_tech", "Medium Wall", "bronze", "granary", cost(f=180, s=50), 60, [upgrade("small_wall", "medium_wall")], ["small_wall_tech"]),
    tech("sentry_tower_tech", "Sentry Tower", "bronze", "granary", cost(f=120, s=50), 30, [upgrade("watch_tower", "sentry_tower")], ["watch_tower_tech"]),
    tech("fortification_tech", "Fortification", "iron", "granary", cost(f=300, s=175), 75, [upgrade("medium_wall", "fortification")], ["medium_wall_tech"]),
    tech("guard_tower_tech", "Guard Tower", "iron", "granary", cost(f=300, s=100), 75, [upgrade("sentry_tower", "guard_tower")], ["sentry_tower_tech"]),
    tech("ballista_tower_tech", "Ballista Tower", "iron", "granary", cost(f=1800, s=750), 150, [upgrade("guard_tower", "ballista_tower")], ["guard_tower_tech", "ballistics"]),
    # Market
    tech("woodworking", "Woodworking", "tool", "market", cost(f=120, w=75), 60, [gather(W, 1.2, 2), stat("range", 1, tags=["archery"]), stat("range", 1, buildings_tags=["tower"])]),
    tech("artisanship", "Artisanship", "bronze", "market", cost(f=170, w=150), 80, [gather(W, 1.2, 2), stat("range", 1, tags=["archery"]), stat("range", 1, buildings_tags=["tower"])], ["woodworking"]),
    tech("craftsmanship", "Craftsmanship", "iron", "market", cost(f=240, w=200), 100, [gather(W, 1.2, 2), stat("range", 1, tags=["archery"]), stat("range", 1, buildings_tags=["tower"])], ["artisanship"]),
    tech("stone_mining", "Stone Mining", "tool", "market", cost(f=100, s=50), 30, [gather(S, 1.3, 3)]),
    tech("siegecraft", "Siegecraft", "iron", "market", cost(f=190, s=100), 60, [gather(S, 1.3, 3)], ["stone_mining"]),
    tech("gold_mining", "Gold Mining", "tool", "market", cost(f=120, w=100), 50, [gather(G, 1.3, 3)]),
    tech("coinage", "Coinage", "iron", "market", cost(f=200, g=100), 60, [{"type": "mine_yield", "resource": G, "value": 1.25}], ["gold_mining"]),
    tech("domestication", "Domestication", "tool", "market", cost(f=200, w=50), 40, [{"type": "farm_food", "op": "add", "value": 75}]),
    tech("plow", "Plow", "bronze", "market", cost(f=250, w=75), 75, [{"type": "farm_food", "op": "add", "value": 75}], ["domestication"]),
    tech("irrigation", "Irrigation", "iron", "market", cost(f=300, w=100), 100, [{"type": "farm_food", "op": "add", "value": 75}], ["plow"]),
    tech("wheel", "Wheel", "bronze", "market", cost(f=175, w=75), 75, [stat("speed", 0.7, units=["villager"])]),
    # Government Center
    tech("architecture", "Architecture", "bronze", "government_center", cost(f=150, w=175), 50,
         [stat("build_time", 0.67, op="mul", buildings_tags=["*"]), stat("hp", 1.2, op="mul", buildings_tags=["*"])]),
    tech("nobility", "Nobility", "bronze", "government_center", cost(f=175, g=120), 70, [stat("hp", 1.15, op="mul", tags=["mounted"])]),
    tech("logistics", "Logistics", "bronze", "government_center", cost(f=180, g=100), 60, [stat("pop", 0.5, op="mul", tags=["melee", "barracks"])]),
    tech("aristocracy", "Aristocracy", "iron", "government_center", cost(f=175, g=150), 60, [stat("speed", 1.25, op="mul", tags=["academy"])]),
    tech("alchemy", "Alchemy", "iron", "government_center", cost(f=250, g=200), 100, [stat("attack", 1, tags=["missile"]), stat("attack", 1, tags=["siege"])]),
    tech("ballistics", "Ballistics", "iron", "government_center", cost(f=200, g=50), 60, [{"type": "flag", "flag": "ballistics"}]),
    tech("engineering", "Engineering", "iron", "government_center", cost(f=200, w=100), 70, [stat("range", 2, tags=["siege"])]),
    # Temple
    tech("astrology", "Astrology", "bronze", "temple", cost(g=150), 50, [{"type": "conversion", "stat": "chance", "value": 1.3}]),
    tech("mysticism", "Mysticism", "bronze", "temple", cost(g=120), 50, [stat("hp", 2, op="mul", tags=["priest"])]),
    tech("polytheism", "Polytheism", "bronze", "temple", cost(g=120), 50, [stat("speed", 1.4, op="mul", tags=["priest"])]),
    tech("fanaticism", "Fanaticism", "iron", "temple", cost(g=150), 60, [{"type": "conversion", "stat": "regen", "value": 1.5}]),
    tech("monotheism", "Monotheism", "iron", "temple", cost(g=350), 75, [{"type": "flag", "flag": "monotheism"}]),
    tech("afterlife", "Afterlife", "iron", "temple", cost(g=275), 75, [stat("range", 3, tags=["priest"])]),
    tech("jihad", "Jihad", "iron", "temple", cost(g=120), 60,
         [stat("hp", 40, units=["villager"]), stat("attack", 7, units=["villager"]), stat("speed", 0.32, units=["villager"]),
          {"type": "carry", "value": -8}]),
    tech("medicine", "Medicine", "iron", "temple", cost(g=150), 60, [{"type": "heal", "value": 3}]),
    # Unit lines
    tech("battle_axe", "Battle Axe", "tool", "barracks", cost(f=100), 40, []),
    tech("short_sword", "Short Sword", "bronze", "barracks", cost(f=120, g=50), 50, [], ["battle_axe"]),
    tech("broad_sword", "Broad Sword", "bronze", "barracks", cost(f=140, g=50), 80, [upgrade("short_swordsman", "broad_swordsman")], ["short_sword"]),
    tech("long_sword", "Long Sword", "iron", "barracks", cost(f=160, g=50), 90, [upgrade("broad_swordsman", "long_swordsman")], ["broad_sword"]),
    tech("legion_tech", "Legion", "iron", "barracks", cost(f=1400, g=600), 150, [upgrade("long_swordsman", "legion")], ["long_sword", "fanaticism"]),
    tech("phalanx_tech", "Phalanx", "iron", "academy", cost(f=300, g=100), 90, [upgrade("hoplite", "phalanx")]),
    tech("centurion_tech", "Centurion", "iron", "academy", cost(f=1800, g=700), 150, [upgrade("phalanx", "centurion")], ["phalanx_tech", "aristocracy"]),
    tech("improved_bow", "Improved Bow", "bronze", "archery_range", cost(f=140, w=80), 60, []),
    tech("composite_bow", "Composite Bow", "bronze", "archery_range", cost(f=180, w=100), 85, [upgrade("improved_bowman", "composite_bowman")], ["improved_bow"]),
    tech("heavy_horse_archer_tech", "Heavy Horse Archer", "iron", "archery_range", cost(f=1750, g=800), 150,
         [upgrade("horse_archer", "heavy_horse_archer")], ["chain_armor_archers"]),
    tech("heavy_cavalry_tech", "Heavy Cavalry", "iron", "stable", cost(f=350, g=125), 90, [upgrade("cavalry", "heavy_cavalry")]),
    tech("cataphract_tech", "Cataphract", "iron", "stable", cost(f=2000, g=850), 150, [upgrade("heavy_cavalry", "cataphract")], ["heavy_cavalry_tech", "metallurgy"]),
    tech("scythe_chariot_tech", "Scythe Chariot", "iron", "stable", cost(w=1200, g=800), 150, [upgrade("chariot", "scythe_chariot")], ["nobility"]),
    tech("armored_elephant_tech", "Armored Elephant", "iron", "stable", cost(f=1000, g=1200), 150, [upgrade("war_elephant", "armored_elephant")], ["iron_shield"]),
    tech("catapult_tech", "Catapult", "iron", "siege_workshop", cost(f=300, w=250), 100, [upgrade("stone_thrower", "catapult")]),
    tech("heavy_catapult_tech", "Heavy Catapult", "iron", "siege_workshop", cost(f=1800, w=900), 150, [upgrade("catapult", "heavy_catapult")], ["catapult_tech", "siegecraft"]),
    tech("helepolis_tech", "Helepolis", "iron", "siege_workshop", cost(f=1500, w=1000), 150, [upgrade("ballista", "helepolis")], ["craftsmanship"]),
]

# ---------------------------------------------------------------- civilizations

def civ(id, name, arch, effects, disabled=()):
    return {"id": id, "name": name, "arch": arch, "effects": effects, "disabled": list(disabled)}


civs = [
    civ("assyrian", "Assyrian", "egyptian", [stat("attack_cooldown", 1 / 1.4, op="mul", tags=["archery"]), stat("speed", 1.3, op="mul", units=["villager"])]),
    civ("babylonian", "Babylonian", "babylonian", [stat("hp", 2, op="mul", buildings_tags=["wall", "tower"]),
                                                    {"type": "conversion", "stat": "regen", "value": 1.3}, gather(S, 1.3)]),
    civ("choson", "Choson", "asian", [stat("hp", 80, units=["long_swordsman", "legion"]), stat("range", 2, buildings_tags=["tower"]),
                                      stat("cost", 0.7, op="mul", units=["priest"])]),
    civ("egyptian", "Egyptian", "egyptian", [gather(G, 1.2), stat("hp", 1.33, op="mul", tags=["chariot"]), stat("range", 3, tags=["priest"])]),
    civ("greek", "Greek", "greek", [stat("speed", 1.3, op="mul", tags=["academy"])]),
    civ("hittite", "Hittite", "babylonian", [stat("hp", 2, op="mul", tags=["catapult"]), stat("attack", 1, tags=["archery"])]),
    civ("minoan", "Minoan", "greek", [stat("range", 2, units=["composite_bowman"]), {"type": "farm_food", "op": "mul", "value": 1.25}]),
    civ("persian", "Persian", "babylonian", [gather(F, 1.3, kind="hunt"), stat("speed", 1.5, op="mul", tags=["elephant"])], ["academy"]),
    civ("phoenician", "Phoenician", "greek", [stat("cost", 0.75, op="mul", tags=["elephant"]), gather(W, 1.3)]),
    civ("shang", "Shang", "asian", [stat("cost", 0.7, op="mul", units=["villager"]), stat("hp", 2, op="mul", buildings_tags=["wall"])]),
    civ("sumerian", "Sumerian", "egyptian", [stat("hp", 15, units=["villager"]), stat("attack_cooldown", 1 / 1.5, op="mul", tags=["catapult"]),
                                            {"type": "farm_food", "op": "mul", "value": 2}]),
    civ("yamato", "Yamato", "asian", [stat("cost", 0.75, op="mul", tags=["cavalry"]), stat("cost", 0.75, op="mul", units=["horse_archer", "heavy_horse_archer"]),
                                      stat("speed", 1.3, op="mul", units=["villager"])]),
    civ("carthaginian", "Carthaginian", "roman", [stat("hp", 1.25, op="mul", tags=["academy"]), stat("hp", 1.25, op="mul", tags=["elephant"])]),
    civ("macedonian", "Macedonian", "roman", [stat("pierce_armor", 2, tags=["academy"]), stat("los", 2, tags=["melee"]),
                                              stat("cost", 0.5, op="mul", tags=["siege"]), {"type": "conversion", "stat": "resist", "value": 4}], ["temple"]),
    civ("palmyran", "Palmyran", "roman", [stat("cost", 1.5, op="mul", units=["villager"]), stat("armor", 1, units=["villager"]),
                                          stat("pierce_armor", 1, units=["villager"]), gather("all", 1.2), stat("speed", 1.25, op="mul", units=["camel_rider"])]),
    civ("roman", "Roman", "roman", [stat("cost", 0.85, op="mul", buildings_tags=["!tower", "!wall", "!wonder"]), stat("cost", 0.5, op="mul", buildings_tags=["tower"]),
                                    stat("attack_cooldown", 1 / 1.33, op="mul", tags=["swordsman"])]),
    # Return of Rome's Lac Viet. Foragers were +20% at release, +15% since a later patch. The team bonus
    # (houses and farms build 50% faster) applies to the player itself, as there are no teams yet.
    civ("lac_viet", "Lac Viet", "asian", [gather(F, 1.15, kind="forage"), stat("train_time", 1 / 1.25, op="mul", tags=["military"]),
                                          stat("armor", 2, tags=["archery"]), stat("armor", 2, units=["ballista"]),
                                          stat("build_time", 1 / 1.5, op="mul", buildings=["house", "farm"])],
        ["aristocracy", "mysticism", "polytheism", "afterlife", "fanaticism", "monotheism", "chain_armor_infantry", "tower_shield",
         "siegecraft", "engineering", "phalanx", "phalanx_tech", "centurion", "centurion_tech", "legion", "legion_tech", "camel_rider",
         "cataphract", "cataphract_tech", "helepolis", "helepolis_tech", "ballista_tower", "ballista_tower_tech"]),
]

# What each civilization cannot build, train or research, from the Definitive Edition tech trees
# (Fandom "<Civ>/Tree" pages, read through the Internet Archive). An upgrade and its unit go
# together, and so does what a missing item locks (no Iron Shield, no Tower Shield). Ships, City
# Watch, Conscription, Theocracy, Urbanization and gates are not in this game yet.
TREES = {
    "assyrian": ["slinger", "improved_bowman", "improved_bow", "composite_bowman", "composite_bow", "heavy_horse_archer",
                 "heavy_horse_archer_tech", "elephant_archer", "scythe_chariot", "scythe_chariot_tech", "war_elephant",
                 "armored_elephant", "armored_elephant_tech", "phalanx", "phalanx_tech", "centurion", "centurion_tech",
                 "bronze_shield", "iron_shield", "tower_shield", "nobility", "aristocracy", "architecture"],
    "babylonian": ["heavy_horse_archer", "heavy_horse_archer_tech", "elephant_archer", "heavy_cavalry", "heavy_cavalry_tech",
                   "cataphract", "cataphract_tech", "war_elephant", "armored_elephant", "armored_elephant_tech", "ballista",
                   "helepolis", "helepolis_tech", "phalanx", "phalanx_tech", "centurion", "centurion_tech", "iron_shield",
                   "tower_shield"],
    "carthaginian": ["legion", "legion_tech", "composite_bowman", "composite_bow", "chariot_archer", "heavy_horse_archer",
                     "heavy_horse_archer_tech", "chariot", "scythe_chariot", "scythe_chariot_tech", "cataphract", "cataphract_tech",
                     "catapult", "catapult_tech", "heavy_catapult", "heavy_catapult_tech", "metallurgy", "chain_armor_infantry",
                     "chain_armor_archers", "chain_armor_cavalry", "fortification", "fortification_tech", "siegecraft",
                     "astrology", "monotheism", "fanaticism"],
    "choson": ["composite_bowman", "composite_bow", "chariot_archer", "heavy_horse_archer", "heavy_horse_archer_tech",
               "elephant_archer", "chariot", "scythe_chariot", "scythe_chariot_tech", "camel_rider", "war_elephant",
               "armored_elephant", "armored_elephant_tech", "catapult", "catapult_tech", "heavy_catapult", "heavy_catapult_tech",
               "phalanx", "phalanx_tech", "centurion", "centurion_tech", "chain_armor_infantry", "chain_armor_archers",
               "chain_armor_cavalry", "iron_shield", "tower_shield", "aristocracy", "alchemy", "engineering"],
    "egyptian": ["broad_swordsman", "broad_sword", "long_swordsman", "long_sword", "legion", "legion_tech", "horse_archer",
                 "heavy_horse_archer", "heavy_horse_archer_tech", "cavalry", "heavy_cavalry", "heavy_cavalry_tech", "cataphract",
                 "cataphract_tech", "armored_elephant", "armored_elephant_tech", "catapult", "catapult_tech", "heavy_catapult",
                 "heavy_catapult_tech", "ballista", "helepolis", "helepolis_tech", "phalanx", "phalanx_tech", "centurion",
                 "centurion_tech", "bronze_shield", "iron_shield", "tower_shield", "siegecraft"],
    "greek": ["broad_swordsman", "broad_sword", "long_swordsman", "long_sword", "legion", "legion_tech", "improved_bowman",
              "improved_bow", "composite_bowman", "composite_bow", "chariot_archer", "horse_archer", "heavy_horse_archer",
              "heavy_horse_archer_tech", "elephant_archer", "chariot", "scythe_chariot", "scythe_chariot_tech", "cataphract",
              "cataphract_tech", "camel_rider", "war_elephant", "armored_elephant", "armored_elephant_tech", "metallurgy",
              "monotheism", "jihad"],
    "hittite": ["slinger", "long_swordsman", "long_sword", "legion", "legion_tech", "improved_bowman", "improved_bow",
                "composite_bowman", "composite_bow", "heavy_cavalry", "heavy_cavalry_tech", "cataphract", "cataphract_tech",
                "ballista", "helepolis", "helepolis_tech", "centurion", "centurion_tech", "afterlife", "jihad", "mysticism",
                "monotheism", "medicine", "polytheism", "fanaticism", "architecture", "irrigation"],
    "minoan": ["legion", "legion_tech", "horse_archer", "heavy_horse_archer", "heavy_horse_archer_tech", "chariot_archer",
               "elephant_archer", "chariot", "scythe_chariot", "scythe_chariot_tech", "heavy_cavalry", "heavy_cavalry_tech",
               "cataphract", "cataphract_tech", "war_elephant", "armored_elephant", "armored_elephant_tech", "astrology",
               "afterlife", "jihad", "mysticism", "monotheism", "fanaticism", "fortification", "fortification_tech",
               "guard_tower", "guard_tower_tech", "ballista_tower", "ballista_tower_tech"],
    "persian": ["academy", "hoplite", "phalanx", "phalanx_tech", "centurion", "centurion_tech", "chariot_archer", "chariot",
                "scythe_chariot", "scythe_chariot_tech", "heavy_catapult", "heavy_catapult_tech", "ballista", "helepolis",
                "helepolis_tech", "ballista_tower", "ballista_tower_tech", "aristocracy", "craftsmanship", "siegecraft",
                "irrigation"],
    "phoenician": ["horse_archer", "heavy_horse_archer", "heavy_horse_archer_tech", "heavy_cavalry", "heavy_cavalry_tech",
                   "cataphract", "cataphract_tech", "catapult", "catapult_tech", "heavy_catapult", "heavy_catapult_tech",
                   "ballista", "helepolis", "helepolis_tech", "metallurgy", "chain_armor_infantry", "chain_armor_archers",
                   "chain_armor_cavalry", "architecture", "siegecraft"],
    "shang": ["long_swordsman", "long_sword", "legion", "legion_tech", "elephant_archer", "war_elephant", "armored_elephant",
              "armored_elephant_tech", "heavy_catapult", "heavy_catapult_tech", "phalanx", "phalanx_tech", "centurion",
              "centurion_tech", "ballista_tower", "ballista_tower_tech", "aristocracy", "alchemy", "engineering", "siegecraft"],
    "sumerian": ["legion", "legion_tech", "improved_bowman", "improved_bow", "composite_bowman", "composite_bow",
                 "elephant_archer", "cavalry", "heavy_cavalry", "heavy_cavalry_tech", "cataphract", "cataphract_tech",
                 "armored_elephant", "armored_elephant_tech", "ballista", "helepolis", "helepolis_tech", "astrology",
                 "afterlife", "jihad", "monotheism", "fanaticism", "metallurgy", "iron_shield", "tower_shield", "craftsmanship"],
    "yamato": ["broad_swordsman", "broad_sword", "long_swordsman", "long_sword", "legion", "legion_tech", "chariot_archer",
               "elephant_archer", "chariot", "scythe_chariot", "scythe_chariot_tech", "camel_rider", "war_elephant",
               "armored_elephant", "armored_elephant_tech", "catapult", "catapult_tech", "heavy_catapult", "heavy_catapult_tech",
               "ballista", "helepolis", "helepolis_tech", "astrology", "jihad", "mysticism", "monotheism", "medicine",
               "fanaticism", "fortification", "fortification_tech", "guard_tower", "guard_tower_tech", "ballista_tower",
               "ballista_tower_tech", "tower_shield"],
    "macedonian": ["temple", "priest", "long_swordsman", "long_sword", "legion", "legion_tech", "chariot_archer",
                   "elephant_archer", "chariot", "scythe_chariot", "scythe_chariot_tech", "camel_rider", "heavy_catapult",
                   "heavy_catapult_tech", "helepolis", "helepolis_tech", "astrology", "afterlife", "jihad", "mysticism",
                   "monotheism", "medicine", "polytheism", "fanaticism", "fortification", "fortification_tech", "nobility",
                   "engineering", "craftsmanship", "siegecraft"],
    "palmyran": ["long_swordsman", "long_sword", "legion", "legion_tech", "elephant_archer", "cataphract", "cataphract_tech",
                 "helepolis", "helepolis_tech", "centurion", "centurion_tech", "mysticism", "monotheism", "medicine",
                 "polytheism", "metallurgy", "tower_shield", "aristocracy", "logistics", "engineering", "craftsmanship",
                 "irrigation"],
    "roman": ["composite_bowman", "composite_bow", "chariot_archer", "horse_archer", "heavy_horse_archer",
              "heavy_horse_archer_tech", "elephant_archer", "heavy_cavalry", "heavy_cavalry_tech", "cataphract",
              "cataphract_tech", "camel_rider", "war_elephant", "armored_elephant", "armored_elephant_tech", "astrology",
              "afterlife", "guard_tower", "guard_tower_tech", "ballista_tower", "ballista_tower_tech", "alchemy", "irrigation"],
}
_ids = {x["id"] for x in units} | {x["id"] for x in buildings} | {x["id"] for x in techs}
for c in civs:
    extra = TREES.get(c["id"], [])
    unknown = [x for x in extra if x not in _ids]
    assert not unknown, (c["id"], unknown)
    c["disabled"] = c["disabled"] + [x for x in extra if x not in c["disabled"]]

rules = {
    "resources": [F, W, G, S],
    "ages": [
        {"id": "stone", "name": "Stone Age"},
        {"id": "tool", "name": "Tool Age", "cost": cost(f=500), "research_time": 120, "requires_buildings": 2,
         "requires_from": ["granary", "storage_pit", "barracks"]},
        {"id": "bronze", "name": "Bronze Age", "cost": cost(f=800), "research_time": 140, "requires_buildings": 2,
         "requires_from": ["market", "archery_range", "stable"]},
        {"id": "iron", "name": "Iron Age", "cost": cost(f=1000, g=800), "research_time": 160, "requires_buildings": 2,
         "requires_from": ["temple", "government_center", "siege_workshop", "academy"]},
    ],
    "combat": {"min_damage": 1, "building_factor": 0.2, "building_min": 0.1},
    "economy": {
        "carry": 10,
        "gather_rates": {F: 0.45, W: 0.45, G: 0.45, S: 0.45},
        "start": {F: 200, W: 200, G: 0, S: 150},
        "start_villagers": 3,
        "pop_max": 50,
        "wonder_seconds": 900,
        # Repair: hit points come back at this share of the building speed, and the full bar would cost
        # this share of the building's price, paid as the work goes.
        "repair_rate": 0.5,
        "repair_cost": 0.5,
    },
    "nodes": [
        {"id": "tree", "name": "Tree", "resource": W, "amount": 40},
        {"id": "lone_tree", "name": "Tree", "resource": W, "amount": 75},
        {"id": "berry_bush", "name": "Berry Bush", "resource": F, "amount": 150, "food_kind": "plant"},
        {"id": "gold_mine", "name": "Gold Mine", "resource": G, "amount": 400},
        {"id": "stone_mine", "name": "Stone Mine", "resource": S, "amount": 300},
        {"id": "fish", "name": "Shore Fish", "resource": F, "amount": 250, "food_kind": "meat", "rate": 0.6, "on_water": True},
    ],
    "animals": [
        {"id": "gazelle", "name": "Gazelle", "hp": 8, "attack": 0, "armor": 0, "speed": 1.5, "los": 4, "food": 150,
         "behavior": "flee", "decay": 0.25, "herd": [3, 6]},
        {"id": "elephant", "name": "Elephant", "hp": 45, "attack": 10, "armor": 0, "attack_cooldown": 1.5, "speed": 0.85, "los": 4,
         "food": 300, "behavior": "defend", "decay": 0.2, "herd": [1, 2]},
        {"id": "lion", "name": "Lion", "hp": 20, "attack": 2, "armor": 0, "attack_cooldown": 1.0, "speed": 1.6, "los": 4, "food": 100,
         "behavior": "aggressive", "decay": 1.0, "herd": [1, 2]},
        {"id": "alligator", "name": "Alligator", "hp": 20, "attack": 4, "armor": 0, "attack_cooldown": 1.5, "speed": 0.5, "los": 3,
         "food": 100, "behavior": "aggressive", "decay": 1.0, "herd": [1, 2], "near_water": True},
    ],
    "units": units,
    "buildings": buildings,
    "techs": techs,
    "civs": civs,
    # Kept as in the original on purpose; balance.py reports these as accepted, not errors.
    "balance": {"accept": {
        "axeman": "the original's Tool Age melee unit; bowmen answer it by kiting, which equal-spend scoring does not see",
        "hoplite": "the original's Bronze Age wall of infantry; slow (0.9), so archers and siege kite it",
        "centurion": "the original's last Academy upgrade, priced at 1800 food 700 gold to research",
    }},
}

out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "rules.json")
with open(out, "w") as fh:
    json.dump(rules, fh, indent=1)
    fh.write("\n")
print("wrote %s: %d units, %d buildings, %d techs, %d civs" % (out, len(units), len(buildings), len(techs), len(civs)))
