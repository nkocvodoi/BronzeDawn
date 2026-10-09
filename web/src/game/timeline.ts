// The Timeline, as the original's end screen draws it: one band a player across the game, as thick as
// their share of all the score at that moment, with the moments that mattered marked on it.
import { scores } from "../core/score";
import { clock } from "../core/sim";
import type { World } from "../core/world";
import { playerColor } from "./art";

const MARK: Record<string, string> = { "1": "T", "2": "B", "3": "I", wonder: "W", defeated: "✕" };
const MARK_TITLE: Record<string, string> = { "1": "Tool Age", "2": "Bronze Age", "3": "Iron Age", wonder: "Wonder built", defeated: "defeated" };

/** Fills a canvas with the Timeline of a world so far, and lets the pointer read the scores at a moment. */
export function drawTimeline(canvas: HTMLCanvasElement, readout: HTMLElement, w: World) {
  const points = [...w.history];
  if (!points.length || points[points.length - 1].t < w.time) points.push({ t: w.time, totals: scores(w).map((s) => s.total) });
  if (points[0].t > 0) points.unshift({ t: 0, totals: w.players.map(() => 0) });
  const end = Math.max(60, points[points.length - 1].t);
  const outAt = w.players.map((p) => w.milestones.find((m) => m.kind === "defeated" && m.player === p.id)?.t ?? Infinity);

  // Each player's share at each point; a player out of the game has none from then on.
  const shares = points.map((pt) => {
    const v = pt.totals.map((x, i) => (pt.t >= outAt[i] ? 0 : Math.max(0, x)));
    const sum = v.reduce((a, b) => a + b, 0);
    const alive = v.map((_, i) => pt.t < outAt[i]);
    const n = alive.filter(Boolean).length || 1;
    return sum > 0 ? v.map((x) => x / sum) : alive.map((a) => (a ? 1 / n : 0));
  });

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 640, cssH = canvas.clientHeight || 260;
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const L = 8, R = 8, T = 8, B = 22, W = cssW - L - R, H = cssH - T - B;
  const x = (t: number) => L + (t / end) * W;
  /** Top and bottom of a player's band at point k, from the top of the chart. */
  const band = (k: number, i: number) => {
    let top = 0;
    for (let j = 0; j < i; j++) top += shares[k][j];
    return [T + top * H, T + (top + shares[k][i]) * H];
  };

  const draw = (hover: number | null) => {
    g.clearRect(0, 0, cssW, cssH);
    g.fillStyle = "#1a140c"; g.fillRect(L, T, W, H);
    w.players.forEach((p, i) => {
      g.beginPath();
      points.forEach((pt, k) => { const [y0] = band(k, i); if (k === 0) g.moveTo(x(pt.t), y0); else g.lineTo(x(pt.t), y0); });
      for (let k = points.length - 1; k >= 0; k--) g.lineTo(x(points[k].t), band(k, i)[1]);
      g.closePath();
      g.fillStyle = playerColor(p.id); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = 1; g.stroke();
    });
    // Minutes along the bottom.
    const step = end <= 20 * 60 ? 120 : end <= 60 * 60 ? 300 : 600;
    g.fillStyle = "#e8dcc0"; g.font = "11px system-ui, sans-serif"; g.textAlign = "center";
    for (let t = 0; t <= end; t += step) {
      g.fillRect(Math.round(x(t)), T + H, 1, 4);
      // The labels at the ends stay inside the chart.
      g.textAlign = t === 0 ? "left" : x(t) > cssW - 24 ? "right" : "center";
      g.fillText(clock(t), x(t), T + H + 15);
    }
    // The milestones, on the band of the player they belong to.
    g.font = "bold 10px system-ui, sans-serif"; g.textAlign = "center";
    for (const m of w.milestones) {
      const k = Math.max(0, points.findIndex((pt) => pt.t >= m.t));
      const [y0, y1] = band(m.kind === "defeated" ? Math.max(0, k - 1) : k, m.player);
      const cx = x(m.t), cy = Math.min(T + H - 7, Math.max(T + 7, (y0 + y1) / 2));
      g.beginPath(); g.arc(cx, cy, 6.5, 0, Math.PI * 2);
      g.fillStyle = "#000"; g.fill(); g.strokeStyle = playerColor(m.player); g.lineWidth = 1.5; g.stroke();
      g.fillStyle = "#fff"; g.fillText(MARK[m.kind === "age" ? String(m.age) : m.kind] ?? "?", cx, cy + 3.5);
    }
    if (hover !== null) {
      g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(Math.round(x(points[hover].t)), T, 1, H);
    }
  };

  const read = (k: number) => {
    const pt = points[k];
    const lines = w.players.map((p, i) => `<span style="color:${playerColor(p.id)}">${p.name}</span> ${pt.t >= outAt[i] ? "out" : Math.max(0, pt.totals[i])}`);
    const near = w.milestones.filter((m) => Math.abs(m.t - pt.t) <= 30)
      .map((m) => `${w.players[m.player].name}: ${MARK_TITLE[m.kind === "age" ? String(m.age) : m.kind]}`);
    readout.innerHTML = `<b>${clock(pt.t)}</b> · ${lines.join(" · ")}${near.length ? `<br>${near.join(" · ")}` : ""}`;
  };

  draw(null);
  read(points.length - 1);
  canvas.onmousemove = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = ((e.clientX - r.left - L) / W) * end;
    let k = 0;
    for (let i = 0; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[k].t - t)) k = i;
    draw(k); read(k);
  };
  canvas.onmouseleave = () => { draw(null); read(points.length - 1); };
}
