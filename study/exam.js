/* The shape of a practice test. One per unit, plus a cumulative one.

   Separate from app.js because it is the one part of the exam that can be
   checked without a browser: tools/test_exam.mjs expands the blueprint at
   every offered length and then builds every question it asks for. */

/* The blueprint for a Unit 2 practice test.

   Carter's ask, in his words: not one or two problems each, but twenty or
   thirty or forty, at varying difficulty. So this is a BLUEPRINT rather
   than a list of questions - shares and levels per skill - and the test is
   expanded from it to whatever length was asked for. The proportions come
   off his review sheet; the levels are what makes a thirty-question test
   feel like a test rather than thirty of the same thing.

   phase orders the paper the way a paper is ordered: the mechanical rules
   first, the transcendental mixes next, then the ones that ask what a
   derivative is FOR, and the implicit and logarithmic ones last. Within a
   phase it climbs by level. */
export const EXAM_PLAN = [
  /* The four rules, warming up. */
  { skill: 'power', share: 2, levels: [1, 2], phase: 1 },
  { skill: 'product', share: 2, levels: [2, 3], phase: 1 },
  { skill: 'quotient', share: 2, levels: [2, 3], phase: 1 },
  { skill: 'chain', share: 3, levels: [1, 2, 3], phase: 1 },

  /* The transcendental mixes - the bulk of the review sheet. */
  { skill: 'trig', share: 3, levels: [2, 3, 3], phase: 2 },
  { skill: 'exp', share: 2, levels: [2, 3], phase: 2 },
  { skill: 'log', share: 2, levels: [2, 3], phase: 2 },
  { skill: 'invtrig', share: 2, levels: [2, 3], phase: 2 },

  /* What a derivative is for. */
  { skill: 'limitdef', share: 2, levels: [2, 3], phase: 3 },
  { skill: 'tangent', share: 2, levels: [2, 3], phase: 3 },
  { skill: 'horizontal', share: 3, levels: [1, 2, 3], phase: 3 },
  { skill: 'secondderiv', share: 2, levels: [2, 3], phase: 3 },
  { skill: 'motion', share: 1, levels: [2], phase: 3 },

  /* The hard end, last, where it belongs. */
  { skill: 'implicit', share: 4, levels: [2, 2, 3, 3], phase: 4 },
  { skill: 'logdiff', share: 1, levels: [2], phase: 4 },
];

/* ===================================================== one paper per unit

   The blueprint above was the only one there was, which meant that once
   the course moved on you could drill the new unit but could not sit a
   paper on it - the mock test quietly stayed a Unit 2 paper forever.
   That is the worst kind of gap, because nothing announces it: the test
   still works, it is just testing last month.

   So papers are named. EXAM_PLAN stays exactly as it was and stays the
   default, because a link or a saved session that asked for "a paper"
   before any of this existed must still get the same paper.

   A cumulative paper is NOT the two lists concatenated. Sitting forty
   questions where thirty are revision is how you spend an evening
   confirming what you already knew, so it leans on the current unit and
   keeps the older one as the minority. */
export const PAPERS = {
  unit2: {
    id: 'unit2',
    name: 'Unit 2 \u00b7 Derivatives',
    blurb: 'The four rules, the transcendental mixes, the limit definition, '
      + 'tangents and implicit differentiation.',
    plan: EXAM_PLAN,
  },

  unit3: {
    id: 'unit3',
    name: 'Unit 3 \u00b7 Applications',
    blurb: 'Related rates, optimisation, and finding maxima and minima, with '
      + 'the rules they are built out of.',
    plan: [
      /* The rules underneath, warming up - a related rates question is a
         chain rule question wearing a hat, and a paper that opens with a
         cone is a paper nobody finishes. */
      { skill: 'chain', share: 2, levels: [1, 2], phase: 1 },
      { skill: 'implicit', share: 2, levels: [2, 2], phase: 1 },

      /* The unit itself, which is most of it. */
      { skill: 'extrema', share: 4, levels: [1, 2, 2, 3], phase: 2 },
      { skill: 'optimize', share: 3, levels: [1, 2, 3], phase: 2 },
      { skill: 'rates', share: 5, levels: [1, 2, 2, 3, 3], phase: 3 },

      /* The neighbours it sits between: where f' = 0 is the same
         question extrema asks, and the second derivative is what comes
         next after it. */
      { skill: 'horizontal', share: 2, levels: [2, 3], phase: 4 },
      { skill: 'concavity', share: 3, levels: [1, 2, 3], phase: 4 },
      { skill: 'secondderiv', share: 1, levels: [2], phase: 4 },
    ],
  },

  cumulative: {
    id: 'cumulative',
    name: 'Everything so far',
    blurb: 'Both units, weighted towards the one you are on now.',
    plan: [
      { skill: 'power', share: 1, levels: [2], phase: 1 },
      { skill: 'product', share: 1, levels: [2], phase: 1 },
      { skill: 'quotient', share: 1, levels: [2], phase: 1 },
      { skill: 'chain', share: 2, levels: [2, 3], phase: 1 },
      { skill: 'trig', share: 2, levels: [2, 3], phase: 2 },
      { skill: 'exp', share: 1, levels: [3], phase: 2 },
      { skill: 'log', share: 1, levels: [3], phase: 2 },
      { skill: 'limitdef', share: 1, levels: [2], phase: 2 },
      { skill: 'tangent', share: 1, levels: [2], phase: 3 },
      { skill: 'implicit', share: 2, levels: [2, 3], phase: 3 },
      /* The current unit, and deliberately the biggest share. */
      { skill: 'extrema', share: 3, levels: [2, 2, 3], phase: 4 },
      { skill: 'optimize', share: 2, levels: [2, 3], phase: 4 },
      { skill: 'rates', share: 4, levels: [1, 2, 3, 3], phase: 4 },
    ],
  },
};

