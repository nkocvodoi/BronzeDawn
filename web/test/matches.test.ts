// Whole matches of AI against AI: the slowest tests, kept apart so CI runs them beside the others.
import { describe, expect, it } from "vitest";
import { RULES } from "../src/core/data";
import { runMatch } from "../src/core/sim";

describe("matches", () => {
  it("ends headless matches with the stronger AI winning nearly all of them", () => {
    // One map can favour the weaker side (its civilization, where the woods fall), so this asks for
    // most, not every one: about 9 in 10 are won. Twelve maps, as six were too few to tell a weaker AI
    // from a change of maps (the gazelle herds moved every map's random numbers: 11 and 10 of 12 won).
    const losses: string[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const r = runMatch(RULES, seed, 75, ["hard", "easy"]);
      if (r.winner !== 0) losses.push(`seed ${seed}:\n${r.lines.join("\n")}`);
      expect(r.problems).toEqual([]);
    }
    expect(losses.length, losses.join("\n\n")).toBeLessThanOrEqual(2);
    // Twelve full matches: about eight minutes here, more on a slower CI machine.
  }, 1_200_000);
});
