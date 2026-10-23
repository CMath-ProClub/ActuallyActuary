/* Profiles, local persistence and cross-device sync.

   Local first, always. Everything works with the network off and with sync
   switched off entirely; sync is a copy of the same state pushed to a small
   Cloudflare Worker so the other device can pick it up.

   The merge rule is what makes two devices safe to use at once:

     attempts   append-only, merged by union on id. An attempt is a historical
                fact - it happened - so neither side may ever delete the
                other's. This is the important one: it is what stops "I studied
                on my phone at lunch" from being erased by the laptop pushing
                an older snapshot.
     sets/tests merged by id, and within an id the newer `updated` wins
     settings   last writer wins, by profile `updated`
     deletions  recorded as tombstones, because an absent record is
                indistinguishable from one the other device has not seen yet

   Last-write-wins on a whole profile would be wrong and would silently lose
   work, which is exactly the failure a study log cannot tolerate. */

const LS_KEY = 'aa.study.v1';
const SCHEMA = 1;

/* The palette the profile chips use. Deliberately NOT the chart series colors:
   a profile color is decoration and must never be mistaken for data. */
export const PROFILE_COLORS = ['#2a78d6', '#1baf7a', '#9a5bd6', '#eb6834', '#d4458a', '#0d8f8f'];

function uid(prefix = '') {
  const r = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${r}` : r;
}

function now() { return Date.now(); }

export function blankProfile(name, colorIndex = 0) {
  return {
    id: uid('p'),
    name: String(name || 'Me').slice(0, 40),
    color: PROFILE_COLORS[colorIndex % PROFILE_COLORS.length],
    created: now(),
    updated: now(),
    settings: {
      guidance: 'hints',        /* hints | steps | answer - how much help practice gives */
      dailyGoal: 20,
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: '',
      reduceMotion: false,
    },
    attempts: [],               /* {id, topicId, ts, correct, ms, difficulty, hints, seed, mode, diagnosis} */
    mastery: {},                /* topicId -> {seen, correct, streak, ease, due, last} */
    sets: [],                   /* {id, name, topicIds[], items[], created, updated, source} */
    tests: [],                  /* {id, name, ts, items[], score, total, breakdown, updated} */
    deleted: {},                /* id -> timestamp, tombstones for sets and tests */
  };
}

function blankState() {
  const p = blankProfile('Me', 0);
  return {
    schema: SCHEMA,
    profiles: { [p.id]: p },
    activeId: p.id,
    sync: { key: '', autoSync: true, lastPull: 0, lastPush: 0, lastError: '' },
    /* Whole-install settings, as opposed to per-person ones. */
    settings: { setupDone: false },
  };
}

/* ------------------------------------------------------------------ storage */

let state = null;
const listeners = new Set();

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.profiles) return null;
    /* Forward-compatible: an unknown future schema is left alone rather than
       being "upgraded" into something lossy. */
    if (parsed.schema > SCHEMA) {
      console.warn('study: saved data is from a newer version; not modifying it');
    }
    return parsed;
  } catch (err) {
    console.error('study: could not read saved data', err);
    return null;
  }
}

function writeLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    /* Quota exceeded is the realistic failure once the attempt log is long.
       Trim the oldest attempts rather than losing the whole profile. */
    console.error('study: save failed', err);
    if (String(err && err.name).includes('Quota')) {
      let trimmed = false;
      for (const p of Object.values(state.profiles)) {
        if (p.attempts.length > 2000) { p.attempts = p.attempts.slice(-2000); trimmed = true; }
      }
      if (trimmed) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; } catch (e2) { /* give up */ }
      }
    }
    return false;
  }
}

export function load() {
  state = readLocal() || blankState();
  if (!state.profiles[state.activeId]) {
    state.activeId = Object.keys(state.profiles)[0];
  }
  if (!state.sync) state.sync = { key: '', autoSync: true, lastPull: 0, lastPush: 0, lastError: '' };
  /* Fill in fields added after a profile was first written. */
  for (const p of Object.values(state.profiles)) {
    if (!p.deleted) p.deleted = {};
    if (!p.settings) p.settings = blankProfile('x').settings;
    if (!Array.isArray(p.attempts)) p.attempts = [];
    if (!Array.isArray(p.sets)) p.sets = [];
    if (!Array.isArray(p.tests)) p.tests = [];
    if (!p.mastery) p.mastery = {};
  }
  return state;
}

export function getState() { return state || load(); }

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try { fn(state); } catch (err) { console.error('study: listener failed', err); }
  }
}

/* Every mutation goes through here so saving and notifying can never be
   forgotten at a call site. */
export function update(fn) {
  const s = getState();
  fn(s);
  const p = s.profiles[s.activeId];
  if (p) p.updated = now();
  writeLocal();
  emit();
  return s;
}

/* ----------------------------------------------------------------- profiles */

export function activeProfile() {
  const s = getState();
  return s.profiles[s.activeId];
}

export function allProfiles() {
  return Object.values(getState().profiles).sort((a, b) => a.created - b.created);
}

export function addProfile(name) {
  const s = getState();
  const idx = Object.keys(s.profiles).length;
  const p = blankProfile(name, idx);
  update((st) => { st.profiles[p.id] = p; st.activeId = p.id; });
  return p;
}

export function switchProfile(id) {
  update((st) => { if (st.profiles[id]) st.activeId = id; });
}

export function renameProfile(id, name) {
  update((st) => {
    const p = st.profiles[id];
    if (p) { p.name = String(name).slice(0, 40); p.updated = now(); }
  });
}

export function removeProfile(id) {
  const s = getState();
  if (Object.keys(s.profiles).length <= 1) return false;   /* never zero profiles */
  update((st) => {
    delete st.profiles[id];
    if (st.activeId === id) st.activeId = Object.keys(st.profiles)[0];
  });
  return true;
}

/* The who-studies-here card is offered once. Answering it or dismissing it
   both count, because a prompt that keeps coming back is worse than a
   default name. */
export function markSetupDone() {
  update((st) => {
    if (!st.settings) st.settings = {};
    st.settings.setupDone = true;
  });
}

export function setSetting(key, value) {
  update((st) => {
    const p = st.profiles[st.activeId];
    if (p) p.settings[key] = value;
  });
}

/* ----------------------------------------------------------------- attempts */

/* Record one answered problem. Returns the updated mastery row so the caller
   can show "you are now 4 for 5 on this". */
/* `diagnosis` is WHY it was wrong, as expr.js worked it out. Without it an
   attempt could only say that chain rule was shaky, never that the same slip
   happens every time. Adding a field is safe for sync: the merge unions
   attempts by id, so an older device simply contributes rows without one. */
export function recordAttempt({ topicId, correct, ms, difficulty, hintsUsed, seed, mode, diagnosis }) {
  let row;
  update((st) => {
    const p = st.profiles[st.activeId];
    if (!p) return;
    p.attempts.push({
      id: uid('a'),
      topicId,
      ts: now(),
      correct: !!correct,
      ms: Math.max(0, Math.round(ms || 0)),
      difficulty: difficulty || 1,
      hints: hintsUsed || 0,
      seed: seed || 0,
      mode: mode || 'practice',
      diagnosis: correct ? '' : (diagnosis || ''),
    });
    /* Keep the log bounded. 5000 attempts is years of study and well inside
       the localStorage budget. */
    if (p.attempts.length > 5000) p.attempts = p.attempts.slice(-5000);
    row = bumpMastery(p, topicId, !!correct);
  });
  return row;
}

/* A light SM-2 variant. The interval is in days and only matters for choosing
   what to review; nothing here pretends to be a clinical memory model. */
function bumpMastery(profile, topicId, correct) {
  const m = profile.mastery[topicId] || { seen: 0, correct: 0, streak: 0, ease: 2.3, due: 0, last: 0 };
  m.seen += 1;
  if (correct) {
    m.correct += 1;
    m.streak += 1;
    m.ease = Math.min(3.2, m.ease + 0.1);
    const days = m.streak === 1 ? 1 : m.streak === 2 ? 3 : Math.min(120, Math.round((m.streak - 1) * m.ease));
    m.due = now() + days * 86400000;
  } else {
    m.streak = 0;
    m.ease = Math.max(1.3, m.ease - 0.25);
    m.due = now() + 3600000;         /* an hour: bring it back this session */
  }
  m.last = now();
  profile.mastery[topicId] = m;
  return m;
}

export function masteryOf(topicId, profile = activeProfile()) {
  return (profile && profile.mastery[topicId]) || null;
}

/* Accuracy over the most recent `window` attempts at this topic. Recent
   performance is what matters; an old run of failures should not hold down a
   topic that has since been learned. */
export function recentAccuracy(topicId, windowSize = 10, profile = activeProfile()) {
  if (!profile) return null;
  const rows = [];
  for (let i = profile.attempts.length - 1; i >= 0 && rows.length < windowSize; i--) {
    if (profile.attempts[i].topicId === topicId) rows.push(profile.attempts[i]);
  }
  if (!rows.length) return null;
  return rows.filter((r) => r.correct).length / rows.length;
}

/* --------------------------------------------------------------- study sets */

export function saveSet(set) {
  const id = set.id || uid('s');
  update((st) => {
    const p = st.profiles[st.activeId];
    const existing = p.sets.findIndex((s) => s.id === id);
    const row = { ...set, id, updated: now(), created: set.created || now() };
    if (existing >= 0) p.sets[existing] = row;
    else p.sets.push(row);
  });
  return id;
}

export function deleteSet(id) {
  update((st) => {
    const p = st.profiles[st.activeId];
    p.sets = p.sets.filter((s) => s.id !== id);
    p.deleted[id] = now();
  });
}

export function saveTest(test) {
  const id = test.id || uid('t');
  update((st) => {
    const p = st.profiles[st.activeId];
    const existing = p.tests.findIndex((t) => t.id === id);
    const row = { ...test, id, updated: now() };
    if (existing >= 0) p.tests[existing] = row;
    else p.tests.push(row);
    if (p.tests.length > 200) p.tests = p.tests.slice(-200);
  });
  return id;
}

export function deleteTest(id) {
  update((st) => {
    const p = st.profiles[st.activeId];
    p.tests = p.tests.filter((t) => t.id !== id);
    p.deleted[id] = now();
  });
}

/* ========================================================================= */
/* sync                                                                      */
/* ========================================================================= */

/* The sync key is a capability: whoever holds it can read and write this
   bundle of profiles. It is generated on the device, never derived from a
   password, and the server only ever sees its SHA-256, so a dump of the
   server's storage does not hand anyone the keys.

   Strength: 20 characters drawn from a 32-letter alphabet is 20 x 5 = 100 bits
   of entropy. (One random BYTE produces each character, but only 5 bits of it
   survive the alphabet, so the entropy is 100 bits and not 160. The alphabet
   has exactly 32 letters and 256 is a multiple of 32, so the modulo introduces
   no bias.) 100 bits is far past guessable while still being short enough to
   read off one screen and type into another. */
const KEY_CHARS = 20;

export function generateSyncKey() {
  const bytes = new Uint8Array(KEY_CHARS);
  crypto.getRandomValues(bytes);
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   /* no 0/O/1/I - it gets typed by hand */
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out.match(/.{1,4}/g).join('-');
}

async function keyId(key) {
  const data = new TextEncoder().encode(`aa-study-v1:${key.replace(/-/g, '').toUpperCase()}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function syncEndpoint() {
  /* Same host family as the page, so one deployment serves every environment:
     study.actuallyactuary.com talks to study-api.actuallyactuary.com, and a
     local preview talks to a locally running worker. */
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '') return 'http://localhost:8787';
  return 'https://study-api.actuallyactuary.com';
}

