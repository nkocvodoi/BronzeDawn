// Two browsers joined straight to each other (WebRTC), with no server of our own: the host makes an
// invitation code, the friend pastes it and gets an answer code back, the host pastes that, and they are
// connected. The codes carry what WebRTC needs to find a way between the two machines; a public STUN
// server tells each machine its address on the internet. Behind some strict networks no way is found:
// then the codes say nothing goes through, and the two stay unconnected.
import type { Link } from "../core/net";

const ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
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

/** One connection to one other player. */
export class Peer {
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
