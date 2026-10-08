import { Application } from "pixi.js";
import { RULES } from "./core/data";
import { Game } from "./game/game";

// Bronze Dawn in the browser.   ?seed=42 plays a given map.   ?snapshot=600 fast-forwards (for screenshots).
const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed")) || Math.floor(Math.random() * 999_999) + 1;

async function boot() {
  const app = new Application();
  await app.init({ resizeTo: window, background: "#000000", antialias: false, roundPixels: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
  app.canvas.id = "game";
  document.body.prepend(app.canvas);
  const game = new Game(app, RULES, seed);
  const ff = Number(params.get("snapshot"));
  if (ff > 0) {
    game.start("normal");
    game.fastForward(ff);
    if (params.has("reveal")) game.revealMap = true;
  }
  (window as unknown as { game: Game }).game = game;
}

boot().catch((e) => {
  document.body.innerHTML = `<p style="color:#fff;padding:2em;font-family:system-ui">Bronze Dawn could not start: ${String(e)}</p>`;
});
