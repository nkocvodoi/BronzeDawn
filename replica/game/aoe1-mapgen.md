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
object records of type, owner, unit id and position), and `web/scripts/aoe/compare-maps.ts` sets one beside Bronze
Dawn's maps of the same kind, size and players:

```
cd web
npx tsx scripts/aoe/compare-maps.ts assets-local/saves/Coastal-1.gmx coastal
```

The saves used here (Large, 144 × 144, 4 or 5 players) are kept with the rest of the original's data in the private
`BronzeDawn-aoe-data` repo, under `saves/`, so the check runs on a machine without the game.

What they showed (2026-10-13), Bronze Dawn as the mean of 8 maps:

| | Coastal | Inland | Mediterranean | Hill Country | Small Islands |
|---|---|---|---|---|---|
| water %, original / ours | 36.9 / 36.3 | 16.0 / 18.1 | 21.2 / 23.3 | 0 / 0 | 68.3 / 68.8 |
| map edge that is water % | 84.5 / 87.6 | 47.8 / 74.7 | 0 / 4.4 | 0 / 0 | 89.0 / 90.2 |
| bases joined by land | yes / yes | yes / yes | yes / yes | yes / yes | no / no |
| gold, stone within 20 tiles of a TC | 8, 7 / 8, 7.1 | 6, 7 / 8.1, 7 | 8, 7.2 / 8, 7.2 | 8, 7 / 8, 7.1 | 9, 9.5 / 9.5, 7.4 |
| berries within 17 | 4.8 / 5.8 | 6.3 / 6.3 | 5.8 / 5.5 | 6 / 6.1 | 6 / 6.2 |

With the maps taken by id instead (§1), Inland had no water at all, Hill Country a sea, the Mediterranean 39% water
and water along every edge: those numbers were wrong, not the generator.

- **Forests and deserts.** Inland's and Hill Country's saves both fell on the one map in four with the "dry" ground
  (twice the desert, three times the palms, half the forests: `terrainInit`, `rand() < 0x1fff`), so their forest and
  desert shares match our dry maps, not our mean. Forest near the Town Centers swings a lot between maps; more saves
  would tell whether ours is a little nearer [open].
- **Alligators.** The original has about twice as many (9 to 12 on these maps against our 4 to 6), and 5 on Hill
  Country, which has neither beach nor shallows, their host terrains in the data. Where those come from was not found
  [gap]. The terrains' own unit lists in the dat (grass tufts, rocks, trees on forest and palm ground) hold none.
- Not yet checked against a save: Large Islands, Highland, Continental, Narrows.
