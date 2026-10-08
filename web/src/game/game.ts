import { Application, Container, Graphics, Matrix, Sprite, Texture } from "pixi.js";
import { AIController, Difficulty } from "../core/ai";
import { Building, Entity, ResourceNode, Unit } from "../core/entities";
import { Tile, Vec2 } from "../core/geom";
import { Terrain } from "../core/grid";
import { Res, ResBag, Rules } from "../core/rules";
import { clock } from "../core/sim";
import { World } from "../core/world";
import { buildingPic, nodePic, Pic, playerColor, terrainChunks, unitPic } from "./art";
import { Command, HUD } from "./hud";
import { depth, fromIso, HALF_H, HALF_W, iso } from "./iso";

/** The drawable side of one entity. */
interface View { root: Container; sprite: Sprite; ring: Graphics; bar: Graphics; pic: Pic; isUnit: boolean }

const BUILD_KEYS: [string, string][] = [
  ["house", "Q"], ["granary", "W"], ["storage_pit", "E"], ["barracks", "R"],
  ["farm", "A"], ["archery_range", "S"], ["stable", "D"], ["watch_tower", "F"], ["town_center", "Z"],
];

export class Game {
  world: World;
  readonly me = 0;
  started = false;
  paused = false;
  revealMap = false;

  private hud = new HUD();
  private worldLayer = new Container();
  private terrain = new Container();
  private entities = new Container();
  private effects = new Container();
  private fogSprite = new Sprite();
  private fogCanvas = document.createElement("canvas");
  private views = new Map<number, View>();
  private cam = { x: 0, y: 0, zoom: 1 };

  selection: number[] = [];
  private groups = new Map<number, number[]>();
  private placing: string | null = null;
  private ghost: Sprite | null = null;
  private attackMovePending = false;
  private dragStart: { x: number; y: number } | null = null;
  private mouse = { x: -1, y: -1, inside: false };
  private keys = new Set<string>();
  private accumulator = 0;
  private fogStamp = -1;
  private minimapStamp = -1;
  private idleIndex = 0;
  private miniBase = document.createElement("canvas");
  private dragBox = document.querySelector("#dragbox") as HTMLDivElement;

  constructor(private app: Application, private rules: Rules, seed: number) {
    this.world = new World(rules, seed, ["You", "Enemy"]);
    this.entities.sortableChildren = true;
    this.worldLayer.addChild(this.terrain, this.entities, this.effects, this.fogSprite);
    app.stage.addChild(this.worldLayer);
    this.buildWorld();
    this.bindInput();
    app.ticker.add((t) => this.frame(t.deltaMS / 1000));
    this.showStart();
  }

  // ---- setup

  private newGame(seed: number) {
    this.world = new World(this.rules, seed, ["You", "Enemy"]);
    for (const v of this.views.values()) v.root.destroy({ children: true });
    this.views.clear();
    this.selection = [];
    this.groups.clear();
    this.cancelPlacing();
    this.fogStamp = this.minimapStamp = -1;
    this.buildWorld();
  }

  private buildWorld() {
    this.terrain.removeChildren().forEach((c) => c.destroy({ texture: true }));
    for (const ch of terrainChunks(this.world.map)) {
      const s = new Sprite(ch.texture);
      s.position.set(ch.x, ch.y);
      s.width = ch.size;
      s.height = ch.size;
      this.terrain.addChild(s);
    }
    const n = this.world.map.width;
    // One extra tile of black on every side so the terrain's edge never peeks out.
    this.fogCanvas.width = n + 2;
    this.fogCanvas.height = n + 2;
    this.fogSprite.texture = Texture.from(this.fogCanvas);
    this.fogSprite.setFromMatrix(new Matrix(HALF_W, HALF_H, -HALF_W, HALF_H, 0, -2 * HALF_H));
    this.miniBase.width = n;
    this.miniBase.height = n;
    this.centerOn(this.world.startTiles[this.me].center);
  }

  private centerOn(p: Vec2) {
    const s = iso(p);
    this.cam.x = s.x;
    this.cam.y = s.y + 40 * this.cam.zoom; // keep clear of the bottom panel
    this.clampCamera();
  }

  private clampCamera() {
    const n = this.world.map.width;
    this.cam.x = Math.min(Math.max(this.cam.x, -n * HALF_W), n * HALF_W);
    this.cam.y = Math.min(Math.max(this.cam.y, -100), 2 * n * HALF_H + 100);
  }

