#!/usr/bin/env python3
"""Draws the example art pack in web/examples/dino-pack/: a war dinosaur in place of the war elephant.

It shows what a pack holds (see replica/art-packs.md): one sprite sheet, five directions of rows with the
other three mirrored, idle, walk and attack animations, the player's colour in magenta, and a manifest.
Everything here is drawn by this script; nothing comes from another game.

    python3 scripts/make-example-pack.py
"""
import json
import os
from PIL import Image, ImageDraw

FW, FH = 72, 60                       # one frame
ROWS = {"idle": (0, 1), "walk": (5, 4), "attack": (10, 3)}   # first row (direction S) and frames
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "examples", "dino-pack")

SKIN, SKIN_DARK, BELLY, CLAW = (92, 138, 58), (58, 92, 38), (196, 184, 120), (230, 222, 200)
SADDLE, SADDLE_DARK = (255, 0, 255), (150, 0, 150)   # magenta: the player's colour
OUTLINE, EYE = (24, 20, 12), (250, 220, 60)


def dino(d: ImageDraw.ImageDraw, ox: int, oy: int, facing: int, step: int, bite: int, view: str):
    """A dinosaur in one frame. facing -1 looks left; view is "side", "front" or "back"."""
    cx, ground = ox + FW // 2, oy + FH - 4
    f = facing
    def x(v): return cx + v * f
    # Legs, swinging with the step.
    swing = [0, 3, 0, -3][step % 4]
    for lx, s in ((-8, swing), (8, -swing)):
        d.rectangle([x(lx) - 3 + s, ground - 14, x(lx) + 3 + s, ground], fill=SKIN_DARK, outline=OUTLINE)
        d.rectangle([x(lx) - 4 + s, ground - 2, x(lx) + 5 + s, ground], fill=CLAW)
    if view == "side":
        # Tail behind, body, the long neck forward, the head with jaws that open to bite.
        d.polygon([(x(-14), ground - 22), (x(-34), ground - 30), (x(-14), ground - 14)], fill=SKIN, outline=OUTLINE)
        d.ellipse([cx - 18, ground - 34, cx + 18, ground - 10], fill=SKIN, outline=OUTLINE)
        d.ellipse([cx - 12, ground - 22, cx + 12, ground - 11], fill=BELLY)
        d.polygon([(x(10), ground - 30), (x(20), ground - 44), (x(26), ground - 42), (x(16), ground - 24)], fill=SKIN, outline=OUTLINE)
        jaw = 4 + bite * 3
        d.polygon([(x(18), ground - 48), (x(32), ground - 46), (x(32), ground - 42), (x(20), ground - 40)], fill=SKIN, outline=OUTLINE)
        d.polygon([(x(20), ground - 40), (x(31), ground - 42 + jaw), (x(21), ground - 37)], fill=SKIN_DARK, outline=OUTLINE)
        d.point([(x(24), ground - 45)], fill=EYE)
        # The war saddle, in the player's colour, with a rider's flag.
        d.rectangle([cx - 9, ground - 38, cx + 9, ground - 31], fill=SADDLE, outline=SADDLE_DARK)
        d.line([(x(-6), ground - 38), (x(-6), ground - 52)], fill=OUTLINE)
        d.polygon([(x(-6), ground - 52), (x(-14), ground - 49), (x(-6), ground - 46)], fill=SADDLE)
    else:
        # Seen from the front or the back: a round body, the neck straight up, the saddle on top.
        d.ellipse([cx - 14, ground - 34, cx + 14, ground - 10], fill=SKIN, outline=OUTLINE)
        if view == "front":
            d.ellipse([cx - 8, ground - 26, cx + 8, ground - 12], fill=BELLY)
        d.rectangle([cx - 4, ground - 50, cx + 4, ground - 30], fill=SKIN, outline=OUTLINE)
        d.ellipse([cx - 7, ground - 56 - bite, cx + 7, ground - 46], fill=SKIN, outline=OUTLINE)
        if view == "front":
            d.point([(cx - 3, ground - 52), (cx + 3, ground - 52)], fill=EYE)
        d.rectangle([cx - 10, ground - 36, cx + 10, ground - 30], fill=SADDLE, outline=SADDLE_DARK)


def main():
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.new("RGBA", (FW * 4, FH * 15), (0, 0, 0, 0))
    d = ImageDraw.Draw(sheet)
    # Directions S, SW, W, NW, N (the game mirrors SW, W, NW into SE, E, NE).
    views = [("front", -1), ("side", -1), ("side", -1), ("side", -1), ("back", -1)]
    for anim, (row0, frames) in ROWS.items():
        for di, (view, facing) in enumerate(views):
            for fr in range(frames):
                step = fr if anim == "walk" else 0
                bite = fr % 2 if anim == "attack" else 0
                dino(d, fr * FW, (row0 + di) * FH, facing, step, bite, view)
    sheet.save(os.path.join(OUT, "war_dinosaur.png"))
    spec = {
        "file": "war_dinosaur.png", "frame": [FW, FH], "anchor": [FW // 2, FH - 4], "directions": 5,
        "anims": {"idle": {"row": 0, "frames": 1}, "walk": {"row": 5, "frames": 4, "fps": 8},
                  "work": {"row": 10, "frames": 3, "fps": 6}, "attack": {"row": 10, "frames": 3, "fps": 6}},
    }
    manifest = {
        "name": "War dinosaurs (example)",
        "units": {"war_elephant": spec, "armored_elephant": spec},
        "credits": [{"what": "War dinosaur", "author": "Bronze Dawn example pack", "license": "CC0"}],
    }
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
