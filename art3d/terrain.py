# Ground tiles: 64 x 32 diamonds of grass, dirt, sand and water, with several variants of each. The game picks
# a variant per tile and samples it across the tile, so the variants share their colour and have only fine
# grain (a few pixels across) and no large shapes: tiles of any two variants meet without a seam.

import numpy as np

W, H = 65, 33
KINDS = {
    #          base colour              grain  specks (colour, share)
    "grass": ((0.36, 0.53, 0.20), 0.10, [((0.27, 0.42, 0.14), 0.16), ((0.48, 0.64, 0.26), 0.10), ((0.80, 0.74, 0.36), 0.012)]),
    "dirt": ((0.52, 0.40, 0.26), 0.09, [((0.40, 0.30, 0.19), 0.14), ((0.64, 0.52, 0.36), 0.08), ((0.58, 0.56, 0.52), 0.02)]),
    "sand": ((0.82, 0.72, 0.50), 0.06, [((0.72, 0.62, 0.42), 0.12), ((0.90, 0.82, 0.62), 0.08)]),
    "water": ((0.20, 0.38, 0.58), 0.05, [((0.16, 0.32, 0.50), 0.14), ((0.30, 0.50, 0.68), 0.06)]),
}


def blur(a, k):
    for axis in (0, 1):
        a = sum(np.roll(a, s, axis=axis) for s in range(-k, k + 1)) / (2 * k + 1)
    return a


def tile(kind, variant):
    rng = np.random.default_rng(hash((kind, variant)) & 0xFFFFFFFF)
    base, grain, specks = KINDS[kind]
    img = np.ones((H, W, 3)) * np.array(base)
    # Two scales of grain: single pixels, and clumps of two or three.
    n = rng.normal(0, 1, (H, W)) * 0.6 + blur(rng.normal(0, 1, (H, W)), 1) * 1.2
    img *= (1 + grain * n)[:, :, None]
    for color, share in specks:
        m = rng.random((H, W)) < share
        if kind in ("grass", "water"):
            # Blades of grass and glints on water run in short strokes across the screen.
            m = m | np.roll(m, 1, axis=1) & (rng.random((H, W)) < 0.6)
        img[m] = img[m] * 0.4 + np.array(color) * 0.6
    if kind == "water":
        # Ripples: short light dashes.
        for _ in range(4):
            y, x = rng.integers(2, H - 2), rng.integers(4, W - 8)
            img[y, x:x + rng.integers(3, 6)] = np.array((0.52, 0.70, 0.84))
    img = np.clip(img, 0, 1)
    # The diamond, with a pixel to spare at each edge (65 x 33).
    yy, xx = np.mgrid[0:H, 0:W]
    inside = np.abs(xx - (W - 1) / 2) / ((W - 1) / 2) + np.abs(yy - (H - 1) / 2) / ((H - 1) / 2) <= 1.0001
    out = np.zeros((H, W, 4))
    out[:, :, :3] = img
    out[:, :, 3] = inside
    return out
