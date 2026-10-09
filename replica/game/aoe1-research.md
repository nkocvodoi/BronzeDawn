# Age of Empires (1997) + The Rise of Rome: gameplay research

These are clean-room notes for rebuilding AoE1's mechanics and numbers in a browser RTS. All facts are summarized in my own words, and no prose was copied. Each table row gives source keys in a `Src` column, and the keys resolve to URLs in the [Sources](#sources) section.

**Version legend.** **O** = original 1997 release (manual or 1.0x patch data). **R** = The Rise of Rome (1998). **DE** = Definitive Edition (2018) or Return of Rome (2023). If a cell shows one number, it is the O/R value. DE values appear only where they differ and were easy to find. `(?)` marks a value I could not confirm in a primary or near-primary source.

**How reliable the sources are.**
- **Most reliable:** the original printed manual (S1, a scan on archive.org). It has the appendix tables for unit attributes, tech costs and buildings.
- **Next:** BlackDouglas's 1998 data tables on Telcontar's site (S2–S4). They have numeric speeds, train times, research times and fire rates. They agree with the manual wherever both list a value.
- **For mechanics:** the Fandom wiki (F-*). Its infoboxes show **DE/Return of Rome** values, but each page has a changelog that lists the original values. I used the changelogs to recover O/R numbers. Fandom blocks direct fetching, so I read it through Internet Archive snapshots.

---

## 1. Economy

### 1.1 Start conditions (Random Map, default settings)

| Item | Value | Notes | Src |
|---|---|---|---|
| Starting buildings | 1 Town Center | Nomad start gives villagers only, and you place the TC yourself | S1 |
| Starting villagers | 3 | Matches the "build a 4th villager first" opening in guides | S15, F-House, S19 |
| Starting resources ("Low", the RM default) | 200 food, 200 wood, 150 stone, 0 gold (?) | The manual only says default = lowest level. A 1999 forum post and a guide (default stone buys either one tower or some walls) both support 200/200/150. I found no primary table | S1, S23, S9 |
| Death Match stockpile | 20,000 food, wood and stone; 10,000 gold | | S1 |
| Default starting age | Stone Age. Tool, Bronze, Iron and Nomad are options | | S1 |
| Population cap | 50 (hard cap in O) | Patch 1.0a/R multiplayer: 25–200. DE: 25–250 | S1, F-Population |
| Pop per House | 4 | | S1 |
| Pop from Town Center | 4 | | S1, F-Town Center |
| Civ start tweaks (DE only) | Shang −40 food; Carthaginians +50 of each; Palmyrans +75 food | DE compensations, not in O/R | F-Civilizations |

Housing is easy to misread: TC (4) plus 12 Houses (48) gives 52, which already reaches the 50 cap. Houses only raise the allowance. If a House is destroyed, the units it supported are not lost (S1). Units still being trained do not count toward the cap, and players used this to go past 50 (S12).

### 1.2 Villager

| Stat | O/R value | DE value | Src |
|---|---|---|---|
| Cost | 50 food (Shang −30% = 35) | Shang 40 food | S1, S2, F-Villager |
| Train time | 20 s at the Town Center | 20 s | S2, F-Villager |
| HP | 25 (Sumerian 40) | 25 | S1, S2 |
| Attack | 3 melee. Reload 1.5 s | Hunters throw spears: 4 attack, range 4 (DE) | S2, F-Villager |
| Armor / pierce armor | 0 / 0 | 0 / 0 | S2 |
| Speed | 1.10. With Wheel 1.80 (+0.7, about 64%) | 0.92 base; +10% in Tool Age; Wheel +50–60% | S2, F-Villager |
| Line of sight | 4 | 4 | F-Villager |
| Carry capacity | 10 per trip (?) | Raised by techs (see below) | F-Villager (?) |
| Jihad | HP 65, attack 10, speed 1.42 (2.10 with Wheel), −8 carry | Renamed Zealotry: +40 HP, +7 attack, +0.11 speed, −8 carry | S2, F-Technology |

Note on carry: no source I could read states the base capacity directly. The −8 carry from Jihad only makes sense if the base is about 10. A 1998 guide also says a villager can be sent home with any partial load (S9).

**Changing jobs:** in O/R a villager drops whatever he carries as soon as he is ordered onto a *different resource type*. Attacking or building does not drop the load. Hunters can switch prey, and farmers can switch to foraging (food to food), without losing it (S9). DE keeps food when switching between food sources (F-Villager).

**Auto-continue:** when a resource runs out, the villager looks for another of the same type within his line of sight. If he finds none, he goes idle (S1).

### 1.3 Gather rates (resources per second, before bonuses)

| Task | O (original) | DE (current) | Notes | Src |
|---|---|---|---|---|
| Forage (berries) | ~0.45 | 0.45 | | S24, F-Villager |
| Hunt | ~0.45 | 0.4725 | DE +5% | S24, F-Villager |
| Farm | ~0.45 | 0.45 | | S24, F-Villager |
| Fish from shore (villager) | ~0.6 (?) | 0.6 (Fandom); 0.55 (forum) | Fastest villager food. HG says R lowered it, but it stayed the best | F-Fish, S24, S19 |
| Fishing Boat / Ship | 0.4 (?) | 0.4 | Slowest rate in the game | F-Fish |
| Wood | ~0.45–0.55 (?) | 0.55 | One original tester reported ~0.45 for everything | S24, F-Villager |
| Gold | ~0.45 | 0.5175 | DE +15% | S24, F-Villager |
| Stone | ~0.45 | 0.5175 | DE +15% | S24, F-Villager |

How market techs change gathering: they add +N carry *and* a work-rate multiplier. Farm techs add food to each Farm, not gather speed (S20, F-Villager).

