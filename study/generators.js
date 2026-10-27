/* The generator registry, plus problem instantiation and grading.

   A problem is identified by (topicId, difficulty, seed), which is all that is
   ever stored. Re-generating from those three values gives back the identical
   problem, so a mock test is a few hundred bytes, syncs instantly, and can be
   reopened months later and still be the same test. */

import MathKit from './math.js';
import { TOPIC_BY_ID } from './topics.js';
import * as ALG from './gen-algebra.js';
import * as CALC from './gen-calculus.js';
import * as ACT from './gen-actuarial.js';
import * as CS from './gen-cs.js';
import { gradeExpression } from './gen-sandbox.js';

const { rng, hashSeed, parseNumber, numericEqual, textEqual, setReport, esc } = MathKit;

export const REGISTRY = { ...ALG, ...CALC, ...ACT, ...CS };

/* Topics whose generator is missing would fail silently at practice time, so
   the app asks this up front and simply does not offer them. */
export function hasGenerator(topicId) {
  const t = TOPIC_BY_ID[topicId];
  return !!(t && t.gen && typeof REGISTRY[t.gen] === 'function');
}

export function generatableTopics() {
  return Object.keys(TOPIC_BY_ID).filter(hasGenerator);
}

let seedCounter = 0;
export function freshSeed() {
  /* Date plus a counter: unique within a session, and unpredictable enough
     that two profiles practicing at once do not get identical problems. */
  seedCounter = (seedCounter + 1) % 100000;
  return (hashSeed(`${Date.now()}:${seedCounter}:${Math.random()}`) >>> 0);
}

/* Build one problem. Returns null (rather than throwing) when a generator is
   missing or blows up, so one bad topic cannot take down a whole test. */
export function generate(topicId, difficulty = 1, seed = null) {
  const t = TOPIC_BY_ID[topicId];
  if (!t || !t.gen) return null;
  const fn = REGISTRY[t.gen];
  if (typeof fn !== 'function') return null;
  const s = seed == null ? freshSeed() : seed >>> 0;
  const lvl = Math.max(1, Math.min(3, Math.round(difficulty)));
  let p;
  try {
    p = fn(rng(s), lvl);
  } catch (err) {
    if (typeof console !== 'undefined') console.error(`generator ${t.gen} failed`, err);
    return null;
  }
  if (!p || !p.stem) return null;
  return {
    ...p,
    topicId,
    difficulty: lvl,
    seed: s,
    key: `${topicId}:${lvl}:${s}`,
    topicName: t.name,
    courseId: t.course,
  };
}

/* Generate n problems across a weighted list of topics, skipping duplicates
   and anything whose generator fails. */
export function generateMany(spec, count) {
  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < count && guard++ < count * 25) {
    const pick = weightedPick(spec);
    if (!pick) break;
    const p = generate(pick.topicId, pick.difficulty);
    if (!p) continue;
    /* The stem is the identity that matters: two different seeds can land on
       the same question for small parameter spaces. */
    const fingerprint = `${p.topicId}|${p.stem}`;
    if (used.has(fingerprint)) continue;
    used.add(fingerprint);
    out.push(p);
  }
  return out;
}

function weightedPick(spec) {
  const total = spec.reduce((a, s) => a + (s.weight || 1), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const s of spec) {
    r -= (s.weight || 1);
    if (r <= 0) return s;
  }
  return spec[spec.length - 1];
}

/* ===================================================================== grading */

/* Returns { correct, detail }. `detail` is shown only when the answer is
   wrong, and says what was read rather than just "incorrect" - a student who
   typed a correct value in an unreadable format deserves to know which it was. */
