/* The endless drill: study THIS, as opposed to sitting a pretend test.

   Carter's idea, and it is a good one. A practice test is fixed in advance -
   that is what makes it a test. A drill should not be: it should watch what
   you miss and feed it back to you.

   The rule he asked for, and the rule this implements:

     - miss a question, and a similar one turns up about five questions later
     - miss THAT one too, and two more get tapered into the next seven
     - keep missing them, and they keep coming

   Why five and not immediately: answering the same question twice in a row
   tests your short-term memory of the answer, not whether you can do it.
   The gap is the point. And why "similar" rather than "the same": the
   generators build from a seed, so a repeat is a new question of the same
   kind at the same difficulty, which is the thing worth re-testing.

   This file is the scheduler only. It knows nothing about the DOM: it takes
   a state object and an index, says what the next question should be, and
   is told afterwards whether it went well. tools/test_drill.mjs simulates
   hundreds of questions through it, which is the only practical way to know
   that a rule like this behaves over a long session rather than over the
   three questions anybody would click through by hand. */

import MathKit from './math.js';
import { EXAM_PLAN } from './exam.js';

/* How far ahead a repeat lands. The first is a single question five on; the
   second strike puts two inside the next seven, which is close enough to
   feel like the tool noticed and far enough not to be a rerun. */
const FIRST_GAP = 5;
const SECOND_GAPS = [3, 6];
const TAPER_WINDOW = 7;

/* The rule as stated is unbounded, and a simulated student who keeps
   missing one topic proves it: every repeat he misses schedules two more,
   the queue outruns the session, and by question 400 the drill is 97% one
   topic and has stopped asking about anything else. Which is not what
   anybody meant by "keep giving me the ones I am doing bad at".

   So a topic can have at most two repeats waiting at once, and the whole
   backlog is capped. Missing something ten times does not earn you twenty
   questions; it earns you the next two, over and over, which is the same
   thing from where the student sits and leaves room for the rest of the
   unit. */
const MAX_PENDING_PER_KEY = 2;
const MAX_PENDING = 8;

/* And after this many misses at one difficulty, the repeat comes back
   EASIER. Failing the same level 3 question four times running teaches
   nothing; the gap is further down. */
const DROP_AFTER = 3;

/* Capping the queue is not enough on its own: with two repeats waiting and
   a student who misses every one of them, serving a repeat frees a slot
   that the miss immediately refills, and the simulated session still ends
   up two thirds one topic. So repeats of the same skill are also spaced.
   You get it back often, you do not get it back every other question. */
const MIN_REPEAT_SPACING = 4;

export function createDrill(seed) {
  return {
    seed: (seed >>> 0) || 1,
    /* Questions scheduled by a wrong answer, each {at, skill, level, why}. */
    scheduled: [],
    /* How many times each skill-and-level has been missed. */
    strikes: {},
    /* What has been asked, so the baseline stream does not repeat itself
       back to back. */
    recent: [],
    /* When each skill last came back as a repeat, for the spacing rule. */
    lastServed: {},
  };
}

const keyOf = (skill, level) => `${skill}:${level}`;

/* The skills a drill draws from, weighted the way the review sheet is. */
function mix() {
  const out = [];
  for (const entry of EXAM_PLAN) {
    for (let i = 0; i < entry.share; i++) out.push(entry);
  }
  return out;
}

/* What to ask at position `index`.

   A question that was scheduled by a miss takes priority, oldest first, so
   a backlog drains rather than piling up. Otherwise it is a weighted draw
   from the blueprint, avoiding whatever was just asked. */
export function nextSlot(state, index) {
  if (!state.lastServed) state.lastServed = {};
  const due = state.scheduled
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.at <= index)
    .sort((a, b) => a.s.at - b.s.at);
  for (const { s: item, i } of due) {
    const last = state.lastServed[item.skill];
    /* Too soon after the last one of these. Push it on rather than dropping
       it - it is still owed. */
    if (last !== undefined && index - last < MIN_REPEAT_SPACING) {
      state.scheduled[i] = { ...item, at: last + MIN_REPEAT_SPACING };
      continue;
    }
    state.scheduled.splice(i, 1);
    state.lastServed[item.skill] = index;
    remember(state, item.skill);
    return { ...item, repeat: true };
  }

  const r = MathKit.rng(MathKit.hashSeed(`${state.seed}:${index}`));
  const pool = mix();
  let entry = pool[Math.floor(r() * pool.length)];
  /* Two of the same in a row is how a drill starts feeling like a rut. */
  for (let tries = 0; tries < 6 && state.recent[0] === entry.skill; tries++) {
    entry = pool[Math.floor(r() * pool.length)];
  }
  const level = entry.levels[Math.floor(r() * entry.levels.length)];
  remember(state, entry.skill);
  return { skill: entry.skill, level, why: 'mix', repeat: false };
}

function remember(state, skill) {
  state.recent.unshift(skill);
  state.recent.length = Math.min(state.recent.length, 4);
}

/* Told how it went. Returns the repeats it just scheduled, so the UI can
   say out loud that it noticed - a drill that silently reorders itself
   looks like a drill that is picking questions at random. */
export function recordResult(state, index, slot, correct) {
  if (!slot || correct) return [];
  const key = keyOf(slot.skill, slot.level);
  const strikes = (state.strikes[key] || 0) + 1;
  state.strikes[key] = strikes;

  /* Keep missing it and it comes back easier, not harder and not forever. */
  const level = strikes > DROP_AFTER ? Math.max(1, slot.level - 1) : slot.level;
  const waiting = state.scheduled.filter((x) => x.skill === slot.skill).length;
  const room = Math.min(MAX_PENDING_PER_KEY - waiting, MAX_PENDING - state.scheduled.length);
  if (room <= 0) return [];

  const gaps = (strikes === 1 ? [FIRST_GAP] : SECOND_GAPS).slice(0, room);
  const added = [];
  for (const gap of gaps) {
    const at = placeFree(state, index + gap, index);
    const item = {
      at,
      skill: slot.skill,
      level,
      why: 'missed',
      easier: level < slot.level,
    };
    state.scheduled.push(item);
    added.push(item);
  }
  return added;
}

/* Keep two scheduled questions off the same slot, and keep everything the
   second strike adds inside the taper window. */
function placeFree(state, want, index) {
  const taken = new Set(state.scheduled.map((s) => s.at));
  let at = want;
  while (taken.has(at) && at <= index + TAPER_WINDOW) at++;
  if (taken.has(at)) {
    at = index + 1;
    while (taken.has(at)) at++;
  }
  return at;
}

/* Everything waiting, for the line that tells you what is coming back. */
export function pending(state) {
  return state.scheduled.slice().sort((a, b) => a.at - b.at);
}

/* A plain-words summary of what the drill currently thinks you are weak at,
   worst first. Only counts a skill once it has actually been missed, since
   a single wrong answer is a wrong answer and not a diagnosis. */
export function weakest(state, limit = 3) {
  return Object.entries(state.strikes)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, n]) => {
      const [skill, level] = key.split(':');
      return { skill, level: Number(level), misses: n };
    });
}
