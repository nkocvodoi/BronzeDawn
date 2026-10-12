# Age of Empires (Genie engine): data, mechanics and AI, for rebuilding the game

This document explains how Age of Empires (1997) and Rise of Rome (1998) store and use their game data, and how
Bronze Dawn can read a player's own copy of the game to play with the original art, sound and numbers.

It contains **no** art, sound, data tables or code from the game. Numbers from the game are written only to
`web/assets-local/`, which is gitignored and served only by the dev server, by the importer described in §1. The
file formats come from the open-source genieutils library (LGPL) and from reading the files themselves. The AI
section describes behaviour and structure observed with the REA reverse-engineering tool, in our own words.

Contents:
1. Using your own copy of the game (Windows and Mac)
2. Where everything lives in the install
3. File formats: empires.dat, .drs, .slp, palette, language.dll
4. How the numbers work: units, combat, economy, effects, techs, ages, civilizations
5. Graphics: animations, directions, buildings by age and architecture, player colour
6. The computer player (AI)
7. How the importer maps the original onto Bronze Dawn
8. Known gaps

---

## 1. Using your own copy of the game

### On a machine with Age of Empires installed

```bash
cd web
npm install
npm run import-aoe -- --aoe "C:/Games/Age of Empires/Empires.exe"   # or the game folder
npm run dev
```

The importer finds `data/` (and `data2/` for Rise of Rome) next to the executable and writes:

| Path in `web/assets-local/` | What |
| --- | --- |
| `rules.json` | Bronze Dawn's rules with the original's numbers (costs, times, HP, attack, armour, range, reload, speed, LOS, gather rates and carry, resource amounts, animals, ages, tech costs and effects, civ bonuses and tech trees). The dev server uses it instead of `data/rules.json`. |
| `manifest.json` | Asset manifest for the game's loader (units, villager jobs, animals, buildings per architecture and age, resources, terrain, icons, sounds). The previous manifest is kept as `manifest.before-aoe.json`. |
| `aoe/units/*.png` | One sprite sheet per unit: idle, walk, attack or work, die; 5 directions each. |
| `aoe/buildings/<id>/<arch>-<age>.png` | Buildings for the 5 architectures (egyptian, greek, babylonian, asian, roman) and the ages where they change. |
| `aoe/resources/*.png`, `aoe/terrain/*.png`, `aoe/icons/*.png` | Trees, bushes, mines, fish, carcasses; 64×32 terrain tiles; unit and building icons. |
| `aoe/sfx/<id>.wav` | Every sound in `sounds.drs` and `interfac.drs`, by resource id. The manifest maps the ones Bronze Dawn plays. |
| `aoe-data/empires-ror.json`, `aoe-data/empires-aoe1997.json` | The complete parsed `empires.dat` of each version, with display names and help text attached. |
| `aoe-data/tables/<version>/*.md` | Readable tables: units, buildings, economy, techs, civs, ages. |
| `aoe-data/rules-notes.md` | Every value or effect of the original that Bronze Dawn's rules cannot express yet. |
| `aoe-data/strings.json`, `aoe-data/sounds.json` | The language.dll string table; the sound list (empires.dat sound id → wav ids). |

Options: `--out <dir>`, `--no-art`, `--no-sound`. `AOE_PATH` can replace `--aoe`.

Run a headless match with the imported rules: `npx tsx scripts/aoe/sim-aoe.ts 1 hard easy 45`.
Play with Bronze Dawn's own rules even though the local file exists: `BD_RULES=default npm run dev`.

### On a machine without the game (for example a Mac)

