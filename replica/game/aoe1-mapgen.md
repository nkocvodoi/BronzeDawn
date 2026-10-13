# Age of Empires random maps: how the original builds them, and how Bronze Dawn does it

Bronze Dawn's nine random maps (`web/src/core/aoemap.ts`) follow the generator in Rise of Rome's
`Empiresx.exe`. The algorithm was read from the binary with Ghidra, plus the raw x87 disassembly, which Ghidra garbles.
The numbers for each map come from the `randomMaps` block of `empires.dat`. This document describes that behaviour in
our own words. It contains no code from the game.

Tags: **[obs]** read in the code; **[inf]** inferred; **[gap]** not determined (Bronze Dawn picks something close).

Contents:
1. The numbers: where they come from and how to rebuild them
2. Seed, sizes, run order
3. Lands
4. Shallows, hills, cliffs
5. Terrain patches and beaches
6. Objects: who gets what, how far away
7. How Bronze Dawn uses the result
8. What is not bit-exact, and why
9. Where it lives in the binary
10. Checked against saved games from the original

---

## 1. The numbers

`data/aoe-maps.json` holds the nine Rise of Rome maps: the first nine records of `randomMaps`, **in file order**. The
generator takes a map by its place in the file: the map type (0 Small Islands, 1 Large Islands, 2 Coastal, 3 Inland,
4 Highland, 5 Continental, 6 Mediterranean, 7 Hill Country, 8 Narrows, the order of strings 10602..10610 in
`language.dll`) indexes the table it loaded record by record, and the same number picks the type's own rules
(6 the central sea, 7 the fivefold hills) [obs]. Each record also carries an id, which is **not** the type: the
Mediterranean is the 7th record, whose id says 2. Taking the records by that id (as Bronze Dawn first did) gave
eight of the nine maps another map's numbers; saved games from the original settled it (§10). The file is made
from the converter's dump of `empires.dat`:

```
cd web
npx tsx scripts/aoe/rms-data.ts assets-local/aoe-data/empires-ror.json ../data/aoe-maps.json
```

Each map has:
- `borders` (4 numbers), `borderUsage` and `margin`. genieutils calls the margin "water shape", but the code uses it as
  the distance a land origin keeps from the map's edge.
- `baseTerrain` and `landCoverage`.
- `lands`: terrain, spacing, base size, zone, placement, base position, proportion, by-player flag, start radius, edge
  fade and clumpiness.
- `terrains`: patches.
- `objects`: unit, host terrain, single/loose/tight, scale flag, per group, fluctuation, groups, area, owner, land
  selector, and min/max distance.

Beside the maps, from the rest of `empires.dat`:
- `terrainUnits`: each terrain's own things, [unit, density in thousandths, centred], as the generator puts them on a
  tile it sets (rocks in the water, tufts on the grass, the trees of a forest).
- `units`: what the generator asks of each thing it puts down: footprint and clearance, the terrains it may stand on
  (its terrain restriction), the terrain it must be on or beside, hill mode, whether it can be built over, and what
  making it draws (§6).

Unit ids become Bronze Dawn ids through the table in `rms-data.ts` (109 → town_center, 66 → gold_mine, 59 →
berry_bush, 65 → gazelle, and so on). Entries Bronze Dawn has no unit for (95, 96, 303: pigeons) are still placed,
as "-", so that the generator draws its numbers for them; Bronze Dawn makes nothing of them.

The dat's elevation block is **not used**: the executable hard-codes the hills (§4) [obs].

## 2. Seed, sizes, run order

- The random generator is MSVC's: `state = state*0x343fd + 0x269ec3`, and `rand()` returns `(state>>16) & 0x7fff`.
  `R(n) = trunc(rand()*n/32767)`, which can return `n` itself. Debug-log calls still evaluate their `rand()`
  argument, so they consume numbers [obs].
- Sizes [obs]: Tiny 72, Small 96, Medium 120, Large 144, Huge 200, Gigantic 250. The map is always square.
- `srand(seed)`, then INIT: land setup, terrain setup, object setup (islands, the Mediterranean lake), elevation
  setup, and one `rand` that decides cliffs (they exist when it is > 0x1fff, so 3 maps in 4).
