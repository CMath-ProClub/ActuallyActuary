/* The shape of a Unit 2 practice test.

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

export const EXAM_LENGTHS = [20, 30, 40];

/* Expand the blueprint to exactly `count` question slots, keeping every
   skill represented and the proportions as close to the sheet as rounding
   allows. Trimming takes from whichever skill currently has the most slots,
   so a short test loses a second implicit question rather than losing
   implicit altogether. */
export function examSlots(count) {
  const total = EXAM_PLAN.reduce((s, e) => s + e.share, 0);
  const slots = [];
  for (const entry of EXAM_PLAN) {
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
  const shareOf = (skill) => (EXAM_PLAN.find((e) => e.skill === skill) || {}).share || 0;
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
  const byShare = EXAM_PLAN.slice().sort((a, b) => b.share - a.share);
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