export const PAPER_IDS = Object.keys(PAPERS);

/* The one a paper means when nobody said which. Kept as unit2 so every
   existing link, saved session and test keeps the paper it had. */
export const DEFAULT_PAPER = 'unit2';

export function paperFor(id) {
  return PAPERS[id] || PAPERS[DEFAULT_PAPER];
}

export const EXAM_LENGTHS = [20, 30, 40];

/* Expand the blueprint to exactly `count` question slots, keeping every
   skill represented and the proportions as close to the sheet as rounding
   allows. Trimming takes from whichever skill currently has the most slots,
   so a short test loses a second implicit question rather than losing
   implicit altogether. */
/* Which concepts a paper is allowed to be ABOUT.

   Turning one off does not mean never meeting it again: a chain rule
   question still uses the power rule, a quotient still has a polynomial on
   the bottom, and an implicit question is made of all of them. It means no
   question whose POINT is that concept. That distinction is the whole
   value of the switch - "I know the power rule, stop spending my revision
   on it" is a different request from "never show me a polynomial". */
export function planFor(skip = [], paper = DEFAULT_PAPER) {
  const base = paperFor(paper).plan;
  const off = new Set(skip || []);
  const left = base.filter((e) => !off.has(e.skill));
  /* Everything switched off is a mistake, not a request: a paper with no
     questions is worse than ignoring the switches. */
  return left.length ? left : base;
}

/* Everything a paper can be about, for the switches themselves. */
export function examConcepts(paper = DEFAULT_PAPER) {
  return paperFor(paper).plan
    .map((e) => ({ skill: e.skill, share: e.share, phase: e.phase }));
}

export function examSlots(count, opts = {}) {
  const plan = planFor(opts.skip, opts.paper);
  const total = plan.reduce((s, e) => s + e.share, 0);
  const slots = [];
  for (const entry of plan) {
    const n = Math.max(1, Math.round((entry.share / total) * count));
    for (let i = 0; i < n; i++) {
      slots.push({
        skill: entry.skill,
        level: entry.levels[i % entry.levels.length],
        phase: entry.phase,
      });
    }
  }
  const countOf = (skill) => slots.filter((s) => s.skill === skill).length;
  const shareOf = (skill) => (plan.find((e) => e.skill === skill) || {}).share || 0;
  while (slots.length > count) {
    let worst = -1;
    let worstN = 1;
    slots.forEach((s, i) => {
      const n = countOf(s.skill);
      if (n > worstN) { worstN = n; worst = i; }
    });
    /* Below one question per skill something has to go entirely. The
       smallest share goes first, so a short test keeps the four rules and
       the implicit questions and loses the single motion problem - and a
       test of 12 is 12 questions, not a silent 15. */
    if (worst === -1) {
      let lowest = Infinity;
      slots.forEach((s, i) => {
        const share = shareOf(s.skill);
        if (share < lowest) { lowest = share; worst = i; }
      });
    }
    if (worst === -1) break;
    slots.splice(worst, 1);
  }
  /* Padding happens for a long test: go round again adding to the biggest
     shares, which is where more practice is actually wanted. */
  const byShare = plan.slice().sort((a, b) => b.share - a.share);
  let k = 0;
  while (slots.length < count) {
    const entry = byShare[k % byShare.length];
    k++;
    slots.push({
      skill: entry.skill,
      level: entry.levels[(k * 7) % entry.levels.length],
      phase: entry.phase,
    });
  }
  slots.sort((a, b) => (a.phase - b.phase) || (a.level - b.level));
  return slots;
}