- `srand(seed)` **again**, then RUN: the modules in rising priority, with one `rand` after each:
  land 1.0 → shallows 1.1 → elevation 1.5 → cliffs 1.75 → terrain 2.0 (beaches at its end) → objects 3.0.
  Finally, the temporary terrain 16 (cliff lines) goes back to grass [obs].

## 3. Lands

- **Slots.** One land per player when `byPlayer` is set, plus the fixed lands. Land tiles = `landCoverage`% of the map
  × the land's share [obs].
- **Origins.** Each origin is placed at random but stays `margin` tiles from the edge and the land spacing away from the
  other origins. The binary has two quirks, both kept:
  - when a try fails, it overwrites the previous origin rather than retrying cleanly;
  - with a margin as large as Large Islands' 30, the lands overlap on Tiny maps.

  Bronze Dawn caps the tries at 100 000, where the original can loop forever [obs; cap is ours].
- **Team order.** Allies are put on neighbouring origins: each origin's list of the others, nearest first, and each
  team in turn takes the free origins nearest the first free one; with no allies nothing moves. No random number
  [obs]. `AoeMapGen` takes World's teams (allies share a number above 0).
- **Growth.** Every land starts as a square of its base size and grows one tile per turn, round-robin, from a priority
  list (lowest first; a new entry goes in front of equal ones).
  - Before a tile is taken, a border check: `roll100 < (distance past the border) × borderUsage` turns it into a
    no-man's tile.
  - It is taken only if no other land is within `spacing`.
  - Its free neighbours go in with priority `roll100 − 5×5-own-count × clumpiness + 250`.
  - The binary counts the seed square into `cnt[zone]` rather than `cnt[land]`. That bug is kept, since it changes
    land sizes.
  - Gaps one tile wide are then filled [obs].
- **Cleanup.** Repeated sweeps turn back to base terrain any land tile caught between two base tiles, plus a set of
  diagonal cases [obs].

## 4. Shallows, hills, cliffs

- **Shallows** (Coastal, Inland, Highland, Continental, Mediterranean, Narrows, when the land-setup roll is < 0x3fff,
  about half the time):
  - an A* path between land centres (grass and beach cost 1, shallows 2, water 7, deep water 14). Its costs so far
    are floats: each step's is rounded to a float before the distance still to go is added [obs];
  - walked back from the target: each tile stepped onto (so the start, never the target) adds the water round it,
    a box of random size on water (4 `rand`s), its four sides on land; at the end these become shallows [obs];
  - plus 2 extra paths between random dry tiles [obs].

  Inland gets them too: rivers between the bases, crossed by the shallows.
- **Hills**, hard-coded per map:
  - 4 layers covering 10, 8, 6 and 4% of the land tiles;
  - × a factor 0.7–1.3 (one roll);
  - × 5 on Hill Country.

  Each layer grows like a land. Smoothing then **raises** tiles, never lowers them, until no step is more than one level
  [obs].
- **Cliffs.** In 3 maps out of 4, on a 3×3 grid of map ninths, by random walks:
  - the number and length per map: Large Islands 5 fewer, Coastal 3 fewer, Inland and Highland 2 tiles longer,
    Hill Country 3 more and 4 tiles longer;
  - Small Islands never has any.

  Each cliff is drawn as a line of temporary terrain 16 from its last cell back to its first [obs], and gets a cliff
  piece in every cell it passes (units 264 to 272). Each cell knows which of its four sides the cliff leaves by, and
  how (which side is high); a step from cell to cell gives both cells that side, keeping at most one other, and a
  piece is put down again whenever its sides change. Straight pieces have two pictures, one drawn at random. The
  table of pieces is the map's own, built in its constructor [obs]. Clearing round a drawn cell leaves the cells
  already in the cliff alone [obs]; the walk forgets the cell it was in only when a new cliff starts [inf: the only
  reading the saves allow]. The module exists only when the map has cliffs at all: Small Islands draws the cliff
  roll and nothing else [obs].

## 5. Terrain patches and beaches