The importer's output is self-contained. Copy the whole `web/assets-local/` folder from a machine that ran the
importer (keep it private: it is the game's art, sound and data), put it at `web/assets-local/`, and run
`npm run dev`. Nothing else is needed: no Windows, no game install, no import step. Restart the dev server after
replacing the folder, because it checks for the manifest and rules file when it starts.

`npm test`, `npm run build` and the GitHub Pages deploy never read `assets-local/`: they keep using
`data/rules.json` and the code-drawn art.

---

## 2. Where everything lives in the install

| File | Contents |
| --- | --- |
| `Empires.exe` / `Empiresx.exe` | The 1997 game / Rise of Rome. Native 32-bit x86 Windows (PE32), MSVC, no symbols. |
| `language.dll` / `languagex.dll` | String tables: names, help text, UI text. `empires.dat` refers to them by number. |
| `data/empires.dat`, `data2/empires.dat` | All game data, zlib "raw deflate" compressed (1997 / Rise of Rome). |
| `data/graphics.drs`, `data2/graphics.drs` | Unit, building and object sprites (SLP). Rise of Rome's file adds and replaces ids. |
| `data/terrain.drs`, `data/border.drs` | Terrain tiles and terrain borders (SLP). |
| `data/interfac.drs` | Interface art (SLP), palettes (JASC-PAL text, id 50500 is the game palette), UI sounds (WAV). |
| `data/sounds.drs` | Sound effects (WAV). |
| `data/*.ai`, `*.per`, `*.cty` | Computer player scripts: build lists, personalities, city plans (§6). |
| `sound/*.mid` | Music (MIDI, which browsers do not play; not imported). |
| `learn/` | What the computer player learns between games (§6). |

---

## 3. File formats

### 3.1 empires.dat (version string `VER 3.7`)

After inflating (raw deflate, no zlib header), the file is a little-endian stream read front to back with no
padding. The reader is `web/scripts/aoe/dat.ts`; it checks that it ends exactly on the last byte. The order:

1. Version, 8 bytes: `VER 3.7` and a NUL.
2. Terrain restrictions: count (u16), terrains used (u16), one pointer per restriction (i32), then for each
   restriction one float per terrain: 0 means "cannot go there", otherwise a damage/passability multiplier.
   Units refer to a restriction by index (land, water, both, ...).
3. Player colours: count (u16); each: name (30 bytes), id (i16), palette resource (i16), minimap colour (u8),
   type (u8).
4. Sounds: count (u16); each: id, play delay, file count (i16 ×3), cache time (i32), then per file: name (13
   bytes), wav resource id in a .drs (i32), probability in percent (i16).
5. Graphics: count (u16), one pointer per graphic (i32; 0 = empty slot), then each present graphic:
   name (21), file name (13), SLP id (i32), loaded flag, old colour flag, layer (u8 ×3), player colour (i16),
   transparent selection (u8), coordinates (i16 ×4), delta count (u16), sound (i16), angle sounds used (u8),
   frame count (u16), angle count (u16), speed multiplier, frame duration, replay delay (f32 ×3), sequence type
   (u8), id (i16), mirroring mode (u8); then deltas (16 bytes each: graphic id, padding, sprite pointer, x, y,
   display angle, padding) and, if used, 3 frame/sound pairs per angle.
6. Terrain block: map pointers and sizes, 19 tile shapes (w, h, dy), padding, 32 terrain slots (enabled, name,
   SLP, sound, minimap colours, passable/impassable terrain, animation, 19 elevation graphics, terrain to draw,
   32 border ids, 30 objects placed on it with densities), 16 terrain borders, then map/tile constants.
7. Random maps: count, pointer; a header per map (id, borders, water shape, base terrain, land coverage and
   the counts of its lists), then each map's body. In the body each list (lands, terrains, objects,
   elevations) follows its own count and pointer.
8. Effects ("technology effects"): count (i32); each: name (31 bytes), command count (i16), commands of 11
   bytes: type (u8), a, b, c (i16), d (f32). See §4.5.
9. Civilizations: count (u16); each: player type (u8), name (20), resource count (u16), tech tree effect (i16),
   starting resources (f32 × count, §4.6), architecture set (u8), unit count (u16), one pointer per unit,
   then every present unit (§3.2).
10. Technologies: count (u16); each: 4 required techs, 3 costs (type, amount i16, paid flag u8), required tech
    count, location (the building unit that researches it), name and description string ids, research time,
    effect id, type, icon (i16 each), button (u8), help, tech-tree and hotkey string ids (i32 ×3), name length
    (u16) and name.

