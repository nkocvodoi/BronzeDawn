// The online lobby: eight seats, the game's settings, a chat, and who is ready. The host keeps it and sends
// every change to the friends; each friend sends only what is theirs to change (their name, civilization,
// team, and whether they are ready). Laid out after the original's multiplayer screen.
import { DIFFICULTIES, DIFFICULTY_NAME, Difficulty } from "../core/ai";
import type { Rules } from "../core/rules";

export type SeatKind = "host" | "friend" | "computer" | "open" | "closed";
export interface Seat {
  kind: SeatKind;
  name: string;
  /** null: picked at random when the game starts. */
  civ: string | null;
  /** 0: no team. */
  team: number;
  ready: boolean;
  /** For a computer: its level. */
  level: Difficulty;
  /** For a friend: which connection, by its number on the host. */
  friend?: number;
}
export interface LobbySettings {
  mapType: string; mapTypeName: string; mapSize: number; mapSizeName: string; victory: string; victoryName: string;
  startAge: string; resources: string; popLimit: number; reveal: boolean; relics: boolean; farmsBlock: boolean; speed: number;
}
export interface LobbyState { code: string | null; seats: Seat[]; settings: LobbySettings; chat: { from: string; text: string }[] }

export const SEATS = 8;
export const NAME_MAX = 16;
export const CHAT_MAX = 200;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A friend's own changes, checked: whatever arrives over the network is only data. */
export function cleanName(x: unknown, fallback: string) {
  // Names show in many places of the interface, some written as HTML: no markup characters at all.
  const s = typeof x === "string" ? x.replace(/[\u0000-\u001f<>&"'`]/g, "").trim().slice(0, NAME_MAX) : "";
  return s || fallback;
}

/** The players a started game will have, in seat order: who sits where, empty seats left out. */
export function seated(state: LobbyState) {
  return state.seats.map((s, i) => ({ seat: s, index: i })).filter(({ seat }) => seat.kind !== "open" && seat.kind !== "closed");
}

/** Whether the host may start: two players at least, and every friend ready. */
export function canStart(state: LobbyState): string | null {
  const players = seated(state);
  if (players.length < 2) return "Two players at least: open a seat for a friend, or add a computer";
  const waiting = players.filter(({ seat }) => seat.kind === "friend" && !seat.ready);
  if (waiting.length) return `Waiting for ${waiting.map(({ seat }) => seat.name).join(", ")} to be ready`;
  return null;
}

/** The lobby as the overlay's lines, seen by the player in seat `you` (the host when `host`). */
export function lobbyHtml(state: LobbyState, you: number, host: boolean, rules: Rules, color: (i: number) => string, status = ""): string[] {
  const civName = (id: string | null) => (id ? rules.civs.find((c) => c.id === id)?.name ?? "?" : "Random");
  const civSelect = (id: string, on: string | null, disabled: boolean) =>
    `<select id="${id}"${disabled ? " disabled" : ""}><option value="">Random</option>${rules.civs.map((c) => `<option value="${c.id}"${c.id === on ? " selected" : ""}>${c.name}</option>`).join("")}</select>`;
  const teamSelect = (id: string, on: number, disabled: boolean) =>
    `<select id="${id}" class="team"${disabled ? " disabled" : ""}>${[0, 1, 2, 3, 4].map((t) => `<option value="${t}"${t === on ? " selected" : ""}>${t ? t : "-"}</option>`).join("")}</select>`;
  const rows = state.seats.map((s, i) => {
    const mine = i === you;
    const swatch = `<span class="swatch" style="background:${color(i)}">${i + 1}</span>`;
    let name: string, civ: string, team: string, ready = "";
    if (s.kind === "open" || s.kind === "closed" || s.kind === "computer") {
      // The host fills an empty seat: open for a friend, closed, or a computer at a level.
      const val = s.kind === "computer" ? `computer:${s.level}` : s.kind;
      name = host
        ? `<select id="seat-${i}" class="seat ${s.kind}">${[["open", "Open"], ["closed", "Closed"], ...DIFFICULTIES.map((d) => [`computer:${d}`, `Computer (${DIFFICULTY_NAME[d]})`])]
          .map(([v, t]) => `<option value="${v}"${v === val ? " selected" : ""}>${t}</option>`).join("")}</select>`
        : `<span class="seat ${s.kind}">${s.kind === "computer" ? `Computer (${DIFFICULTY_NAME[s.level]})` : s.kind === "open" ? "Open" : "Closed"}</span>`;
      civ = s.kind === "computer" ? (host ? civSelect(`civ-${i}`, s.civ, false) : civName(s.civ)) : "";
      team = s.kind === "computer" ? teamSelect(`team-${i}`, s.team, !host) : "";
    } else {
      name = mine ? `<input id="my-name" maxlength="${NAME_MAX}" value="${esc(s.name)}" autocomplete="off">` : `<b class="who">${esc(s.name)}</b>${s.kind === "host" ? ` <span class="tag">host</span>` : ""}`;
      civ = mine ? civSelect("my-civ", s.civ, false) : civName(s.civ);
      team = teamSelect(mine ? "my-team" : `team-${i}`, s.team, !mine && !(host && s.kind === "friend"));
      ready = s.kind === "host" ? "" : `<span class="ready ${s.ready ? "yes" : "no"}">${s.ready ? "Ready" : "Not ready"}</span>`;
    }
    return `<tr class="${mine ? "me" : ""}"><td>${swatch}</td><td>${name}</td><td>${civ}</td><td>${team}</td><td>${ready}</td></tr>`;
  }).join("");
  const st = state.settings;
  const line = (k: string, v: string) => `<li><span>${k}</span><b>${esc(v)}</b></li>`;
  const settings = `<ul class="lobby-settings">${[
    line("Map type", st.mapTypeName), line("Map size", st.mapSizeName), line("Victory", st.victoryName),
    line("Starting age", rules.ages[Number(st.startAge)]?.name ?? "Stone Age"), line("Resources", st.resources[0].toUpperCase() + st.resources.slice(1)),
    line("Population limit", String(st.popLimit)), line("Game speed", `${st.speed}x`),
    line("Ruins and Artifacts", st.relics ? "Yes" : "No"), line("Reveal map", st.reveal ? "Yes" : "No"), line("Farms block the way", st.farmsBlock ? "Yes" : "No"),
  ].join("")}</ul>`;
  const chat = state.chat.slice(-30).map((c) => (c.from ? `<div><b>${esc(c.from)}:</b> ${esc(c.text)}</div>` : `<div class="sys">${esc(c.text)}</div>`)).join("") || `<div class="quiet">Say hello to the others here.</div>`;
  const me = state.seats[you];
  const startWhy = host ? canStart(state) : null;
  const code = state.code ? `Room code <span class="room-code">${state.code.slice(0, 3)} ${state.code.slice(3)}</span>` : "";
  return [
    `<div class="lobby">`
      + `<div class="lobby-head">${code}</div>`
      + `<div class="lobby-main">`
      + `<div class="lobby-left"><table class="seats"><tr><th></th><th>Name</th><th>Civilization</th><th>Team</th><th></th></tr>${rows}</table>`
      + `<div class="lobby-chat" id="lobby-chat">${chat}</div>`
      + `<input id="chat-in" maxlength="${CHAT_MAX}" placeholder="Type a message and press Enter" autocomplete="off"></div>`
      + `<div class="lobby-right"><button id="lobby-settings"${host ? "" : " disabled"}>Settings</button>${settings}</div>`
      + `</div>`
      + `<div class="lobby-foot">`
      + (host ? `<span class="host-note">You are the host</span>` : `<label class="ready-box"><input type="checkbox" id="my-ready"${me?.ready ? " checked" : ""}> I'm Ready!</label>`)
      + (host ? `<button id="lobby-start"${startWhy ? ` disabled title="${esc(startWhy)}"` : ""}>Start Game</button>` : `<button disabled>Start Game</button>`)
      + `<button id="online-leave">Cancel</button>`
      + `</div>`
      + `<div class="lobby-status">${esc(status || (startWhy ?? (host ? "Everyone is ready" : me?.ready ? "Waiting for the host to start the game" : "Tick I'm Ready! when you are")))}</div>`
      + `</div>`,
  ];
}
