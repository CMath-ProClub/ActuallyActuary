/* Somewhere to go when the working is not enough.

   "If I'm really struggling, could you find some links to some YouTube
   videos that might be helpful to watch?"

   Every link here was opened and its title read back before it was written
   down. That matters more than it sounds: a study tool that sends somebody
   to a dead link at eleven at night, the day before a test, is worse than
   one that offers nothing - and a list of plausible-looking video IDs is
   exactly the sort of thing that is easy to produce and impossible to
   trust. If a link ever does rot, the fix is to open it, not to guess a
   new one.

   These are OUTSIDE links to other people's teaching. They are labelled as
   such, with who made them, because sending somebody off this site without
   saying so is not how a tool should behave. */

/* Checked on 27 October 2026. Each `title` is what the page itself said. */
const LECTURE = 'Professor Leonard';

const VIDEOS = {
  'c1-2.1': {
    url: 'https://www.youtube.com/watch?v=962lLfW-8Jo',
    title: 'Calculus 1 Lecture 2.1: Introduction to the Derivative of a Function',
    who: LECTURE,
  },
  'c1-2.2': {
    url: 'https://www.youtube.com/watch?v=EY6FHX6asU0',
    title: 'Calculus 1 Lecture 2.2: Techniques of Differentiation',
    who: LECTURE,
  },
  'c1-2.3': {
    url: 'https://www.youtube.com/watch?v=AvCQQ3X4Nuc',
    title: 'Calculus 1 Lecture 2.3: The Product and Quotient Rules for Derivatives',
    who: LECTURE,
  },
  'c1-2.4': {
    url: 'https://www.youtube.com/watch?v=qr1WXiq3S3k',
    title: 'Calculus 1 Lecture 2.4: Applications of the Derivative',
    who: LECTURE,
  },
  'c1-2.5': {
    url: 'https://www.youtube.com/watch?v=RJJSiNz5oto',
    title: 'Calculus 1 Lecture 2.5: Finding Derivatives of Trigonometric Functions',
    who: LECTURE,
  },
  'c1-2.6': {
    url: 'https://www.youtube.com/watch?v=8dr1dZjfhmc',
    title: 'Calculus 1 Lecture 2.6: Discussion of the Chain Rule for Derivatives',
    who: LECTURE,
  },
  'c1-2.7': {
    url: 'https://www.youtube.com/watch?v=RUS4mKo9tBk',
    title: 'Calculus 1 Lecture 2.7: Implicit Differentiation',
    who: LECTURE,
  },
  'c1-2.7b': {
    url: 'https://www.youtube.com/watch?v=t4kL2l6w9f0',
    title: 'Calculus 1 Lecture 2.7 Part 1',
    who: LECTURE,
  },
  'c1-3.1': {
    url: 'https://www.youtube.com/watch?v=vNWz20_bPTA',
    title: 'Calculus 1 Lecture 3.1 Part 1 (increasing, decreasing and concavity)',
    who: LECTURE,
  },
  explog: {
    url: 'https://www.youtube.com/watch?v=zmnh448y_ZU',
    title: 'Derivatives of Exponential Functions & Logarithmic Differentiation',
    who: '',
  },
  logdiff: {
    url: 'https://www.youtube.com/watch?v=RVzCQajuw4A',
    title: 'Regular derivative vs. logarithmic derivative',
    who: 'blackpenredpen',
  },
  invtrig: {
    url: 'https://www.youtube.com/watch?v=KbYW9FDm-Zk',
    title: 'Derivatives of Inverse Trigonometric Functions',
    who: '',
  },
};

/* Which videos belong to which skill, and one line on what to watch for -
   because "go and watch an hour of calculus" is not help, and "the bit
   where he collects the dy/dx terms" is. */
const BY_SKILL = {
  limitdef: [
    ['c1-2.1', 'The whole difference quotient, worked out slowly.'],
  ],
  power: [
    ['c1-2.2', 'The rules for polynomials, roots and negative powers.'],
  ],
  product: [
    ['c1-2.3', 'Why it is not f prime times g prime.'],
  ],
  quotient: [
    ['c1-2.3', 'The order of the numerator is the part people get backwards.'],
  ],
  chain: [
    ['c1-2.6', 'Outside first, then multiply by the derivative of the inside.'],
  ],
  trig: [
    ['c1-2.5', 'All six, and where the minus signs live.'],
  ],
  exp: [
    ['explog', 'e to a power, and what happens when the base is not e.'],
  ],
  log: [
    ['explog', 'ln(u) is u prime over u, not one over u.'],
  ],
  invtrig: [
    ['invtrig', 'The three formulas, and where the square root comes from.'],
  ],
  implicit: [
    ['c1-2.7', 'Differentiate both sides, then collect every dy/dx on one side.'],
    ['c1-2.7b', 'The same lecture in parts, if the long one is too much.'],
  ],
  logdiff: [
    ['logdiff', 'When taking logs first is easier than the rules.'],
    ['explog', 'x^x and friends, worked through.'],
  ],
  tangent: [
    ['c1-2.1', 'The derivative IS the slope of the tangent line.'],
  ],
  horizontal: [
    ['c1-3.1', 'Where the derivative is zero, and what it means.'],
  ],
  secondderiv: [
    ['c1-3.1', 'What the second derivative tells you about the shape.'],
  ],
  motion: [
    ['c1-2.4', 'Position, velocity and acceleration as derivatives.'],
  ],
};

/* The four shapes the lock-in tab drills all come back to the same two
   lectures, which is itself worth knowing. */
const BY_FAMILY = {
  'trig-xy': ['c1-2.7', 'c1-2.5'],
  'cos-powers': ['c1-2.7', 'c1-2.6'],
  'exp-xy': ['c1-2.7', 'explog'],
  'log-xy': ['c1-2.7', 'explog'],
};

function entry(id, why) {
  const video = VIDEOS[id];
  if (!video) return null;
  return { ...video, why: why || '' };
}

/* Videos for a skill, worst case an empty list. */
export function helpFor(skill) {
  const rows = BY_SKILL[skill] || [];
  return rows.map(([id, why]) => entry(id, why)).filter(Boolean);
}

/* Videos for one of the lock-in shapes. */
export function helpForFamily(family) {
  const ids = BY_FAMILY[family] || [];
  return ids.map((id) => entry(id, '')).filter(Boolean);
}

/* Everything, for a page that wants to list them. */
export function allHelp() {
  return Object.keys(BY_SKILL).map((skill) => ({ skill, videos: helpFor(skill) }));
}

export default { helpFor, helpForFamily, allHelp };
