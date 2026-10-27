/* What keeps going wrong, and what to do about it.

   expr.js already works out WHY an answer was wrong - the inside derivative
   was never applied, the product rule was used as f'g', the sign on cosine
   went missing - and then that finding was thrown away the moment it was
   shown. An attempt recorded `correct: false` and nothing else, so the tool
   could tell you that chain rule was shaky but never that you make the SAME
   slip every time.

   This keeps it. Each attempt now carries the diagnosis, and this module
   turns a pile of them into: here is the mistake you make most, here is what
   it is, and here is a drill aimed squarely at it.

   The honest limits are the same ones the rest of the project keeps to. A
   handful of attempts is not a pattern, so nothing is claimed below a floor.
   And a misread answer is a notation problem rather than a mathematical one,
   so it is counted separately instead of being folded in with real errors. */

import { SKILLS } from './gen-sandbox.js';

/* Every diagnosis the engine can produce, in plain words, with the skills
   worth drilling when it keeps happening.

   `teachable` marks the ones that say something about the maths. The others
   are real and worth showing, but they are about typing or about answering
   the wrong question, and lumping them in with method errors would overstate
   how much is going wrong. */
export const DIAGNOSES = {
  'chain-missing': {
    label: 'Stopping after the outside derivative',
    detail: 'The inside derivative still has to multiply in.',
    skills: ['chain', 'trig', 'exp', 'log'],
    teachable: true,
  },
  'chain-twice': {
    label: 'Applying the inside derivative twice',
    detail: 'It multiplies in once, not once per layer you look at.',
    skills: ['chain'],
    teachable: true,
  },
  'product-naive': {
    label: 'Product rule as f prime times g prime',
    detail: 'It is the first times the derivative of the second, plus the other way round.',
    skills: ['product'],
    teachable: true,
  },
  'quotient-swapped': {
    label: 'Quotient rule numerator the wrong way round',
    detail: 'Bottom times the top derivative comes first, then subtract.',
    skills: ['quotient'],
    teachable: true,
  },
  'cos-sign': {
    label: 'Losing the minus on cosine',
    detail: 'd/dx cos(u) is MINUS sin(u) times u prime.',
    skills: ['trig'],
    teachable: true,
  },
  'sin-sign': {
    label: 'Adding a minus to sine',
    detail: 'Only cosine picks up the minus sign.',
    skills: ['trig'],
    teachable: true,
  },
  'power-not-reduced': {
    label: 'Keeping the exponent',
    detail: 'The power rule drops it by one.',
    skills: ['power'],
    teachable: true,
  },
  'ln-chain-missing': {
    label: 'Logs without the inside derivative',
    detail: 'd/dx ln(u) is u prime over u, not one over u.',
    skills: ['log'],
    teachable: true,
  },
  'exp-chain-missing': {
    label: 'Exponentials without the inside derivative',
    detail: 'e to a power reproduces itself, then the exponent derivative multiplies in.',
    skills: ['exp'],
    teachable: true,
  },
  factor: {
    label: 'A coefficient lost or counted twice',
    detail: 'The shape was right and the number in front was not.',
    skills: ['chain', 'trig', 'power'],
    teachable: true,
  },
  sign: {
    label: 'Every sign flipped',
    detail: 'Usually one rule that carries a minus.',
    skills: ['trig', 'chain'],
    teachable: true,
  },
  partial: {
    label: 'One term off in a longer answer',
    detail: 'The method held up; a single piece did not.',
    skills: ['product', 'chain', 'power'],
    teachable: true,
  },
  offset: {
    label: 'A constant term wrong',
    detail: 'Everything varies correctly, the level is off.',
    skills: ['power'],
    teachable: true,
  },
  zero: {
    label: 'Answering zero',
    detail: 'Only a constant function has a zero derivative.',
    skills: ['power'],
    teachable: true,
  },
  'y-as-constant': {
    label: 'Treating y as a number',
    detail: 'Differentiating a y term leaves a dy/dx behind.',
    skills: ['implicit'],
    teachable: true,
  },
  reciprocal: {
    label: 'Solving for dx/dy',
    detail: 'The question asked for dy/dx. Flip it.',
    skills: ['implicit'],
    teachable: true,
  },
  'tangent-slope-only': {
    label: 'A slope where a line was wanted',
    detail: 'A tangent line needs the point as well: y = f(a) + f\u2032(a)(x \u2212 a).',
    skills: ['tangent'],
    teachable: true,
  },
  'tangent-value-only': {
    label: 'The height without the slope',
    detail: 'f(a) is where the line touches. It still has to lean.',
    skills: ['tangent'],
    teachable: true,
  },
  'only-once': {
    label: 'Stopping after the first derivative',
    detail: 'A second derivative, or an acceleration, means differentiating twice.',
    skills: ['secondderiv', 'motion'],
    teachable: true,
  },
  'incomplete-set': {
    label: 'Stopping at the first solution',
    detail: 'A factored equation is zero wherever ANY factor is zero. Check each one.',
    skills: ['horizontal'],
    teachable: true,
  },
  'extra-root': {
    label: 'A solution that is not one',
    detail: 'Usually a factor that can never be zero, like e to a power, or a '
      + 'value outside the interval the question gave.',
    skills: ['horizontal'],
    teachable: true,
  },
  'not-differentiated': {
    label: 'Answering with f itself',
    detail: 'The question asked for its derivative.',
    skills: [],
    teachable: false,
  },
  'not-integrated': {
    label: 'Answering with the integrand',
    detail: 'The question asked for its antiderivative.',
    skills: ['antiderivative'],
    teachable: false,
  },
  'not-factored': {
    label: 'Right value, not factored',
    detail: 'The algebra was right; the answer was not written as a product.',
    skills: ['factor'],
    teachable: false,
  },
  'not-expanded': {
    label: 'Right value, not multiplied out',
    detail: 'The algebra was right; the brackets are still there.',
    skills: ['expand'],
    teachable: false,
  },
  unreadable: {
    label: 'Answers that could not be read',
    detail: 'A notation problem rather than a maths one. Check brackets and operators.',
    skills: [],
    teachable: false,
  },
  undecidable: {
    label: 'Answers the checker could not verify',
    detail: 'Not your fault: there was nowhere to compare the two sides.',
    skills: [],
    teachable: false,
  },
  wrong: {
    label: 'Wrong, with no pattern found',
    detail: 'Nothing specific to say about these ones.',
    skills: [],
    teachable: false,
  },
};