export function grade(problem, response) {
  if (problem == null) return { correct: false, detail: '' };
  /* A question asked in parts arrives as an array of lines. Everything
     else is one string. */
  if (problem.kind === 'parts') {
    const lines = Array.isArray(response) ? response : [response];
    if (!lines.some((l) => String(l == null ? '' : l).trim())) {
      return { correct: false, detail: 'No answer given.' };
    }
    const v = gradeExpression(problem, lines);
    return {
      correct: v.correct,
      detail: v.hint || '',
      decided: v.decided !== false,
      diagnosis: v.kind || '',
      parts: v.parts || [],
    };
  }
  const raw = response == null ? '' : String(response).trim();
  if (!raw) return { correct: false, detail: 'No answer given.' };

  switch (problem.kind) {
    /* A typed-in function rather than a value. The sandbox builds these, and
       expr.js decides whether what was typed is the same function as the
       answer, in whatever form it was written. Unlike every other kind here
       it can also come back UNDECIDED, when there were not enough points
       where both sides are defined to compare them; that is reported rather
       than counted as wrong. */
    /* All four are marked by the expression engine; gradeExpression picks
       the right question to ask of the answer. */
    /* A multi-line answer. `raw` is an array of lines, and the sandbox
       grader marks each against its own reference. */
    case 'parts':
    case 'antiderivative':
    case 'factored':
    case 'expanded':
    case 'expression': {
      const v = gradeExpression(problem, raw);
      return {
        correct: v.correct,
        detail: v.hint || '',
        decided: v.decided !== false,
        diagnosis: v.kind || '',
      };
    }

    case 'choice': {
      const idx = Number(raw);
      const opt = problem.choices && problem.choices[idx];
      const ok = !!(opt && opt.correct);
      return { correct: ok, detail: '', diagnosis: ok ? '' : 'wrong' };
    }

    case 'numeric': {
      const got = parseNumber(raw);
      if (got === null) {
        /* Not a maths mistake: the answer could not be read at all. Worth
           counting separately, because a pile of these means the notation
           is the problem rather than the method. */
        return {
          correct: false,
          diagnosis: 'unreadable',
          detail: `I could not read "${esc(raw)}" as a number. Try a plain number, a fraction like 3/4, or an expression like 2*pi/3.`,
        };
      }
      const ok = numericEqual(got, problem.answer, problem.tol || 1e-6);
      return {
        correct: ok,
        detail: ok ? '' : `Read as ${MathKit.num(got, 6)}.`,
        diagnosis: ok ? '' : 'wrong',
      };
    }

    case 'set': {
      if (problem.ordered) {
        /* "x, y" where position matters. */
        const parts = raw.split(/[,;]/).map((p) => parseNumber(p));
        if (parts.length !== problem.answers.length || parts.some((p) => p === null)) {
          return { correct: false, detail: `Expected ${problem.answers.length} values separated by commas.` };
        }
        const ok = parts.every((p, i) => numericEqual(p, problem.answers[i], problem.tol || 1e-6));
        return { correct: ok, detail: '', diagnosis: ok ? '' : 'wrong' };
      }
      /* Which values are missing and which were invented, rather than a
         count. Finding two of the three roots is most of the work and
         deserves to be told apart from not knowing the method. */
      const rep = setReport(raw, problem.answers, problem.tol || 1e-6);
      if (rep.correct) return { correct: true, detail: '', diagnosis: '' };
      const fmt = (v) => MathKit.num(v, 4);
      const parts = [];
      let diagnosis = 'wrong';
      if (rep.unreadable) {
        parts.push('I could not read part of that. Separate the values with commas, '
          + 'like 0, -2 or pi/3, 5*pi/3.');
        diagnosis = 'unreadable';
      }
      if (rep.duplicates) parts.push('The same value is in there twice.');
      if (rep.found.length && rep.missing.length) {
        parts.push(`You found ${rep.found.length} of the ${rep.wanted}: `
          + `${rep.found.map(fmt).join(', ')}. There `
          + `${rep.missing.length === 1 ? 'is one more' : `are ${rep.missing.length} more`}.`);
        diagnosis = 'incomplete-set';
      } else if (rep.missing.length === rep.wanted && !rep.extra.length && !rep.unreadable) {
        parts.push(`Expected ${rep.wanted} value${rep.wanted === 1 ? '' : 's'}, in any order.`);
      }
      if (rep.extra.length) {
        parts.push(`${rep.extra.map(fmt).join(', ')} `
          + `${rep.extra.length === 1 ? 'is not one of them' : 'are not among them'}.`);
        if (diagnosis === 'wrong') diagnosis = 'extra-root';
      }
      return { correct: false, detail: parts.join(' '), diagnosis };
    }

    case 'text':
    default: {
      const accept = [problem.answer, ...(problem.accept || [])];
      const ok = textEqual(raw, accept);
      if (ok) return { correct: true, detail: '', diagnosis: '' };
      /* A text answer that parses to the right number is usually a formatting
         difference, not a wrong answer. Say so rather than marking it wrong
         with no explanation. */
      const asNum = parseNumber(raw);
      const wantNum = parseNumber(problem.answer);
      if (asNum !== null && wantNum !== null && numericEqual(asNum, wantNum)) {
        return { correct: true, detail: '', diagnosis: '' };
      }
      return { correct: false, detail: '', diagnosis: 'wrong' };
    }
  }
}

/* What the input should look like for this kind of answer. Shown as the
   placeholder, so nobody loses a question to formatting. */
export function inputHint(problem) {
  if (!problem) return '';
  switch (problem.kind) {
    case 'antiderivative':
      return 'an antiderivative, e.g. sin(3*x)/3 - the + C is optional';
    case 'factored':
      return 'the factored form, e.g. (x+2)(x+3)';
    case 'expanded':
      return 'multiplied out, e.g. x^2+5*x+6';
    case 'expression':
      /* Short enough to fit the box on a phone. The "no need to simplify"
         note lives under the question, where it is not truncated. */
      return problem.implicit
        ? 'an expression in x and y, e.g. -x/y'
        : 'the derivative, e.g. 6*x*cos(3*x^2)';
    case 'numeric': return 'a number, e.g. 12, -3.5, 3/4, 2*pi/3';
    case 'set': return problem.ordered ? 'two values, e.g. 3, -1' : 'all values, separated by commas';
    case 'parts': return 'one line at a time';
    case 'text': return 'your answer';
    default: return '';
  }
}
