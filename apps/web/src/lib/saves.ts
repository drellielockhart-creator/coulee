/**
 * Saves in the browser (11 §4.3). OWNER: module:web.
 *
 * A save is `PlaySession.save()`: world, source, PC, knowledge, replay log. IndexedDB holds it
 * (a session is most of a megabyte and grows); localStorage is the fallback. Storage can be
 * missing or refused (private windows, cleared site data), so every access is wrapped and a
 * failure is reported as `false`/`null`, never thrown into the game.
 */
export interface SaveMeta {
  slot: string;
  stamp: string;
  place: string;
  /** Game minute. */
  t: number;
  /** Observation mode the session was played in (ADR 0002: say which). */
  mode: 'fair' | 'god';
  /** Wall-clock milliseconds when saved (display only). */
  savedAt: number;
}
export interface SaveRecord extends SaveMeta {
  json: string;
}

const DB = 'coulee';
const STORE = 'saves';
const LS = 'coulee.save.';

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'slot' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** A request's result, resolved only when its transaction commits (an abort after success is a failure). */
function request<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      let result: T | null = null;
      req.onsuccess = () => {
        result = (req.result as T) ?? null;
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => resolve(null);
      tx.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function fromLocal(slot: string): SaveRecord | null {
  try {
    const raw = localStorage.getItem(LS + slot);
    return raw ? (JSON.parse(raw) as SaveRecord) : null;
  } catch {
    return null;
  }
}

/** Of two copies of a slot (IndexedDB and the fallback), the newer one. */
function newer<T extends { savedAt: number }>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  return b.savedAt > a.savedAt ? b : a;
}

export async function putSave(record: SaveRecord): Promise<boolean> {
  const db = await open();
  if (db) {
    const ok = await request<IDBValidKey>(db, 'readwrite', (s) => s.put(record));
    db.close();
    if (ok !== null) return true;
  }
  try {
    localStorage.setItem(LS + record.slot, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export async function getSave(slot: string): Promise<SaveRecord | null> {
  const db = await open();
  let stored: SaveRecord | null = null;
  if (db) {
    stored = await request<SaveRecord>(db, 'readonly', (s) => s.get(slot));
    db.close();
  }
  // A failed IndexedDB write falls back to localStorage, so the fallback may hold the newer copy.
  return newer(stored, fromLocal(slot));
}

/** What is kept, without the (large) sessions themselves. */
export async function listSaves(): Promise<SaveMeta[]> {
  const out = new Map<string, SaveMeta>();
  const db = await open();
  if (db) {
    const all = (await request<SaveRecord[]>(db, 'readonly', (s) => s.getAll())) ?? [];
    db.close();
    for (const { json: _json, ...meta } of all) out.set(meta.slot, meta);
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(LS)) continue;
      const { json: _json, ...meta } = JSON.parse(localStorage.getItem(key) ?? '{}') as SaveRecord;
      if (meta.slot) {
        const chosen = newer(out.get(meta.slot) ?? null, meta);
        if (chosen) out.set(meta.slot, chosen);
      }
    }
  } catch {
    // storage unavailable: nothing listed from it
  }
  return [...out.values()].sort((a, b) => b.savedAt - a.savedAt);
}

/** Offer a text file to the player (the replay log): no storage involved. */
export function download(name: string, text: string, type = 'application/x-ndjson'): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
