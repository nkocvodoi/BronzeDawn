// Art packs: a player's own art and sound, picked from a folder or a zip on their disk and kept in this
// browser (IndexedDB). Nothing is uploaded and nothing is published: a pack lives where its player put it.
// A pack is a folder with a manifest.json in the format of replica/assets-needed.md; what it names
// replaces the game's own pictures and sounds, piece by piece (a dinosaur for the war elephant, say).
// See replica/art-packs.md.
import type { Manifest } from "./assets";

export interface PackInfo {
  id: string; name: string; enabled: boolean; added: number;
  /** Files kept, their size in bytes, and what the manifest names that the pack does not have. */
  files: number; bytes: number; missing: string[];
}
interface StoredPack { info: PackInfo; manifest: Manifest }

const DB = "bronze-dawn-packs", PACKS = "packs", FILES = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PACKS, { keyPath: "info.id" });
      req.result.createObjectStore(FILES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("The browser would not open its storage"));
  });
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("The browser's storage refused"));
  });
}

function get<T>(store: IDBObjectStore, key: IDBValidKey) {
  return new Promise<T | undefined>((resolve, reject) => {
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

/** Every file a manifest names, by the same walk the asset loader does. */
export function manifestFiles(m: Manifest): string[] {
  const out: string[] = [];
  mapFiles(m, (f) => { out.push(f); return f; });
  return out;
}

/** A copy of a manifest with every file name passed through `f` (to give a pack's files their own names). */
export function mapFiles(m: Manifest, f: (file: string) => string): Manifest {
  const img = (s: unknown): unknown => {
    if (!s || typeof s !== "object") return s;
    if (Array.isArray(s)) return s.map(img);
    const o = s as Record<string, unknown>;
    if (typeof o.file === "string") return { ...o, file: f(o.file) };
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, img(v)]));
  };
  const strs = <T extends Record<string, unknown> | undefined>(o: T) =>
    o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map(f) : typeof v === "string" ? f(v) : v]));
  return {
    ...m,
    units: img(m.units) as Manifest["units"],
    buildings: img(m.buildings) as Manifest["buildings"],
    construction: img(m.construction) as Manifest["construction"],
    resources: img(m.resources) as Manifest["resources"],
    cliffs: img(m.cliffs) as Manifest["cliffs"],
    terrain: strs(m.terrain) as Manifest["terrain"],
    icons: strs(m.icons) as Manifest["icons"],
    resourceIcons: strs(m.resourceIcons) as Manifest["resourceIcons"],
    cursors: img(m.cursors) as Manifest["cursors"],
    sfx: strs(m.sfx) as Manifest["sfx"],
    music: m.music?.map(f),
  };
}

/** Files picked from a folder (their paths include the folder's own name) or read from a zip. */
export interface PackFile { path: string; data: Blob }

/** The files of a folder picked with a directory input. */
export function folderFiles(list: FileList): PackFile[] {
  return [...list].map((file) => ({ path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, data: file }));
}

/** The files of a zip, read with the browser's own inflater (stored and deflated entries). */
export async function zipFiles(zip: Blob): Promise<PackFile[]> {
  const buf = new DataView(await zip.arrayBuffer());
  // The end of central directory record: its signature, searched for from the end.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (buf.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This is not a zip file");
  const count = buf.getUint16(eocd + 10, true);
  let p = buf.getUint32(eocd + 16, true);
  const out: PackFile[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (buf.getUint32(p, true) !== 0x02014b50) throw new Error("The zip's directory is broken");
    const method = buf.getUint16(p + 10, true), size = buf.getUint32(p + 20, true);
    const nameLen = buf.getUint16(p + 28, true), extra = buf.getUint16(p + 30, true), comment = buf.getUint16(p + 32, true);
    const local = buf.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf.buffer, p + 46, nameLen));
    p += 46 + nameLen + extra + comment;
    if (name.endsWith("/")) continue;
    const start = local + 30 + buf.getUint16(local + 26, true) + buf.getUint16(local + 28, true);
    const raw = new Blob([new Uint8Array(buf.buffer, start, size)]);
    if (method === 0) out.push({ path: name, data: raw });
    else if (method === 8) out.push({ path: name, data: await new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob() });
    else throw new Error(`${name}: a kind of compression the browser cannot read`);
  }
  return out;
}

