// A bug report from inside the game (F8, or Report a bug in the menu): one file with the game saved as it
// stands, a picture of the map, the latest messages and console errors, the settings and the screen. Loaded
// like a saved game (Saved Games, Load from a file), it opens that game at that moment; `npm run report`
// reads one without a browser.
import type { SaveFile } from "../core/save";

export interface LogEntry { at: number; kind: "error" | "warn" | "message"; text: string }
export interface Report {
  kind: "bdreport"; version: 1; made: string; url: string; agent: string;
  screen: { width: number; height: number; ratio: number };
  settings: Record<string, string>;
  game: Record<string, unknown> | null;
  save: SaveFile | null;
  log: LogEntry[];
  /** The map as drawn, a PNG data URL (the panels round it are HTML and not in it). */
  picture: string | null;
  /** What was on the panels: the status box, the command buttons, any open screen, as text. */
  panels: Record<string, string>;
}

const LOG: LogEntry[] = [];
const KEEP = 150;
const t0 = Date.now();

function push(kind: LogEntry["kind"], text: string) {
  LOG.push({ at: Math.round((Date.now() - t0) / 100) / 10, kind, text: text.slice(0, 2000) });
  if (LOG.length > KEEP) LOG.splice(0, LOG.length - KEEP);
}

/** From the page's start: console errors and warnings, uncaught errors and rejections. */
export function startLog() {
  for (const kind of ["error", "warn"] as const) {
    const orig = console[kind].bind(console);
    console[kind] = (...args: unknown[]) => {
      push(kind, args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack ?? ""}` : typeof a === "string" ? a : safe(a))).join(" "));
      orig(...args);
    };
  }
  window.addEventListener("error", (e) => push("error", `${e.message} at ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack ?? ""}`));
  window.addEventListener("unhandledrejection", (e) => push("error", `unhandled: ${e.reason instanceof Error ? `${e.reason.message}\n${e.reason.stack}` : safe(e.reason)}`));
}

/** A line the game showed the player, kept with the rest. */
export function logMessage(text: string) { push("message", text); }

function safe(v: unknown) { try { return JSON.stringify(v); } catch { return String(v); } }

/** The browser's own settings for this game (shortcuts, sound, art packs on or off...). */
function settings(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("bd")) out[k] = (localStorage.getItem(k) ?? "").slice(0, 2000);
    }
  } catch { /* private window */ }
  return out;
}

export function makeReport(parts: { game: Record<string, unknown> | null; save: SaveFile | null; picture: string | null; panels: Record<string, string> }): Report {
  return {
    kind: "bdreport", version: 1, made: new Date().toISOString(), url: location.href, agent: navigator.userAgent,
    screen: { width: innerWidth, height: innerHeight, ratio: devicePixelRatio }, settings: settings(), log: [...LOG], ...parts,
  };
}

/** A report's saved game, or a saved game as it is. */
export function saveIn(x: unknown): SaveFile {
  const r = x as Partial<Report>;
  if (r && r.kind === "bdreport") {
    if (!r.save) throw new Error("this bug report was made outside a game: there is no game in it to open");
    return r.save;
  }
  return x as SaveFile;
}
