import { describe, expect, it } from "vitest";
import { chordOfKey, chordOfMouse, KeyMap, prettyChord } from "../src/game/keymap";

const key = (code: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}, k = "") =>
  ({ code, key: k, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, shiftKey: !!mods.shift, metaKey: !!mods.meta });
const mouse = (button: number, mods: { ctrl?: boolean; shift?: boolean } = {}) =>
  ({ button, ctrlKey: !!mods.ctrl, altKey: false, shiftKey: !!mods.shift, metaKey: false });

/** A localStorage stand-in. */
const memory = () => { const m = new Map<string, string>(); return { m, get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => void m.set(k, v) }; };

describe("chords", () => {
  it("names keys by where they sit, with their modifiers", () => {
    expect(chordOfKey(key("KeyH", {}, "h"))).toBe("H");
    expect(chordOfKey(key("KeyB", { ctrl: true }))).toBe("Ctrl+B");
    expect(chordOfKey(key("Equal", { shift: true }, "+"))).toBe("Shift+=");
    expect(chordOfKey(key("NumpadAdd", {}, "+"))).toBe("=");
    expect(chordOfKey(key("Period", {}, "."))).toBe(".");
    expect(chordOfKey(key("F3"))).toBe("F3");
    expect(chordOfKey(key("ShiftLeft", { shift: true }, "Shift"))).toBeNull();
    expect(chordOfKey(key("KeyC", { meta: true }))).toBeNull(); // Cmd+C stays the browser's
  });
  it("names the middle and side mouse buttons, not the left and right", () => {
    expect(chordOfMouse(mouse(3))).toBe("Mouse4");
    expect(chordOfMouse(mouse(4, { shift: true }))).toBe("Shift+Mouse5");
    expect(chordOfMouse(mouse(1, { ctrl: true }))).toBe("Ctrl+Mouse3");
    expect(chordOfMouse(mouse(0))).toBeNull();
    expect(chordOfMouse(mouse(2))).toBeNull();
    expect(prettyChord("Shift+Mouse4")).toBe("Shift+Mouse back button");
    expect(prettyChord("Shift+=")).toBe("+");
  });
});

describe("KeyMap", () => {
  it("ships the original's shortcuts", () => {
    const k = new KeyMap();
    expect(k.actionFor("H")?.id).toBe("go_town_center");
    expect(k.actionFor("Ctrl+B")?.id).toBe("go_barracks");
    expect(k.actionFor("Shift+=")?.id).toBe("faster");
    // Panel letters and group digits are read by the panel and the groups, never looked up here.
    expect(k.actionFor("S")).toBeUndefined();
    expect(k.actionFor("1")).toBeUndefined();
  });

  it("puts a side button on an order, keeps the panel letter, and remembers it", () => {
    const store = memory();
    const k = new KeyMap(store);
    expect(k.set("cmd_stand_ground", 1, "Mouse4")).toBeUndefined();
    expect(k.actionFor("Mouse4")?.id).toBe("cmd_stand_ground");
    expect(k.set("cmd_stand_ground", 0, "X")).toBeUndefined(); // the panel's letter cannot change
    expect(k.get("cmd_stand_ground")).toEqual(["D", "Mouse4"]);
    const again = new KeyMap(store);
    expect(again.get("cmd_stand_ground")).toEqual(["D", "Mouse4"]);
    expect(again.changed).toBe(true);
  });

  it("moves a chord that another shortcut had", () => {
    const k = new KeyMap();
    const taken = k.set("idle_villager", 0, "H");
    expect(taken?.id).toBe("go_town_center");
    expect(k.get("go_town_center")[0]).toBeNull();
    expect(k.actionFor("H")?.id).toBe("idle_villager");
  });

  it("refuses the keys the game keeps, clears slots, and resets", () => {
    const store = memory();
    const k = new KeyMap(store);
    k.set("pause", 0, "Escape");
    expect(k.get("pause")[0]).toBe("F3");
    k.set("pause", 0, null);
    expect(k.actionFor("F3")).toBeUndefined();
    k.reset();
    expect(k.actionFor("F3")?.id).toBe("pause");
    expect(k.changed).toBe(false);
    expect(store.m.get("bd-keys")).toBe("{}");
  });

  it("survives a broken save", () => {
    const store = memory();
    store.set("bd-keys", "{not json");
    expect(new KeyMap(store).actionFor("H")?.id).toBe("go_town_center");
    store.set("bd-keys", JSON.stringify({ look: "Space", go_dock: [1, 2] }));
    expect(new KeyMap(store).actionFor("Space")?.id).toBe("look");
  });
});