/** Keeps a pack: finds its manifest.json (at the top, or one folder down), checks what it names, and
 *  stores every file under the pack's id. */
export async function addPack(files: PackFile[], fallbackName: string): Promise<PackInfo> {
  const manifestAt = files.map((f) => f.path).filter((p) => /(^|\/)manifest\.json$/.test(p)).sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (!manifestAt) throw new Error("No manifest.json in it: see replica/art-packs.md for what a pack holds");
  const root = manifestAt.slice(0, manifestAt.length - "manifest.json".length);
  let manifest: Manifest;
  try { manifest = JSON.parse(await files.find((f) => f.path === manifestAt)!.data.text()); }
  catch (e) { throw new Error(`manifest.json is not valid JSON: ${(e as Error).message}`); }
  const inside = new Map(files.filter((f) => f.path.startsWith(root) && f.path !== manifestAt).map((f) => [f.path.slice(root.length), f.data]));
  const named = manifestFiles(manifest);
  const missing = [...new Set(named.filter((f) => !inside.has(f)))];
  const keep = [...new Set(named)].filter((f) => inside.has(f));
  if (!keep.length) throw new Error("The manifest names no file that is in the pack");
  const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const name = (manifest as { name?: string }).name ?? (root.replace(/\/$/, "").split("/").pop() || fallbackName);
  const info: PackInfo = { id, name, enabled: true, added: Date.now(), files: keep.length, bytes: keep.reduce((n, f) => n + inside.get(f)!.size, 0), missing };
  try { await navigator.storage?.persist?.(); } catch { /* the browser may still clear it when space runs low */ }
  const db = await open();
  const tx = db.transaction([PACKS, FILES], "readwrite");
  tx.objectStore(PACKS).put({ info, manifest } satisfies StoredPack);
  for (const f of keep) tx.objectStore(FILES).put(inside.get(f)!, `${id}/${f}`);
  await done(tx);
  return info;
}

export async function listPacks(): Promise<PackInfo[]> {
  const db = await open();
  const all = await new Promise<StoredPack[]>((resolve, reject) => {
    const r = db.transaction(PACKS).objectStore(PACKS).getAll();
    r.onsuccess = () => resolve(r.result as StoredPack[]);
    r.onerror = () => reject(r.error);
  });
  return all.map((p) => p.info).sort((a, b) => a.added - b.added);
}

export async function setEnabled(id: string, enabled: boolean) {
  const db = await open();
  const tx = db.transaction(PACKS, "readwrite");
  const p = await get<StoredPack>(tx.objectStore(PACKS), id);
  if (p) tx.objectStore(PACKS).put({ ...p, info: { ...p.info, enabled } });
  await done(tx);
}

export async function removePack(id: string) {
  const db = await open();
  const tx = db.transaction([PACKS, FILES], "readwrite");
  tx.objectStore(PACKS).delete(id);
  tx.objectStore(FILES).delete(IDBKeyRange.bound(`${id}/`, `${id}/￿`));
  await done(tx);
}

/** The enabled packs, oldest first (a later pack wins), each with its manifest renamed to its own files
 *  and a blob URL for every one of them. */
export async function loadPacks(): Promise<{ info: PackInfo; manifest: Manifest; urls: Map<string, string> }[]> {
  if (typeof indexedDB === "undefined") return [];
  let db: IDBDatabase;
  try { db = await open(); } catch { return []; }
  const packs = await new Promise<StoredPack[]>((resolve) => {
    const r = db.transaction(PACKS).objectStore(PACKS).getAll();
    r.onsuccess = () => resolve(r.result as StoredPack[]);
    r.onerror = () => resolve([]);
  });
  const out = [];
  for (const p of packs.filter((x) => x.info.enabled).sort((a, b) => a.info.added - b.info.added)) {
    const urls = new Map<string, string>();
    const files = db.transaction(FILES).objectStore(FILES);
    const named = [...new Set(manifestFiles(p.manifest))];
    const blobs = await Promise.all(named.map((f) => get<Blob>(files, `${p.info.id}/${f}`).catch(() => undefined)));
    named.forEach((f, i) => { const b = blobs[i]; if (b) urls.set(`pack/${p.info.id}/${f}`, URL.createObjectURL(b)); });
    out.push({ info: p.info, manifest: mapFiles(p.manifest, (f) => `pack/${p.info.id}/${f}`), urls });
  }
  return out;
}
