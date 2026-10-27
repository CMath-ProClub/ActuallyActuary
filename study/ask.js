/* Turning a sentence into a practice plan.

   You type "I need to work on my trig derivatives, give me plain ones and a
   hint if I am close" and this works out that you mean the trig skill, at the
   easy level, with hints on. It is a DICTIONARY, not a model: phrases map to
   skills, and anything it cannot place is handed back as unrecognised so the
   page can ask rather than guess.

   Why not send the sentence to the local model, when there is one running? A
   model would read the sentence better, and would also sometimes decide you
   asked for integrals when you asked for derivatives. This runs instantly,
   works with the machine off, is identical on every device, and can be tested.
   The model's job in this tool is reading handwriting, which is the thing it
   is actually better at than code.

   Keep PHRASES honest: every entry must name a real skill in gen-sandbox.js
   or a real topic id in topics.js, and tools/test_flow.mjs fails the build if
   one does not exist. */

import { SKILLS } from './gen-sandbox.js';
import { TOPICS, TOPIC_BY_ID } from './topics.js';

/* Words that mean a sandbox skill. Longest match wins, so "chain rule" is
   found before "rule", and "logarithmic differentiation" before "log". */
const SKILL_PHRASES = [
  /* Longer than "trig derivative", which would otherwise claim this first
     and leave the word inverse stranded. */
  ['inverse trig derivative', 'invtrig'],
  ['inverse trig', 'invtrig'],
  ['arc trig', 'invtrig'],
  ['arcsin', 'invtrig'],
  ['arccos', 'invtrig'],
  ['arctan', 'invtrig'],
  ['inverse sine', 'invtrig'],
  ['inverse cosine', 'invtrig'],
  ['inverse tangent', 'invtrig'],
  ['limit definition', 'limitdef'],
  ['difference quotient', 'limitdef'],
  ['first principles', 'limitdef'],
  ['tangent lines', 'tangent'],
  ['tangent line', 'tangent'],
  ['equation of the tangent', 'tangent'],
  ['horizontal tangents', 'horizontal'],
  ['horizontal tangent', 'horizontal'],
  ['where the derivative is zero', 'horizontal'],
  ['second derivatives', 'secondderiv'],
  ['second derivative', 'secondderiv'],
  ['double prime', 'secondderiv'],
  ['concavity', 'secondderiv'],
  ['velocity and acceleration', 'motion'],
  ['acceleration', 'motion'],
  ['velocity', 'motion'],
  ['position function', 'motion'],
  ['cosecant', 'trig'],
  ['secant', 'trig'],
  ['cotangent', 'trig'],
  ['csc', 'trig'],
  ['cot', 'trig'],
  ['tangent', 'trig'],
  ['sine', 'trig'],
  ['cosine', 'trig'],
  ['u substitution', 'usub'],
  ['u-substitution', 'usub'],
  ['usub', 'usub'],
  ['substitution', 'usub'],
  ['antiderivative', 'antiderivative'],
  ['indefinite integral', 'antiderivative'],
  ['integral', 'antiderivative'],
  ['integrate', 'antiderivative'],
  ['integration', 'antiderivative'],
  ['factoring', 'factor'],
  ['factorise', 'factor'],
  ['factorize', 'factor'],
  ['factor', 'factor'],
  ['expanding', 'expand'],
  ['expand', 'expand'],
  ['multiply out', 'expand'],
  ['foil', 'expand'],
  ['logarithmic differentiation', 'logdiff'],
  ['logarithmic derivation', 'logdiff'],
  ['log differentiation', 'logdiff'],
  ['implicit differentiation', 'implicit'],
  ['implicit derivative', 'implicit'],
  ['implicit', 'implicit'],
  ['chain rule', 'chain'],
  ['chain', 'chain'],
  ['product rule', 'product'],
  ['product', 'product'],
  ['quotient rule', 'quotient'],
  ['quotient', 'quotient'],
  ['trig derivative', 'trig'],
  ['trigonometric', 'trig'],
  ['trig', 'trig'],
  ['natural log', 'log'],
  ['ln ', 'log'],
  ['logarithm', 'log'],
  ['log', 'log'],
  ['exponential', 'exp'],
  ['e to the', 'exp'],
  ['power rule', 'power'],
  ['polynomial', 'power'],
  ['power', 'power'],
];

/* Words that mean a whole course, for when the ask is broad: "help me with
   algebra 2" is a curriculum request, not a sandbox skill. */
const COURSE_PHRASES = [
  ['algebra 2', 'alg2'],
  ['algebra ii', 'alg2'],
  ['algebra', 'alg2'],
  ['precalculus', 'precalc'],
  ['precalc', 'precalc'],
  ['pre-calc', 'precalc'],
  ['trigonometry', 'precalc'],
  ['calculus 1', 'calc1'],
  ['calculus i', 'calc1'],
  ['calc 1', 'calc1'],
  ['calculus', 'calc1'],
  ['exam p', 'examp'],
  ['probability', 'examp'],
  ['computer science', 'cs'],
];

