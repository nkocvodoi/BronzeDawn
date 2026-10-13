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

Unit ids become Bronze Dawn ids through the table in `rms-data.ts` (109 → town_center, 66 → gold_mine, 59 →
berry_bush, 65 → gazelle, and so on). Entries Bronze Dawn has no unit for (95, 96, 303) are dropped.

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
- **Team order.** Unless positions are fixed, teammates are put on neighbouring origins [obs].
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
  - an A* path between land centres;
  - water tiles on the path become shallows (terrain 4);
  - plus 2 extra paths [obs].
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

  Each cliff is drawn as a line of temporary terrain 16 [obs]. Bronze Dawn draws a straight line between the walk's
  points; the original's exact sample points and piece shapes are a **[gap]** (§8).

## 5. Terrain patches and beaches

- Each `terrains` entry places `clumps` patches, using `proportion`% of the tiles:
  - only on its `on` terrain;
  - `edgeSpacing` away from other terrain;
  - grown by priority like the lands, with `clumpiness`.

  A forest becomes trees in the objects module (one tree per forest tile, before any other object) [obs].
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
- Every object creation calls `rand()` and then `srand()` with the result. That is why one changed object shifts
  everything after it [obs].
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
  animals (gazelle herds by group).
- **Additions.** The ruins and artifacts (Bronze Dawn's own, `relics()` in `mapgen.ts`) and the free-roaming animals
  are added after.

Map choices, by Bronze Dawn id: `small_islands` 0, `large_islands` 1, `coastal` 2, `inland` 3, `highland` 4,
`continental` 5, `mediterranean` 6, `hill_country` 7, `narrows` 8. Maps from an art pack still go through
`generateFromSpec`.

The AI had to learn the original's distances: berries out to 23 tiles, and gazelle herds beyond its own are 26 or
more tiles away (`ai.ts`).

## 8. What is not bit-exact

Bronze Dawn follows the same algorithm with the same numbers, but a given seed **does not** give the same map as the
original, for these reasons:
- **Cliffs.** The cliff-piece state machine and the exact points sampled along the walk come from x87 code that
  Ghidra garbles. A straight line is used [gap].
- **Terrain units.** A terrain whose dat record lists auto-placed units calls `rand()` when it is set. Which terrains
  do this was not checked [gap].
- **Facing.** A random facing for each new object, which depends on graphic flags in the dat [gap].
- **Rounding.** x87 rounding at exact integer edges is assumed to be 53-bit [inf].

Each of these shifts the random sequence from that point on, so everything after it differs in detail. The rules
(sizes, distances, counts, spacing) do not change.

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
| Cliffs | 46e0c0 (pieces 4f0490 / 4f0130 / 4f0300) |
| Terrain patches, beaches | 4742b0 / 4748d0, 474380 |
| Objects | 4719a0 (candidates 471af0, loose 4725b0, tight 472780) |
| `rand` / `srand` | 528420 / 528410 |

## 10. Checked against saved games from the original

A game saved at the very start (Single Player, Random Map) holds the whole map: `web/scripts/aoe/gmx.ts` reads a
Rise of Rome `.gmx` (one raw deflate stream: the size at 106, 9-byte tiles with terrain and elevation first, then
object records of type, owner, unit id and position). Two tools use it:

```
cd web
# the original's maps of one kind beside Bronze Dawn's of the same size and players
npx tsx scripts/aoe/compare-maps.ts coastal assets-local/saves/Coastal-1.gmx assets-local/saves/Coastal-2.gmx
# the seed the original used, and how much of our map from that seed is the same, tile for tile
npx tsx scripts/aoe/find-seed.ts coastal assets-local/saves/Coastal-1.gmx
```

The saves (Large, 144 × 144, 4 or 5 players, two of each of the nine kinds) are kept with the rest of the
original's data in the private `BronzeDawn-aoe-data` repo, under `saves/`, so both run on a machine without the game.

### What they show (2026-10-13)

Two of the original's maps of each kind against 12 of ours (`compare-maps.ts`): water, the map's edges, whether the
bases meet by land, beach, desert, forest, palms, hills, gold, stone, berries, gazelles, elephants, lions and fish,
on the map and round each Town Center, are all within the original's range on all nine. What is not:

- **Alligators.** The original has 5 to 12 on every map but Highland and Continental, ours 0 to 5.5, though our
  count per group follows the code (§6). Hill Country has 5 with neither beach nor shallows, the host terrains the
  data gives them, so they come from somewhere other than the map's object list [gap]. The terrains' own unit
  lists in the dat (grass tufts, rocks, trees) hold none.
- **Hill Country's forests** lie further from the Town Centers in the original (19 forest tiles 12 to 20 tiles out,
  against our 89; both its saves agree). Its elevation is also where our maps from the original's seed part most
  (below) [open].

