/* How sure can you be about a percentage?

   "You are at 71% on implicit differentiation" is a number this app has
   always been happy to print. After six attempts it means almost
   nothing - four out of six is 67% and five out of six is 83%, and one
   question moved it sixteen points. Printing it to the nearest percent
   implies a precision that is not there, and the dashboard already
   carries a warning saying so in words.

   This says it in numbers instead, which is both more honest and more
   useful: it gives the interval the true rate plausibly lies in, and
   that interval is WIDE when there is little data and narrow when there
   is a lot. Six attempts at 67% comes out as "somewhere between 30% and
   90%", which tells you to go and answer more questions. Sixty attempts
   at 67% comes out as "between 54% and 78%", which tells you something
   real.

   =================================================================
   WILSON, NOT THE OBVIOUS ONE
   =================================================================

   The interval everybody writes first is p +/- 1.96*sqrt(p(1-p)/n).
   It is wrong exactly where this app needs it most. At 100% it gives a
   width of ZERO - six out of six becomes "100%, certainly" - and near
   the ends it runs past 0 or 100, so a weak topic gets a lower bound of
   minus eight percent.

   The Wilson score interval has neither failure. It never leaves
   [0, 1], and six out of six comes out as 61% to 100%, which is the
   honest reading of six questions.

   NOTHING HERE PREDICTS AN EXAM SCORE. It is the accuracy on questions
   this app generated, with an honest width on it. plan.js refuses to
   claim readiness and so does this. */

/* 95%: 1.96. Kept as a named constant because the number is otherwise
   completely opaque to anybody reading this later. */
const Z = 1.959964;

/* The interval, and whether it is worth showing at all. */
export function wilson(correct, total, z = Z) {
  const n = Math.max(0, Math.round(total || 0));
  const k = Math.min(n, Math.max(0, Math.round(correct || 0)));
  if (!n) {
    return { n: 0, rate: null, low: null, high: null, width: null, enough: false };
  }

  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const spread = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  const low = Math.max(0, centre - spread);
  const high = Math.min(1, centre + spread);

  return {
    n,
    correct: k,
    rate: p,
    low,
    high,
    width: high - low,
    /* An interval wider than forty points is not a measurement, it is a
       shrug. Below that this will say so rather than draw a bar that
       looks like information. */
    enough: (high - low) <= 0.4,
  };
}

/* How many more questions, roughly, to get the interval under `want`.

   Solved by walking n upward rather than algebraically, because the
   Wilson width is not a tidy function of n and this only ever needs to
   be right to the nearest handful. Capped, because "answer 400 more
   questions" is not advice. */
export function moreNeeded(correct, total, want = 0.4, cap = 200) {
  const now = wilson(correct, total);
  if (!now.n) return cap;
  if (now.width != null && now.width <= want) return 0;
  const p = now.rate;
  for (let extra = 1; extra <= cap; extra++) {
    const n = now.n + extra;
    /* Assume the rate holds, which is the only assumption available. */
    const k = Math.round(p * n);
    if (wilson(k, n).width <= want) return extra;
  }
  return cap;
}

/* The sentence a person reads. Never a grade, never a prediction. */
export function describe(correct, total, name = 'this') {
  const w = wilson(correct, total);
  if (!w.n) return `No attempts at ${name} yet.`;
  const pct = (x) => `${Math.round(x * 100)}%`;

  if (!w.enough) {
    const more = moreNeeded(correct, total);
    return `${w.correct} of ${w.n} right, but that only pins ${name} down to `
      + `somewhere between ${pct(w.low)} and ${pct(w.high)}. `
      + (more >= 200
        ? 'Far too little to read anything into.'
        : `About ${more} more question${more === 1 ? '' : 's'} would make that `
          + 'mean something.');
  }
  return `${pct(w.rate)} on ${name}, give or take - the true rate is between `
    + `${pct(w.low)} and ${pct(w.high)} on ${w.n} attempts.`;
}

/* Is one topic genuinely worse than another, or is it just noise?

   Two topics whose intervals OVERLAP have not been shown to differ, and
   saying "implicit is your weakest" off four attempts against sixty is
   how a dashboard invents a problem. */
export function clearlyWorse(a, b) {
  const wa = wilson(a.correct, a.total);
  const wb = wilson(b.correct, b.total);
  if (!wa.n || !wb.n) return false;
  return wa.high < wb.low;
}

export default { wilson, moreNeeded, describe, clearlyWorse };