export function syncState() { return getState().sync; }

export function setSyncKey(key) {
  update((st) => {
    st.sync.key = String(key || '').trim().toUpperCase();
    st.sync.lastError = '';
  });
}

export function setAutoSync(on) {
  update((st) => { st.sync.autoSync = !!on; });
}

/* Merge a remote snapshot into local state. Pure apart from the update() call,
   and deliberately conservative: it never deletes anything that is not
   explicitly tombstoned. */
export function mergeRemote(remote) {
  if (!remote || !remote.profiles) return { added: 0, updated: 0 };
  let added = 0, changed = 0;

  update((st) => {
    for (const [pid, rp] of Object.entries(remote.profiles)) {
      const lp = st.profiles[pid];
      if (!lp) {
        st.profiles[pid] = rp;
        added++;
        continue;
      }

      /* Tombstones from both sides, so a delete on one device sticks. */
      const tombs = { ...(lp.deleted || {}), ...(rp.deleted || {}) };

      /* attempts: union by id, never subtract */
      const seen = new Set(lp.attempts.map((a) => a.id));
      let newAttempts = 0;
      for (const a of (rp.attempts || [])) {
        if (!seen.has(a.id)) { lp.attempts.push(a); seen.add(a.id); newAttempts++; }
      }
      if (newAttempts) {
        lp.attempts.sort((a, b) => a.ts - b.ts);
        if (lp.attempts.length > 5000) lp.attempts = lp.attempts.slice(-5000);
        changed++;
      }

      /* Mastery is derived from attempts, so recompute rather than merge two
         summaries - merging counters would double-count the shared history. */
      if (newAttempts) {
        lp.mastery = {};
        for (const a of lp.attempts) bumpMastery(lp, a.topicId, a.correct);
      }

      /* sets and tests: by id, newest `updated` wins, tombstones removed */
      lp.sets = mergeById(lp.sets, rp.sets || [], tombs);
      lp.tests = mergeById(lp.tests, rp.tests || [], tombs);
      lp.deleted = tombs;

      /* Scalar fields follow whichever profile was touched last. */
      if ((rp.updated || 0) > (lp.updated || 0)) {
        lp.name = rp.name;
        lp.color = rp.color;
        lp.settings = { ...lp.settings, ...rp.settings };
        lp.updated = rp.updated;
        changed++;
      }
    }
    st.sync.lastPull = now();
    st.sync.lastError = '';
  });

  return { added, updated: changed };
}

