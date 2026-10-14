/** Shortcuts the player can change: keys and mouse buttons (the middle one and the two side ones).
 *
 *  A binding is a chord: modifiers then a key, such as "H", "Ctrl+B", "Shift+=" or "Mouse4". Letters and digits
 *  are read from where the key sits, so they work the same on any keyboard layout.
 *
 *  Each action has two slots. For the game's own shortcuts both can be changed. For an order on the command panel
 *  the first slot is its letter there, which stays as in the original (it moves with the panel's other letters);
 *  the second slot is free, for a side mouse button for instance. */

export interface KeyAction {
  id: string;
  group: string;
  label: string;
  /** The two slots as shipped. */
  defaults: [string | null, string | null];
  /** The first slot is the command panel's letter and cannot be changed. */
  fixed?: boolean;
  /** For an order on the command panel: the icon of the button it presses, or failing that its title. */
  icon?: string;
  title?: string;
}

const a = (group: string, id: string, label: string, k0: string | null, k1: string | null = null): KeyAction =>
  ({ id, group, label, defaults: [k0, k1] });
const order = (id: string, label: string, letter: string, icon: string, title?: string): KeyAction =>
  ({ id, group: "Orders on the command panel", label, defaults: [letter, null], fixed: true, icon, title });

export const KEY_ACTIONS: KeyAction[] = [
  a("View", "look", "Look at the selection", "Space"),
  a("View", "zoom_in", "Zoom in", "PageUp"),
  a("View", "zoom_out", "Zoom out", "PageDown"),
  a("Selection", "idle_villager", "Next idle villager", "."),
  a("Selection", "next_in_selection", "Next unit of the selection", "Tab"),
  a("Selection", "delete", "Delete what is selected", "Delete", "Backspace"),
  a("Go to a building", "go_town_center", "Town Center (again: the next)", "H"),
  a("Go to a building", "go_barracks", "Barracks", "Ctrl+B"),
  a("Go to a building", "go_archery_range", "Archery Range", "Ctrl+A"),
  a("Go to a building", "go_stable", "Stable", "Ctrl+L"),
  a("Go to a building", "go_siege_workshop", "Siege Workshop", "Ctrl+K"),
  a("Go to a building", "go_academy", "Academy", "Ctrl+Y"),
  a("Go to a building", "go_temple", "Temple", "Ctrl+P"),
  a("Go to a building", "go_dock", "Dock", "Ctrl+D"),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): KeyAction => ({
    id: `group_${n}`, group: "Groups", label: `Group ${n} (Ctrl+${n} saves it, Shift+${n} adds it)`, defaults: [String(n), null], fixed: true,
  })),
  order("cmd_build", "Build menu (villagers)", "B", "build"),
  order("cmd_repair", "Repair (villagers)", "R", "repair"),
  order("cmd_stop", "Stop", "S", "stop"),
  order("cmd_attack_move", "Attack-move", "A", "attack_move"),
  order("cmd_flag", "Flag", "F", "flag"),
  order("cmd_stand_ground", "Stand ground", "D", "stand_ground"),
  order("cmd_attack_ground", "Attack ground (stone throwers)", "T", "attack_ground"),
  order("cmd_unload", "Unload a transport", "U", "unload"),
  order("cmd_sacrifice", "Sacrifice (priests, Martyrdom)", "Q", "temple", "Sacrifice"),
  order("cmd_villager", "Train a villager (Town Center)", "C", "villager"),
  order("cmd_age", "Advance to the next age (Town Center)", "A", "age"),
  a("Game", "pause", "Pause", "F3", "Pause"),
  a("Game", "faster", "Game speed up", "=", "Shift+="),
  a("Game", "slower", "Game speed down", "-", "Shift+-"),
  a("Game", "scores", "Population, scores or nothing above the minimap", "F4"),
];