- Each `terrains` entry places `clumps` patches, using `proportion`% of the tiles:
  - only on its `on` terrain;
  - `edgeSpacing` away from other terrain;
  - grown by priority like the lands, with `clumpiness`.

  Forests become trees in the objects module (§6).
- A patch may not cut through: each terrain has a terrain it may not border, which `IMPASSABLE` in `aoemap.ts` lists
  [obs].
- **Beaches.** At the end, every land tile 8-adjacent to water becomes beach [obs].

## 6. Objects

Each entry is placed in order:
- `land` selects where: −1 anywhere, −2 away from every land origin, ≥ 0 on that land.
- A per-player entry is repeated for each player's land, between `min` and `max` tiles from its origin. Distances are
  **Chebyshev** (the larger of dx and dy), so "16" reaches about 23 tiles on a diagonal [obs].
- Candidate tiles come in a shuffled list. After each group, the tiles within the group spacing are struck out:
  - 12 for berries, gazelles, gold and stone on players' lands;
  - map width/6 or /8 for the "away from lands" entries [obs].
- `scale` entries: `groups × w × h / 20736` (20736 = 144², Large) [obs].
- **Single** puts one object. **Loose** scatters the group inside `area`. **Tight** grows it tile by tile. Fluctuation
  adds `R(fluctuation)` objects [obs].
- Whether a thing may go somewhere (`canPlace`): its box (clearance, or footprint) on the map; the terrain it must
  be on or have beside it (no corners); every tile of the box on ground its terrain restriction allows; the slope
  (hill mode 1: no steep tile, 2: flat); then no overlap with what stands there, among things of the same kind of
  height. A land's own things pass over what can be built over (the trees of a forest, tufts) [obs].
- A thing on a land must be reachable from its origin: one map of connected ground per terrain restriction, made the
  first time it is asked for [obs].
- Every object creation calls `rand()` and then `srand()` with the result. That is why one changed object shifts
  everything after it [obs]. Making a thing draws more round that, as the saves show (§10) [inf]:
  - one before, if its standing picture has several frames and sequence flag 4 (the frame it starts on);
  - one after, for a facing, if it moves (genie type 30 and up) and its picture has several angles;
  - one more for a unit (type 70: villagers and animals), and one more again for one with a running picture
    (lion, gazelle);
  - a building is made finished: one more `rand` and `srand` [obs].
- What can be built over goes from under a map's thing as it is put down (the tufts, rocks and trees inside its
  footprint) [inf: the saves].
- **First, each tile's own things.** The objects module starts by going over the whole map, row by row: for each of
  the tile's terrain's units, a spot (random, or the tile's middle), a roll against its density, and the thing if
  it fits: the trees of a forest, the tufts and rocks of grass and desert, the rocks along a beach, a ripple on the
  shallows [obs]. The land cleanup does the same for each tile it sets, which on a water map draws three numbers
  per water rock and puts none down, as they need a beach beside them [obs].
- Inland, as an example for each player:
  - TC and 3 villagers;
  - stone at 10–18 and 20–35;
  - gold at 12–18 and 21–35;
  - 7 berries at 7–16;
  - 6 gazelles at 10–24;
  - 15 lone trees (5 entries of 3) at 8–22.

  The map as a whole gets more stone, gold, berries, gazelles, elephants, lions and alligators away from the players
  (gazelles ≥ 26, gold and stone ≥ 40) [dat].

## 7. How Bronze Dawn uses the result

`fillWorld` turns the generated grid into the game's world:
- **Terrain.** Water and deep water become water; shallows become shallows; desert, beach and palm desert become
  sand; everything else becomes grass. Cliff tiles become `Terrain.cliff`. Elevation is copied over.
- **Objects.** TC at the land origin for each player; villagers; resource nodes (fish on deep water become deep fish);
  animals (gazelle herds by group). The trees of the forests come from the terrains' own things (class 15, one per
  forest tile); the rest of those (tufts, rocks, bones, cliff pieces) are decoration Bronze Dawn does not draw.