function mergeById(mine, theirs, tombs) {
  const out = new Map();
  for (const row of mine) out.set(row.id, row);
  for (const row of theirs) {
    const have = out.get(row.id);
    if (!have || (row.updated || 0) > (have.updated || 0)) out.set(row.id, row);
  }
  for (const id of Object.keys(tombs || {})) out.delete(id);
  return [...out.values()];
}

function snapshot() {
  const s = getState();
  return { schema: SCHEMA, savedAt: now(), profiles: s.profiles };
}

/* True while syncNow is in flight.

   This exists because syncNow writes to state several times (the merged data,
   then lastPull and lastPush), and every write notifies subscribers. The
   auto-sync debounce in app.js is one of those subscribers, so without this
   flag a sync would schedule the next sync, forever, every few seconds. The
   auto-sync checks this and does not re-arm on a sync's own bookkeeping. */
let syncing = false;
export function isSyncing() { return syncing; }

/* Pull, merge, then push the merged result. Doing both in one call is what
   makes two devices converge instead of ping-ponging. */
export async function syncNow({ signal } = {}) {
  const s = getState();
  const key = (s.sync.key || '').trim();
  if (!key) return { ok: false, reason: 'no-key', message: 'No sync key set.' };
  if (syncing) return { ok: false, reason: 'busy', message: 'A sync is already running.' };
  syncing = true;
  try {
    return await runSync(key, signal);
  } finally {
    syncing = false;
  }
}

