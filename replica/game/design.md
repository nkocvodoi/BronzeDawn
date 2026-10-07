# Game design: Bronze Dawn

Working title only. Run `/replica-brand` for the real name before release.

## 1. Scope

- **Inspired by:** classic Stone Age to Tool Age real-time strategy (Age of Empires, 1997). Mechanics only, see section 9.
- **Platform:** macOS 13+, Apple silicon and Intel (universal binary). Swift + SpriteKit, nothing to install beyond Xcode.
- **Slice:** one skirmish mode, you against one AI on a seeded 72x72 map, 2 ages, 4 resources, 5 units, 9 buildings.
- **Out of scope for now:** Bronze and Iron ages, technologies, civilizations, campaign, multiplayer, editor, audio.

## 2. Sources

The genre's public conventions, plus the game's own manual and gameplay the user plays themselves. No files, art or numbers from the original.

## 3. Systems inventory

| ID | system | what the player does | rules | edge cases handled |
| --- | --- | --- | --- | --- |
| G01 | map | explores | grass, dirt, sand, water; seeded lakes, forests, mines; bases always connected | a carved path when forests or lakes wall off a base |
| G02 | camera | scrolls, zooms | arrows, trackpad, pinch, edge scroll in full screen, minimap click | clamped to the map |
| G03 | selection | clicks, drags | own units in a box; shift adds; double click selects the type on screen | dead entities drop out of the selection |
| G04 | commands | right clicks | attack enemy, gather resource, build or farm own, drop off, else move; attack-move | water target walks to the shore |
| G05 | pathfinding | | A* on tiles, 8 directions, no corner cutting, line-of-sight smoothing | unreachable goal goes to the closest tile; repath when a building appears |
| G06 | gathering | sends villagers | carry 10, rates per resource, nearest drop-off | node runs out: next node of the same kind within 10 tiles |
| G07 | construction | places buildings | cost paid on placement, builders add progress | units under a new footprint are nudged out |
| G08 | production | trains units | queue of 5, cost paid on queue, cancel refunds, rally point | housing full pauses the queue with a message |
| G09 | combat | fights | damage = attack - armor (pierce for ranged), min 1, + class bonus; arrows fly | soldiers turn on attackers when hitting a building |
| G10 | ages | advances | Tool Age: 500 food, 60 s, 2 different Stone Age buildings (not houses or the town center) | the town center cannot train while advancing |
| G11 | fog | | visible and explored per player, soft edges | enemy buildings stay drawn once seen |
| G12 | AI | plays against you | same rules and commands as the player; easy, normal, hard | it knows where your base is, not what is in it |
| G13 | win | | a player with no units and no building that trains is defeated | |
| G14 | HUD | reads, clicks | resources, pop, age, clock, info panel, command grid with hotkeys, tooltips, minimap, messages | |

## 4. The loops

**Core loop:** gather -> build -> train -> advance -> fight.

| time | a good player | the AI (normal) |
| --- | --- | --- |
| 0 to 3 min | villagers nonstop, houses, berries and wood | same, storage pit and granary by 5 villagers |
| 3 to 10 min | barracks, farms, save 500 food, advance | advances at about 9 to 12 min |
| 10 min on | ranges, stable, towers, counter the enemy army | trains counters to what it sees, attacks from 11 min |

## 5. Entities

Every number is in `data/rules.json`.

- **Resources:** food (berries, farms), wood (trees), gold (mines, axemen), stone (mines, towers).
- **Units:** villager (works), clubman (cheap early infantry, beats cavalry), axeman (Tool Age infantry, +4 vs cavalry), bowman (beats infantry), scout (fast, +5 vs archers).
- **Buildings:** town center, house (+4 pop), granary, storage pit, barracks, farm (250 food), archery range, stable, watch tower.
- **Infantry** deal +2/+3 to buildings: they are the siege role.

## 6. Balance

```
Rules: 0 errors, 0 warnings

Matchups at equal spend (row vs column, >1.1 wins, <0.91 loses)
         clubman  axeman  bowman   scout
clubman        -    0.94    0.75    2.67
axeman      1.06       -    0.79    5.10
bowman      1.34    1.26       -    0.80
scout       0.38    0.20    1.24       -

Counters
  clubman  countered by bowman
  axeman   countered by bowman
  bowman   countered by scout
  scout    countered by axeman, clubman

Ranged units are scored without kiting, so their real numbers are higher.
```

The AI picks units with the same equal-spend formula, so it counters what it sees.

## 7. Controls

See the README.

## 8. Architecture

`DawnCore` (no SpriteKit): rules, grid, pathfinder, world step at 20 Hz, fog, AI, map generator, headless simulation.
`BronzeDawn`: SpriteKit scene, procedural art, HUD, input. Rendering interpolates between steps.

## 9. Clean-room notes

Taken: genre mechanics (gather, ages, counters, fog). Made fresh: every name, number, sprite (drawn in code), word and line of code. No third-party assets.

## 10. Build order

| milestone | systems | headless test | done |
| --- | --- | --- | --- |
| M1 | G01 G02 G05 | testPathGoesAroundAWall | yes |
| M2 | G03 G04 | | yes |
| M3 | G06 | testGatherLoopDepositsAtTheTownCenter | yes |
| M4 | G07 G08 | testTrainingSpendsAndSpawns, testHousingBlocksTraining | yes |
| M5 | G09 | testFightToTheDeath | yes |
| M6 | G11 | | yes |
| M7 | G12 G13 | testHeadlessMatchEnds | yes |
| M8 | G10 | testAgeUpNeedsTwoBuildingsAndFood | yes |
| M9 | G14 | | yes |
| M10 | Bronze Age, techs, audio | | next |