- **Additions.** The ruins and artifacts (Bronze Dawn's own, `relics()` in `mapgen.ts`) and the free-roaming animals
  are added after.

Map choices, by Bronze Dawn id: `small_islands` 0, `large_islands` 1, `coastal` 2, `inland` 3, `highland` 4,
`continental` 5, `mediterranean` 6, `hill_country` 7, `narrows` 8. Maps from an art pack still go through
`generateFromSpec`.

The AI had to learn the original's distances: berries out to 23 tiles, and gazelle herds beyond its own are 26 or
more tiles away (`ai.ts`). On a Tiny map a hunted gazelle may lead its hunters to the enemy's side: they are put on
other food there, and meat on the enemy's side is left. An AI that sizes up the enemy keeps its army as big as the
enemy's before it saves for the next age.

## 8. What is bit-exact, and what is not

Against the 18 saves of §10, a given seed gives the original's map: every tile's terrain and elevation, the
shallows, the cliff pieces, each terrain's own things and the map's own, on the same spot to the float. What rests on
what Bronze Dawn could not read in the code, and what has not been checked:
- **What making a thing draws.** The draws before and after each creation (§6) come from the saves, not the code:
  where the starting frame, the unit's and the running picture's numbers are drawn was not found [inf]. Things the
  saves have none of (a unit with an animated picture without flag 4, buildings other than the Town Center) follow
  the same rules untested.
- **The cliff walk's memory.** That it forgets the last cell only at a cliff's start is the one reading the saves
  allow; the map function that walks the line for the pieces (4f0c70) is not decompiled [inf].
- **Decorations under things.** That what can be built over goes from under a map's thing is read from the saves
  [inf]; it draws no number either way.
- **Other sizes.** The saves are all Large (144) with 4 or 5 players. Tiny to Gigantic follow the same code: the
  cliff count for maps of 251 tiles or more reads an unset value in the original [obs], which Bronze Dawn takes as
  the 200-tile one.
- **Rounding.** x87 is taken to run at 53 bits; the A* path and the cliffs depend on it and come out right on all 18.

## 9. Where it lives in Empiresx.exe

These addresses are from Empiresx.exe with MD5 52e8ae9f4262b2ccf679f806c86e7c46.

| What | Function |
|---|---|
| Entry (seed, INIT, RUN) | 447330 |
| INIT | 4731a0; land setup 4733c0; terrain 4737d0; objects 473990; elevation 4740a0 |
| RUN, module list | 474200, 46d060 |
| Land origins, team order | 46f300, 46f6e0 |
| Land growth, border, spacing | 471140, 4710a0, 470ef0 |
| Cleanup | 446930 |
| Shallows | 472b50 |
| Elevation, smoothing | 4703c0 / 470960, 446360 |
| Cliffs | 46e0c0 (walk 46e3c0, clearing 46e770); pieces 4f0ab0 / 4f0490 / 4f0300 / 4f0170, their table 4efef0 |
| Setting a tile, its terrain's own things | 449010 → 448600; over the whole map in the objects module 449110 → 4481b0 |
| canPlace, a tile's slope | 443700, 4493a0 |
| Terrain patches, beaches | 4742b0 / 4748d0, 474380 |
| Objects | 4719a0 (candidates 471af0, loose 4725b0, tight 472780) |
| `rand` / `srand` | 528420 / 528410 |

## 10. Checked against saved games from the original

A game saved at the very start (Single Player, Random Map) holds the whole map: `web/scripts/aoe/gmx.ts` reads a
Rise of Rome `.gmx`. It is one raw deflate stream: the size at 106; then a 9-byte record per tile, which starts with
where the tile is drawn (x as a short, (x + y) × 32, which is how the records are found) and has the terrain at +5
and the elevation at +6; then object records of type, owner, unit id and position. Two tools use it:

```
cd web
# the original's maps of one kind beside Bronze Dawn's of the same size and players
npx tsx scripts/aoe/compare-maps.ts coastal assets-local/saves/Coastal-1.gmx assets-local/saves/Coastal-2.gmx
# the seed the original used (and the teams, if it had allies), and how much of our map from it is the same
npx tsx scripts/aoe/find-seed.ts coastal assets-local/saves/Coastal-1.gmx
```

The saves (Large, 144 × 144, 4 or 5 players, two of each of the nine kinds) are kept with the rest of the
original's data in the private `BronzeDawn-aoe-data` repo, under `saves/`, so both run on a machine without the game.

### The original's seeds, and how far ours follows them (2026-10-13)

The original seeds the generator with a `rand()`, so 0 to 32767. Trying every seed until the Town Centers stand on
the land origins finds it: one, and only one, for each save. Three were played with allies (players 3 and 4 on
Coastal 1 and Hill Country 1, two teams on Mediterranean 1), whose origins the team order hands out again; the tool
finds those teams too. Bronze Dawn's map from that seed:

| Save | Seed | tiles alike (land/water, shallows, elevation, forest, desert, every tile) | cliff pieces | terrains' own things | the map's own things | gold |
|---|---|---|---|---|---|---|
| Small Islands 1, 2 | 6730, 19828 | 100 | -, - | 1080/1080, 1065/1069 | 353/354, 340/340 | 80/80, 72/72 |
| Large Islands 1, 2 | 26850, 31865 | 100 | 12/12, 17/17 | 2257/2258, 2138/2139 | 326/326, 331/331 | 72/72, 63/63 |
| Coastal 1, 2 | 16643, 29455 | 100 | -, 21/21 | 2882/2882, 3039/3040 | 351/351, 353/354 | 76/76, 75/75 |
| Inland 1, 2 | 8491, 18036 | 100 | 46/46, - | 3786/3796, 4079/4084 | 305/305, 310/311 | 68/68, 75/75 |
| Highland 1, 2 | 28666, 26769 | 100 | -, 33/33 | 5133/5133, 4511/4511 | 260/260, 302/304 | 76/76, 76/76 |
| Continental 1, 2 | 19238, 23745 | 100 | 15/15, 57/57 | 1920/1923, 1858/1869 | 333/333, 329/329 | 72/72, 72/72 |
| Mediterranean 1, 2 | 12914, 16572 | 100 | 62/62, - | 4510/4512, 4484/4487 | 401/401, 352/352 | 91/91, 76/76 |
| Hill Country 1, 2 | 28418, 23981 | 100 | 75/75, 81/81 | 4034/4039, 4058/4059 | 257/257, 260/260 | 75/75, 74/74 |
| Narrows 1, 2 | 23362, 8281 | 100 | 25/25, 38/38 | 2156/2159, 1828/1829 | 353/354, 346/347 | 75/75, 69/69 |

(things: how many of ours stand on the very spot of one of the save's, to the float; the map's own are the Town
Centers, player 1's villagers, mines, berries, fish and lone trees). What is not on its spot had gone or moved in
the minutes before the save: a fish caught, a decoration under a house the computer built. The rest of the map's
things, the computer players' villagers, the animals and the birds, are on their spots where they had not moved yet
(two in three or more).

### What the saves turned up, in the order the map is made

1. **The save reader** took each tile's terrain from the previous tile's record, and on three saves started six
   records early: the land and water were taken as ours shifted by one tile.
2. **Allies** move the land origins (§3), on the saves played with them.
3. **Inland's rivers** had been left out; with them, Inland's lands are the original's.
4. **The cleanup draws numbers** (§6): each tile it sets runs that terrain's own things.
5. **No cliff module on Small Islands**, so no number drawn after it.
6. **The A* path's floats and the walk back** (§4).
7. **The cliff walk and its pieces** (§4).
8. **canPlace and the zones** (§6), and **what making a thing draws** (§6): with these the Town Centers, the mines and
   all after them stand where the original's do.
9. **The "extra alligators"** were the reader's: stray records with positions like 1e-36. The original has as many
   alligators as Bronze Dawn on every save, none on Hill Country.

Two of the original's maps of each kind against 16 of ours (`compare-maps.ts`) still differ on one row: Hill
Country's forests 12 to 20 tiles from the Town Centers (24 against our 98). Both its saves are "dry" maps (one in
four: half the forest, twice the desert), and our maps from their seeds are theirs to the tile, so this is the two
saves, not the generator.
