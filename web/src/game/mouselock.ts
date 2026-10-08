// Keeps the mouse inside the game, as a desktop RTS does in a window: once you click into the
// game the pointer cannot leave it, so scrolling at the screen's edge never overshoots. Alt+Tab,
// Esc or opening a menu lets go; the next click on the map takes it again.
//
// Browsers do this with Pointer Lock, which hides the real pointer and reports only how far the
// mouse moved. So this draws its own pointer, keeps its position, and replays every click, wheel
// and move as an ordinary mouse event on whatever is under it. The rest of the game cannot tell.

import { CursorKind, cursorArt } from "./cursors";

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

export class MouseLock {
  /** Whether the player wants the mouse kept in the game. On by default, as in most RTS games. */
  wanted = store.get("bd-mouselock") !== "off";
  x = 0;
  y = 0;
  private img = document.createElement("img");
  private kind: CursorKind = "arrow";
  private hover: Element | null = null;
  private hoverChain: Element[] = []; // the element under the pointer and its parents
  private down: Element | null = null;
  private buttons = 0;
  private clicks = { n: 0, t: 0, x: 0, y: 0 };

  constructor(private onChange: (locked: boolean) => void) {
    this.img.id = "soft-cursor";
    this.img.alt = "";
    this.img.hidden = true;
    document.body.appendChild(this.img);
    this.show("arrow");
    document.addEventListener("pointerlockchange", () => {
      const on = this.locked;
      this.img.hidden = !on;
      if (!on) this.setHover(null);
      document.body.classList.toggle("mouse-locked", on);
      this.onChange(on);
    });
    // Runs before everything else: real events from a locked mouse are swallowed and replayed.
    for (const type of ["mousemove", "mousedown", "mouseup", "click", "dblclick", "contextmenu", "wheel", "pointerdown", "pointerup", "pointermove"]) {
      window.addEventListener(type, (e) => this.intercept(e as MouseEvent), { capture: true, passive: false });
    }
  }

  get locked() { return document.pointerLockElement === document.body; }

  /** Takes the mouse, starting where the real pointer is now. Needs a click: browsers allow it only then. */
  lock(x: number, y: number) {
    if (!this.wanted || this.locked) return;
    this.x = x; this.y = y;
    this.place();
    try {
      const p = document.body.requestPointerLock() as unknown as Promise<void> | undefined;
      // Refused right after the player pressed Esc, for a second or so: the next click tries again.
      p?.catch?.(() => {});
    } catch { /* not supported */ }
  }

  unlock() { if (this.locked) document.exitPointerLock(); }

  toggle() {
    this.wanted = !this.wanted;
    store.set("bd-mouselock", this.wanted ? "on" : "off");
    if (!this.wanted) this.unlock();
    return this.wanted;
  }

  /** Which pointer to draw: the game's choice over the map, the arrow over the panels. */
  show(kind: CursorKind) {
    if (kind === this.kind && this.img.src) return;
    this.kind = kind;
    const a = cursorArt()[kind];
    this.img.src = a.url;
    this.img.style.marginLeft = `${-a.hot[0]}px`;
    this.img.style.marginTop = `${-a.hot[1]}px`;
  }

  private place() {
    this.img.style.transform = `translate(${this.x}px, ${this.y}px)`;
  }

  private target(): Element {
    return document.elementFromPoint(this.x, this.y) ?? document.body;
  }

  /** Mouse leave and enter as the pointer crosses elements, so tooltips and hover styles follow it. */
  private setHover(el: Element | null) {
    if (el === this.hover) return;
    // The chain is kept from when the pointer arrived: a button redrawn under it has no parents left.
    const prev = this.hoverChain;
    this.hover = el;
    this.hoverChain = [];
    for (let n = el; n; n = n.parentElement) this.hoverChain.push(n);
    document.querySelectorAll(".vhover").forEach((n) => n.classList.remove("vhover"));
    el?.closest("button")?.classList.add("vhover");
    for (const n of prev) {
      if (el && n.contains(el)) break;
      n.dispatchEvent(new MouseEvent("mouseleave", this.init({ bubbles: false })));
    }
  }

  private init(extra: MouseEventInit = {}): MouseEventInit {
    return { clientX: this.x, clientY: this.y, screenX: this.x, screenY: this.y, buttons: this.buttons, bubbles: true, cancelable: true, view: window, ...extra };
  }

  private intercept(e: MouseEvent) {
    if (!this.locked || !e.isTrusted) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const mods = { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey };
    switch (e.type) {
      case "mousemove": {
        this.x = Math.min(window.innerWidth - 1, Math.max(0, this.x + e.movementX));
        this.y = Math.min(window.innerHeight - 1, Math.max(0, this.y + e.movementY));
        this.place();
        const t = this.target();
        this.setHover(t);
        t.dispatchEvent(new MouseEvent("mousemove", this.init(mods)));
        break;
      }
      case "mousedown": {
        this.buttons = e.buttons;
        const t = this.target();
        this.down = t;
        // Count quick clicks in one spot, for double-click selection.
        const now = performance.now(), c = this.clicks;
        c.n = now - c.t < 400 && Math.hypot(this.x - c.x, this.y - c.y) < 6 ? c.n + 1 : 1;
        c.t = now; c.x = this.x; c.y = this.y;
        t.dispatchEvent(new MouseEvent("mousedown", this.init({ ...mods, button: e.button, detail: c.n })));
        if (e.button === 2) t.dispatchEvent(new MouseEvent("contextmenu", this.init({ ...mods, button: 2 })));
        break;
      }
      case "mouseup": {
        this.buttons = e.buttons;
        const t = this.target();
        t.dispatchEvent(new MouseEvent("mouseup", this.init({ ...mods, button: e.button, detail: this.clicks.n })));
        // A click lands on what was both pressed and released, as a real one does.
        const d = this.down;
        this.down = null;
        if (e.button === 0 && d && (d === t || d.contains(t))) {
          (t instanceof HTMLElement && t.closest("button") ? t.closest("button")! : t)
            .dispatchEvent(new MouseEvent("click", this.init({ ...mods, button: 0, detail: this.clicks.n })));
        }
        break;
      }
      case "wheel": {
        const w = e as WheelEvent;
        this.target().dispatchEvent(new WheelEvent("wheel", { ...this.init(mods), deltaX: w.deltaX, deltaY: w.deltaY, deltaMode: w.deltaMode }));
        break;
      }
      // click, dblclick, contextmenu and pointer events are made above, from mousedown and mouseup.
    }
  }
}
