// Reads the string table (RT_STRING resources) of a Windows PE file such as language.dll / languagex.dll.
// empires.dat refers to display names and help text by these string ids.

export function readStringTable(bytes: Uint8Array): Map<number, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pe = view.getUint32(0x3c, true);
  if (view.getUint32(pe, true) !== 0x4550) throw new Error("not a PE file");
  const sections = view.getUint16(pe + 6, true);
  const optSize = view.getUint16(pe + 20, true);
  const opt = pe + 24;
  const magic = view.getUint16(opt, true);
  const dirs = opt + (magic === 0x20b ? 112 : 96);
  const rsrcRva = view.getUint32(dirs + 2 * 8, true);
  const table = opt + optSize;
  let rsrcOff = -1;
  for (let i = 0; i < sections; i++) {
    const s = table + i * 40;
    const va = view.getUint32(s + 12, true);
    const size = Math.max(view.getUint32(s + 8, true), view.getUint32(s + 16, true));
    if (rsrcRva >= va && rsrcRva < va + size) rsrcOff = view.getUint32(s + 20, true) + (rsrcRva - va);
  }
  const out = new Map<number, string>();
  if (rsrcOff < 0) return out;
  const rvaToOff = (rva: number): number => rsrcOff + (rva - rsrcRva);

  const entries = (dir: number): { id: number; offset: number; isDir: boolean }[] => {
    const named = view.getUint16(rsrcOff + dir + 12, true);
    const ids = view.getUint16(rsrcOff + dir + 14, true);
    const list = [];
    for (let i = 0; i < named + ids; i++) {
      const e = rsrcOff + dir + 16 + i * 8;
      const id = view.getUint32(e, true);
      const off = view.getUint32(e + 4, true);
      list.push({ id, offset: off & 0x7fffffff, isDir: (off & 0x80000000) !== 0 });
    }
    return list;
  };

  const types = entries(0).find((e) => e.id === 6 && e.isDir);
  if (!types) return out;
  for (const block of entries(types.offset)) {
    if (!block.isDir) continue;
    for (const lang of entries(block.offset)) {
      const data = rsrcOff + lang.offset;
      let p = rvaToOff(view.getUint32(data, true));
      const base = (block.id - 1) * 16;
      for (let i = 0; i < 16; i++) {
        const len = view.getUint16(p, true);
        p += 2;
        if (len) {
          const s = Buffer.from(bytes.subarray(p, p + len * 2)).toString("utf16le");
          if (!out.has(base + i)) out.set(base + i, s);
        }
        p += len * 2;
      }
    }
  }
  return out;
}
