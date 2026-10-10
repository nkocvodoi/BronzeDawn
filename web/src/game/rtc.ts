// Connecting two browsers for an online game, two ways.
//
// Room codes (the usual way): the host opens a room and gets a six-digit code; a friend types it in. This
// uses PeerJS's free public server to match the code to the host; the game then goes straight between
// the two machines. Behind some strict networks (mobile data, carrier-grade NAT) no straight way exists
// and a TURN server must relay the game. None is free and open any more (PeerJS's own is gone), so one
// can be given at build time: VITE_TURN_URLS (comma-separated), VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL.
//
// Long codes (no server at all): the host makes an invitation code, the friend pastes it and sends an
// answer code back. Only a public STUN server is used, so behind strict networks no way may be found:
// this is the fallback for when the public service is down, and works best on the same network.
import { DataConnection, Peer as PeerJS } from "peerjs";
import type { Link } from "../core/net";

/** A connection to another player, however it was made. */
export interface Conn { readonly link: Link; readonly open: boolean; onOpen: (() => void) | null; onClose: (() => void) | null; close(): void }

/** The STUN servers that tell each machine its address, and a TURN relay if this build was given one. */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
/** The relay's addresses as given, keeping only well-formed ones: a browser refuses the whole list, and with
 *  it every connection, over one mistyped address. */
export function relayUrls(given: string | undefined): string[] {
  const urls = (given ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  const good = urls.filter((u) => /^(stun|stuns|turn|turns):[^\s,]+$/.test(u));
  if (good.length < urls.length) console.warn(`TURN: left out ${urls.length - good.length} address(es) that are not stun:, turn: or turns: URLs`);
  return good;
}
const RELAY = relayUrls(env.VITE_TURN_URLS);
const ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(RELAY.length ? [{ urls: RELAY, username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL }] : []),
];
/** Whether this build can relay a game between networks that cannot reach each other straight. */
export const HAS_RELAY = RELAY.some((u) => u.startsWith("turn"));
/** Codes start with this, so a code for another version is recognised as such. */
const PREFIX = "BD1-";

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** A session description as a short code: compressed, in letters that survive a chat message. */
async function encode(d: RTCSessionDescriptionInit): Promise<string> {
  const raw = new Blob([JSON.stringify({ t: d.type, s: d.sdp })]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return PREFIX + toB64(new Uint8Array(await new Response(raw).arrayBuffer()));
}

async function decode(code: string): Promise<RTCSessionDescriptionInit> {
  const c = code.trim().replace(/\s+/g, "");
  if (!c.startsWith(PREFIX)) throw new Error("This is not a Bronze Dawn code (or it is from another version)");
  const raw = new Blob([fromB64(c.slice(PREFIX.length))]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const { t, s } = JSON.parse(await new Response(raw).text());
  return { type: t, sdp: s };
}

/** Waits until the browser has found its addresses, so the code carries them all (no second message). */
function gathered(pc: RTCPeerConnection, ms = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") { resolve(); return; }
    const done = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", done); resolve(); } };
    pc.addEventListener("icegatheringstatechange", done);
    setTimeout(resolve, ms); // what it has by then is usually enough
  });
}

/** One connection to one other player, made with long codes. */
export class Peer implements Conn {
  private channel: RTCDataChannel | null = null;
  private handler: ((m: unknown) => void) | null = null;
  private early: unknown[] = [];
  /** Called once the two can talk, and when they no longer can. */
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;
  open = false;