  /** Screen pixel to world screen-space (before iso inversion). */
  private toScene(sx: number, sy: number) {
    const w = this.app.screen.width, h = this.app.screen.height;
    return { x: (sx - w / 2) * this.cam.zoom + this.cam.x, y: (sy - h / 2) * this.cam.zoom + this.cam.y };
  }

  private toWorld(sx: number, sy: number) { const p = this.toScene(sx, sy); return fromIso(p.x, p.y); }

  // ---- screens

  showStart() {
    this.started = false;
    this.hud.showOverlay("Bronze Dawn", [
      "Grow a Stone Age village, advance to the Tool Age, and destroy the enemy.",
      `<span class="choices"><button data-start="easy">1 · Easy</button><button data-start="normal">2 · Normal</button><button data-start="hard">3 · Hard</button></span>`,
      "Press ? at any time for the controls",
    ]);
  }

  start(d: Difficulty) {
    this.world.ais = [new AIController(1, d)];
    this.started = true;
    this.hud.hideOverlay();
    this.hud.message("Gather food and wood. Build houses. Good luck.");
    this.selectTownCenter();
  }

  private showHelp() {
    this.hud.showOverlay("Controls", [
      "Left click / drag: select · Shift: add · Double click: all of that kind on screen",
      "Right click: move, gather, build, attack, or set a rally point",
      "Villager build keys: Q House · W Granary · E Storage Pit · R Barracks · A Farm",
      "S Archery Range · D Stable · F Watch Tower · Z Town Center",
      "Buildings: Q W train · T advance age · X cancel · Soldiers: A attack-move · S stop",
      "H town center · . idle villager · Ctrl+1-9 save group · 1-9 recall · Delete destroy",
      "Arrows / trackpad / screen edge: scroll · Pinch or + -: zoom · P pause",
      "Press ? or Esc to close",
    ], "help");
  }

  private gameOver(winner: number) {
    const won = winner === this.me;
    const p = this.world.players[this.me].stats, e = this.world.players[1].stats;
    this.hud.showOverlay(won ? "Victory" : "Defeat", [
      `Time ${clock(this.world.time)}`,
      `You: gathered ${Math.floor(p.gathered.total)}, trained ${p.trained}, killed ${p.kills}, lost ${p.lost}`,
      `Enemy: gathered ${Math.floor(e.gathered.total)}, trained ${e.trained}, killed ${e.kills}, lost ${e.lost}`,
      `<span class="choices"><button data-restart>New map (Enter)</button></span>`,
    ], won ? "win" : "lose");
  }

  // ---- the loop

