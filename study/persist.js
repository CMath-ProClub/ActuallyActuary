/* Keeping the workspace when the tab closes.

   The board and the photo shelf were built in memory, which is fine until
   the first time someone closes the tab halfway through a worksheet and
   loses twenty minutes of working out. That is the moment a tool stops
   feeling trustworthy, and it is worth more than another feature.

   TWO STORES, because the two things are different sizes.

   Strokes are small - a few hundred points of JSON - and localStorage is
   synchronous, which means a save can happen on every stroke without any
   bookkeeping. Photos are not small: one downscaled phone photo is around
   300KB as a data URL, and localStorage caps out somewhere near 5MB for the
   WHOLE origin, which the study history is already using. Three photos
   would evict someone's attempt log. So photos go to IndexedDB, which is
   asynchronous and awkward and has room.

   Everything is scoped to the profile, so two people sharing a laptop never
   see each other's work. */

const LS_PREFIX = 'aa.study.ws.';
const DB_NAME = 'aa-study-workspace';
const DB_VERSION = 1;
const PHOTO_STORE = 'photos';

/* A stable name for one piece of work. The problem key makes the board you
   drew for THIS problem come back when you return to it, rather than one
   board smeared across everything. */
export function workspaceKey(profileId, problemKey) {
  const who = String(profileId || 'anon').replace(/[^a-z0-9]/gi, '').slice(0, 16);
  const what = String(problemKey || 'scratch').replace(/[^a-z0-9:._-]/gi, '').slice(0, 64);
  return `${who}|${what}`;
}

/* ------------------------------------------------------------- the board */

export function saveStrokes(key, strokes) {
  try {
    const live = (strokes || []).filter((s) => s && !s.dead);
    if (!live.length) {
      localStorage.removeItem(LS_PREFIX + key);
      return true;
    }
    /* Round the coordinates on the way out. Four decimal places on a 0..1
       coordinate is a quarter of a pixel on a 4K screen, and it cuts the
       stored size by more than half. */
    const lean = live.map((s) => ({
      i: s.id,
      t: s.tool,
      c: s.color,
      a: s.author,
      w: s.at,
      p: s.points.map((pt) => [round(pt.x), round(pt.y)]),
    }));
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(lean));
    return true;
  } catch (err) {
    /* A full quota must not take the drawing surface down with it. */
    return false;
  }
}

function round(v) {
  return Math.round(v * 10000) / 10000;
}

export function loadStrokes(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return [];
    const lean = JSON.parse(raw);
    if (!Array.isArray(lean)) return [];
    return lean.map((s) => ({
      id: s.i,
      tool: s.t || 'pen',
      color: s.c || 'ink',
      author: s.a || 'me',
      at: s.w || 0,
      points: (s.p || []).map(([x, y]) => ({ x, y })),
    })).filter((s) => s.id && s.points.length);
  } catch (err) {
    return [];
  }
}

export function clearStrokes(key) {
  try {
    localStorage.removeItem(LS_PREFIX + key);
    return true;
  } catch (err) {
    return false;
  }
}

/* How much of the budget the boards are using, so Settings can say. */
export function strokeBytes() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) total += (localStorage.getItem(k) || '').length;
    }
  } catch (err) { /* nothing to report */ }
  return total;
}

/* ----------------------------------------------------------- the session */

/* What you were in the middle of.

   A problem is NOT stored. It is described - which generator, which seed -
   and rebuilt, which is the same trick a mock test has always used to be a
   few hundred bytes instead of a document. The seed determinism the whole
   project rests on is what makes reopening a page land you on the identical
   question rather than a similar one. */
const SESSION_KEY = 'aa.study.session.';

export function describeProblem(problem) {
  if (!problem) return null;
  if (problem.source === 'typed') {
    return { source: 'typed', text: problem.functionText };
  }
  if (problem.source === 'sandbox') {
    return {
      source: 'sandbox', skill: problem.skill,
      level: problem.difficulty, seed: problem.seed,
    };
  }
  return {
    source: 'curriculum', topicId: problem.topicId,
    level: problem.difficulty, seed: problem.seed,
  };
}

export function saveSession(profileId, name, payload) {
  try {
    if (!payload) {
      localStorage.removeItem(SESSION_KEY + name + ':' + profileId);
      return true;
    }
    localStorage.setItem(SESSION_KEY + name + ':' + profileId,
      JSON.stringify({ ...payload, at: Date.now() }));
    return true;
  } catch (err) {
    return false;
  }
}

/* Anything older than this is not something you were "in the middle of". */
const STALE_AFTER = 1000 * 60 * 60 * 12;

export function loadSession(profileId, name) {
  try {
    const raw = localStorage.getItem(SESSION_KEY + name + ':' + profileId);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object') return null;
    if (payload.at && Date.now() - payload.at > STALE_AFTER) {
      localStorage.removeItem(SESSION_KEY + name + ':' + profileId);
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

export function clearSession(profileId, name) {
  return saveSession(profileId, name, null);
}

/* ------------------------------------------------------------- the photos */

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        const store = db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
        store.createIndex('key', 'key', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    /* Private browsing in some browsers refuses IndexedDB outright. The
       shelf still works, it just will not come back. */
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(db, mode) {
  return db.transaction(PHOTO_STORE, mode).objectStore(PHOTO_STORE);
}

export async function savePhoto(key, item) {
  const db = await openDb();
  if (!db || !item || !item.id) return false;
  return new Promise((resolve) => {
    try {
      const request = tx(db, 'readwrite').put({ ...item, key });
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

export async function loadPhotos(key) {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const request = tx(db, 'readonly').index('key').getAll(key);
      request.onsuccess = () => {
        const rows = request.result || [];
        rows.sort((a, b) => (a.at || 0) - (b.at || 0));
        resolve(rows);
      };
      request.onerror = () => resolve([]);
    } catch (err) {
      resolve([]);
    }
  });
}

export async function deletePhoto(id) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const request = tx(db, 'readwrite').delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

export async function clearPhotos(key) {
  const rows = await loadPhotos(key);
  for (const row of rows) await deletePhoto(row.id);
  return rows.length;
}

/* Everything stored, for the line in Settings that says how much room this
   is taking and offers to empty it. */
export async function photoUsage() {
  const db = await openDb();
  if (!db) return { count: 0, bytes: 0 };
  return new Promise((resolve) => {
    try {
      const request = tx(db, 'readonly').getAll();
      request.onsuccess = () => {
        const rows = request.result || [];
        const bytes = rows.reduce((a, r) => a + (r.dataUrl ? r.dataUrl.length * 0.75 : 0), 0);
        resolve({ count: rows.length, bytes: Math.round(bytes) });
      };
      request.onerror = () => resolve({ count: 0, bytes: 0 });
    } catch (err) {
      resolve({ count: 0, bytes: 0 });
    }
  });
}

export async function clearEverything() {
  const db = await openDb();
  if (db) {
    await new Promise((resolve) => {
      try {
        const request = tx(db, 'readwrite').clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (err) { resolve(false); }
    });
  }
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
  } catch (err) { /* nothing to clear */ }
  return true;
}

export default {
  workspaceKey, saveStrokes, loadStrokes, clearStrokes, strokeBytes,
  describeProblem, saveSession, loadSession, clearSession,
  savePhoto, loadPhotos, deletePhoto, clearPhotos, photoUsage, clearEverything,
};