Every civilization holds a full copy of the unit list. In the data the copies differ only in graphics (each
civilization points its later buildings at its architecture's pictures); civ bonuses are not baked into the
units, they are effects (§4.6).

### 3.2 Units

A unit record grows with its type (u8): 10 eye candy, 20 flag, 30 dead/fish (moving), 40 bird (has actions),
50 combatant, 60 projectile, 70 creatable unit, 80 building, 90 tree. Each type adds a block to the previous one:

- **Base (every unit):** name length, id, name and creation string ids, class (§4.1), standing graphic (one in
  AoE), dying graphic, undead graphic and mode, hit points, line of sight, garrison capacity, collision size
  (x, y, z), train sound, dead unit (the corpse it leaves), sort number, can-be-built-on, icon, hide-in-editor,
  portrait, enabled, placement terrains, clearance size, hill mode, fog visibility, terrain restriction, fly
  mode, resource capacity (what it carries), resource decay (per second, for corpses), blast defence, combat
  level, interaction mode, minimap mode and colour, interface kind, help and hotkey string ids, recyclable,
  auto-gather, doppelganger on death, gather group, selection effect and colour, outline size, 3 resource
  storages (type, amount, flag; for example a house gives `population headroom +4`, a gold mine holds
  `gold 400`), damage graphics (picture shown below a share of hit points), selection and dying sounds, attack
  reaction, convert terrain, name, copy id.
- **Moving (30+):** speed, walking and running graphics, rotation speed, size class, tracking unit (a trail),
  movement algorithm.
- **Action (40+):** default task, search radius, work rate (resource per second when working), 2 drop sites,
  task swap group, attack and move sounds, run pattern, and the task list: each task says what the unit can do
  to what (action type, target class or unit, terrain, resource in/out, work value and range, auto-search,
  graphics for moving / working / carrying, gather and deposit sounds).
- **Combat (50+):** base armour, attacks and armours as lists of (class, amount) (§4.2), terrain defence bonus,
  max range, blast width (splash), reload time, projectile unit, accuracy %, break-off-combat, frame delay (when
  in the attack animation the hit lands), projectile start offset, blast level, min range, attack graphic, and
  the values shown in the interface.
- **Projectile (60):** projectile type, smart mode (leads moving targets), hit mode, vanish mode, area effect,
  arc.
- **Creatable (70+):** 3 costs (resource type, amount, paid flag; type 4 is population), train time, train
  location (building unit id), button, displayed pierce armour.
- **Building (80):** construction graphic, adjacent mode, graphics angle, disappears-when-built, stacked unit,
  foundation terrain, overlay, the tech it triggers when built, construction sound.

Buildings use `train time` as their build time.

### 3.3 .drs archives

64-byte header: copyright text (40), version (`1.00`), type (`tribe` + padding), table count (i32), offset of
the first file (i32). Then 12 bytes per table: extension stored reversed (`' pls'` = slp, `' vaw'` = wav,
`'anib'` = binary), offset of its file list, file count. Each file entry: id, offset, size (i32 ×3).

### 3.4 SLP sprites (version `2.0N`)

Header: version (4), frame count (i32), comment (24). Per frame (32 bytes): command table offset, outline
table offset, palette offset, properties, width, height, hotspot x, hotspot y. The outline table has, per row,
the transparent pixels on the left and right (u16 each; `0x8000` = empty row). The command table has, per row,
the offset of its commands. Command byte, low bits:

| Low bits | Command | Pixel count |
| --- | --- | --- |
| `xx00` | copy pixels | `cmd >> 2` |
| `xx01` | skip | `cmd >> 2` |
| `0010` | copy pixels | `((cmd & 0xF0) << 4) + next byte` |
| `0011` | skip | same |
| `0110` | player colour pixels (palette index + 16 × player colour) | `cmd >> 4`, or next byte if 0 |
| `0111` | fill with one colour | same |
| `1010` | fill with player colour | same |
| `1011` | shadow | same |
| `1110` | extended: 4/6 one outline pixel, 5/7 outline run (next byte), 0-3 hints | - |
| `1111` | end of row | - |

The hotspot is the point that sits on the ground: a unit's feet, a building's centre.

### 3.5 Palette and strings

The palette is `interfac.drs` binary 50500, a JASC-PAL text file of 256 RGB entries. Player colours are bands
of the palette: a player-colour pixel stores its shade, drawn at `shade + 16 × (player + 1)`.

`language.dll` is a Windows PE file whose `RT_STRING` resources hold the text. Block `n` holds strings
`(n-1)*16` to `(n-1)*16+15`, each a u16 length and UTF-16 text. Rise of Rome's `languagex.dll` adds to and
overrides it.

---

## 4. How the numbers work

The exact values for every unit, building, tech and civ are in the importer's `aoe-data/tables/`. This section
explains what they mean.

### 4.1 Unit classes

Effects, tasks and bonuses target units by class: 0 archer, 1 artifact, 2 trade boat, 3 building, 4 civilian,
5 sea fish, 6 infantry, 7 berry bush, 8 stone mine, 9 prey animal, 10 predator animal, 11 other, 12 cavalry,
13 siege weapon, 14 terrain object, 15 tree, 16 tree stump, 18 priest, 20 transport boat, 21 fishing boat,
22 war boat, 23 chariot archer, 24 war elephant, 25 hero, 26 elephant archer, 27 wall, 28 phalanx, 29 domestic
animal, 30 flag, 32 gold mine, 33 shore fish, 34 cliff, 35 chariot, 36 cavalry archer, 37 doppelganger, 38 bird,
39 slinger.

### 4.2 Combat

Attacks and armours are lists of `(class, amount)`. Class 4 is melee and class 3 is pierce; the others are bonus
classes. Damage of one hit is the sum, over every class that appears in both the attacker's attack list and the
target's armour list, of `attack − armour`, never below 1. A negative armour entry is a weakness: an attack that
carries that class (even with amount 0) deals the difference. For example, a unit whose armour list has
`class 9: −5` takes 5 extra damage from any attacker whose attack list has class 9. That is how the original
expresses "cavalry is strong against infantry" or "siege is strong against buildings". Effects change attack and
armour with the value `class × 256 + amount` (so `1026` = melee +2, `769` = pierce +1).

Ranged attacks fire the unit's projectile unit, which flies at its own speed along an arc; with "smart
projectiles" (Ballistics) it aims where a moving target will be. `accuracy %` is the chance to hit the target;
a miss lands nearby. Blast width spreads damage around the target (catapults, elephants trample). Reload time is
the time between attacks; frame delay is when the hit lands within the attack animation. Higher ground gives
the attacker a chance of extra damage.

### 4.3 Economy

- Every civilization starts with the same stockpile (civ resources 0-3) and a few villagers.
- A villager becomes a different unit for each job (forager, hunter, farmer, fisherman, woodcutter, gold miner,
  stone miner, builder, repairer). Each job unit has its own **work rate** (resource per second while working)
  and **carry** (resource capacity). Techs change these per job: for example the wood tech adds carry and work
  rate to the woodcutter only.
- Resource objects hold an amount (resource storage 0); corpses also lose food at their decay rate.
- Drop sites: the Town Center takes everything; Granary takes plant food; Storage Pit takes meat, wood, stone
  and gold; the Dock takes fish.
- Farms are buildings with a food store; techs add food to every new farm (a resource, "farm food amount").
- Population: houses and the Town Center provide population headroom (resource storage type 4).
- Trade: trade boats carry goods between docks; the gold depends on the distance.

### 4.4 Production and building

Units and techs cost resources (paid when queued) and take their train/research time at their location.
Buildings take their build time (the creatable block's train time) with one builder.

### 4.5 Effects

Techs, ages and civilizations change the game through effect commands `(type, a, b, c, d)`:

| Type | Meaning | Fields |
| --- | --- | --- |
| 0 | set attribute | a = unit (or −1), b = class (or −1), c = attribute, d = value |
| 1 | change resource | a = resource, b = 0 set / 1 add, d = amount |
| 2 | enable / disable unit | a = unit, b = 1 enable / 0 disable |
| 3 | upgrade unit | a = from, b = to (existing units change too) |
| 4 | add to attribute | as type 0 |
| 5 | multiply attribute | as type 0 |
| 6 | multiply resource | a = resource, d = factor |
| 102 | disable tech | d = tech (used in civ tech trees) |

Attributes: 0 hit points, 1 line of sight, 2 garrison capacity, 3/4 size, 5 speed, 6 rotation speed, 8 armour,
9 attack, 10 reload time, 11 accuracy, 12 max range, 13 work rate, 14 carry, 15 base armour, 16 projectile, 17
graphics angle (which look of a building, §5.3), 18 terrain defence, 19 smart projectiles, 20 min range, 21 first
resource storage, 22 blast width, 23 search radius, 100 cost (multiply = discount).

Resources include 0 food, 1 wood, 2 stone, 3 gold, 4 population headroom, 6 current age, 21 technology count
(score only), 27/28 priest/building conversion enabled, 32 population cap, 34/35 faith and its recharge,
36 farm food amount, 46 tribute inefficiency, 47 gold mining productivity, 50 reveal ally. The full list with
names is in `web/scripts/aoe/names.ts`.

### 4.6 Technologies, ages and civilizations

- A tech requires up to 4 other techs and a count of how many of them are needed (an age needs "2 of these
  buildings": each building triggers a hidden tech when built).
- **Ages** are techs at the Town Center. Their effects raise the age resource, upgrade buildings to their later
  look (§5.3), and upgrade the villager.
- Some techs only unlock units (Chariot, Cavalry, ...); others upgrade a unit line (Short Sword: Axeman →
  Short Swordsman), which also upgrades the units already on the map.
- **Civilizations**: each has a "tech tree" effect. It holds the civ's bonuses as ordinary effect commands (for
  example faster gold mining, cheaper buildings, more hit points for a class) and a list of type 102 commands that
  disable the techs the civ cannot research. A unit is unavailable when the tech that enables or upgrades to it
  is disabled.

---

## 5. Graphics

### 5.1 Graphics records and animations

A unit points to graphics for standing, walking, attacking, dying, decaying and, through its tasks, working
and carrying. A graphic has a frame count, an angle count, a frame duration (seconds per frame) and a
mirroring mode. Its SLP stores the frames angle by angle.

### 5.2 Directions

Units have 8 angles but store 5 (south, south-west, west, north-west, north); the other 3 are drawn mirrored.
The importer writes one sheet row per stored direction, which is Bronze Dawn's `directions: 5` layout.

### 5.3 Buildings by age and architecture

- A graphic can have **deltas**: other graphics drawn with an offset (building parts, smoke, fire, flags). A
  building picture is the sum of its deltas.
- The **angles** of a building graphic are not directions but looks. Attribute 17 (graphics angle), set by the
  age effects, picks the look.
- The age effects also **upgrade** buildings to their later units (for example Barracks1 → Barracks2 in the
  Bronze Age), and every civilization points those later units at its architecture's pictures. Stone- and
  Tool-age buildings are shared; from the Bronze Age the 5 architectures (Egyptian, Greek, Babylonian, Asian,
  Roman) differ.
- The importer replays the four age effects for each building to find its unit and angle in each age, and
  writes one picture per architecture and per age where the picture changes.

### 5.4 Player colour and shadows

Player-colour pixels become shades of magenta in the imported PNGs, which Bronze Dawn repaints with each
player's colour. Shadow pixels become translucent black.

---

## 6. The computer player (AI)

Found by analysing `Empires.exe` with REA and Ghidra (strings, cross-references and decompiled structure),
and from the script files shipped with the game. This describes how the AI is organised, not its code.

### 6.1 Modules

The AI is a set of cooperating modules, each with its own name in the debug log:

| Module | Role |
| --- | --- |
| Main decision | Coordinates the others. |
| Strategy | Holds the build list and picks the best one for the situation. |
| Build | Works through the build list in order and tracks progress. |
| Resource | Splits villagers between gathering, building and exploring. |
| Tactical | Turns plans into orders for every unit (below). |
| Trade | Markets and trade boats. |
| Diplomacy | Allies and enemies. |
| Emotional | A per-player attitude (likely how hostile it feels towards each player). |

### 6.2 The tactical update

The tactical module never does everything in one game tick. Each tick it runs one step of a fixed cycle of 22
steps and moves on, so the cost is spread over time. The cycle, in order: set up soldier groups, evaluate
civilian distribution, task civilians, set up boat groups, fill boat groups, task boats, fill soldier groups,
task idle soldiers, task active soldiers, run attack plays, task ungrouped soldiers, research, train, change the
build list, help build, repair buildings, repair walls, build, check open builds, check open tasks, food drop
sites, insert into the build list.

### 6.3 Groups

Soldiers and boats act in **groups** of up to 40 units. A group has a commander, a target unit and target
position, a retreat position, a list of waypoints, and optionally an attack **play** (a scripted manoeuvre).
Every time a group is tasked it first drops units that died, skips units busy with another action (unless
forced), then gives orders by role:

| Group task | Behaviour |
| --- | --- |
| Idle / gather | Clean up the member list and add up the group's hit points. |
| Attack | With a play, hand the group to the play system. Without one, every member attacks the target; the commander, and members with no way to reach the target, move to the target position instead. |
| Attack-move | Move to the position, fighting on the way. |
| Attack roundup | Converge on a target; re-check at most every few seconds so orders do not thrash. |
| Retreat | Move members back to the retreat position, filtered by their hit points. |
| Defend | Guard a unit or position; the guard radius depends on what is guarded. |
| Explore | The commander explores; each other member randomly either escorts the commander or explores on its own. |
| Guard area | Keep only members in the same map zone as the commander; the rest leave the group. |
| Fish / trade (boats) | The commander fishes or trades; the other boats follow it. |
| Capture | Civilian groups "capture" a target through a defend order. |

### 6.4 Scripts that drive the AI

Shipped as text files in `data/`, loaded when a game starts (each is copied to a temporary file first):

- **Build lists (`.ai`)**: the order in which to build, train, research and advance. One line per item: a
  letter code (B build, U unit, T train, R research, C age), the item's id and name, how many, and which building
  makes it. Random-map games pick a build list at random.
- **Personalities (`.per`)**: "strategic numbers", one `index value` pair per line, each tuning a behaviour
  (share of villagers on each job, how many explorers, how aggressive the attacks are, ...).
- **City plans (`.cty`)**: building positions relative to the Town Center. Without one the AI places buildings
  by "influence" (scoring spots around its base).
- **Learning (`learn/*.uh`)**: what the AI remembers between games.

The game also writes a detailed AI log when enabled (`AILog\<name>.log`), with lines such as the build-list
progress and every group order.

---

## 7. How the importer maps the original onto Bronze Dawn

`web/scripts/aoe/convert.ts` starts from `data/rules.json` and overwrites its numbers. Mapping tables at the top
of the file give, for every Bronze Dawn unit, building, tech, civ, resource node and animal, the original's id.

- **Units**: cost, train time, HP, LOS, speed, reload, range, min range, blast width (as `area` or `trample`),
  melee or pierce attack, melee and pierce armour, boats' gather rate, transports' capacity. Bonus attack classes
  stay as Bronze Dawn's `bonus` (listed in `rules-notes.md`).
- **Buildings**: cost, build time, HP, LOS, population, towers' attack, range and reload, armour, farm food.
- **Economy**: starting resources, carry, gather rate per resource and, new, per food source
  (`economy.gather_kind_rates`: forage, hunt, farm, fish). `gather_speed` and `build_speed` are set to 1 because
  the original's rates are already real-time.
- **Resource nodes and animals**: amounts, HP, attack, armour, speed, LOS, food, corpse decay.
- **Ages and techs**: cost and time. Tech effects are converted when every command maps to a Bronze Dawn effect
  (stat changes on the units and buildings the original targets, gather rate and carry per job, farm food, unit
  upgrades); otherwise Bronze Dawn's own effects stay and the original's are listed under `notes` on the tech.
- **Civs**: bonuses converted the same way (`notes` for the rest); the tech tree becomes `disabled` (techs and
  the units they unlock or upgrade to). Lac Viet is Bronze Dawn's own civ and keeps its rules.

## 8. Known gaps

- Bronze Dawn's damage model has one melee and one pierce value plus a bonus table, not the original's open list
  of classes; the extra classes are in `rules-notes.md`.
- Additive gather-rate techs become multipliers on the base rate (exact for one tech, slightly different when
  several stack).
- `data/rules.json` is the importer's output (2026-10-12), with three engine-specific readings: a blow of a class
  other than melee or pierce is the attack when the unit has no other (catapult ships 35, lion 2); a Farm holds
  the player's "farm food amount" (resource 36, 250); meat rots at the living animal's decay (gazelle 0.3,
  elephant 0.2, lion 1 a second), not the carcass unit's 1. Unit upgrades keep Bronze Dawn's chain (War Galley →
  Trireme) where the original names the line's first unit (Scout Ship → Trireme): that is what makes the ships on
  the water change in Bronze Dawn.
- Still not carried over (rules-notes.md): Artisanship's +1 line of sight for all, Alchemy's +1 for catapult ships,
  Coinage's gold productivity, Architecture's builder work rate, Logistics' population cost, Jihad's carry −8,
  Astrology's priest work rate; Monotheism, Medicine and Martyrdom keep Bronze Dawn's own effects.
- The loader has no death or corpse animation; the sheets include a `die` row for when it does.
- Projectiles, walls, fire and rubble are still drawn by code; music is MIDI and is not imported.
- Tech icons are not imported (unit and building icons are).