  private frame(dt: number) {
    dt = Math.min(dt, 0.25);
    this.scrollCamera(dt);
    const w = this.world;
    if (this.started && !this.paused && w.winner === null) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= World.dt && steps < 6) { w.step(); this.accumulator -= World.dt; steps++; }
      this.handleEvents();
    }
    const alpha = this.started ? Math.min(1, this.accumulator / World.dt) : 1;
    const sw = this.app.screen.width, sh = this.app.screen.height;
    this.worldLayer.scale.set(1 / this.cam.zoom);
    this.worldLayer.position.set(sw / 2 - this.cam.x / this.cam.zoom, sh / 2 - this.cam.y / this.cam.zoom);
    this.sync(alpha);
    if (w.tick !== this.fogStamp && (w.tick % 5 === 0 || this.fogStamp < 0)) { this.updateFog(); this.fogStamp = w.tick; }
    if (Math.floor(w.tick / 10) !== this.minimapStamp) { this.updateMinimap(); this.minimapStamp = Math.floor(w.tick / 10); }
    this.selection = this.selection.filter((id) => w.entity(id));
    const sel = this.selectedEntities();
    this.hud.update(w, this.me, sel);
    this.hud.setCommands(this.commands(sel));
    this.updateGhost();
  }

  private handleEvents() {
    const w = this.world;
    for (const e of w.events) {
      switch (e.kind) {
        case "projectile": {
          if (!this.visible(e.from.tile) && !this.visible(e.to.tile)) break;
          const a = iso(e.from), b = iso(e.to);
          const arrow = new Graphics().rect(-5, -0.75, 10, 1.5).fill(0x262626);
          arrow.rotation = Math.atan2(b.y - a.y, b.x - a.x);
          this.effects.addChild(arrow);
          let t = 0;
          const tick = (dt: { deltaMS: number }) => {
            t += dt.deltaMS / 1000;
            const k = Math.min(1, t / e.flight);
            arrow.position.set(a.x + (b.x - a.x) * k, a.y - 18 + (b.y - a.y + 4) * k - Math.sin(k * Math.PI) * 14);
            if (k >= 1) { this.app.ticker.remove(tick); arrow.destroy(); }
          };
          this.app.ticker.add(tick);
          break;
        }
        case "died": {
          const v = this.views.get(e.id);
          if (v) { v.root.destroy({ children: true }); this.views.delete(e.id); }
          this.selection = this.selection.filter((id) => id !== e.id);
          if (e.wasBuilding && this.explored(e.at.tile)) this.puff(e.at, true);
          else if (e.owner >= 0 && this.visible(e.at.tile)) this.puff(e.at, false);
          break;
        }
        case "message":
          if (e.player === this.me || e.player === -1) this.hud.message(e.text);
          break;
        case "underAttack":
          if (e.player === this.me && !this.onScreen(e.at)) this.hud.message("You are under attack!", "warn");
          break;
        case "ageReached":
          if (e.player !== this.me) this.hud.message(`The enemy reached the ${this.rules.ages[e.age].name}`, "warn");
          break;
        case "completed": {
          const b = e.owner === this.me ? w.building(e.id) : null;
          if (b) this.hud.message(`${b.name} complete`);
          break;
        }
        case "gameOver":
          this.gameOver(e.winner);
          break;
      }
    }
    w.events.length = 0;
  }

  private puff(at: Vec2, big: boolean) {
    const p = iso(at);
    const g = new Graphics().circle(0, 0, big ? 26 : 9).fill({ color: 0x8c7a66, alpha: 0.7 });
    g.position.set(p.x, p.y);
    this.effects.addChild(g);
    let t = 0;
    const tick = (dt: { deltaMS: number }) => {
      t += dt.deltaMS / 1000;
      g.scale.set(1 + t * 1.4);
      g.alpha = Math.max(0, 1 - t / 0.6);
      if (t >= 0.6) { this.app.ticker.remove(tick); g.destroy(); }
    };
    this.app.ticker.add(tick);
  }

  // ---- drawing entities

  private visible(t: Tile) { return this.revealMap || this.world.fog[this.me].isVisible(t); }
  private explored(t: Tile) { return this.revealMap || this.world.fog[this.me].isExplored(t); }

  private onScreen(p: Vec2) {
    const s = iso(p);
    return Math.abs(s.x - this.cam.x) < (this.app.screen.width / 2) * this.cam.zoom &&
      Math.abs(s.y - this.cam.y) < (this.app.screen.height / 2) * this.cam.zoom;
  }

  private makeView(e: Entity): View {
    let pic: Pic, ring: Graphics, barY: number, barW: number;
    const own = e.owner === this.me;
    const ringColor = own ? 0xffffff : e.owner >= 0 ? playerColor(e.owner) : 0xffee55;
    if (e instanceof Unit) {
      pic = unitPic(e.def.id, e.owner);
      const big = e.def.id === "scout";
      ring = new Graphics().ellipse(0, 0, big ? 17 : 12, big ? 8 : 6).stroke({ width: 1.5, color: ringColor });
      barY = -pic.h + 2; barW = 26;
    } else if (e instanceof Building) {
      pic = buildingPic(e.def, e.owner);
      const s = e.def.size, w = s * HALF_W, h = s * HALF_H;
      ring = new Graphics().poly([0, 0, w, -h, 0, -2 * h, -w, -h]).stroke({ width: 1.5, color: ringColor });
      barY = -pic.h + 40; barW = s * 22;
    } else {
      const r = e as ResourceNode;
      pic = nodePic(r.def.id, this.world.map.shade[this.world.map.index(r.tile)]);
      ring = new Graphics().ellipse(0, 0, 15, 7.5).stroke({ width: 1.5, color: ringColor });
      barY = -pic.h; barW = 0;
    }
    const root = new Container();
    const sprite = new Sprite(pic.texture);
    sprite.width = pic.w;
    sprite.height = pic.h;
    sprite.anchor.set(pic.ax, pic.ay);
    const bar = new Graphics();
    bar.position.set(-barW / 2, barY);
    (bar as Graphics & { barW: number }).barW = barW;
    ring.visible = false;
    bar.visible = false;
    root.addChild(ring, sprite, bar);
    this.entities.addChild(root);
    const v = { root, sprite, ring, bar, pic, isUnit: e instanceof Unit };
    this.views.set(e.id, v);
    return v;
  }

  private place(v: View, e: Entity, alpha: number) {
    const time = this.world.time;
    if (e instanceof Unit) {
      const p = e.prevPos.lerp(e.pos, alpha);
      const s = iso(p);
      v.root.position.set(s.x, s.y);
      v.root.zIndex = depth(p) + 0.3;
      const dx = e.facing.x - e.facing.y;
      if (Math.abs(dx) > 0.2) v.sprite.scale.x = Math.abs(v.sprite.scale.x) * (dx < 0 ? -1 : 1);
      const moving = e.prevPos.distance(e.pos) > 0.001;
      if (moving || e.busy) {
        const phase = time * (e.busy ? 10 : 14) + e.id;
        v.sprite.y = -Math.abs(Math.sin(phase)) * (e.busy ? 2 : 2.5);
        v.sprite.rotation = e.busy ? Math.sin(time * 10 + e.id) * 0.08 : 0;
      } else { v.sprite.y = 0; v.sprite.rotation = 0; }
    } else if (e instanceof Building) {
      const fp = e.footprint;
      const s = iso(new Vec2(fp.maxX, fp.maxY));
      v.root.position.set(s.x, s.y);
      v.root.zIndex = depth(fp.center);
      v.sprite.alpha = e.complete ? 1 : 0.35 + 0.55 * e.progress;
    } else if (e instanceof ResourceNode) {
      const s = iso(e.center);
      v.root.position.set(s.x, s.y);
      v.root.zIndex = depth(e.center);
    }
  }

  private sync(alpha: number) {
    const selected = new Set(this.selection);
    const show = (e: Entity, vis: boolean) => {
      let v = this.views.get(e.id);
      if (!vis) { if (v) v.root.visible = false; return; }
      if (!v) v = this.makeView(e);
      v.root.visible = true;
      this.place(v, e, alpha);
      const sel = selected.has(e.id);
      v.ring.visible = sel;
      const bw = (v.bar as Graphics & { barW: number }).barW;
      v.bar.visible = sel && bw > 0;
      if (v.bar.visible) {
        const f = Math.max(0, e.hp / e.maxHp);
        v.bar.clear().rect(0, 0, bw, 4).fill(0x000000).rect(0, 0, bw * f, 4).fill(f > 0.5 ? 0x33cc33 : f > 0.25 ? 0xdddd33 : 0xdd3333);
      }
    };
    const w = this.world;
    for (const u of w.units) show(u, u.owner === this.me || this.visible(u.pos.tile));
    for (const b of w.buildings) show(b, b.owner === this.me || this.explored(b.footprint.origin));
    for (const n of w.nodes) show(n, this.explored(n.tile));
  }

  // ---- fog and minimap

  private updateFog() {
    const f = this.world.fog[this.me];
    const n = f.width, m = n + 2;
    const c = this.fogCanvas.getContext("2d")!;
    const img = c.createImageData(m, m);
    img.data.fill(255);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        img.data[((y + 1) * m + x + 1) * 4 + 3] = this.revealMap ? 0 : f.visible[i] ? 0 : f.explored[i] ? 110 : 255;
      }
    }
    for (let i = 0; i < m * m; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 0; }
    c.putImageData(img, 0, 0);
    this.fogSprite.texture.source.update();
  }

  private updateMinimap() {
    const w = this.world, map = w.map, n = map.width, f = w.fog[this.me];
    const bc = this.miniBase.getContext("2d")!;
    const img = bc.createImageData(n, n);
    const put = (x: number, y: number, c: [number, number, number]) => {
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      const i = (y * n + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    };
    const hex = (h: string): [number, number, number] => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (!this.revealMap && !f.explored[i]) { put(x, y, [0, 0, 0]); continue; }
        let c: [number, number, number];
        switch (map.terrain[i] as Terrain) {
          case Terrain.grass: c = [78, 120, 52]; break;
          case Terrain.dirt: c = [130, 106, 66]; break;
          case Terrain.sand: c = [196, 176, 118]; break;
          default: c = [42, 88, 156];
        }
        if (!this.revealMap && !f.visible[i]) c = [c[0] / 2 + 10, c[1] / 2 + 10, c[2] / 2 + 10];
        put(x, y, c);
      }
    }
    const nodeColor: Record<Res, [number, number, number]> = { [Res.wood]: [28, 70, 30], [Res.food]: [200, 60, 80], [Res.gold]: [240, 200, 60], [Res.stone]: [170, 170, 175] };
    for (const r of w.nodes) if (this.explored(r.tile)) put(r.tile.x, r.tile.y, nodeColor[r.res]);
    for (const b of w.buildings) {
      if (b.owner !== this.me && !this.explored(b.footprint.origin)) continue;
      for (const t of b.footprint.tiles()) put(t.x, t.y, hex(playerColor(b.owner)));
    }
    for (const u of w.units) {
      if (u.owner !== this.me && !this.visible(u.pos.tile)) continue;
      const t = u.pos.tile;
      put(t.x, t.y, hex(playerColor(u.owner)));
      put(t.x + 1, t.y, hex(playerColor(u.owner)));
    }
    bc.putImageData(img, 0, 0);

    const mm = this.hud.minimap, c = mm.getContext("2d")!;
    const k = this.miniScale();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, mm.width, mm.height);
    c.imageSmoothingEnabled = false;
    c.setTransform(k * HALF_W, k * HALF_H, -k * HALF_W, k * HALF_H, mm.width / 2, (mm.height - n * 2 * HALF_H * k) / 2);
    c.drawImage(this.miniBase, 0, 0);
    // The camera's view.
    const sw = this.app.screen.width, sh = this.app.screen.height;
    const corners = [[0, 0], [sw, 0], [sw, sh], [0, sh]].map(([x, y]) => this.toWorld(x, y));
    c.strokeStyle = "white";
    c.lineWidth = 1 / (k * HALF_H);
    c.beginPath();
    corners.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.stroke();
  }

  private miniScale() {
    const mm = this.hud.minimap, n = this.world.map.width;
    return Math.min(mm.width / (n * 2 * HALF_W), mm.height / (n * 2 * HALF_H));
  }

  /** Minimap pixel to tile coordinates, or null outside the map. */
  private minimapToWorld(ev: MouseEvent): Vec2 | null {
    const mm = this.hud.minimap, rect = mm.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * mm.width;
    const py = ((ev.clientY - rect.top) / rect.height) * mm.height;
    const n = this.world.map.width, k = this.miniScale();
    const sx = (px - mm.width / 2) / k, sy = (py - (mm.height - n * 2 * HALF_H * k) / 2) / k;
    const p = fromIso(sx, sy);
    return p.x >= 0 && p.y >= 0 && p.x <= n && p.y <= n ? p : null;
  }

  // ---- commands

  selectedEntities() { return this.selection.map((id) => this.world.entity(id)).filter((e): e is Entity => e !== null); }

  private commands(sel: Entity[]): Command[] {
    const w = this.world, me = this.me;
    const mine = sel.filter((e) => e.owner === me);
    if (!mine.length || w.winner !== null) return [];
    const units = mine.filter((e): e is Unit => e instanceof Unit);
    if (units.some((u) => u.isVillager)) {
      const out: Command[] = [];
      for (const [id, key] of BUILD_KEYS) {
        const def = this.rules.buildings.get(id);
        if (def) out.push({ key, title: def.name, detail: this.rules.buildingCost(id).text, blocker: w.blockerBuilding(id, me), action: () => this.beginPlacing(id) });
      }
      out.push({ key: "X", title: "Stop", detail: "", blocker: null, action: () => w.stop(me, this.selection) });
      return out;
    }
    if (units.length) {
      return [
        { key: "A", title: "Attack-move", detail: "click a point", blocker: null, action: () => { this.attackMovePending = true; this.hud.message("Click where to attack-move"); } },
        { key: "S", title: "Stop", detail: "", blocker: null, action: () => w.stop(me, this.selection) },
      ];
    }
    const b = mine[0];
    if (mine.length !== 1 || !(b instanceof Building) || !b.complete) return [];
    const out: Command[] = [];
    (b.def.trains ?? []).forEach((t, i) => {
      const def = this.rules.units.get(t);
      if (!def) return;
      out.push({ key: "QWER"[Math.min(i, 3)], title: def.name, detail: this.rules.unitCost(t).text, blocker: w.blockerUnit(t, me), action: () => {
        const why = w.train(me, b.id, t);
        if (why) this.hud.message(why, "warn");
      } });
    });
    const p = w.players[me];
    if (b.def.id === "town_center" && p.age + 1 < this.rules.ages.length) {
      const next = this.rules.ages[p.age + 1];
      out.push({ key: "T", title: `Advance: ${next.name}`, detail: ResBag.of(next.cost).text, blocker: w.blockerForNextAge(me), action: () => {
        const why = w.advanceAge(me, b.id);
        if (why) this.hud.message(why, "warn");
      } });
    }
    if (b.queue.length || b.researching !== null) {
      out.push({ key: "X", title: "Cancel", detail: "refund", blocker: null, action: () => w.cancel(me, b.id) });
    }
    return out;
  }

  private selectTownCenter() {
    const tc = this.world.buildingsOf(this.me).find((b) => b.def.id === "town_center");
    if (tc) { this.selection = [tc.id]; this.centerOn(tc.center); }
  }

  private beginPlacing(type: string) {
    const why = this.world.blockerBuilding(type, this.me);
    if (why) { this.hud.message(why, "warn"); return; }
    this.cancelPlacing();
    this.placing = type;
    const pic = buildingPic(this.rules.buildings.get(type)!, this.me);
    const g = new Sprite(pic.texture);
    g.width = pic.w; g.height = pic.h;
    g.anchor.set(pic.ax, pic.ay);
    g.alpha = 0.6;
    g.zIndex = 100000;
    this.entities.addChild(g);
    this.ghost = g;
  }

  private cancelPlacing() {
    this.placing = null;
    this.ghost?.destroy();
    this.ghost = null;
  }

  private placementOrigin(type: string, sx: number, sy: number) {
    const size = this.rules.buildings.get(type)!.size;
    const w = this.toWorld(sx, sy);
    return new Vec2(w.x - size / 2 + 0.5, w.y - size / 2 + 0.5).tile;
  }

  private updateGhost() {
    if (!this.placing || !this.ghost) return;
    const o = this.placementOrigin(this.placing, this.mouse.x, this.mouse.y);
    const size = this.rules.buildings.get(this.placing)!.size;
    const s = iso(new Vec2(o.x + size, o.y + size));
    this.ghost.position.set(s.x, s.y);
    this.ghost.tint = this.world.canPlace(this.placing, o, this.me) ? 0xbbffbb : 0xff5555;
  }

  // ---- picking

  /** The entity drawn under a screen point. Units win over what is behind them. */
  private pick(sx: number, sy: number): Entity | null {
    const p = this.toScene(sx, sy);
    const wp = fromIso(p.x, p.y);
    let best: Entity | null = null, bestScore = -Infinity;
    for (const [id, v] of this.views) {
      if (!v.root.visible) continue;
      const e = this.world.entity(id);
      if (!e) continue;
      const x0 = v.root.x - v.pic.ax * v.pic.w, y0 = v.root.y + v.sprite.y - v.pic.ay * v.pic.h;
      const inX = (k: number) => p.x >= x0 + v.pic.w * k && p.x <= x0 + v.pic.w * (1 - k);
      const inY = p.y >= y0 + v.pic.h * 0.05 && p.y <= y0 + v.pic.h;
      if (e instanceof Building) {
        if (!(e.footprint.distance(wp) === 0 || (inX(0.15) && inY))) continue;
      } else if (!(inX(0.12) && inY)) continue;
      const score = v.root.zIndex + (e instanceof Unit ? 1000 : 0);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  // ---- input

  private bindInput() {
    const canvas = this.app.canvas;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const s = t.closest("[data-start]") as HTMLElement | null;
      if (s) this.start(s.dataset.start as Difficulty);
      if (t.closest("[data-restart]")) this.restart();
    });
    window.addEventListener("mousemove", (e) => {
      this.mouse = { x: e.clientX, y: e.clientY, inside: true };
      if (this.dragStart) {
        const a = this.dragStart;
        const r = { x: Math.min(a.x, e.clientX), y: Math.min(a.y, e.clientY), w: Math.abs(a.x - e.clientX), h: Math.abs(a.y - e.clientY) };
        Object.assign(this.dragBox.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
        this.dragBox.hidden = r.w < 4 && r.h < 4;
      }
    });
    document.addEventListener("mouseleave", () => { this.mouse.inside = false; });
    canvas.addEventListener("mousedown", (e) => this.mouseDown(e));
    window.addEventListener("mouseup", (e) => this.mouseUp(e));
    const mm = this.hud.minimap;
    const miniMove = (e: MouseEvent) => {
      const p = this.minimapToWorld(e);
      if (!p) return;
      if (e.button === 2) this.world.smart(this.me, this.selection, null, p);
      else this.centerOn(p);
    };
    mm.addEventListener("mousedown", (e) => { e.preventDefault(); miniMove(e); });
    mm.addEventListener("mousemove", (e) => { if (e.buttons & 1) miniMove(e); });
    mm.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey) this.zoom(1 + e.deltaY * 0.01);           // trackpad pinch
      else { this.cam.x += e.deltaX * this.cam.zoom; this.cam.y += e.deltaY * this.cam.zoom; this.clampCamera(); }
    }, { passive: false });
    window.addEventListener("keydown", (e) => this.keyDown(e));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key));
    window.addEventListener("blur", () => this.keys.clear());
  }

  private restart() {
    this.newGame(Math.floor(Math.random() * 999_999) + 1);
    this.showStart();
  }

  private mouseDown(e: MouseEvent) {
    if (!this.started || this.hud.overlayShown) return;
    if (e.button === 2) { this.rightClick(e); return; }
    if (e.button !== 0) return;
    if (this.placing) {
      const o = this.placementOrigin(this.placing, e.clientX, e.clientY);
      const builders = this.selectedEntities().filter((x): x is Unit => x instanceof Unit && x.isVillager && x.owner === this.me).map((u) => u.id);
      const r = this.world.place(this.me, this.placing, o, builders);
      if ("error" in r) this.hud.message(r.error, "warn");
      else if (!e.shiftKey) this.cancelPlacing();
      return;
    }
    if (this.attackMovePending) {
      this.attackMovePending = false;
      this.world.move(this.me, this.selection, this.toWorld(e.clientX, e.clientY), true);
      this.marker(e.clientX, e.clientY, 0xff3333);
      return;
    }
    this.dragStart = { x: e.clientX, y: e.clientY };
  }

  private mouseUp(e: MouseEvent) {
    const a = this.dragStart;
    if (!a || e.button !== 0) return;
    this.dragStart = null;
    this.dragBox.hidden = true;
    const w = this.world, me = this.me;
    if (Math.hypot(a.x - e.clientX, a.y - e.clientY) < 6) {
      const hit = this.pick(e.clientX, e.clientY);
      if (!hit) { if (!e.shiftKey) this.selection = []; return; }
      if (e.detail >= 2 && hit.owner === me) {
        this.selection = [...this.views.keys()].filter((id) => {
          const o = w.entity(id);
          return !!o && o.owner === me && o.typeId === hit.typeId && this.onScreen(o.center);
        });
        return;
      }
      if (e.shiftKey && hit.owner === me) {
        const i = this.selection.indexOf(hit.id);
        if (i >= 0) this.selection.splice(i, 1); else this.selection.push(hit.id);
      } else this.selection = [hit.id];
      return;
    }
    const p0 = this.toScene(Math.min(a.x, e.clientX), Math.min(a.y, e.clientY));
    const p1 = this.toScene(Math.max(a.x, e.clientX), Math.max(a.y, e.clientY));
    const inside = w.unitsOf(me).filter((u) => {
      const s = iso(u.pos);
      return s.x >= p0.x && s.x <= p1.x && s.y >= p0.y && s.y <= p1.y;
    }).map((u) => u.id);
    if (!inside.length) { if (!e.shiftKey) this.selection = []; return; }
    this.selection = e.shiftKey ? [...new Set([...this.selection, ...inside])] : inside;
  }

  private rightClick(e: MouseEvent) {
    if (this.world.winner !== null) return;
    if (this.placing) { this.cancelPlacing(); return; }
    this.attackMovePending = false;
    const at = this.toWorld(e.clientX, e.clientY);
    const sel = this.selectedEntities().filter((x) => x.owner === this.me);
    if (sel.length === 1 && sel[0] instanceof Building) {
      this.world.setRally(this.me, sel[0].id, at);
      this.marker(e.clientX, e.clientY, playerColor(this.me));
      return;
    }
    const target = this.pick(e.clientX, e.clientY);
    const r = this.world.smart(this.me, this.selection, target?.id ?? null, at);
    if (r === "attacked") this.marker(e.clientX, e.clientY, 0xff3333);
    else if (r !== "nothing") this.marker(e.clientX, e.clientY, 0x33ff66);
  }

  private marker(sx: number, sy: number, color: number | string) {
    const p = this.toScene(sx, sy);
    const g = new Graphics().ellipse(0, 0, 13, 6.5).stroke({ width: 2, color });
    g.position.set(p.x, p.y);
    this.effects.addChild(g);
    let t = 0;
    const tick = (dt: { deltaMS: number }) => {
      t += dt.deltaMS / 1000;
      g.scale.set(Math.max(0.3, 1 - t * 1.75));
      g.alpha = Math.max(0, 1 - t / 0.4);
      if (t >= 0.4) { this.app.ticker.remove(tick); g.destroy(); }
    };
    this.app.ticker.add(tick);
  }

  private zoom(k: number) {
    this.cam.zoom = Math.min(2.2, Math.max(0.6, this.cam.zoom * k));
    this.clampCamera();
  }

  private keyDown(e: KeyboardEvent) {
    const key = e.key;
    if (key.startsWith("Arrow")) { this.keys.add(key); e.preventDefault(); return; }
    const ch = key.length === 1 ? key.toUpperCase() : key;
    if (!this.started) {
      const d = ({ "1": "easy", "2": "normal", "3": "hard" } as Record<string, Difficulty>)[ch];
      if (d) this.start(d);
      return;
    }
    if (this.world.winner !== null) { if (key === "Enter") this.restart(); return; }
    if (key === "?" || key === "F1") {
      e.preventDefault();
      if (this.hud.overlayShown) { this.hud.hideOverlay(); this.paused = false; } else { this.showHelp(); this.paused = true; }
      return;
    }
    if (key === "Escape") {
      if (this.hud.overlayShown) { this.hud.hideOverlay(); this.paused = false; return; }
      if (this.placing) this.cancelPlacing(); else if (this.attackMovePending) this.attackMovePending = false; else this.selection = [];
      return;
    }
    if (this.hud.overlayShown) return;
    if (key === "Delete" || key === "Backspace") { for (const id of this.selection) this.world.destroy(this.me, id); return; }
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) {
      const d = Number(digit[1]);
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
        this.groups.set(d, [...this.selection]);
        this.hud.message(`Group ${d} saved`);
      } else {
        const g = (this.groups.get(d) ?? []).filter((id) => this.world.entity(id));
        if (g.length && g.join() === this.selection.join()) this.centerOn(this.world.entity(g[0])!.center);
        this.selection = g;
      }
      return;
    }
    if (e.metaKey || e.ctrlKey) return; // leave browser shortcuts alone
    switch (ch) {
      case "H": this.selectTownCenter(); return;
      case ".": this.selectIdleVillager(); return;
      case "P": this.paused = !this.paused; this.hud.message(this.paused ? "Paused (P to resume)" : "Resumed"); return;
      case "+": case "=": this.zoom(0.85); return;
      case "-": this.zoom(1.15); return;
      case "`": this.revealMap = !this.revealMap; this.fogStamp = -1; return; // debugging aid
    }
    // Rebuild the commands now: the selection may have changed since the last frame.
    this.hud.setCommands(this.commands(this.selectedEntities()));
    this.hud.run(this.hud.commands.find((c) => c.key === ch));
  }

  private selectIdleVillager() {
    const idle = this.world.unitsOf(this.me).filter((u) => u.isVillager && u.order.kind === "idle");
    if (!idle.length) { this.hud.message("No idle villagers"); return; }
    this.idleIndex = (this.idleIndex + 1) % idle.length;
    this.selection = [idle[this.idleIndex].id];
    this.centerOn(idle[this.idleIndex].pos);
  }

  private scrollCamera(dt: number) {
    let dx = 0, dy = 0;
    if (this.keys.has("ArrowLeft")) dx--;
    if (this.keys.has("ArrowRight")) dx++;
    if (this.keys.has("ArrowUp")) dy--;
    if (this.keys.has("ArrowDown")) dy++;
    const m = this.mouse, edge = 6, sw = window.innerWidth, sh = window.innerHeight;
    if (m.inside && !this.dragStart && document.hasFocus() && this.started) {
      if (m.x <= edge) dx--;
      if (m.x >= sw - edge) dx++;
      if (m.y <= edge) dy--;
      if (m.y >= sh - edge) dy++;
    }
    if (dx || dy) {
      const speed = 900 * dt * this.cam.zoom;
      this.cam.x += dx * speed;
      this.cam.y += dy * speed;
      this.clampCamera();
    }
  }

  // ---- for the snapshot and smoke tests

  /** Where a world point is on screen, in CSS pixels. */
  screenOf(p: Vec2) {
    const s = iso(p);
    return { x: (s.x - this.cam.x) / this.cam.zoom + this.app.screen.width / 2, y: (s.y - this.cam.y) / this.cam.zoom + this.app.screen.height / 2 };
  }

  look(p: Vec2) { this.centerOn(p); }

  /** Fast-forwards with an AI on both sides. */
  fastForward(seconds: number) {
    this.world.ais.push(new AIController(this.me, "normal"));
    for (let i = 0; i < seconds / World.dt; i++) this.world.step();
    this.world.events.length = 0;
  }
}