| Tech | Effect (DE wiki wording, which matches the O manual's "+N") | Src |
|---|---|---|
| Woodworking / Artisanship / Craftsmanship | each +2 wood carry, ×1.2 woodcutting rate, +1 missile range | S1, F-Villager |
| Gold Mining | +3 gold carry, ×1.3 rate | S1, F-Villager |
| Coinage | Gold Mines yield +25% more gold. Tribute becomes free | S1 |
| Stone Mining / Siegecraft | each +3 stone carry, ×1.3 rate | S1, F-Villager |

### 1.4 Food sources

| Source | Food | HP | Behaviour | Gatherers | Src |
|---|---|---|---|---|---|
| Berry bush | 150 per bush | — | Static. Usually a cluster near each TC. Drop off at Granary or TC only | 1 per bush | F-Berry Bush, S15 |
| Gazelle | 150 | 8 | Runs when attacked or approached. Groups of 5+. Carcass decays 1 food per 4 s | 2 | F-Gazelle |
| Elephant (wild) | 300 | 45; attack 10; speed 0.85 | Fights back only if attacked. Can be lured to a drop site. Decays 1 food per 5 s | 4–6 | F-Elephant, S15 |
| Lion | 100 | 20; attack 2 (DE wiki); fast | Attacks units within ~2 tiles and also kills gazelles. Decays 1 food/s | 2–4 | F-Lion |
| Alligator | 100 | 20; attack 4; speed 0.5 | Aggressive but slow | 1–2 | F-Alligator |
| Shore fish | 250 (O/R); 200 in Return of Rome | — | 1 tile at the shoreline. Villagers or boats | 1 | F-Shore Fish |
| Deep fish / whale | 300 (O) | — | Boats only. Two boats can fish one spot without slowing each other | any | S9, F-Whale |
| Farm | 250, then +75 / +75 / +75 from Domestication / Plow / Irrigation (O) | 50 (building) | See 1.5 | 1 | S1, F-Farm |

Food from a kill counts only if a **villager** makes the kill. Military units can kill animals, but the carcass gives no food (S1, F-Lion).

### 1.5 Farms

| Property | Value | Src |
|---|---|---|
| Age / prerequisite | Tool Age; needs a Market | S1, S3 |
| Cost / build time / HP | 75 wood / 30 s (DE 24 s) / 50 | S1, S3, F-Farm |
| Footprint | 3×3 tiles | F-Farm |
| Food | 250. O: Domestication +75, Plow +75, Irrigation +75 (total 475). DE: +75 / +100 / +125 (total 550) | S1, F-Farm |
| Workers | One farmer works it. More villagers can be assigned, but output does not rise; a second one only works while the first is away depositing | S9, F-Farm |
| Drop-off | Granary or Town Center only, never the Storage Pit | S1, S9 |
| When exhausted | It disappears. You must build a new Farm (another 75 wood). There is no reseeding and no auto-rebuild in O/R. DE lets you right-click an exhausted Farm to rebuild it | F-Farm, S9 |
| Pathing | Not walkable in O/R; Farms block units like any building. DE makes them walkable by default | F-Farm |
| Civ modifiers (O) | Sumerian ×2 Farm production; Minoan +25%; Persian −30% (removed in R) | S1, S16 |

### 1.6 Wood, gold, stone sources

| Source | Amount | Src |
|---|---|---|
| Single tree (palm, pine, oak and so on) | 75 wood; 25 HP that must be chopped first | F-Tree |
| Forest tree | 40 wood | F-Tree |
| Gold mine | 400 (?). One 1998 guide implies 300, saying Coinage turns 300 into 375 | S9 (?) |
| Stone mine | 250–350 (?) | (?) |

Heavy Catapults (and Juggernauts in O) can clear trees with Attack Ground. Clearing gives no wood (F-Tree, S10).

### 1.7 Drop-off buildings

| Building | Takes | Src |
|---|---|---|
| Town Center | Everything | S1 |
| Granary | Berries and Farm food only | S1 |
| Storage Pit | Wood, gold, stone, hunted meat, shore-fished food | S1 |
| Dock | Food from Fishing Boats/Ships only. Villagers can also drop shore fish here in Return of Rome | S1, F-Dock |

### 1.8 Fishing boats and trade

| Item | O/R value | DE / Return of Rome change | Src |
|---|---|---|---|
| Fishing Boat | 50 wood, 20 s train (S2) or 40 s base (wiki), 45 HP, speed 1.45 | | S2, F-Fishing Boat |
| Fishing Ship upgrade (Bronze) | 100 wood + 50 food; 75 HP; speed 2.10 | | S4, S2 |
| Trade Boat | Stone Age in O, 100 wood, 200 HP, speed 2.10 | Return of Rome: Bronze Age, 75 wood + 60 gold, 120 HP | S2, F-Trade Boat |
| Merchant Ship upgrade (Bronze) | 75 wood + 200 food; 250 HP; speed 2.5 | | S4, S2 |
| How O trade works | Pick a cargo of food, wood or stone. 20 units are deducted when the boat sails. The foreign Dock holds a "goods" stock that refills to a cap of 100, and the boat waits if fewer than 20 are there. On return you get gold based on the straight-line distance between the two nearest Docks (about 7–75 gold per trip). The other player gains and loses nothing | Return of Rome: no cargo, no restock time | S1, F-Trade Boat, F-Trade |
| Saturation | Run at most ~2 boats per foreign Dock, or they queue for goods | | S9 |
| Docks restock | 20 s after a trade visit (O/DE) | | F-Trade |
| Dock work rate | 200% in Bronze Age in O (ships train faster as the ages advance) | DE: 170% | F-Dock |

---

## 2. Ages

| Age | Cost | Research time | To start it you need | Unlocks | Src |
|---|---|---|---|---|---|
| Stone | — (start) | — | — | TC, House, Granary, Storage Pit, Barracks, Dock. Villager, Clubman, Fishing Boat, Trade Boat (O) | S1 |
| Tool | 500 food | 2:00 | A TC plus 2 *different* Stone Age buildings from Granary, Storage Pit, Dock, Barracks (Houses do not count) | Market, Archery Range, Stable, Farm, Small Wall and Watch Tower (both researched at the Granary), Light Transport, Scout Ship. Axeman, Bowman, Scout, Slinger (R). Tool-tier Storage Pit and Market techs | S1, S4, F-Tool Age |
| Bronze | 800 food | 2:20 | 2 different of Market, Archery Range, Stable | Temple, Government Center, Siege Workshop, Academy, more TCs (needs a Gov. Center). Medium Wall, Sentry Tower, swordsmen, chariots, cavalry, Camel Rider (R), Hoplite, Priest, Stone Thrower, War Galley, Fishing Ship, Merchant Ship, Improved and Composite Bow | S1, S4, F-Bronze Age |
| Iron | 1,000 food + 800 gold | 2:40 | 2 different of Temple, Gov. Center, Siege Workshop, Academy | Wonder, Fortification, Guard Tower, Ballista Tower, elephants, Horse Archers, Ballista, Catapults, Trireme, Catapult Trireme, Fire Galley (R), Long Swordsman, Legion, Phalanx, Centurion, Cataphract, Iron-tier techs | S1, S4, F-Iron Age |

Buildings change appearance with each age (S1). Starting in a later age gives all earlier-age techs for free (S1).

---

## 3. Buildings

O/R costs, HP and build times come from the manual and S3. Line of sight and footprint come from Fandom infoboxes, which show DE values; the original LOS is given where a changelog listed it. Every building has 0/0 armor (DE wiki), but all buildings take only 20% damage (see section 6).

| Building | Age | Cost | HP | Size (tiles) | Build time | LOS | Trains | Researches | Prerequisite | Src |
|---|---|---|---|---|---|---|---|---|---|---|
| Town Center | Stone | 200 W | 600 | 3×3 | 60 s | 7 | Villager | Tool, Bronze and Iron Age | Extra TCs need a Gov. Center (Bronze) | S1, S3, F-Town Center |
| House | Stone | 30 W | 75 | 2×2 | 20 s | 3 (O), 2 (DE) | — | — | — | S1, S3, F-House |
| Granary | Stone | 120 W | 350 | 3×3 | 30 s | 5 (O), 4 (DE) | — | Walls and towers (see section 5) | — | S1, S3, F-Granary |
| Storage Pit | Stone | 120 W | 350 | 3×3 | 30 s | 4 | — | Toolworking line, shields, all armor lines | — | S1, S3, F-Storage Pit |
| Barracks | Stone | 125 W | 350 | 3×3 | 30 s | 5 | Clubman/Axeman, swordsman line, Slinger (R) | Axe, Short/Broad/Long Sword, Legion | — | S1, S3, F-Barracks |
| Dock | Stone | 100 W | 350 | 3×3 | 50 s | 5 | Fishing Boat, Trade Boat, Light Transport, Scout Ship line, Catapult Trireme, Fire Galley (R) | Ship upgrades | Must touch water | S1, S3, F-Dock |
| Archery Range | Tool | 150 W | 350 | 3×3 | 40 s | 4 | Bowman, Imp./Composite Bowman, Chariot Archer, Horse Archer, Elephant Archer | Improved Bow, Composite Bow, Heavy Horse Archer | Barracks | S1, S3, F-Archery Range |
| Stable | Tool | 150 W | 350 | 3×3 | 40 s | 4 | Scout, Chariot, Cavalry line, War Elephant, Camel (R), Scythe Chariot (R), Armored Elephant (R) | Heavy Cavalry, Cataphract, Scythe Chariot (R), Armored Elephant (R) | Barracks | S1, S3, F-Stable |
| Market | Tool | 150 W | 350 | 3×3 | 40 s | 5 | — (DE: Trade Cart) | Woodworking line, Stone/Gold Mining, Coinage, Siegecraft, farm techs, Wheel | Granary | S1, S3, F-Market |
| Farm | Tool | 75 W | 50 | 3×3 | 30 s (DE 24) | 4 (O), 3 (DE) | — | — | Market | S1, S3, F-Farm |
| Small Wall | Tool | 5 S per tile | 200 | 1×1 | 8 s (S3); 7 s (DE) | 3 | — | — | "Small Wall" researched at the Granary | S1, S3, F-Small Wall |
| Watch Tower | Tool | 150 S | 100 (DE 125) | 2×2 (DE) | 80 s (DE 65–72) | 8 (DE) | — | — | "Watch Tower" researched at the Granary | S1, S3, F-Watch Tower |
| Government Center | Bronze | 175 W | 350 | 3×3 | 60 s | 6 (O), 5 (DE) | — | Architecture, Nobility, Writing, Aristocracy, Alchemy, Ballistics, Engineering, Logistics (R) | Market | S1, S3, F-Government Center |
| Temple | Bronze | 200 W | 350 | 3×3 | 60 s | 5 (O), 4 (DE) | Priest | Priest techs | Market | S1, S3, F-Temple |
| Academy | Bronze | 200 W (DE 150) | 350 | 3×3 | 60 s | 5 | Hoplite line | Phalanx, Centurion | Stable | S1, S3, F-Academy |
| Siege Workshop | Bronze | 200 W | 350 | 3×3 | 60 s | 5 | Stone Thrower line, Ballista line | Catapult, Heavy Catapult, Helepolis | Archery Range | S1, S3, F-Siege Workshop |
| Medium Wall | Bronze | 5 S | 300 | 1×1 | 8 s | 3 | — | — | Medium Wall tech | S1, S3, F-Medium Wall |
| Sentry Tower | Bronze | 150 S | 150 | 2×2 (DE) | 80 s | 9 (DE) | — | — | Sentry Tower tech | S1, S3, F-Sentry Tower |
| Fortification | Iron | 5 S | 400 | 1×1 | 8 s | 3 | — | — | Fortification tech | S1, S3, F-Fortified Wall |
| Guard Tower | Iron | 150 S | 200 | 2×2 (DE) | 80 s | 10 (DE) | — | — | Guard Tower tech | S1, S3, F-Guard Tower |
| Ballista Tower | Iron | 150 S | 200 | 2×2 (DE) | 80 s | 10 (DE) | — | — | Ballistics, then the Ballista Tower tech | S1, S3, F-Ballista Tower |
| Wonder | Iron | 1,000 W + 1,000 S + 1,000 G | 500 | 5×5 (DE) | Very long. S3 lists "2hr"; DE 8,000 s of villager work (?) | 4 | — | — | — | S1, S3, F-Wonder |

**Tower attacks (O).** Every tower deals piercing damage.

| Tower | Attack | Range | Fire rate | Src |
|---|---|---|---|---|
| Watch | 3 | 5 | 1.5 s | S1, S3 |
| Sentry | 4 | 6 | 1.5 s | S1, S3 |
| Guard | 6 | 7 | 1.5 s | S1, S3 |
| Ballista | 20 | 7 | 3 s | S1, S3 |

Return of Rome raised these to 5/6, 6/7, 8/8 and 18/8 attack/range, and lets towers garrison 5 villagers (F-* tower pages). **Town Centers have no attack in any version** (F-House).

Building notes:
- **No gates in O/R.** Gates (Small/Medium/Fortified) were added in Return of Rome (2023) (F-Small Gate). In O/R a wall fully blocks your own units too.
- **No garrisoning** in O/R except loading units into transports (F-Garrison).
- Walls are dragged out tile by tile. Shift-click places several buildings of the same type (S1).
- **Deleting a building under construction** refunds 50% of the cost of the unbuilt part (S1).
- **Repair costs resources.** Damaged buildings show fire (S1).
- Construction speed scales with the number of builders. Allies cannot help each other build (S1).

---

## 4. Units

Column key: Cost F/W/G/S. **T** = train time. **Atk** = attack. **Arm** = melee armor. **PA** = pierce armor. **Rng** = range in tiles. **Spd** = speed in tiles/s (O values from S2). **LOS** = line of sight (Fandom; DE unless marked). **RT** = reload time in seconds. All O/R values come from S1/S2 unless noted.

### 4.1 Town Center and Temple

| Unit | Age | Cost | T | HP | Atk | Arm | PA | Rng | Spd | LOS | Notes | Src |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Villager | Stone | 50F | 20 | 25 | 3 | 0 | 0 | melee | 1.10 | 4 | See 1.2 | S1, S2, F-Villager |
| Priest | Bronze | 125G | 50 | 25 | — | 0 | 0 | 10 | 0.80 (DE 0.66) | 12 | Heals 3 HP/s in O (2.5 in DE); converts | S1, S2, F-Priest |

### 4.2 Barracks

| Unit | Age | Cost | T | HP | Atk | Arm | PA | Rng | Spd | LOS | Upgrade cost / time | Src |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Clubman | Stone | 50F | 27 (DE 26) | 40 | 3 | 0 | 0 | melee | 1.20 | 4 | — | S1, S2, F-Clubman |
| Axeman | Tool | 50F | 27 | 50 | 5 | 0 | 0 (DE 1) | melee | 1.20 | 4 | "Axe" tech: 100F, 40 s | S1, S2, S4, F-Axeman |
| Short Swordsman | Bronze | 35F 15G | 27 | 60 | 7 | 1 | 0 | melee | 1.20 | 4 | "Short Sword": 120F 50G, 50 s (O required Axe first) | S1, S2, S4, F-Short Swordsman |
| Broad Swordsman | Bronze | 35F 15G | 27 | 70 (DE 80) | 9 | 1 | 0 | melee | 1.20 | 4 | 140F 50G, 1:20 | S2, S4, F-Broad Swordsman |
| Long Swordsman | Iron | 35F 15G | 27 | 80 (DE 100) | 11 | 2 | 0 | melee | 1.20 | 4 | 160F 50G, 1:30 | S2, S4, F-Long Swordsman |
| Legion | Iron | 35F 15G | 27 | 160 (DE 140) | 13 | 2 | 0 | melee | 1.20 | 4 | 1,400F 600G, 2:30 (O needs Fanaticism) | S2, S4, F-Legionary |
| Slinger (R) | Tool | 40F 10S | 24 (R); 35 (DE) | 25 | 2 | 0 | 2 | 4 | 1.2 (R) | 5 (R) | +2 vs archers; bonus vs walls and towers (+7 in R). Stone Mining and Siegecraft give +1 attack and range. Ignores the armor techs | S6, S16, F-Slinger |

Axeman, Bowman and Scout are new units, not upgrades. Older Clubmen are not converted. Other upgrades replace every existing unit of that line (S1).

### 4.3 Academy (not available to Persians)

| Unit | Age | Cost | T | HP | Atk | Arm | PA | Spd | LOS | Upgrade | Src |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hoplite | Bronze | 60F 40G | 36 | 120 | 17 | 5 | 0 | 0.90 | 4 | — | S1, S2, F-Hoplite |
| Phalanx | Iron | 60F 40G | 36 | 120 | 20 | 7 | 0 | 0.90 | 4 | 300F 100G, 1:30 | S2, S4, F-Phalangite |
| Centurion | Iron | 60F 40G | 36 | 160 | 30 | 8 | 0 | 0.90 | 4 | 1,800F 700G, 2:30 (O needs Aristocracy) | S2, S4, F-Centurion |

### 4.4 Archery Range

| Unit | Age | Cost | T | HP | Atk | PA | Rng | RT | Spd | LOS | Notes | Src |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bowman | Tool | 40F 20W | 30 | 35 | 3 | 0 | 5 | 1.4 | 1.20 | 7 | DE adds +2 vs light infantry | S1, S2, F-Bowman |
| Improved Bowman | Bronze | 40F 20G | 30 | 40 | 4 | 0 | 6 | 1.4 | 1.20 | 8 | "Improved Bow" 80W 140F, 1:00 (enables training) | S1, S2, S4 |
| Composite Bowman | Bronze | 40F 20G | 30 | 45 | 5 | 0 | 7 | 1.4 | 1.20 | 9 | 100W 180F, 1:25 | S1, S2, S4 |
| Chariot Archer | Bronze | 40F 70W | 40 | 70 | 4 | 0 | 7 | 1.5 | 2.00 | 9 | Needs Wheel. Triple attack vs priests (O). Hard to convert (×8 in O) | S1, S2, F-Chariot Archer |
| Horse Archer | Iron | 50F 70G | 40 | 60 | 7 | 2 | 7 | 1.5 | 2.20 | 9 | | S1, S2, F-Horse Archer |
| Heavy Horse Archer | Iron | 50F 70G | 40 | 90 | 8 | 2 | 7 | 1.5 | 2.50 | 9 | 1,750F 800G, 2:30 (O needs Chain Mail Archers) | S2, S4, F-Heavy Horse Archer |
| Elephant Archer | Iron | 180F 60G | 50 | 600 | 5 | 0 | 7 | 1.5 | 0.90 | 9 | | S1, S2, F-Elephant Archer |

### 4.5 Stable

| Unit | Age | Cost | T | HP | Atk | Arm | PA | Spd | LOS | Bonus / notes | Src |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Scout | Tool | 100F (DE 90) | 30 | 60 | 3 | 0 | 0 (DE 1) | 2.00 | 8 (O), 7 (DE) | Widest vision. Does not auto-attack villagers | S1, S2, F-Scout |
| Chariot | Bronze | 40F 60W | 40 | 100 | 7 | 0 | 0 | 2.00 | 4 | Needs Wheel. ×2 attack vs priests (O). Hard to convert | S1, S2, F-Chariot |
| Cavalry | Bronze | 70F 80G | 40 | 150 | 8 | 0 | 0 (DE 1) | 2.00 | 4 | +5 vs Barracks infantry | S1, S2, F-Cavalry |
| Heavy Cavalry | Iron | 70F 80G | 40 | 150 | 10 | 1 | 1 | 2.00 | 4 | 350F 125G, 1:30 | S2, S4, F-Heavy Cavalry |
| Cataphract | Iron | 70F 80G | 40 | 180 | 12 | 3 | 1 | 2.00 | 4 | 2,000F 850G, 2:30 (O needs Metallurgy) | S2, S4, F-Cataphract |
| War Elephant | Iron | 170F 40G | 50 | 600 | 15 | 0 | 0 | 0.90 | 5 | Trample splash (blast radius 2.0 in O). Attack not upgradable (O) | S1, S2, F-War Elephant |
| Camel Rider (R) | Bronze | 70F 60G | 30 | 125 | 6 | 0 | 0 | fast; DE 1.66 | 4 | +8 vs cavalry and horse archers, +4 vs chariots | S6, S16, F-Camel Rider |
| Scythe Chariot (R) | Iron | 40F 60W | 40 | 120 | 9 | 2 | 0 | fast | 4 | 1,200W 800G, 2:30. Splash radius 2.0. Needs Nobility | S6, S16, F-Scythe Chariot |
| Armored Elephant (R) | Iron | 170F 40G | 50 | 600 | 18 | 2 | 1 | slow (0.75 DE) | 5 | 1,000F 1,200G. Needs Iron Shield. +40 vs buildings, another +40 vs walls (R) | S6, S16, F-Armored Elephant |

### 4.6 Siege Workshop

| Unit | Age | Cost | T | HP | Atk | Rng (min) | RT | Spd | LOS | Area | Upgrade | Src |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Stone Thrower | Bronze | 180W 80G | 60 | 75 | 50 | 10 (2) | 5.0 | 0.80 | 13 | Small (radius 0.5, O) | — | S1, S2, F-Stone Thrower |
| Catapult | Iron | 180W 80G | 60 | 75 | 60 | 12 (2) | 5.0 | 0.80 | 15 | Medium (1.5, O) | 300F 250W, 1:40 | S1, S2, S4, F-Catapult |
| Heavy Catapult | Iron | 180W 80G | 60 | 150 | 60 | 13 (2) | 5.0 | 0.80 | 16 | Large (1.5 (?), O) | 1,800F 900W, 2:30 (O needs Siegecraft). Can fell trees | S1, S2, S4, F-Heavy Catapult |
| Ballista | Iron | 100W 80G | 50 | 55 | 40 | 9 (3) | 3.0 | 0.80 | 11 | none | — | S1, S2, F-Ballista |
| Helepolis | Iron | 100W 80G | 50 | 55 | 40 | 10 (3) | 1.5 | 0.80 | 12 | none | 1,500F 1,000W, 2:30 (O needs Craftsmanship) | S2, S4, F-Helepolis |

In DE the siege units have +140 bonus vs buildings and +50 vs towers (F-Catapult). O ignores armor in a different way; see section 6.

### 4.7 Dock

| Unit | Age | Cost | T (O) | HP | Atk | Rng | RT | Spd | LOS | Notes | Src |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Fishing Boat | Stone | 50W | 20 | 45 | — | — | — | 1.45 | 6 | | S1, S2 |
| Fishing Ship | Bronze | 50W | 20 | 75 | — | — | — | 2.10 | 6 | Upgrade 100W 50F, 0:15 | S2, S4 |
| Trade Boat | Stone (O) | 100W | 25 | 200 | — | — | — | 2.10 | 4 | | S1, S2, F-Trade Boat |
| Merchant Ship | Bronze | 100W | 25 | 250 | — | — | — | 2.50 | 4 | Upgrade 75W 200F | S2, S4 |
| Light Transport | Tool | 150W | 38 | 150 | — | — | — | 1.45 | 4 | Carries 5 | S1, S2, F-Light Transport |
| Heavy Transport | Iron | 150W | 38 | 200 | — | — | — | 1.80 | 5 | Carries 10. Upgrade 125W 150F | S2, S4, F-Heavy Transport |
| Scout Ship | Tool | 135W | 30 (S2) / 60 (wiki O) | 120 | 5 | 5 | 1.4 | 1.80 | 7 | | S1, S2, F-Scout Ship |
| War Galley | Bronze | 135W | 30 / 60 | 160 | 8 | 6 | 1.5 | 1.80 | 9 | Upgrade 75W 150F, 0:38 | S1, S2, S4, F-War Galley |
| Trireme | Iron | 135W | 30 / 60 | 200 | 12 | 7 | 2.0 (S1); 1.8 (wiki O) | 1.80 | 10 | Upgrade 100W 250F, 0:40 | S1, S2, S4, F-Trireme |
| Catapult Trireme | Iron | 135W 75G | 45 | 120 | 35 | 9 | 5.0 | 1.40 | 12 | Small area. Tech 100W 300F | S1, S2, S4, F-Catapult Trireme |
| Juggernaught | Iron | 135W 75G | 45 | 200 | 35 | 10 | 5.0 | 1.40 | 13 | Medium area. Can fell trees (O). 900W 2,000F, 2:30. Needs Engineering | S1, S2, S4, F-Juggernaut |
| Fire Galley (R) | Iron | 115W 40G | 45 (R) | 200 | 24 | 1 | 1.0 | fast; DE 2.0 | 8 | Takes +10 from Ballista/Helepolis and +15 from other siege. Needs War Galley. Disabled by Full Tech Tree | S6, S16, F-Fire Galley |

The train-time difference for ships has a cause: the wiki gives a base time that the Dock's per-age work rate (200% in Bronze, O) divides down, while S2 lists observed times.

All boats are **twice as hard to convert** (S1).

---

## 5. Technologies (O costs; the R additions are marked)

Costs and times come from the manual (S1) and S4. They agree on every cost. Times are from S4.

### Town Center
| Tech | Age | Cost | Time | Effect | Src |
|---|---|---|---|---|---|
| Tool Age | Stone | 500F | 2:00 | Advance | S1, S4 |
| Bronze Age | Tool | 800F | 2:20 | Advance | S1, S4 |
| Iron Age | Bronze | 1,000F 800G | 2:40 | Advance | S1, S4 |

### Storage Pit
| Tech | Age | Cost | Time | Effect | Src |
|---|---|---|---|---|---|
| Toolworking | Tool | 100F | 0:30 | +2 attack, hand-to-hand units | S1, S4 |
| Metalworking | Bronze | 200F 120G | 1:25 | +2 attack, hand-to-hand | S1, S4 |
| Metallurgy | Iron | 300F 180G | 1:40 | +3 attack, hand-to-hand. Needed for Cataphract | S1, S4 |
| Bronze Shield | Bronze | 150F 180G | 0:50 | +1 infantry pierce armor | S1, S4 |
| Iron Shield | Iron | 200F 320G | 1:15 | +1 infantry pierce armor | S1, S4 |
| Tower Shield (R) | Iron | 250F 400G | (?) | +1 infantry pierce armor | S7, S16 |
| Leather / Scale / Chain Mail – Infantry | T/B/I | 75F / 100F 50G / 125F 100G | 0:30 / 1:00 / 1:15 | +2 armor each (Barracks and Academy units) | S1, S4 |
| Leather / Scale / Chain Mail – Archers | T/B/I | 100F / 125F 50G / 150F 100G | same | +2 armor each | S1, S4 |
| Leather / Scale / Chain Mail – Cavalry | T/B/I | 125F / 150F 50G / 175F 100G | same | +2 armor each (Stable units) | S1, S4 |

### Granary (walls and towers)
| Tech | Age | Cost | Time | Src |
|---|---|---|---|---|
| Small Wall | Tool | 50F | 0:10 | S4 |
| Watch Tower | Tool | 50F | 0:10 | S4 |
| Medium Wall | Bronze | 180F 50S | 1:00 | S4 |
| Sentry Tower | Bronze | 120F 50S | 0:30 | S4 |
| Fortification | Iron | 300F 175S | 1:15 | S4 |
| Guard Tower | Iron | 300F 100S | 1:15 | S4 |
| Ballista Tower | Iron | 1,800F 750S | 2:30 | S4 |

Wall and tower upgrades convert the existing structures (S1).

### Market
| Tech | Age | Cost | Time | Effect | Src |
|---|---|---|---|---|---|
| Woodworking | Tool | 120F 75W | 1:00 | +2 woodcutting, +1 missile range | S1, S4 |
| Artisanship | Bronze | 170F 150W | 1:20 | same | S1, S4 |
| Craftsmanship | Iron | 240F 200W | 1:40 | same. Needed for Helepolis | S1, S4 |
| Stone Mining | Tool | 100F 50S | 0:30 | +3 stone mining | S1, S4 |
| Siegecraft | Iron | 190F 100S | 1:00 | +3 stone mining. Villagers can damage walls and towers. Needed for Heavy Catapult | S1, S4 |
| Gold Mining | Tool | 120F 100W | 0:50 | +3 gold mining | S1, S4 |
| Coinage | Iron | 200F 100G | 1:00 | +25% gold per mine. Free tribute | S1, S4 |
| Domestication | Tool | 200F 50W | 0:40 | +75 food per Farm | S1, S4 |
| Plow | Bronze | 250F 75W | 1:15 | +75 food per Farm | S1, S4 |
| Irrigation | Iron | 300F 100W | 1:40 | +75 food per Farm | S1, S4 |
| Wheel | Bronze | 175F 75W | 1:15 | Villagers faster (manual "30%"; data +0.7 speed). Needed for chariots | S1, S2, S4 |

### Government Center
| Tech | Age | Cost | Time | Effect | Src |
|---|---|---|---|---|---|
| Architecture | Bronze | 150F 175W | 0:50 | −33% build time, +20% HP for buildings and walls | S1, S4 |
| Nobility | Bronze | 175F 120G | 1:10 | +15% HP for Cavalry, Chariot, Chariot Archer, Horse Archer | S1, S4 |
| Writing | Bronze | 200F 75G | 1:00 | Shared exploration with allies | S1, S4 |
| Logistics (R) | Bronze | 180F 100G | (?) | Barracks units (except Slinger) count as ½ population | S7, S16 |
| Aristocracy | Iron | 175F 150G | 1:00 | Academy units +25% speed. Needed for Centurion | S1, S4 |
| Alchemy | Iron | 250F 200G | 1:40 | +1 attack for missile and siege units (R: Fire Galley +6) | S1, S4, F-Technology |
| Ballistics | Iron | 200F 50G | 1:00 | Missiles and siege lead moving targets. Needed for Ballista Tower | S1, S4, S10 |
| Engineering | Iron | 200F 100W | 1:10 | +2 siege range. Needed for Juggernaught | S1, S4 |

### Temple
| Tech | Age | Cost | Time | Effect | Src |
|---|---|---|---|---|---|
| Astrology | Bronze | 150G | 0:50 | Conversion +30% faster | S1, S4 |
| Mysticism | Bronze | 120G | 0:50 | Priest HP ×2 (25 to 50) | S1, S4, S11 |
| Polytheism | Bronze | 120G | 0:50 | Priest speed +40% | S1, S4 |
| Fanaticism | Iron | 150G | 1:00 | Faith regenerates 50% faster (O: needed for Legion) | S1, S4 |
| Monotheism | Iron | 350G | 1:15 | Convert enemy priests and buildings (not TCs or Wonders) | S1, S4 |
| Afterlife | Iron | 275G | 1:15 | +3 conversion range | S1, S4 |
| Jihad | Iron | 120G | 1:00 | Villagers gain HP, attack and speed but carry less | S1, S2, S4 |
| Medicine (R) | Iron | 150G | (?) | Faster priest healing (O/R ×3 per wiki; DE +100%) | S7, S16, F-Priest |
| Martyrdom (R) | Iron | 600G (R FAQ); 400G in wiki (DE "Sacrifice") | (?) | Sacrifice the priest for an instant conversion (not of priests). The AI never uses it | S7, S16, S18 |

### Unit upgrades
These are listed with each unit in section 4.

---

## 6. Combat rules

| Rule | Detail | Src |
|---|---|---|
| Damage vs units | `max(1, max(0, Atk_melee − Armor) + max(0, Atk_pierce − PierceArmor) + Σ bonuses) × elevation`. Damage is fixed, with no random roll. The minimum is about 1 HP per hit | F-Armor, S10, S12 |
| Pierce armor | Present since O. Only missile damage uses it: Archery Range units, towers, Scout Ship, War Galley and Trireme, plus Ballista/Helepolis for shield techs. Pierce armor does not reduce melee damage | S1, S12 |
| Melee-type attacks | Villagers, Barracks/Academy units (except Slinger), Stable units, the Stone Thrower line and catapult ships deal "melee" damage that armor reduces | F-Armor |
| Damage vs buildings | The same sum ×0.2, with a minimum of 0.1. Buildings in effect resist 80%; a +10 bonus does +2 | F-Armor, F-Villager |
| Elevation and cliffs (O manual) | When the target is lower, each hit has a 25% chance of **triple damage** | S1 |
| Elevation (DE) | ×1.5 when a ranged unit shoots downhill; ×0.67 when a melee unit attacks uphill | F-Armor |
| Bonus damage (O) | Cavalry line +5 vs Barracks infantry. Chariot ×2 and Chariot Archer ×3 vs priests. R: Slinger +2 vs archers and extra vs walls/towers; Camel +8 vs cavalry/HA and +4 vs chariots | S1, S2, S6 |
| Area damage | Stone Thrower small, Catapult medium, Heavy Catapult large, Catapult Trireme small, Juggernaught medium. War Elephant and Scythe Chariot trample adjacent enemies. Siege splash hurts your own units and buildings too (?) | S1, S2, HG-rm |
| Siege accuracy | Without Ballistics, siege fires at the target's position at firing time and misses moving units. With Ballistics it leads the target. R: slow targets always hit, medium sometimes, fast ones dodge | S10, S16 |
| Attack Ground | Stone Thrower line and catapult ships only | S1 |
| Fire rates (O) | Infantry and cavalry 1.5 s (Scout 0.9, cavalry 1.3, chariot 1.4 per S2). Bowmen 1.4. Siege 5 s. Ballista 3 s. Helepolis 1.5 s | S1, S2 |
| Auto-attack | Military units attack anything that enters their sight. Stand Ground holds position and fires only at targets in range. Scouts do not auto-attack villagers. Units prefer low-HP targets such as villagers | S1, HG-rm |
| Building attack | Only towers attack. TCs, walls and other buildings have none | S1, S3, F-House |
| Villagers vs walls/towers | Villagers can only destroy walls and towers after Siegecraft | S1 |

### 6.1 Priests: conversion and healing

| Aspect | Detail | Src |
|---|---|---|
| Range | 10 tiles (Egyptian +3; Afterlife +3) | S1, S2 |
| Mechanic | You must order a conversion; priests only auto-convert if attacked. Each 1.5 s "chant" has a chance to succeed. DE wiki: at least 3 chants, then 30% per chant (39% with Astrology), up to 100 chants. O exact odds (?) | S1, F-Priest |
| After success | Faith drops to 0 and regenerates over about 50 s (2%/s); Fanaticism makes it ~33 s. A failed attempt does not drain faith (S11). The priest stands idle afterwards | F-Priest, S11, S1 |
| Resistance | Boats ×2. Chariots and Chariot Archers ×8 (O). Macedonian units ×4 (R) | S1, F-Chariot, S16 |
| Cannot convert | Town Centers, Wonders, allied units. Priests and buildings need Monotheism, and the priest must stand adjacent to a building | S1 |
| Converted units | Keep their stats from the moment of conversion and get no further upgrades from you. Only Monotheism, Astrology, Fanaticism, Ballistics and Siegecraft still apply. A converted building you have never built yourself cannot train until you build your own copy | S1 |
| Population | Conversions ignore the 50 cap | F-Priest, S11 |
| Healing | Priests stand adjacent and heal friendly or allied land units, including siege but not ships or buildings. No cooldown. After the first ordered heal they keep healing nearby units. 3 HP/s (O), 2.5 (DE) | S1, F-Priest, S11 |

---

## 7. Civilizations

**Architecture sets (O).**
- Egyptian: Egyptians, Assyrians, Sumerians.
- Greek: Greeks, Minoans, Phoenicians.
- Babylonian (Mesopotamian): Babylonians, Hittites, Persians.
- Asian: Choson, Shang, Yamato.
- Roman (R): Romans, Carthaginians, Macedonians, Palmyrans.
- Return of Rome (DE, 2023) adds the Lac Viet, with East Asian buildings and the standard East Asian Wonder (S25).

DE swaps the Hittites and Sumerians between the Egyptian and Mesopotamian sets (F-Wonder).

Each civilization also has its own missing techs and units. F-Civilizations lists them for the DE tree.

| Civ | Bonuses (O manual; R changes noted) | Src |
|---|---|---|
| Assyrian | Archery Range units fire 40% faster. Villagers 30% faster | S1, S5 |
| Babylonian | Walls and towers ×2 HP. Priests regain faith 30% faster. Stone mining +30% | S1, S5 |
| Choson | Long Swordsman and Legion +80 HP. Towers +2 range. Priests −30% cost | S1, S5 |
| Egyptian | Gold mining +20%. Chariot and Chariot Archer +33% HP. Priests +3 range | S1, S5 |
| Greek | Academy units 30% faster. War ships 30% faster | S1, S5 |
| Hittite | Stone Thrower line ×2 HP. Archery Range units +1 attack. War ships +4 range | S1, S5 |
| Minoan | Ships −30% cost. Composite Bowman +2 range. Farms +25% | S1, S5 |
| Persian | Hunting +30%. Farms −30% (removed in R). Elephants 50% faster. Trireme fires 50% faster. No Academy | S1, S5, S16 |
| Phoenician | Elephants −25% cost. Catapult Trireme/Juggernaught fire 65% faster. Woodcutting +2 (S5) / +30% (S16) | S1, S5, S16 |
| Shang | Villagers −30% cost (35F). Walls ×2 HP | S1, S5 |
| Sumerian | Villagers +15 HP. Stone Thrower line fires 50% faster. Farms ×2 | S1, S5 |
| Yamato | Scout, Cavalry line and Horse Archers −25% cost. Villagers 30% faster. Ships +30% HP | S1, S5 |
| Carthaginian (R) | Transports 30% faster. Fire Galley +25% attack. Academy units and elephants +25% HP | S8, S16 |
| Macedonian (R) | Academy units +2 pierce armor. Melee units +2 LOS. Siege Workshop units −50% cost. Units ×4 harder to convert. No Temple | S8, S16 |
| Palmyran (R) | Free tribute. Double gold per trade trip. Villagers cost +50% (75F) but have armor and work +20% faster. Camel Riders +25% speed | S8, S16 |
| Roman (R) | Buildings −15% cost (S16) or −25% (S8), except towers, walls and Wonders. Towers −50%. Swordsmen attack 33% faster | S8, S16 |
| Lac Viet (DE RoR) | Foragers work 20% faster at release, 15% after a later patch. Military units created 25% faster. Archery Range units +2 armor; a later patch gives Ballistae +2 armor too. Team bonus: Houses and Farms built 50% faster | S25, S26, F-Lac Viet |

**Lac Viet tech tree (F-Lac Viet/Tree, S26; not checked in game).** No Aristocracy, Mysticism, Polytheism,
Afterlife, Fanaticism, Monotheism, Chain Mail Infantry, Tower Shield, Siegecraft, Engineering or Urbanization.
No Phalangite, Centurion, Legionary, Camel Rider, Cataphract, Helepolis, Ballista Tower, Fire Galley or
Juggernaut. They keep the whole Archery Range, the Ballista, all Market techs, and Astrology, Zealotry,
Theocracy and Medicine at the Temple. Our rules have no Urbanization and no ships yet, so those are left out;
the team bonus applies to the player itself until there are teams. Siegecraft is the way to Heavy Catapult
here, so the Lac Viet stop at Catapult.

**Every civilization's tech tree (F-Trees, read 2026-10-09).** The DE tech tree page of each civilization
greys out what it lacks; the lists in `TREES` in `scripts/gen-rules.py` are those greyed items, mapped to our
ids, including what a missing item locks (no Iron Shield, so no Tower Shield). Pages are
`https://web.archive.org/web/2024id_/https://ageofempires.fandom.com/wiki/<Civ>/Tree`, or
`<Civ>_(Age_of_Empires)/Tree` for the Egyptians, Greeks, Persians and Romans (the Roman snapshot used is
20240414225713). Rise of Rome differs a little, per the pages' "missing before the Definitive Edition" notes:
the Choson also lacked Nobility; the Egyptians, Shang and Palmyrans Coinage; the Palmyrans Plow; the
Macedonians the Wheel and Catapult; the Shang Ballistics until a DE patch. We follow DE. Ships, City Watch,
Conscription, Theocracy, Urbanization and gates are not in the game, so they are left out.

---

## 8. Other mechanics

| Mechanic | Detail | Src |
|---|---|---|
| Victory, standard (RM default) | The first to achieve any of these wins: **Conquest**; hold **all Artifacts** for 2,000 years; hold **all Ruins** for 2,000 years; keep a **Wonder** standing for 2,000 years. The manual says 2,000 years is about 15 minutes. A countdown clock appears top-right in the controller's color | S1 |
| Conquest | Destroy every enemy villager, military unit, war ship and building. Trade, transport and fishing boats, walls, Ruins and Artifacts do not need to be destroyed | S1 |
| Other victory settings | Conquest only; Score (first to reach a target score); Time Limit (highest score when time runs out). Team score is the average of the team | S1 |
| Ruins | 5 per random map, or none. Static, indestructible. The last civ to bring a unit nearby controls it. Score +10 each | S1, F-Ruins, F-Score |
| Artifacts | 5 or none. Captured like Ruins and can be carried, including on transports. Taking an enemy-held Artifact requires standing next to it. If a transport sinks with one, it reappears on a nearby shore. Score +10 each | S1, F-Artifact, F-Score |
| Wonder | Iron Age only. Everyone is notified when one is started (the minimap shows it) and again when it finishes. Destroying it stops the clock, and its owner is not eliminated. Each Wonder standing at game end is worth 100 points | S1, F-Wonder, F-Score |
| Score categories | Military, Economy, Religion, Technology, Other. Bonuses of +25 or +50 go to whoever leads in a category. The full point table is in F-Score | S1, F-Score |
| Map types (O) | Small Islands, Large Islands, Coastal, Inland, Highland. R adds Continental, Mediterranean, Hill Country, Narrows. R also adds cliffs on some maps | F-Fandom map listing (via search), S16 |
| Map sizes | Small, Medium, Large, Huge; R adds **Gigantic**. Tile sizes: maybe 72/96/120/144/200 (?), unconfirmed | S1, S16 (?) |
| Map generation | Random land/water layout with forests, shallows, elevation and cliffs (R). Each TC gets a berry patch nearby. Gold, stone, gazelles, elephants, lions and alligators are scattered around. A Seed Map option repeats a map from a seed | S1, S15 |
| Terrain | Water and forest are impassable to land units. Shallows can be crossed by land units and ships | S1 |
| Fog of war | Unexplored = black. Explored terrain and buildings stay visible, but building changes (damage, age, destruction) only show while in LOS. Enemy units are visible only in LOS or when they attack. "Reveal Map" is a start option. Writing shares allied LOS | S1 |
| Formations | No formation choice. "Units near each other move in formation" unless ordered onto a target, then they converge. No phalanx-style moves | S1, S12 |
| Attack-move | **None.** Workaround: right-click the ground near the enemy and units engage what they see on arrival | S10 |
| Waypoints | Shift + right-click sets a path | S1 |
| Idle villager | Not in the 1.0 release. The `.` hotkey came with AoE patch 1.0c / RoR patch 1.0a | S19 |
| Rally points | **None in O or R.** Units appear next to the building that trained them. DE added gather points (?) | S1 |
| Production queue | O: one unit at a time per building. R added unit queueing | S16 |
| Gates | **None in O/R**; added in Return of Rome (2023) | F-Small Gate |
| Garrison | None, except loading transports | F-Garrison |
| Tribute | Through the Diplomacy screen, in 100-unit clicks. 25% fee in O (pay 125 to send 100). Coinage or Palmyrans make it free. DE wiki says 30% and requires a Market (DE rule) | S1, F-Tribute |
| AI and tribute | A neutral computer player can turn ally if you tribute 2,600+ resources. A hostile one never does | F-Tribute |
| Diplomacy stances | Ally; Neutral (attacks military and buildings but not villagers); Enemy. Allied victory option | S1 |
| Market exchange | **None in O/R** (no buy/sell). Return of Rome added it. The O Market only holds techs and unlocks Farms | F-Market |
| Repair | Villagers repair buildings and ships for a resource cost, faster with more villagers | S1 |
| Delete | DEL kills your own unit or building. Partial refund on unfinished buildings | S1 |

---

## 9. Interface

### 9.1 Layout (O manual)

| Area | Content | Src |
|---|---|---|
| Top-left | Stockpile counters: wood, food, gold, stone | S1 |
| Top-center | Age indicator | S1 |
| Top-right | Menu bar: Chat, Diplomacy and Menu buttons. Countdown clocks appear below | S1 |
| Bottom-left | Status box for the selected unit or building: portrait, HP current/max, attack, armor, pierce armor, range, priest faith %, resource amount at a work site, ship cargo | S1 |
| Bottom-center | Command / Build / Upgrade / Research button grid. A "Next" arrow button shows more building buttons | S1 |
| Bottom-right | **Diamond-shaped minimap**. Click it or drag the white box to move the view. "S" button toggles score display; "?" button gives popup help | S1 |
| Scrolling | Move the pointer to the screen edge, or use the arrow keys | S1 |
| Resolution | 800×600 default; 640 and 1024 options | S1, HG-commands |
| R additions | F11 shows elapsed time and pop. HOME or middle mouse jumps to the last alert (repeat to cycle the last 5) | S16 |

### 9.2 Mouse scheme

| Behaviour | Detail | Src |
|---|---|---|
| Default ("Two Buttons") | Left-click selects. Right-click gives the context command (move, gather, attack, repair, build at a foundation, load a transport, trade with a dock, heal or convert with a priest) | S1 |
| "One Button" option | Left-click both selects and commands | S1 |
| Box select | Drag a rectangle | S1 |
| Add to selection | Ctrl+click (O manual); Shift+click (later patch/RoR docs) | S1, S17 |
| Double-click | **R only:** selects all units of that type on screen | S16 |
| Group | "Group" and "Ungroup" buttons make a persistent group, so clicking one member selects all. Ctrl+0–9 assigns a number; the digit selects it; Alt+digit selects and centers on it; Shift+digit adds the group | S1, S17 |
| Selection limit | 25 units (?). A developer reply cited online confirms there is a cap but gives no number | (?) |
| Building | Select a villager, press the **Build** button (key **B**) to open the build grid, then a building button or letter (next page via the arrow). Place it with a click; red ghost = invalid site. Shift to place several; drag for walls | S1, S17 |

### 9.3 Default hotkeys (O/R)

| Key | Action | Src |
|---|---|---|
| B then E / G / S / B / D | Build House / Granary / Storage Pit / Barracks / Dock | S13, S17 |
| B then A / L / M / T / W / F | Archery Range / Stable / Market / Tower / Wall / Farm | S13 |
| B then Y / K / C / P / N | Academy / Siege Workshop / Gov. Center / Temple / Town Center | S13, S17 |
| H | Select (and cycle) Town Centers. Then C = Villager | S17 |
| Ctrl+B / A / L / D / K / P / Y | Select Barracks / Archery Range / Stable / Dock / Siege Workshop / Temple / Academy | S17 |
| Train keys | Clubman T; Slinger L (R); swordsmen Z (R); Bowman T; Imp/Comp A; Chariot Archer R; Horse Archer C; Elephant Archer E; Scout T (R) / S (O); Chariot R; Cavalry C; Camel L; Elephant E; Priest T; catapults C; Ballista B; Hoplite T; Fishing F; Trade R; Transport T; warships E; Fire Galley G | S13, S17, S16 |
| M / D / R / T | Move / Stand Ground / Repair / Attack Ground | S13 |
| Del | Delete the selected unit or building | S1 |
| Space | Center on the selection | S17 |
| Tab / Shift+Tab | Cycle within the selection | S17 |
| Esc | Deselect or cancel | S17 |
| + / − | Game speed (1.0 normal, 1.5 fast, 2.0 very fast) | S17 |
| F3 or Pause | Pause | S17 |
| F10 | Game menu | S17 |
| Enter | Chat (also used to type cheat codes) | S17 |
| . | Idle villager (patch 1.0c / RoR 1.0a) | S19 |

---

## 10. Computer AI

| Aspect | What is known | Src |
|---|---|---|
| Difficulty levels | "Easy" to "Hardest" per the manual. Commonly listed as Easiest, Easy, Moderate, Hard, Hardest (?) | S1 |
| Cheating | Hardest gives the AI **extra resources**, not smarter play. Player reports put it at roughly +2,000 of each resource (one says food only), with no official figure (?). One guide says the AI is better than humans at exploring and micro | S23, S20, S19 |
| Aggression | Easy is much less aggressive than Moderate. Low levels send small groups that give up the chase quickly | S20, HG-forum (search) |
| Diplomacy | All computer players start allied to each other and neutral to you, then turn enemy at the start or later. Once enemy, almost always enemy. Team numbers are the only way to make AIs fight each other | S20 |
| Structure | Scripted. A `.ai` build list (units/buildings/research in order, with retrain limits), a `.per` file of "strategic numbers", and `.cty` city layout files. It skips items it cannot afford and comes back to them. Houses, Storage Pits and Granaries are auto-built when needed. It stalls if it finds no forage, wood or water early, because it needs a Granary, Storage Pit or Dock to reach Tool. Lions near its base can cripple it. It never uses Martyrdom. It does not build walls | S18, S20 |
| Typical timings | Normal levels: Tool Age around 15 minutes, sometimes later. Hardest: Tool ~6–7 min, Bronze ~7–12 min, Iron ~20 min (player estimates) | S19, S23 |
| Typical build | Similar to the human opening: house, villagers, granary/storage pit near food and wood, a barracks for early clubmen and axemen, then tool-age archers and cavalry. Early attacks are 5–10 units that fade by mid-Bronze (player reports, (?)) | S23 |
| Reference human pace | Ken Stanley's 1998 guide: ~3 villagers/min, 24 villagers by 8:00, click Tool at ~9:00, click Bronze at 11:20. Good players reach Tool in ~10 min and Bronze in ~11–15 min. A villager boom reaches Iron in ~17 min | S15, S16 |

---

## Gaps (your game vs AoE1)

Your current build: 72×72 map; food/wood/gold/stone; Stone and Tool ages only; villager carry 10; gather rates food 0.45, wood 0.4, gold 0.38, stone 0.36 per second; start 200F/200W/0G/150S with 3 villagers; pop max 50; house +4, TC +5; buildings town_center, house, granary, storage_pit, barracks, farm (250 food), archery_range, stable, watch_tower; units villager, clubman, axeman, bowman, scout. You have no technologies, hunting, fishing, ships, priests, walls, market, civs, ruins/artifacts/wonders, but you do have rally points and attack-move.

| # | Gap or deviation | AoE1 value | Importance to the AoE1 feel |
|---|---|---|---|
| 1 | **Age advancement rule.** Check that you require 2 *different* current-age buildings plus a TC research of 500F / 2:00 | Tool needs 2 of Granary / Storage Pit / Barracks / Dock | High |
| 2 | **No Bronze or Iron Age** | Bronze 800F, needs 2 of Market / Archery Range / Stable; Iron 1,000F + 800G | High; the 4-age arc is the game's identity. Bronze at least |
| 3 | **No technologies** (Storage Pit armor/attack, Market economy techs, Granary wall/tower techs) | See section 5 | High; Leather Armor and Toolworking decide Tool-Age fights |
| 4 | **No Market** | Tool, 150W, needs Granary. Farms need it. Holds economy techs and is a Bronze prerequisite | High (Farms should be gated behind it) |
| 5 | **No hunting** (gazelle, elephant, lion, alligator) | 150 / 300 / 100 / 100 food, carcass decay, villagers throw spears, lions attack | High; the Stone Age is about berries and hunting |
| 6 | **No shore fishing, Dock or boats** | Shore fish 250 food at ~0.6/s; Dock 100W; Fishing Boat 50W; deep fish 300 | High on water maps, medium overall (Dock is also an age-up building) |
| 7 | **TC pop +5** | AoE1 is +4 | Medium; easy fix, and the opening depends on 3 villagers + 4 pop |
| 8 | **Gather rates** | AoE1 runs ~0.45/s for nearly everything: wood ~0.45–0.55, gold/stone ~0.45 (DE 0.5175), shore fish ~0.6, boats 0.4. Yours (wood 0.4, gold 0.38, stone 0.36) are slower | Medium |
| 9 | **Farm rules** | 75W, Tool Age, needs Market, 3×3, blocks movement, one farmer, 250 food (+75 per tech), disappears and must be rebuilt by hand | Medium; the manual rebuild chore is part of the feel |
| 10 | **No walls** (Small Wall needs a 50F Granary research; 5 stone per tile) and **no gates** | | Medium; walling with houses and walls is classic. Do not add gates if you want O fidelity |
| 11 | **Tower line incomplete** (Sentry, Guard, Ballista) and tower research gating | Watch Tower needs a 50F Granary tech. 150S, 100 HP, 3 attack, range 5 | Medium |
| 12 | **Combat formula** | Fixed damage `max(1, melee−armor + pierce−parmor + bonus)`; buildings take ×0.2; separate pierce armor; elevation triple-damage chance | High if missing |
| 13 | **Missing Tool-Age units** | Slinger (R), Scout Ship, Light Transport | Low–medium |
| 14 | **Unit stats** | Clubman 40 HP / 3 atk; Axeman 50 / 5 (an upgrade, 100F); Bowman 35 HP, 3 atk, range 5, 40F + 20W; Scout 100F, 60 HP, speed 2.0, LOS 8 | Medium (check against section 4) |
| 15 | **No priests or conversion** | Bronze Temple, 125G | High once Bronze exists |
| 16 | **No civilizations** | 12 (16 with R), bonuses in section 7 | Medium; even 4 civs matching the architecture groups add identity |
| 17 | **No Ruins, Artifacts or Wonder victory**; no score | Section 8 | Medium (Wonder needs Iron; Ruins/Artifacts are cheap to add) |
| 18 | **Rally points exist** | AoE1 had none | Low; keeping them is a modern convenience. Make them optional for authenticity |
| 19 | **Attack-move exists** | AoE1 had none; units auto-engage what they see | Low; harmless convenience, could be a toggle |
| 20 | **Production queue** | O: one at a time. R: queue | Low |
| 21 | **No idle-villager key or double-click select-type** (if missing) | Both arrived in R or later patches | Low |
| 22 | **No hardest-AI resource bonus or scripted build-list AI** | Section 10 | Medium |
| 23 | **Map size** | 72×72 is a plausible "Small" size (?). AoE1 also had Medium through Huge and map types (islands, coastal, inland, highland) | Low–medium |
| 24 | **Interface** | Diamond minimap bottom-right, status box bottom-left, B-key build grid with a "Next" page, left-select / right-command | Medium for feel |
| 25 | **Housing.** Units in training do not count toward pop, and destroyed houses do not kill units | | Low |

---

## Sources

All web sources were accessed 2026-10-08. Fandom ("F-") pages were read through Internet Archive snapshots (`https://web.archive.org/web/2024id_/<url>`), because the live site blocks automated fetches.

| Key | Source | URL |
|---|---|---|
| S1 | *Age of Empires* original manual, 1997 (scan + OCR) | https://archive.org/details/manual_Age_of_Empires (text: https://archive.org/download/manual_Age_of_Empires/Age_of_Empires_djvu.txt) |
| S2 | BlackDouglas unit statistics (Telcontar's Empire of the Ages) | http://artho.com/age/stats/aoetable.html |
| S3 | BlackDouglas structure statistics | http://artho.com/age/stats/structures.html |
| S4 | BlackDouglas technology statistics | http://artho.com/age/stats/technologies.html |
| S5 | Civilization attributes (Telcontar) | http://artho.com/age/alltribes.html |
| S6 | Rise of Rome units (Telcontar) | http://artho.com/age/ror/units/ |
| S7 | Rise of Rome upgrades (Telcontar) | http://artho.com/age/ror/techs/ |
| S8 | Rise of Rome civilizations (Telcontar) | http://artho.com/age/ror/civs/ |
| S9 | Resource management guide (Telcontar) | http://artho.com/age/resources.html |
| S10 | Combat guide (Telcontar) | http://artho.com/age/combat.html |
| S11 | Conversion guide (Telcontar) | http://artho.com/age/conversion.html |
| S12 | AoE FAQ (Telcontar) | http://artho.com/age/faq.html |
| S13 | Hotkey list (Telcontar) | http://artho.com/age/files/hotkeys.txt |
| S14 | Patch 1.0b notes (Telcontar) | http://artho.com/age/files/patch.html |
| S15 | Ken Stanley, "Bronze Age in 15 minutes" guide (1998) | http://artho.com/age/bronze/ (sections node1–node15.html) |
| S16 | Rise of Rome FAQ (GameRevolution) | https://www.gamerevolution.com/?p=29074 |
| S17 | Hotkeys (AoE Heaven) | https://aoe.heavengames.com/theacademy/hotkeysandcommands/hotkeys/ |
| HG-commands | Command line parameters (AoE Heaven) | https://aoe.heavengames.com/theacademy/hotkeysandcommands/commands/ |
| S18 | AI files article (AoE Heaven) | https://aoe.heavengames.com/siegeworkshop/ai/ |
| S19 | Random Map hints: Stone Age (AoE Heaven) | https://aoe.heavengames.com/theacademy/singleplayerhelp/singleplayerrandommapguides/random-map-hints-and-tips/stone-age/ |
| S20 | Random Map hints: Other Questions (AoE Heaven) | https://aoe.heavengames.com/theacademy/singleplayerhelp/singleplayerrandommapguides/random-map-hints-and-tips/other-questions/ |
| S21 | Random Map hints: Ruins/Artifacts (AoE Heaven) | https://aoe.heavengames.com/theacademy/singleplayerhelp/singleplayerrandommapguides/random-map-hints-and-tips/ruinsartifacts/ |
| HG-rm | Random Map hints: Bronze Age (AoE Heaven) | https://aoe.heavengames.com/theacademy/singleplayerhelp/singleplayerrandommapguides/random-map-hints-and-tips/bronze-age/ |
| S22 | Villager page (AoE Heaven) | https://aoe.heavengames.com/theacademy/unitsboatsandbuildings/villagers/ |
| S23 | "Do the computer cheat in hardest difficulty?" (AoE Heaven forum) | https://aoe.heavengames.com/cgi-bin/aoecgi/display.cgi?action=st&fn=1&tn=1096 |
| S24 | "Villager Resource Gather Rates" (official AoE forums) | https://forums.ageofempires.com/t/villager-resource-gather-rates/33158 |
| S25 | "Return of Rome: everything you need to know" (official site, accessed 2026-10-09) | https://www.ageofempires.com/news/return-of-rome-everything-you-need-to-know/ |
| S26 | Lac Viet civilisation page (AoE Heaven, accessed 2026-10-09) | https://aoe.heavengames.com/theacademy/civilisations/lac-viet/ |
| F-Trees | Fandom tech tree pages of all 17 civilizations, through the Internet Archive | https://web.archive.org/web/2024id_/https://ageofempires.fandom.com/wiki/Assyrians/Tree (and the same for each civ) |
| F-Lac Viet, F-Lac Viet/Tree | Fandom (through search results; the live site blocks fetches) | https://ageofempires.fandom.com/wiki/Lac_Viet · https://ageofempires.fandom.com/wiki/Lac_Viet/Tree |
| LQ-Lac Viet | Liquipedia | https://liquipedia.net/ageofempires/Lac_Viet |
| F-Villager | Fandom | https://ageofempires.fandom.com/wiki/Villager_(Age_of_Empires) |
| F-Farm | Fandom | https://ageofempires.fandom.com/wiki/Farm_(Age_of_Empires) |
| F-House | Fandom | https://ageofempires.fandom.com/wiki/House_(Age_of_Empires) |
| F-Town Center | Fandom | https://ageofempires.fandom.com/wiki/Town_Center_(Age_of_Empires) |
| F-Granary / F-Storage Pit / F-Barracks / F-Dock | Fandom | https://ageofempires.fandom.com/wiki/Granary_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Storage_Pit_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Barracks_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Dock_(Age_of_Empires) |
| F-Archery Range / F-Stable / F-Market | Fandom | https://ageofempires.fandom.com/wiki/Archery_Range_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Stable_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Market_(Age_of_Empires) |
| F-Government Center / F-Temple / F-Academy / F-Siege Workshop / F-Wonder | Fandom | https://ageofempires.fandom.com/wiki/Government_Center · https://ageofempires.fandom.com/wiki/Temple_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Academy · https://ageofempires.fandom.com/wiki/Siege_Workshop_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Wonder_(Age_of_Empires) |
| F-Small Wall / F-Medium Wall / F-Fortified Wall / F-Small Gate | Fandom | https://ageofempires.fandom.com/wiki/Small_Wall · https://ageofempires.fandom.com/wiki/Medium_Wall · https://ageofempires.fandom.com/wiki/Fortified_Wall_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Small_Gate |
| F-Watch / Sentry / Guard / Ballista Tower | Fandom | https://ageofempires.fandom.com/wiki/Watch_Tower_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Sentry_Tower_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Guard_Tower_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Ballista_Tower_(Age_of_Empires) |
| F-Tool Age / F-Bronze Age / F-Iron Age | Fandom | https://ageofempires.fandom.com/wiki/Tool_Age · https://ageofempires.fandom.com/wiki/Bronze_Age · https://ageofempires.fandom.com/wiki/Iron_Age |
| F-Clubman, F-Axeman, F-Short/Broad/Long Swordsman, F-Legionary, F-Slinger | Fandom | https://ageofempires.fandom.com/wiki/Clubman · https://ageofempires.fandom.com/wiki/Axeman_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Short_Swordsman · https://ageofempires.fandom.com/wiki/Broad_Swordsman · https://ageofempires.fandom.com/wiki/Long_Swordsman_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Legionary_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Slinger_(Age_of_Empires) |
| F-Hoplite, F-Phalangite, F-Centurion | Fandom | https://ageofempires.fandom.com/wiki/Hoplite_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Phalangite · https://ageofempires.fandom.com/wiki/Centurion_(Age_of_Empires) |
| F-Bowman, F-Improved/Composite Bowman, F-Chariot Archer, F-Horse Archer, F-Heavy Horse Archer, F-Elephant Archer | Fandom | https://ageofempires.fandom.com/wiki/Bowman_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Improved_Bowman · https://ageofempires.fandom.com/wiki/Composite_Bowman_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Chariot_Archer_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Horse_Archer_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Heavy_Horse_Archer · https://ageofempires.fandom.com/wiki/Elephant_Archer_(Age_of_Empires) |
| F-Scout, F-Chariot, F-Scythe Chariot, F-Cavalry, F-Heavy Cavalry, F-Cataphract, F-War Elephant, F-Armored Elephant, F-Camel Rider | Fandom | https://ageofempires.fandom.com/wiki/Scout_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Chariot_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Scythe_Chariot · https://ageofempires.fandom.com/wiki/Cavalry_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Heavy_Cavalry_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Cataphract_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/War_Elephant_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Armored_Elephant_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Camel_Rider_(Age_of_Empires) |
| F-Stone Thrower, F-Catapult, F-Heavy Catapult, F-Ballista, F-Helepolis | Fandom | https://ageofempires.fandom.com/wiki/Stone_Thrower · https://ageofempires.fandom.com/wiki/Catapult_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Heavy_Catapult · https://ageofempires.fandom.com/wiki/Ballista_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Helepolis_(Age_of_Empires) |
| F-Priest | Fandom | https://ageofempires.fandom.com/wiki/Priest_(Age_of_Empires) |
| F-Fishing Boat, F-Trade Boat, F-Light/Heavy Transport, F-Scout Ship, F-War Galley, F-Trireme, F-Catapult Trireme, F-Juggernaut, F-Fire Galley | Fandom | https://ageofempires.fandom.com/wiki/Fishing_Boat_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Trade_Boat · https://ageofempires.fandom.com/wiki/Light_Transport · https://ageofempires.fandom.com/wiki/Heavy_Transport · https://ageofempires.fandom.com/wiki/Scout_Ship_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/War_Galley_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Trireme_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Catapult_Trireme · https://ageofempires.fandom.com/wiki/Juggernaut_(Age_of_Empires) · https://ageofempires.fandom.com/wiki/Fire_Galley_(Age_of_Empires) |
| F-Gazelle, F-Elephant, F-Lion, F-Alligator, F-Berry Bush, F-Shore Fish, F-Fish, F-Whale, F-Tree | Fandom | https://ageofempires.fandom.com/wiki/Gazelle · https://ageofempires.fandom.com/wiki/Elephant · https://ageofempires.fandom.com/wiki/Lion · https://ageofempires.fandom.com/wiki/Alligator · https://ageofempires.fandom.com/wiki/Berry_Bush · https://ageofempires.fandom.com/wiki/Shore_Fish · https://ageofempires.fandom.com/wiki/Fish · https://ageofempires.fandom.com/wiki/Whale · https://ageofempires.fandom.com/wiki/Tree |
| F-Armor | Fandom (AoE1 damage formula) | https://ageofempires.fandom.com/wiki/Armor |
| F-Technology | Fandom technology table (DE values) | https://ageofempires.fandom.com/wiki/Technology_(Age_of_Empires) |
| F-Civilizations | Fandom (DE civ bonuses and missing techs/units) | https://ageofempires.fandom.com/wiki/Civilizations_(Age_of_Empires) |
| F-Ruins, F-Artifact, F-Tribute, F-Trade, F-Score, F-Population, F-Garrison | Fandom | https://ageofempires.fandom.com/wiki/Ruins · https://ageofempires.fandom.com/wiki/Artifact · https://ageofempires.fandom.com/wiki/Tribute · https://ageofempires.fandom.com/wiki/Trade · https://ageofempires.fandom.com/wiki/Score · https://ageofempires.fandom.com/wiki/Population · https://ageofempires.fandom.com/wiki/Garrison |

Liquipedia (liquipedia.net/ageofempires) returned HTTP 403 to automated fetches, so it was not used.
