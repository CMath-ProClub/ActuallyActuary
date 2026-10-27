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
import { FOCUS_IDS, focusFamily } from './gen-sandbox.js';

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

/* The difficulty follows the answers.

   Carter's rule, in his words: get an easy one wrong and stay on easy, get
   a hard one right and stay on hard, and sit in the middle when the
   answers are mixed. So each skill has a rung on a three-rung ladder,
   starting in the middle:

     - two right in a row moves up one rung
     - one wrong moves down one rung, immediately

   Two in a row to climb, one to fall, because a lucky guess should not
   promote you and a slip should not cost much - the next two right answers
   put it back. The ends are sticky by construction: max(1, ...) means a
   missed easy question leaves you on easy, and min(3, ...) means a right
   hard one leaves you on hard.

   A skill nobody has tried yet starts wherever the student generally is,
   rather than always at the middle: somebody who is plainly a level 3
   should not be shown level 2 chain rule questions just because chain rule
   has not come up yet. */
const UP_AFTER = 2;
const START_LEVEL = 2;

/* ---------------------------------------------------------------- lock in */

/* A drill pointed at a handful of named shapes.

   Carter sat a quiz the night before his test and came back knowing
   exactly which four kinds of implicit differentiation he could not do. A
   general drill would show him one of those every seventh question, which
   is no use with a test in the morning.

   So lock-in starts at mostly-focus and EASES OFF as he gets them right:
   every correct focus question drops their share a little, every miss puts
   it back up faster than it came down. Getting good at the four shapes is
   what turns the rest of the unit back on, which is the behaviour he asked
   for and also the right one - drilling something you have already got is
   how revision time disappears.

   The sprinkled-in questions favour the five skills the four shapes are
   built out of, because those are what a wrong answer is usually made of:
   the product rule, the chain rule, and the three function families. */
const FOCUS_MAX = 0.85;
const FOCUS_MIN = 0.3;

/* What "I have got this one" means: three right in a row on that shape.
   Counting total right answers instead let the session ease off after eight
   of them, which with four shapes is two each - not knowing it, just not
   having been caught yet. A miss sets that shape's run back to nothing, so
   the share goes straight back up. */
const FOCUS_RUN = 3;

export const SUPPORT_SKILLS = ['product', 'chain', 'trig', 'exp', 'log'];
const SUPPORT_WEIGHT = 3;

export function createDrill(seed, opts = {}) {
  /* A lock-in drill names the shapes it is pointed at; an ordinary one has
     none and behaves exactly as it did. */
  const focus = (opts.focus || []).filter((f) => f && f.family);
  return {
    seed: (seed >>> 0) || 1,
    focus,
    /* How much of the session the focus shapes take, right now. */
    share: focus.length ? FOCUS_MAX : 0,
    /* Right and wrong on each focus shape, so the worst one comes up most. */
    tally: {},
    /* Questions scheduled by a wrong answer, each {at, skill, level, why}. */
    scheduled: [],
    /* How many times each skill-and-level has been missed. */
    strikes: {},
    /* What has been asked, so the baseline stream does not repeat itself
       back to back. */
    recent: [],
    /* When each skill last came back as a repeat, for the spacing rule. */
    lastServed: {},
    /* The rung each skill is on, and how many right in a row at it. */
    levels: {},
    streaks: {},
    /* The last move up or down, so the session can say it happened. */
    moved: null,
  };
}

/* A focus shape is its own thing to get right or wrong: two of them are
   both implicit differentiation, and treating them as one skill would mean
   missing the logarithm one brings back the exponential one. */
const keyOf = (skill, level, family) => `${family || skill}:${level}`;
const trackOf = (slot) => (slot && slot.family) || (slot && slot.skill) || '';

/* The skills a drill draws from, weighted the way the review sheet is. */
function mix(weighted = false) {
  const out = [];
  for (const entry of EXAM_PLAN) {
    const extra = weighted && SUPPORT_SKILLS.includes(entry.skill) ? SUPPORT_WEIGHT : 1;
    for (let i = 0; i < entry.share * extra; i++) out.push(entry);
  }
  return out;
}

/* What to ask at position `index`.

   A question that was scheduled by a miss takes priority, oldest first, so
   a backlog drains rather than piling up. Otherwise it is a weighted draw
   from the blueprint, avoiding whatever was just asked. */