async function runSync(key, signal) {

  let id;
  try {
    id = await keyId(key);
  } catch (err) {
    return { ok: false, reason: 'crypto', message: 'This browser cannot hash the sync key (is the page on https?).' };
  }

  const base = `${syncEndpoint()}/v1/bundle/${id}`;
  let pulled = null;

  try {
    const res = await fetch(base, { signal, headers: { accept: 'application/json' } });
    if (res.status === 404) pulled = null;                 /* first ever sync */
    else if (!res.ok) throw new Error(`server said ${res.status}`);
    else pulled = await res.json();
  } catch (err) {
    update((st) => { st.sync.lastError = `Pull failed: ${err.message}`; });
    return { ok: false, reason: 'pull', message: `Could not reach the sync service: ${err.message}` };
  }

  let mergeInfo = { added: 0, updated: 0 };
  if (pulled && pulled.profiles) mergeInfo = mergeRemote(pulled);

  try {
    const body = JSON.stringify(snapshot());
    const res = await fetch(base, {
      method: 'PUT',
      signal,
      headers: { 'content-type': 'application/json' },
      body,
    });
    if (!res.ok) throw new Error(`server said ${res.status}`);
    update((st) => { st.sync.lastPush = now(); st.sync.lastError = ''; });
  } catch (err) {
    update((st) => { st.sync.lastError = `Push failed: ${err.message}`; });
    return { ok: false, reason: 'push', message: `Pulled, but could not save back: ${err.message}`, ...mergeInfo };
  }

  return { ok: true, ...mergeInfo };
}

/* ------------------------------------------------------- export and import */

export function exportJson() {
  return JSON.stringify(snapshot(), null, 2);
}

export function importJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, message: 'That file is not valid JSON.' };
  }
  if (!parsed || !parsed.profiles || typeof parsed.profiles !== 'object') {
    return { ok: false, message: 'That file does not look like a study export.' };
  }
  const info = mergeRemote(parsed);
  return { ok: true, message: `Imported: ${info.added} new profile(s), ${info.updated} updated.` };
}