/** Keys the player cannot take: they open the help and menu, cancel, chat and scroll. */
export const RESERVED = new Set(["Escape", "F1", "F10", "Shift+/", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

const NAMED: Record<string, string> = {
  Space: "Space", Tab: "Tab", Enter: "Enter", Escape: "Escape", Backspace: "Backspace", Delete: "Delete", Insert: "Insert",
  Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Pause: "Pause",
  ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight",
  Period: ".", Comma: ",", Slash: "/", Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
  Minus: "-", Equal: "=", Backquote: "`", NumpadAdd: "=", NumpadSubtract: "-",
};

/** The chord a key press makes, or null for a lone modifier, or with Cmd held (the browser's shortcuts). */
export function chordOfKey(e: Pick<KeyboardEvent, "code" | "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): string | null {
  if (e.metaKey) return null;
  let k: string | undefined;
  const m = /^(?:Key([A-Z])|Digit([0-9])|Numpad([0-9])|(F[0-9]{1,2}))$/.exec(e.code);
  if (m) k = m[1] ?? m[2] ?? m[3] ?? m[4];
  else k = NAMED[e.code];
  if (!k && e.key && e.key.length === 1) k = e.key.toUpperCase(); // a key with no code, as some test tools send
  if (!k) return null;
  // The numpad's + and - are the speed keys without Shift.
  const shift = e.shiftKey && e.code !== "NumpadAdd" && e.code !== "NumpadSubtract";
  return (e.ctrlKey ? "Ctrl+" : "") + (e.altKey ? "Alt+" : "") + (shift ? "Shift+" : "") + k;
}

/** The chord a mouse button makes: the middle one is Mouse3, the side ones Mouse4 (back) and Mouse5 (forward). */
export function chordOfMouse(e: Pick<MouseEvent, "button" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): string | null {
  const name = ({ 1: "Mouse3", 3: "Mouse4", 4: "Mouse5" } as Record<number, string>)[e.button];
  if (!name || e.metaKey) return null;
  return (e.ctrlKey ? "Ctrl+" : "") + (e.altKey ? "Alt+" : "") + (e.shiftKey ? "Shift+" : "") + name;
}

const PRETTY: Record<string, string> = {
  "Shift+=": "+", "Shift+-": "_", "Shift+/": "?", Mouse3: "Middle mouse button", Mouse4: "Mouse back button", Mouse5: "Mouse forward button",
  PageUp: "Page Up", PageDown: "Page Down",
};

/** A chord as the player reads it. */
export function prettyChord(c: string): string {
  if (PRETTY[c]) return PRETTY[c];
  const parts = c.split("+");
  const last = parts.pop()!;
  return [...parts, PRETTY[last] ?? last].join("+");
}

type Slots = [string | null, string | null];

interface Store { get(k: string): string | null; set(k: string, v: string): void }

const STORE_KEY = "bd-keys";

export class KeyMap {
  private slots = new Map<string, Slots>();
  private byChord = new Map<string, string>();

  constructor(private store?: Store) {
    let saved: Record<string, Slots> = {};
    try { saved = JSON.parse(store?.get(STORE_KEY) ?? "{}") ?? {}; } catch { /* a broken save: the defaults */ }
    for (const act of KEY_ACTIONS) {
      const s = saved[act.id];
      const ok = Array.isArray(s) && s.length === 2 && s.every((x) => x === null || typeof x === "string");
      const slots: Slots = ok ? [act.fixed ? act.defaults[0] : s[0], s[1]] : [...act.defaults];
      this.slots.set(act.id, slots);
    }
    this.index();
  }

  /** The two slots of an action. */
  get(id: string): Slots { return this.slots.get(id) ?? [null, null]; }

  /** The action a chord runs, if any. */
  actionFor(chord: string | null): KeyAction | undefined {
    const id = chord ? this.byChord.get(chord) : undefined;
    return id ? KEY_ACTIONS.find((x) => x.id === id) : undefined;
  }

  /** Puts a chord in a slot, or clears the slot with null. A chord that was elsewhere moves here; returns where it was taken from. */
  set(id: string, slot: 0 | 1, chord: string | null): KeyAction | undefined {
    const act = KEY_ACTIONS.find((x) => x.id === id);
    if (!act || (slot === 0 && act.fixed)) return undefined;
    if (chord && RESERVED.has(chord)) return undefined;
    let taken: KeyAction | undefined;
    if (chord) {
      for (const other of KEY_ACTIONS) {
        const s = this.slots.get(other.id)!;
        s.forEach((c, i) => {
          if (c !== chord || (other.id === id && i === slot)) return;
          if (i === 0 && other.fixed) return; // a panel letter stays; the new binding wins over it
          s[i] = null;
          taken = other;
        });
      }
    }
    this.slots.get(id)![slot] = chord;
    this.index();
    this.save();
    return taken;
  }

  /** Every action back to how it shipped. */
  reset() {
    for (const act of KEY_ACTIONS) this.slots.set(act.id, [...act.defaults]);
    this.index();
    this.save();
  }

  /** Whether any action has been changed from its default. */
  get changed() { return KEY_ACTIONS.some((act) => this.get(act.id).some((c, i) => c !== act.defaults[i])); }

  /** Only the slots that can change are looked up here. A panel letter means different orders for different
   *  selections (A is Attack-move for soldiers and Advance at a Town Center), so the panel reads its own letters;
   *  a chord put in a free slot is looked up first, so it wins over a panel letter it shares. */
  private index() {
    this.byChord.clear();
    for (const act of KEY_ACTIONS) {
      this.slots.get(act.id)!.forEach((c, i) => {
        if (c && !(i === 0 && act.fixed) && !this.byChord.has(c)) this.byChord.set(c, act.id);
      });
    }
  }

  private save() {
    const out: Record<string, Slots> = {};
    for (const act of KEY_ACTIONS) {
      const s = this.get(act.id);
      if (s[0] !== act.defaults[0] || s[1] !== act.defaults[1]) out[act.id] = s;
    }
    this.store?.set(STORE_KEY, JSON.stringify(out));
  }
}
