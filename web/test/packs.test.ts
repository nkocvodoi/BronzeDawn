import { describe, expect, it } from "vitest";
import { manifestFiles, mapFiles, zipFiles } from "../src/game/packs";
import type { Manifest } from "../src/game/assets";

/** A small zip, written here: one stored entry and one deflated (CRCs are not checked by the reader). */
async function zipOf(entries: { name: string; text: string; deflate: boolean }[]): Promise<Blob> {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const raw = enc.encode(e.text);
    const data = e.deflate
      ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer())
      : raw;
    const name = enc.encode(e.name);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(8, e.deflate ? 8 : 0, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, name.length, true);
    locals.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(10, e.deflate ? 8 : 0, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, a) => n + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...locals, ...central, new Uint8Array(end.buffer)] as BlobPart[]);
}

describe("art packs", () => {
  const m: Manifest = {
    units: { war_elephant: { file: "dino.png", frame: [72, 60], anchor: [36, 56], directions: 5, anims: { idle: { row: 0, frames: 1 } } } },
    buildings: { house: { greek: { tool: { file: "b/house.png" } }, default: { file: "b/any.png" } } },
    resources: { tree: [{ file: "t1.png" }, { file: "t2.png" }] },
    terrain: { grass: ["g1.png", "g2.png"] },
    icons: { villager: "i/v.png" },
    sfx: { roar: ["s/roar.ogg"] },
    music: ["m/1.ogg"],
  };

  it("finds every file a manifest names, and renames them all for a pack", () => {
    expect(manifestFiles(m).sort()).toEqual(["b/any.png", "b/house.png", "dino.png", "g1.png", "g2.png", "i/v.png", "m/1.ogg", "s/roar.ogg", "t1.png", "t2.png"]);
    const renamed = mapFiles(m, (f) => `pack/x/${f}`);
    expect(manifestFiles(renamed).every((f) => f.startsWith("pack/x/"))).toBe(true);
    expect(renamed.units!.war_elephant.frame).toEqual([72, 60]); // the rest is left as it was
    expect(manifestFiles(m)).not.toContain("pack/x/dino.png"); // the original is untouched
  });

  it("reads a zip, stored and deflated entries alike", async () => {
    const zip = await zipOf([
      { name: "dino-pack/manifest.json", text: JSON.stringify({ name: "Dinos" }), deflate: false },
      { name: "dino-pack/notes.txt", text: "roar ".repeat(50), deflate: true },
    ]);
    const files = await zipFiles(zip);
    expect(files.map((f) => f.path)).toEqual(["dino-pack/manifest.json", "dino-pack/notes.txt"]);
    expect(JSON.parse(await files[0].data.text()).name).toBe("Dinos");
    expect(await files[1].data.text()).toBe("roar ".repeat(50));
    await expect(zipFiles(new Blob(["not a zip"]))).rejects.toThrow("not a zip");
  });
});
