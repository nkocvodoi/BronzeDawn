// Reader for Genie .drs archives (graphics.drs, sounds.drs, interfac.drs, terrain.drs, border.drs).
//
// Layout: a 64-byte header (copyright text, version, "tribe", table count, first file offset), then one
// 12-byte entry per table (extension stored reversed, offset, file count), then 12 bytes per file (id,
// offset, size).

export interface DrsFile {
  id: number;
  /** "slp", "wav", "bin" (palettes and other binary blobs) or "shp". */
  ext: string;
  data: Uint8Array;
}

export function readDrs(bytes: Uint8Array): DrsFile[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = Buffer.from(bytes.subarray(44, 56)).toString("latin1");
  if (!tag.startsWith("tribe")) throw new Error("not a .drs archive");
  const tables = view.getInt32(56, true);
  const files: DrsFile[] = [];
  for (let t = 0; t < tables; t++) {
    const at = 64 + t * 12;
    const raw = Buffer.from(bytes.subarray(at, at + 4)).toString("latin1");
    const ext = raw.split("").reverse().join("").trim().replace("bina", "bin");
    const offset = view.getInt32(at + 4, true);
    const count = view.getInt32(at + 8, true);
    for (let i = 0; i < count; i++) {
      const e = offset + i * 12;
      const id = view.getInt32(e, true);
      const start = view.getInt32(e + 4, true);
      const size = view.getInt32(e + 8, true);
      files.push({ id, ext, data: bytes.subarray(start, start + size) });
    }
  }
  return files;
}