/* Below this, a count is noise rather than a pattern. The same reasoning as
   the thirty-trade floor the backtester uses before it will report a result. */
export const PATTERN_FLOOR = 3;

export function describeDiagnosis(kind) {
  return DIAGNOSES[kind] || null;
}

/* Count up the diagnoses in a set of attempts.

   `window` limits how far back to look, because a mistake you fixed three
   weeks ago is not a mistake you make. */
export function summarize(attempts, { windowSize = 120, since = 0 } = {}) {
  const recent = (attempts || [])
    .filter((a) => a && !a.correct && a.diagnosis && (!since || a.ts >= since))
    .slice(-windowSize);

  const byKind = new Map();
  for (const attempt of recent) {
    const kind = attempt.diagnosis;
    if (!byKind.has(kind)) {
      byKind.set(kind, { kind, count: 0, topics: new Map(), last: 0 });
    }
    const row = byKind.get(kind);
    row.count += 1;
    row.last = Math.max(row.last, attempt.ts || 0);
    if (attempt.topicId) {
      row.topics.set(attempt.topicId, (row.topics.get(attempt.topicId) || 0) + 1);
    }
  }

  return [...byKind.values()]
    .map((row) => {
      const meta = DIAGNOSES[row.kind] || {
        label: row.kind, detail: '', skills: [], teachable: false,
      };
      return {
        ...row,
        label: meta.label,
        detail: meta.detail,
        teachable: !!meta.teachable,
        /* Only offer a drill for a skill that actually exists. */
        skills: (meta.skills || []).filter((s) => SKILLS[s]),
        topics: [...row.topics.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, count]) => ({ id, count })),
      };
    })
    .sort((a, b) => b.count - a.count || b.last - a.last);
}

/* The one worth telling someone about: the most common TEACHABLE mistake
   that has happened enough times to be a pattern. */
export function headline(attempts, options = {}) {
  const rows = summarize(attempts, options);
  return rows.find((r) => r.teachable && r.count >= PATTERN_FLOOR) || null;
}

/* A practice spec aimed at one mistake. Falls back to the skills the mistake
   is associated with when the attempts do not name a sandbox skill. */
export function drillFor(row) {
  if (!row) return null;
  const skills = row.skills && row.skills.length ? row.skills : [];
  if (!skills.length) return null;
  return {
    skills,
    /* Drill at the level where the mistake lives rather than the hardest
       one available: the point is repetition of the step that goes wrong. */
    level: 2,
    hints: true,
    label: `Drilling: ${row.label.toLowerCase()}`,
  };
}

/* A plain-language line for a session summary. Returns null when there is
   nothing worth saying, which is most of the time and is fine. */
export function sessionNote(attempts, sessionStart) {
  const rows = summarize(attempts, { since: sessionStart, windowSize: 60 });
  const top = rows.find((r) => r.teachable && r.count >= 2);
  if (!top) return null;
  return `${top.count} of the misses this session were the same thing: `
    + `${top.label.toLowerCase()}. ${top.detail}`;
}

export default { DIAGNOSES, PATTERN_FLOOR, summarize, headline, drillFor, sessionNote, describeDiagnosis };