/* Which of the focus shapes to ask about. Weighted by how badly it is
   going: a shape that has been missed twice is three times as likely as one
   that has been missed once, and a shape nobody has tried yet counts as one
   miss so that it gets a turn early. */
function pickFocus(state, r) {
  const focus = state.focus || [];
  if (!focus.length) return null;
  const weights = focus.map((f) => {
    const t = (state.tally || {})[f.family] || { right: 0, wrong: 0, run: 0 };
    const tried = t.right + t.wrong;
    /* Capped, or a shape missed ten times crowds the other three out
       entirely - which is how you walk into the test having practised one
       of the four. */
    const struggling = Math.min(t.wrong, 3) * 1.5;
    /* One that is already solid steps back but never disappears. */
    const solid = (t.run || 0) >= FOCUS_RUN ? -0.6 : 0;
    return Math.max(0.4, 1 + struggling + solid + (tried === 0 ? 1 : 0));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = r() * total;
  for (let i = 0; i < focus.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return focus[i];
  }
  return focus[focus.length - 1];
}

/* The share of the session the focus shapes currently take, from how much
   of the focus set has been shown to be solid. All four at three in a row
   eases it to the floor; one miss anywhere puts it back up. */
export function focusShare(state) {
  if (!state || !state.focus || !state.focus.length) return 0;
  const tally = state.tally || {};
  let sum = 0;
  for (const f of state.focus) {
    const run = (tally[f.family] || {}).run || 0;
    sum += Math.min(1, run / FOCUS_RUN);
  }
  const solid = sum / state.focus.length;
  return FOCUS_MAX - (FOCUS_MAX - FOCUS_MIN) * solid;
}

/* How each shape is going, for the panel that lists them. */
export function focusProgress(state) {
  const tally = (state && state.tally) || {};
  return ((state && state.focus) || []).map((f) => {
    const t = tally[f.family] || { right: 0, wrong: 0, run: 0 };
    return {
      family: f.family,
      right: t.right || 0,
      wrong: t.wrong || 0,
      run: t.run || 0,
      solid: (t.run || 0) >= FOCUS_RUN,
    };
  });
}

export function nextSlot(state, index) {
  if (!state.lastServed) state.lastServed = {};
  const r = MathKit.rng(MathKit.hashSeed(`${state.seed}:${index}`));
  const locked = !!(state.focus && state.focus.length);

  /* Decide what KIND of question this slot is before looking at the queue.

     Serving the queue first looked right and was not: in a lock-in session
     every sprinkled-in question that gets missed books a slot, and those
     repeats crowded the focus shapes down to about 40% of the session when
     the share said 85%. The roll comes first now, and the queue is read for
     the kind of question the roll asked for. The first question is always a
     focus one, because opening a cram session with a quotient rule question
     is not what anybody pressed the button for. */
  const wantFocus = locked && (index === 0 || r() < focusShare(state));
  const served = serveDue(state, index, locked ? (item) => !!item.family === wantFocus : null);
  if (served) return served;

  if (wantFocus) {
    const chosen = pickFocus(state, r);
    if (chosen) {
      const level = offeredLevel({ levels: [2, 3] }, ladderFor(state, chosen.family));
      remember(state, chosen.family);
      return {
        skill: chosen.skill || 'implicit',
        family: chosen.family,
        level,
        why: 'focus',
        repeat: false,
      };
    }
  }

  /* In a lock-in session the sprinkled-in questions lean towards the rules
     the focus shapes are made of. */
  const pool = mix(locked);
  let entry = pool[Math.floor(r() * pool.length)];
  /* Two of the same in a row is how a drill starts feeling like a rut. */
  for (let tries = 0; tries < 6 && state.recent[0] === entry.skill; tries++) {
    entry = pool[Math.floor(r() * pool.length)];
  }
  /* The difficulty is the rung this skill is on, not a dice roll - but a
     skill that only offers one level still only offers that one. */
  const level = offeredLevel(entry, ladderFor(state, entry.skill));
  remember(state, entry.skill);
  return { skill: entry.skill, level, why: 'mix', repeat: false };
}

/* The oldest question that is owed and allowed right now, or nothing.
   `wanted` filters by kind in a lock-in session; without it every owed
   question is fair game, which is how an ordinary drill works. */
function serveDue(state, index, wanted) {
  const due = state.scheduled
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.at <= index && (!wanted || wanted(s)))
    .sort((a, b) => a.s.at - b.s.at);
  for (const { s: item } of due) {
    const last = state.lastServed[trackOf(item)];
    /* Too soon after the last one of these. Push it on rather than dropping
       it - it is still owed. */
    if (last !== undefined && index - last < MIN_REPEAT_SPACING) {
      const at = state.scheduled.indexOf(item);
      if (at >= 0) state.scheduled[at] = { ...item, at: last + MIN_REPEAT_SPACING };
      continue;
    }
    const at = state.scheduled.indexOf(item);
    if (at >= 0) state.scheduled.splice(at, 1);
    state.lastServed[trackOf(item)] = index;
    remember(state, trackOf(item));
    return { ...item, repeat: true };
  }
  return null;
}

/* The rung a skill is on. One that has not come up yet starts wherever the
   student generally is. */
export function ladderFor(state, skill) {
  if (!state.levels) state.levels = {};
  const known = state.levels[skill];
  if (known) return known;
  return overallLevel(state);
}

/* Where the student generally is, across the skills that have been tried.
   The middle rung until there is anything to go on. */
export function overallLevel(state) {
  const values = Object.values((state && state.levels) || {});
  if (!values.length) return START_LEVEL;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.max(1, Math.min(3, Math.round(mean)));
}

/* The closest level this skill actually offers. motion only has level 2
   problems, so asking it for a level 3 gets a level 2 rather than nothing. */
function offeredLevel(entry, want) {
  const levels = entry.levels || [START_LEVEL];
  let best = levels[0];
  for (const level of levels) {
    if (Math.abs(level - want) < Math.abs(best - want)) best = level;
  }
  return best;
}

function remember(state, skill) {
  state.recent.unshift(skill);
  state.recent.length = Math.min(state.recent.length, 4);
}

/* Told how it went. Returns the repeats it just scheduled, so the UI can
   say out loud that it noticed - a drill that silently reorders itself
   looks like a drill that is picking questions at random. */
export function recordResult(state, index, slot, correct) {
  if (!slot) return [];
  moveLadder(state, slot, correct);

  /* A focus shape going right eases the session off it; going wrong puts
     it back, faster than it came down. */
  if (slot.family && state.focus && state.focus.length) {
    if (!state.tally) state.tally = {};
    const t = state.tally[slot.family] || { right: 0, wrong: 0, run: 0 };
    if (correct) { t.right++; t.run = (t.run || 0) + 1; } else { t.wrong++; t.run = 0; }
    state.tally[slot.family] = t;
    state.share = focusShare({ ...state, tally: { ...state.tally, [slot.family]: t } });
  }

  if (correct) return [];
  const key = keyOf(slot.skill, slot.level, slot.family);
  const strikes = (state.strikes[key] || 0) + 1;
  state.strikes[key] = strikes;

  /* Keep missing it and it comes back easier, not harder and not forever. */
  const level = strikes > DROP_AFTER ? Math.max(1, slot.level - 1) : slot.level;
  const waiting = state.scheduled.filter((x) => trackOf(x) === trackOf(slot)).length;
  const room = Math.min(MAX_PENDING_PER_KEY - waiting, MAX_PENDING - state.scheduled.length);
  if (room <= 0) return [];

  const gaps = (strikes === 1 ? [FIRST_GAP] : SECOND_GAPS).slice(0, room);
  const added = [];
  for (const gap of gaps) {
    const at = placeFree(state, index + gap, index);
    const item = {
      at,
      skill: slot.skill,
      family: slot.family || null,
      level,
      why: 'missed',
      easier: level < slot.level,
    };
    state.scheduled.push(item);
    added.push(item);
  }
  return added;
}

/* Up a rung after two right in a row, down a rung on a miss. */
function moveLadder(state, slot, correct) {
  if (!state.levels) state.levels = {};
  if (!state.streaks) state.streaks = {};
  const skill = trackOf(slot);
  const from = ladderFor(state, skill);
  let to = from;
  if (correct) {
    const streak = (state.streaks[skill] || 0) + 1;
    if (streak >= UP_AFTER) {
      to = Math.min(3, from + 1);
      state.streaks[skill] = 0;
    } else {
      state.streaks[skill] = streak;
    }
  } else {
    to = Math.max(1, from - 1);
    state.streaks[skill] = 0;
  }
  state.levels[skill] = to;
  state.moved = to === from ? null : { skill, from, to };
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