/* Dials the sentence can turn. */
const HARDER = ['longer', 'harder', 'tough', 'challenging', 'difficult', 'hard',
  'complicated', 'messy', 'advanced', 'test me'];
const EASIER = ['plain', 'simple', 'easy', 'basic', 'straightforward', 'short',
  'gentle', 'warm up', 'warmup', 'start slow'];
const WANTS_HINTS = ['hint', 'tip', 'nudge', 'close but', 'if i am close',
  'help me when', 'tell me what i did', 'what i did wrong'];
const NO_HINTS = ['no hint', 'without hint', 'do not hint', 'dont hint',
  'no help', 'cold'];
const WANTS_QUIZ = ['quiz', 'test me', 'exam', 'timed', 'graded'];
const WANTS_STEPS = ['show me how', 'walk me through', 'worked', 'explain',
  'show the steps', 'show steps'];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9+\- ']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Longest phrase first, and a match REMOVES its text before shorter phrases
   get a look.

   That consumption is the whole trick. "logarithmic derivations" contains the
   word "log", so without it the sentence asks for logarithmic
   differentiation AND for plain logs, and half the problems come back wrong
   for what was asked. Matching the longest phrase first and deleting it
   leaves nothing for "log" to find. */
function findAll(haystack, phrases) {
  const hits = [];
  const ordered = [...phrases].sort((a, b) => b[0].length - a[0].length);
  let left = ` ${haystack} `;
  for (const [phrase, id] of ordered) {
    if (!left.includes(phrase)) continue;
    if (!hits.includes(id)) hits.push(id);
    left = left.split(phrase).join(' ');
  }
  return hits;
}

function has(haystack, words) {
  return words.some((w) => haystack.includes(w));
}

/* A number of questions, when the sentence says one: "give me 15 problems",
   "a 20 question quiz". */
function findCount(text) {
  const m = text.match(/(\d{1,3})\s*(?:problems?|questions?|probs?|q\b|items?)/)
    || text.match(/(?:quiz|test)\s*(?:of|with)?\s*(\d{1,3})/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 100 ? n : null;
}

/* The one public call. Returns a plan plus what it understood, so the page
   can show its reading back and let you correct it rather than silently
   practising the wrong thing. */
export function interpret(raw) {
  const text = normalize(raw);
  const skills = findAll(text, SKILL_PHRASES).filter((s) => SKILLS[s]);
  const courses = findAll(text, COURSE_PHRASES);

  /* A course named on its own means curriculum topics. A skill named at all
     means the sandbox, because that is the more specific request. */
  const topicIds = [];
  if (!skills.length && courses.length) {
    for (const t of TOPICS) {
      if (t.gen && courses.includes(t.course)) topicIds.push(t.id);
    }
  }

  const wantsHarder = has(text, HARDER);
  const wantsEasier = has(text, EASIER);
  const level = wantsHarder ? 3 : wantsEasier ? 1 : 2;

  const hints = has(text, NO_HINTS) ? false : has(text, WANTS_HINTS) ? true : null;
  const count = findCount(text);

  const understood = [];
  for (const s of skills) understood.push(SKILLS[s].name);
  if (!skills.length) {
    for (const c of courses) {
      const course = TOPICS.find((t) => t.course === c);
      understood.push(course ? c : c);
    }
  }

  return {
    text: String(raw || '').trim(),
    skills,
    topicIds,
    level,
    hints,
    count,
    format: has(text, WANTS_QUIZ) ? 'quiz' : 'practice',
    wantsSteps: has(text, WANTS_STEPS),
    /* Nothing recognised is a real answer, not an error. The page offers the
       skill list instead of starting something arbitrary. */
    recognised: skills.length > 0 || topicIds.length > 0,
    understood,
  };
}

/* Everything the page can offer as a chip, so the list cannot drift out of
   step with what the generators actually support. */
export function skillMenu() {
  return Object.keys(SKILLS).map((id) => ({
    id,
    name: SKILLS[id].name,
    ask: SKILLS[id].ask,
    topicId: SKILLS[id].topicId,
  }));
}

export function courseMenu() {
  const seen = new Map();
  for (const t of TOPICS) {
    if (!t.gen) continue;
    if (!seen.has(t.course)) seen.set(t.course, []);
    seen.get(t.course).push(t.id);
  }
  return [...seen.entries()].map(([course, ids]) => ({ course, ids }));
}

/* A sentence for the plan, used in the confirmation line and in the session
   label that gets stored with each attempt. */
export function describe(plan) {
  if (!plan) return '';
  const names = plan.skills && plan.skills.length
    ? plan.skills.map((s) => (SKILLS[s] ? SKILLS[s].name : s))
    : (plan.topicIds || []).slice(0, 3)
      .map((id) => (TOPIC_BY_ID[id] ? TOPIC_BY_ID[id].name : id));
  if (!names.length) return 'Mixed practice';
  const list = names.length === 1 ? names[0]
    : names.length === 2 ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const depth = plan.level === 3 ? ', longer problems' : plan.level === 1 ? ', plain ones' : '';
  return `${list}${depth}`;
}

export default { interpret, skillMenu, courseMenu, describe };