Two things these saves turned up and that are now as the original does them:
- **The maps by their place in the file** (§1): taken by the id each record carries, Inland had no water, Hill
  Country a sea, the Mediterranean 39% water instead of about 21%.
- **What may stand where.** A thing goes only on the ground its terrain restriction in the dat allows (`standOn`
  in `data/aoe-maps.json`, from `terrainRestrictions`): mines and berries on grass or desert, animals and Town
  Centers not on beaches, the alligator and villagers on beaches and shallows too. Without it, on the small
  islands, our mines and herds stood on the beach rim, the far edge from the Town Center (Large Islands' stone
  within 20 tiles: 5, the original's 7.5, now 7.2).

### The original's seeds, and how far ours follows them

The original seeds the generator with a `rand()`, so 0 to 32767. The land origins come before anything Bronze Dawn
does not do bit for bit, so trying every seed until the Town Centers stand where the save has them finds it
(`find-seed.ts`). It found one, and only one, for each of the 18 saves. Bronze Dawn's map from that seed, tile for
tile:

| Save | Seed | land / water | elevation | forest | desert | every tile | gold on the same tile |
|---|---|---|---|---|---|---|---|
| Small Islands 1, 2 | 6730, 19828 | 96.7, 100 | 94.1, 94.9 | 95.3, 95.8 | 91.6, 92.0 | 59.4, 70.6 | 0, 0 |
| Large Islands 1, 2 | 26850, 31865 | 100, 96.1 | 92.3, 91.8 | 89.7, 91.0 | 86.4, 84.4 | 78.1, 65.9 | 0, 0 |
| Coastal 1, 2 | 16643, 29455 | 69.3, 95.7 | 85.4, 91.9 | 85.7, 85.7 | 81.7, 81.2 | 35.2, 59.7 | 1, 0 |
| Inland 1, 2 | 8491, 18036 | 88.5, 80.9 | 83.9, 81.8 | 79.5, 80.2 | 73.8, 76.8 | 43.0, 36.3 | 3, 0 |
| Highland 1, 2 | 28666, 26769 | 100, 96.4 | 95.3, 82.1 | 96.8, 79.6 | 95.4, 62.0 | 94.1, 41.2 | 0, 5 |
| Continental 1, 2 | 19238, 23745 | 96.7, 98.6 | 93.3, 93.1 | 91.3, 90.4 | 88.7, 87.6 | 66.3, 64.0 | 0, 11 |
| Mediterranean 1, 2 | 12914, 16572 | 83.3, 99.4 | 84.2, 84.0 | 76.6, 74.6 | 74.4, 73.4 | 36.2, 52.4 | 1, 0 |
| Hill Country 1, 2 | 28418, 23981 | 100, 100 | 28.1, 67.2 | 83.3, 81.0 | 69.7, 73.5 | 54.7, 57.6 | 0, 0 |
| Narrows 1, 2 | 23362, 8281 | 99.6, 100 | 89.5, 92.7 | 91.9, 90.5 | 87.6, 87.5 | 81.0, 78.9 | 4, 2 |

(shares in %, gold as mines). Read from the left: the lands are often the original's to the tile (100% on six of
the saves); where they are not, something in the lands' growth or shallows still draws its numbers differently.
Hills part next, most on Hill Country. The gold mines almost never stand on the same tile: by the objects the
random numbers have parted, as §8 expects (the cliffs, the terrains' own units, the facings). The "dry" ground is
not one of the differences: on the five saves that have it, ours from the same seed has it too, palms to within a
few tiles (Highland 1: 1891 against 1891). With the seeds known, each step can now be checked against the
original's map until it is the same.
