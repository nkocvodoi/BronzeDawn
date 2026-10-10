// Saved games in the browser: gzipped, in IndexedDB (a save is too big for localStorage), and to and from a
// file on disk. Each keeps a few words to list it by.
import type { SaveFile } from "../core/save";

export interface SaveInfo { id: number; name: string; saved: string; time: number }
interface Stored extends SaveInfo { data: Blob }

const DB = "bronze-dawn", STORE = "saves";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("The browser would not open its storage"));
  });
}

function run<T>(mode: IDBTransactionMode, body: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const req = body(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("The browser's storage refused"));
  }));
}

/** A save as a gzipped file. */
export async function pack(file: SaveFile): Promise<Blob> {
  const raw = new Blob([JSON.stringify(file)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(raw).blob();
}

/** A gzipped save back. A plain JSON file is read too. */
export async function unpack(data: Blob): Promise<SaveFile> {
  const head = new Uint8Array(await data.slice(0, 2).arrayBuffer());
  const gz = head[0] === 0x1f && head[1] === 0x8b;
  const text = gz ? await new Response(data.stream().pipeThrough(new DecompressionStream("gzip"))).text() : await data.text();
  return JSON.parse(text) as SaveFile;
}

export async function storeSave(name: string, file: SaveFile): Promise<void> {
  const data = await pack(file);
  await run("readwrite", (s) => s.add({ name, saved: file.saved, time: file.time, data } as Omit<Stored, "id">));
}

/** Every save, newest first, without its contents. */
export async function listSaves(): Promise<SaveInfo[]> {
  const all = await run<Stored[]>("readonly", (s) => s.getAll() as IDBRequest<Stored[]>);
  return all.map(({ id, name, saved, time }) => ({ id, name, saved, time })).sort((a, b) => b.saved.localeCompare(a.saved));
}

export async function readSave(id: number): Promise<SaveFile> {
  const s = await run<Stored | undefined>("readonly", (st) => st.get(id) as IDBRequest<Stored | undefined>);
  if (!s) throw new Error("That save is gone");
  return unpack(s.data);
}

export async function deleteSave(id: number): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}
