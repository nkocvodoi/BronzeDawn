// Every sound in the game, made at run time with Web Audio: no recordings, nothing borrowed.
// Effects are short envelopes over noise and oscillators; voices are a buzz through vowel
// formants speaking a made-up tongue; the music is a drone, a lyre and a hand drum.

export type Sfx =
  | "chop" | "mine" | "forage" | "hammer" | "farm" | "fish" | "spear"
  | "sword" | "club" | "bow" | "thud" | "knock" | "boom" | "die" | "collapse"
  | "complete" | "trained" | "researched" | "alarm" | "ageUp" | "convert" | "heal"
  | "click" | "error" | "victory" | "defeat";

/** Who is talking: a pitch, a pace and a timbre. */
export type VoiceKind = "villager" | "soldier" | "rider" | "priest" | "siege";

const VOWELS: Record<string, [number, number, number]> = {
  a: [800, 1150, 2900], e: [400, 2000, 2600], i: [300, 2300, 3000], o: [450, 800, 2830], u: [325, 700, 2700],
};
const CONSONANTS = ["k", "t", "m", "n", "r", "s", "h", "d", "b", ""];

/** Made-up words, so every unit answers in the same tongue. Seeded by the unit type. */
const SAYINGS: Record<VoiceKind, string[][]> = {
  villager: [["ha", "ru"], ["te", "ma"], ["o", "ki", "ta"], ["su", "ne"], ["da", "ho"]],
  soldier: [["ka", "dar"], ["to", "rak"], ["ha", "dum"], ["ba", "ka", "ro"], ["ur", "ta"]],
  rider: [["hai", "ya"], ["ko", "rem"], ["sa", "da", "ka"], ["ta", "ru"]],
  priest: [["o", "mo", "lo"], ["e", "lu", "na"], ["sa", "ma", "o"], ["u", "ra", "mo"]],
  siege: [["hu", "ka"], ["ro", "ta"], ["ma", "da"]],
};