  private constructor(private pc: RTCPeerConnection) {
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") this.closed();
    });
  }

  private use(ch: RTCDataChannel) {
    this.channel = ch;
    ch.onopen = () => { this.open = true; this.onOpen?.(); };
    ch.onclose = () => this.closed();
    ch.onmessage = (e) => {
      let m: unknown;
      try { m = JSON.parse(String(e.data)); } catch { return; }
      if (this.handler) this.handler(m); else this.early.push(m);
    };
  }

  private ended = false;
  /** The connection is gone (it failed, or the other side left): said once, however it was noticed. */
  private closed() {
    if (this.ended) return;
    this.ended = true;
    this.open = false;
    this.onClose?.();
  }

  /** The host's side: an invitation code to give, and a way to take the friend's answer. */
  static async invite(): Promise<{ peer: Peer; code: string; accept: (answer: string) => Promise<void> }> {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer = new Peer(pc);
    peer.use(pc.createDataChannel("game", { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const code = await encode(pc.localDescription!);
    const accept = async (answer: string) => {
      const d = await decode(answer);
      if (d.type !== "answer") throw new Error("That is an invitation code: paste your friend's answer code here");
      await pc.setRemoteDescription(d);
    };
    return { peer, code, accept };
  }

  /** The friend's side: from the host's invitation code, the answer code to send back. */
  static async answer(invitation: string): Promise<{ peer: Peer; code: string }> {
    const d = await decode(invitation);
    if (d.type !== "offer") throw new Error("That is an answer code: paste the host's invitation here");
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer = new Peer(pc);
    pc.addEventListener("datachannel", (e) => peer.use(e.channel));
    await pc.setRemoteDescription(d);
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    return { peer, code: await encode(pc.localDescription!) };
  }

  /** This connection as the game's link: messages as JSON. A new listener replaces the old one. */
  get link(): Link {
    return {
      send: (m: unknown) => { if (this.channel?.readyState === "open") this.channel.send(JSON.stringify(m)); },
      onMessage: (h: (m: unknown) => void) => {
        this.handler = h;
        const waiting = this.early; this.early = [];
        for (const m of waiting) h(m);
      },
    };
  }

  close() { this.pc.close(); }
}

// ---- room codes

/** Room codes are six digits, kept apart from other PeerJS users by this prefix. */
const ROOM_PREFIX = "bronzedawn-room-";
const roomId = (code: string) => ROOM_PREFIX + code;
const newCode = () => String(Math.floor(Math.random() * 900000) + 100000);

/** Why a room could not be reached, in words for the player. */
function says(e: unknown): string {
  const t = (e as { type?: string }).type;
  if (t === "peer-unavailable") return "No game has that code (check it, or ask the host for a new one)";
  if (t === "network" || t === "server-error" || t === "socket-error" || t === "socket-closed") return "The free matching service cannot be reached right now; try again, or use the long codes";
  if (t === "browser-incompatible") return "This browser cannot play online";
  return (e as Error).message ?? String(e);
}

/** A connection made through a room. */
class RoomConn implements Conn {
  private handler: ((m: unknown) => void) | null = null;
  private early: unknown[] = [];
  private ended = false;
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;
  open = false;

  constructor(private c: DataConnection, private owner?: PeerJS) {
    c.on("open", () => { this.open = true; this.onOpen?.(); });
    c.on("data", (m) => { if (this.handler) this.handler(m); else this.early.push(m); });
    const gone = () => { if (this.ended) return; this.ended = true; this.open = false; this.onClose?.(); };
    c.on("close", gone);
    c.on("error", gone);
    c.on("iceStateChanged", (st) => { if (st === "failed" || st === "closed" || st === "disconnected") gone(); });
  }

  get link(): Link {
    return {
      send: (m: unknown) => { if (this.open) this.c.send(m); },
      onMessage: (h: (m: unknown) => void) => {
        this.handler = h;
        const waiting = this.early; this.early = [];
        for (const m of waiting) h(m);
      },
    };
  }

  close() { this.c.close(); this.owner?.destroy(); }
}

/** The host's room: its code, and each friend who joins. */
export class Room {
  onFriend: ((c: Conn) => void) | null = null;
  /** The room's line to the matching service broke: no one new can join (those in stay connected). */
  onLost: ((why: string) => void) | null = null;
  private constructor(private peer: PeerJS, readonly code: string) {
    peer.on("connection", (dc) => {
      const conn = new RoomConn(dc);
      this.onFriend?.(conn);
    });
    peer.on("disconnected", () => this.onLost?.("The room is no longer listed: friends already in stay connected, but no one new can join"));
  }

  /** Opens a room under a fresh six-digit code (another one if that code is taken). */
  static open(tries = 4): Promise<Room> {
    return new Promise((resolve, reject) => {
      const code = newCode();
      const peer = new PeerJS(roomId(code), { config: { iceServers: ICE } });
      const timer = setTimeout(() => { peer.destroy(); reject(new Error("The free matching service did not answer; try again, or use the long codes")); }, 12000);
      peer.on("open", () => { clearTimeout(timer); resolve(new Room(peer, code)); });
      peer.on("error", (e) => {
        clearTimeout(timer);
        peer.destroy();
        if ((e as { type?: string }).type === "unavailable-id" && tries > 1) Room.open(tries - 1).then(resolve, reject);
        else reject(new Error(says(e)));
      });
    });
  }

  close() { this.peer.destroy(); }
}

/** A friend's side: joins the room with this code. Fails with a reason if nothing answers in time. */
export function joinRoom(code: string): Promise<Conn> {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 6) return Promise.reject(new Error("A room code is six digits"));
  return new Promise((resolve, reject) => {
    const peer = new PeerJS({ config: { iceServers: ICE } });
    let done = false;
    const fail = (why: string) => { if (done) return; done = true; peer.destroy(); reject(new Error(why)); };
    const timer = setTimeout(() => fail(HAS_RELAY ? "The host could not be reached in time: check the code, and that you both have internet"
      : "The host could not be reached in time. Check the code. If it is right, your two networks found no way to each other (common on mobile data): try both on the same Wi-Fi."), 20000);
    peer.on("error", (e) => { clearTimeout(timer); fail(says(e)); });
    peer.on("open", () => {
      const conn = new RoomConn(peer.connect(roomId(digits), { reliable: true, serialization: "json" }), peer);
      conn.onOpen = () => { if (done) return; done = true; clearTimeout(timer); conn.onOpen = null; resolve(conn); };
    });
  });
}
