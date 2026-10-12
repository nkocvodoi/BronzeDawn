// A random map described by its numbers: how much land, how it is shared out, what ground and what
// things go where. Bronze Dawn's own format; mapgen.ts's generateFromSpec builds a map from one. A player's
// art pack can carry some ("maps" in its manifest.json), and the start screen offers them.

/** Where an object may stand. */
export type Host = "land" | "beach" | "water" | "shallows" | "deep";

export interface RandomMapSpec {
  name: string;
  /** What the map is before the lands grow: sea, or land everywhere. */
  base: "water" | "land";
  /** How much of the map the lands cover, 0 to 100. */
  land: number;
  /** Margins left as the base at each edge, as a share of the map's size (0 to 100): SW, NW, NE, SE. */
  border: [number, number, number, number];
  /** Every player on a land of their own kept `spacing` tiles from the others ("apart"), on their own
   *  land that may grow into the others' ("joined"), or all on one land ("shared"). */
  lands: "apart" | "joined" | "shared";
  spacing: number;
  /** The ground kept clear round each start, in tiles. */
  startRadius: number;
  /** Patches of other ground, each a share of the ground they grow on, in a number of clumps. */
  patches: { kind: "sand" | "woods" | "palms"; share: number; clumps: number; on: "grass" | "sand"; spacing: number }[];
  /** Things to place: near every player (between minDist and maxDist from their start), or across the
   *  map (at least minDist from every start when `away`). `count` in a group, give or take `spread`;
   *  `groups` of them, scaled with the map's size when `scale`. */
  objects: {
    kind: string; on: Host; layout: "single" | "loose" | "tight"; count: number; spread: number;
    groups: number; area: number; perPlayer: boolean; away: boolean; minDist: number; maxDist: number; scale: boolean;
  }[];
  /** A sea along one side, for a coast: Bronze Dawn's reading of a land map that is meant to have one. */
  coast?: boolean;
  /** Hills and cliffs per Small map, and whether the hills are broad and high. */
  relief?: [number, number, boolean];
}

/** A spec from someone else's file, checked enough that the generator cannot be thrown by it. */
export function isMapSpec(x: unknown): x is RandomMapSpec {
  const s = x as RandomMapSpec;
  return !!s && typeof s === "object" && typeof s.name === "string" && (s.base === "water" || s.base === "land")
    && typeof s.land === "number" && Array.isArray(s.border) && s.border.length === 4 && Array.isArray(s.patches) && Array.isArray(s.objects);
}