/** The old modal sound: D dorian, in Hz, low to high. */
const SCALE = [146.8, 164.8, 174.6, 196.0, 220.0, 246.9, 261.6, 293.7, 329.6, 349.2, 392.0, 440.0];

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last = new Map<string, number>();
  private playing = 0;
  sfxOn = store.get("bd-sfx") !== "off";
  musicOn = store.get("bd-music") !== "off";
  private musicTimer = 0;
  private nextBar = 0;
  private bar = 0;

  /** Browsers only allow sound after a click or a key. Call this from one. */
  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return;
      const ctx = new C();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
      this.musicBus.connect(this.master);
      const n = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      // Silent while the tab is hidden or minimised, as a desktop game is when you Alt+Tab away.
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) void ctx.suspend();
        else void ctx.resume();
      });
    }
    if (this.ctx.state === "suspended" && !document.hidden) void this.ctx.resume();
  }

  get ready() { return !!this.ctx && this.ctx.state === "running"; }

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    store.set("bd-sfx", this.sfxOn ? "on" : "off");
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(this.sfxOn ? 1 : 0, this.ctx.currentTime, 0.05);
    return this.sfxOn;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    store.set("bd-music", this.musicOn ? "on" : "off");
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 : 0, this.ctx.currentTime, 0.3);
    return this.musicOn;
  }

  // ---- building blocks

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** A burst of filtered noise. */
  private noise(out: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, attack = 0.002) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, peak, attack, dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + attack + dur + 0.05);
  }

  /** One oscillator with a pitch glide and a decay. */
  private tone(out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, attack = 0.003) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.env(g, t, peak, attack, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  /** A struck metal: a few partials that do not line up, as a blade or a bell rings. */
  private metal(out: AudioNode, t: number, base: number, ratios: number[], dur: number, peak: number) {
    ratios.forEach((r, i) => this.tone(out, t, "sine", base * r, base * r * 0.995, dur / (1 + i * 0.4), peak / (1 + i * 0.6), 0.001));
  }

  /** A brass-like horn: a sawtooth opening through a filter, with a little vibrato. */
  private horn(out: AudioNode, t: number, f: number, dur: number, peak: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = 5.2; depth.gain.value = f * 0.008;
    lfo.connect(depth).connect(o.frequency);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 2;
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.linearRampToValueAtTime(f * 5, t + 0.08);
    lp.frequency.linearRampToValueAtTime(f * 3, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.05);
    g.gain.setValueAtTime(peak, t + dur - 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    o.connect(lp).connect(g).connect(out);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2);
  }

  /** A plucked string, like a lyre: bright at first, then soft. */
  private pluck(out: AudioNode, t: number, f: number, peak: number, dur = 1.4) {
    const c = this.ctx!;
    const o = c.createOscillator(), o2 = c.createOscillator();
    o.type = "triangle"; o.frequency.value = f;
    o2.type = "sawtooth"; o2.frequency.value = f * 1.003;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(f * 8, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.25);
    const g = c.createGain(), g2 = c.createGain();
    g2.gain.value = 0.25;
    this.env(g, t, peak, 0.004, dur);
    o.connect(lp); o2.connect(g2).connect(lp);
    lp.connect(g).connect(out);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  /** A soft flute, breathy, with a slow vibrato. */
  private flute(out: AudioNode, t: number, f: number, dur: number, peak: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = "sine"; o.frequency.value = f;
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = 4.6; depth.gain.value = f * 0.012;
    lfo.connect(depth).connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.12);
    g.gain.setValueAtTime(peak * 0.8, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    this.noise(out, t, dur * 0.6, "bandpass", f * 2, 3, peak * 0.12, 0.08);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  /** A hand drum: a falling thump with a slap of noise. */
  private drum(out: AudioNode, t: number, f: number, peak: number) {
    this.tone(out, t, "sine", f * 1.6, f, 0.28, peak, 0.002);
    this.noise(out, t, 0.06, "bandpass", 900, 1.2, peak * 0.35);
  }

  /** Where a sound sits: quieter and to one side when it is away from the middle of the screen. */
  private place(vol: number, pan: number): AudioNode {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.value = vol;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    return g;
  }

  // ---- effects

  /** Plays an effect. `gap` keeps a noisy battle from stacking the same sound a hundred times. */
  play(name: Sfx, vol = 1, pan = 0, gap = 0.06) {
    if (!this.ready || !this.sfxOn || vol <= 0.02) return;
    const c = this.ctx!, now = c.currentTime;
    if (now - (this.last.get(name) ?? -1) < gap || this.playing > 24) return;
    this.last.set(name, now);
    this.playing++;
    setTimeout(() => this.playing--, 400);
    const out = this.place(vol, pan), t = now + 0.01, j = 0.9 + Math.random() * 0.2;
    switch (name) {
      case "chop": // an axe in wood: a dull knock and a woody crack
        this.tone(out, t, "sine", 210 * j, 120, 0.09, 0.5);
        this.noise(out, t, 0.07, "bandpass", 1300 * j, 2.5, 0.55);
        break;
      case "mine": // a pick on rock: a bright clink over grit
        this.metal(out, t, 1750 * j, [1, 1.47, 2.09], 0.16, 0.22);
        this.noise(out, t, 0.05, "highpass", 2500, 0.7, 0.3);
        break;
      case "forage":
        this.noise(out, t, 0.12, "bandpass", 3200 * j, 1.5, 0.18, 0.02);
        break;
      case "farm": // a hoe in soil
        this.noise(out, t, 0.1, "bandpass", 700 * j, 1.2, 0.3, 0.01);
        this.tone(out, t, "sine", 140, 90, 0.06, 0.2);
        break;
      case "fish":
        this.noise(out, t, 0.18, "lowpass", 900 * j, 0.8, 0.22, 0.02);
        this.tone(out, t + 0.03, "sine", 600 * j, 1100, 0.07, 0.08);
        break;
      case "hammer": // building: wood on wood
        this.tone(out, t, "square", 330 * j, 200, 0.04, 0.12);
        this.noise(out, t, 0.06, "bandpass", 2000 * j, 3, 0.4);
        this.tone(out, t, "sine", 160, 90, 0.08, 0.35);
        break;
      case "spear":
        this.noise(out, t, 0.08, "bandpass", 600 * j, 1, 0.35);
        break;
      case "sword": // blade on blade
        this.metal(out, t, 1180 * j, [1, 1.58, 2.31, 3.17], 0.3, 0.3);
        this.noise(out, t, 0.04, "highpass", 3000, 0.7, 0.35);
        break;
      case "club":
        this.tone(out, t, "sine", 180 * j, 80, 0.12, 0.55);
        this.noise(out, t, 0.05, "lowpass", 900, 0.7, 0.35);
        break;
      case "bow": // a twang and the swish of the arrow
        this.tone(out, t, "triangle", 260 * j, 190, 0.12, 0.25);
        this.noise(out, t + 0.02, 0.15, "bandpass", 2400, 0.8, 0.12, 0.04);
        break;
      case "thud": // an arrow strikes
        this.noise(out, t, 0.05, "bandpass", 500 * j, 1.5, 0.35);
        break;
      case "knock": // against a building
        this.tone(out, t, "sine", 120 * j, 70, 0.12, 0.4);
        this.noise(out, t, 0.08, "lowpass", 700, 0.8, 0.3);
        break;
      case "boom": // a stone from a catapult lands
        this.tone(out, t, "sine", 90, 38, 0.5, 0.8);
        this.noise(out, t, 0.6, "lowpass", 500, 0.7, 0.6, 0.005);
        break;
      case "die": { // a cry that falls away
        const f = (j > 1 ? 190 : 150);
        this.voiceSyllable(out, t, "a", "h", f, f * 0.55, 0.38, 0.5);
        break;
      }
      case "collapse": // timber and stone come down
        this.tone(out, t, "sine", 70, 30, 1.4, 0.8);
        this.noise(out, t, 1.6, "lowpass", 420, 0.6, 0.7, 0.03);
        for (let i = 0; i < 7; i++) this.noise(out, t + 0.1 + Math.random() * 1.1, 0.08, "bandpass", 900 + Math.random() * 1500, 2, 0.35);
        break;
      case "complete": // three rising notes on the lyre
        [0, 2, 4].forEach((k, i) => this.pluck(out, t + i * 0.11, SCALE[k + 3] * 2, 0.3, 0.9));
        break;
      case "trained": // a short call on the horn
        this.horn(out, t, 220, 0.16, 0.18);
        this.horn(out, t + 0.2, 293.7, 0.28, 0.18);
        break;
      case "researched": // a temple bell
        this.metal(out, t, 660, [1, 2.76, 5.4, 8.93], 1.6, 0.25);
        break;
      case "alarm": // the war horn: two long low blasts
        this.horn(out, t, 110, 0.55, 0.32);
        this.horn(out, t, 110.6 * 1.5, 0.55, 0.12);
        this.horn(out, t + 0.75, 110, 0.9, 0.32);
        this.horn(out, t + 0.75, 110.6 * 1.5, 0.9, 0.12);
        break;
      case "ageUp": { // a fanfare
        const notes: [number, number, number][] = [[0, 220, 0.18], [0.2, 220, 0.18], [0.4, 293.7, 0.3], [0.75, 370, 0.3], [1.1, 440, 0.9]];
        for (const [dt, f, d] of notes) { this.horn(out, t + dt, f, d, 0.22); this.horn(out, t + dt, f * 1.5, d, 0.08); }
        this.drum(out, t + 1.1, 70, 0.6);
        break;
      }
      case "convert": // the priest's chant: one long rising and falling vowel
        this.chant(out, t);
        break;
      case "heal":
        [5, 7, 9].forEach((k, i) => this.tone(out, t + i * 0.09, "sine", SCALE[k] * 2, SCALE[k] * 2, 0.5, 0.12, 0.02));
        break;
      case "click":
        this.tone(out, t, "square", 1400, 900, 0.02, 0.06);
        this.noise(out, t, 0.02, "highpass", 3000, 0.7, 0.12);
        break;
      case "error":
        this.tone(out, t, "square", 140, 120, 0.14, 0.12);
        this.tone(out, t + 0.16, "square", 120, 100, 0.18, 0.12);
        break;
      case "victory": {
        const notes = [0, 2, 4, 7, 4, 7];
        notes.forEach((k, i) => this.horn(out, t + i * 0.24, SCALE[k] * 1.5, i === notes.length - 1 ? 1.2 : 0.2, 0.2));
        break;
      }
      case "defeat":
        [7, 5, 4, 2, 0].forEach((k, i) => this.horn(out, t + i * 0.42, SCALE[k], 0.38, 0.18));
        break;
    }
  }

  // ---- voices

  /** One spoken syllable: a consonant of noise, then a vowel sung through formant filters. */
  private voiceSyllable(out: AudioNode, t: number, vowel: string, cons: string, f0: number, f1: number, dur: number, peak: number) {
    const c = this.ctx!;
    if (cons && cons !== "m" && cons !== "n") {
      const bright = cons === "s" ? 5000 : cons === "h" ? 1500 : cons === "r" ? 1200 : 2600;
      this.noise(out, t, cons === "s" ? 0.07 : 0.025, "bandpass", bright, 1.5, peak * (cons === "h" ? 0.25 : 0.5));
      t += cons === "s" ? 0.06 : 0.02;
    }
    const src = c.createOscillator();
    src.type = "sawtooth";
    src.frequency.setValueAtTime(f0, t);
    src.frequency.linearRampToValueAtTime(f1, t + dur);
    const vib = c.createOscillator(), vd = c.createGain();
    vib.frequency.value = 6; vd.gain.value = f0 * 0.015;
    vib.connect(vd).connect(src.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.025);
    g.gain.setValueAtTime(peak, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const [a, b, d] = VOWELS[vowel] ?? VOWELS.a;
    for (const [f, q, amp] of [[a, 9, 1], [b, 11, 0.6], [d, 12, 0.25]] as [number, number, number][]) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
      const fg = c.createGain(); fg.gain.value = amp * 3;
      src.connect(bp).connect(fg).connect(g);
    }
    if (cons === "m" || cons === "n") {
      const hum = c.createBiquadFilter();
      hum.type = "lowpass"; hum.frequency.value = 400;
      const hg = c.createGain();
      this.env(hg, t - 0.05, peak * 0.6, 0.01, 0.06);
      src.connect(hum).connect(hg).connect(out);
    }
    g.connect(out);
    src.start(t - 0.05); vib.start(t - 0.05);
    src.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }

  /** A unit answers: when picked, or when it gets an order. */
  voice(kind: VoiceKind, seed: number, ack: boolean) {
    if (!this.ready || !this.sfxOn) return;
    const c = this.ctx!, now = c.currentTime;
    if (now - (this.last.get("voice") ?? -1) < 0.45) return;
    this.last.set("voice", now);
    const lines = SAYINGS[kind];
    const words = lines[(seed + (ack ? 1 : 0) * 3 + Math.floor(Math.random() * 2)) % lines.length];
    const base = { villager: 150, soldier: 118, rider: 135, priest: 105, siege: 125 }[kind] * (0.92 + (seed % 5) * 0.04);
    const pace = kind === "priest" ? 0.2 : kind === "soldier" ? 0.12 : 0.14;
    const out = this.place(0.55, 0);
    let t = now + 0.02;
    words.forEach((syl, i) => {
      const cons = CONSONANTS.includes(syl[0]) && syl.length > 1 ? syl[0] : "";
      const vowel = [...syl].find((ch) => ch in VOWELS) ?? "a";
      const last = i === words.length - 1;
      // A question when picked (rising), a firm answer to an order (falling).
      const f0 = base * (1 + (ack ? -0.04 : 0.03) * i), f1 = last ? f0 * (ack ? 0.82 : 1.12) : f0;
      const dur = last ? pace * 1.6 : pace;
      this.voiceSyllable(out, t, vowel, cons, f0, f1, dur, kind === "soldier" ? 0.5 : 0.4);
      t += dur + 0.025;
    });
  }

  /** The priest's chant, sung long: o-o-lo, rising then falling, with a second voice a fifth above. */
  private chant(out: AudioNode, t: number) {
    const f = 118;
    this.voiceSyllable(out, t, "o", "", f, f * 1.25, 0.45, 0.45);
    this.voiceSyllable(out, t + 0.45, "o", "l", f * 1.25, f * 1.5, 0.4, 0.45);
    this.voiceSyllable(out, t + 0.88, "o", "", f * 1.5, f * 1.1, 0.7, 0.45);
    this.voiceSyllable(out, t, "o", "", f * 1.5, f * 1.87, 0.45, 0.15);
    this.voiceSyllable(out, t + 0.45, "o", "l", f * 1.87, f * 2.25, 0.4, 0.15);
    this.voiceSyllable(out, t + 0.88, "o", "", f * 2.25, f * 1.65, 0.7, 0.15);
  }

  // ---- music

  /** Starts the music: a drone, a lyre wandering the mode, a drum, and now and then a flute. */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextBar = this.ctx.currentTime + 0.5;
    this.bar = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 200);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }

  private scheduleMusic() {
    const c = this.ctx!;
    if (c.state !== "running") return;
    const beat = 60 / 76, barLen = beat * 4;
    while (this.nextBar < c.currentTime + 1.2) {
      const t = this.nextBar, out = this.musicBus, b = this.bar;
      // Sections of eight bars; the root moves between D and a step down, C, as old modal music does.
      const section = Math.floor(b / 8) % 4;
      const root = section === 2 ? 130.8 : 146.8;
      if (b % 2 === 0) {
        // The drone: root and fifth, slow to swell.
        for (const [f, v] of [[root / 2, 0.12], [root * 0.75, 0.06], [root, 0.05]] as [number, number][]) {
          const o = c.createOscillator();
          o.type = "sawtooth"; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8;
          const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(v, t + 1.2);
          g.gain.setValueAtTime(v, t + barLen * 2 - 0.6);
          g.gain.exponentialRampToValueAtTime(0.0001, t + barLen * 2 + 0.6);
          o.connect(lp).connect(g).connect(out);
          o.start(t); o.stop(t + barLen * 2 + 0.7);
        }
      }
      // The drum: a steady walk, busier in the second half of each section.
      const hits = (b % 8) >= 4 ? [0, 1.5, 2, 3, 3.5] : [0, 2, 3];
      if (section !== 3) for (const h of hits) this.drum(out, t + h * beat, h === 0 ? 62 : 85, h === 0 ? 0.5 : 0.28);
      // The lyre: a phrase that steps around the mode and comes home.
      if (section !== 0 || b % 8 >= 2) {
        let k = section === 2 ? 2 : 4;
        for (let i = 0; i < 8; i++) {
          if (Math.random() < 0.3) continue;
          k = Math.max(0, Math.min(SCALE.length - 1, k + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
          if (i === 7) k = section === 2 ? 2 : 0;
          this.pluck(out, t + i * beat / 2, SCALE[k] * (section === 2 ? 0.891 : 1), 0.16, 1.2);
        }
      }
      // The flute takes a long line over the third section.
      if (section === 1 && b % 2 === 0) {
        let k = 7;
        for (let i = 0; i < 4; i++) {
          k = Math.max(4, Math.min(SCALE.length - 1, k + [-1, 1, -2, 2, 0][Math.floor(Math.random() * 5)]));
          this.flute(out, t + i * beat * 2, SCALE[k] * 2, beat * 1.9, 0.07);
        }
      }
      this.nextBar += barLen;
      this.bar++;
    }
  }
}
