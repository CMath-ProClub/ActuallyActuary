/* A grammar for functions, instead of a list of shapes.

   The complaint that produced this file: "you ask the same exact question,
   except you change a couple numbers around." Dead right. Every skill here
   used to pick from two or three hand-written templates and randomise the
   coefficients, so the exponential skill could produce a·e^(mx+b) and
   literally nothing else. It could not reach e^(sin 5x) in a million
   seeds, let alone e^(arctan(8x² − 3x + 20)) - which are exactly the
   derivatives that turn up on a real test.

   So functions are GROWN here rather than filled in. A small recursive
   grammar - atoms, wraps, and combinations - with a budget that controls
   how big the result gets, and a set of rules about what may go inside
   what. The engine can differentiate anything this produces, because every
   piece of it is something the engine already knows.

   Three rules keep the output sane, and all three exist because breaking
   them produced a question nobody could answer:

   1. WHAT GOES INSIDE WHAT MATTERS. e^(x²) is fine at x = 2 and 4·10^15 at
      x = 6, so the sampler that grades it runs out of usable points. arcsin
      of anything bigger than 1 is undefined everywhere interesting. So an
      exponent must be linear or BOUNDED, and arcsin and arccos only ever
      see something that stays inside [-1, 1].

   2. IT HAS TO BE DEFINED SOMEWHERE. ln(sin x) is a perfectly good
      function on a third of the real line; ln(x² + 1) is good everywhere;
      ln(-x² - 4) is good nowhere. Only the last is a problem, and the only
      honest way to tell them apart is to sample.

   3. IT HAS TO FIT ON THE PAGE. A grammar left to itself will cheerfully
      build something whose derivative needs three lines, which is not a
      question, it is a punishment.

   Everything here is pure, so tools/test_compose.mjs can hammer it without
   a browser. */

import Expr from './expr.js';

const { num, vr, neg, add, sub, mul, div, pow, fn, derivative, simplify,
  text, html } = Expr;

const X = vr('x');

export const TRIG = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];
export const PLAIN_TRIG = ['sin', 'cos', 'tan'];
export const INVERSE_TRIG = ['asin', 'acos', 'atan'];

/* How big an expression is allowed to get, in nodes and in characters. The
   character limits are what a person actually experiences. */
const MAX_STEM = 110;
const MAX_ANSWER = 190;

/* ------------------------------------------------------------- shapes */

/* Is this expression bounded for all real x? Used to decide what may sit
   in an exponent, and what arcsin may be handed. Structural rather than
   analytic: it only has to be right when it says yes. */
export function isBounded(node) {
  if (!node) return false;
  switch (node.t) {
    case 'num':
    case 'const':
      return true;
    case 'var':
      return false;
    case 'neg':
      return isBounded(node.a);
    case 'add':
    case 'sub':
      return isBounded(node.a) && isBounded(node.b);
    case 'mul':
      /* A bounded thing times a constant is still bounded. */
      return (node.a.t === 'num' && isBounded(node.b))
        || (node.b.t === 'num' && isBounded(node.a));
    case 'div':
      return node.b.t === 'num' && node.b.v !== 0 && isBounded(node.a);
    case 'pow':
      return isBounded(node.a) && node.b.t === 'num' && node.b.v > 0;
    case 'fn':
      /* sin, cos and the inverse trig functions are bounded whatever they
         are given. tanh too. Everything else is not. */
      return ['sin', 'cos', 'asin', 'acos', 'atan', 'tanh'].includes(node.n);
    default:
      return false;
  }
}

/* Does this expression stay within [-1, 1]? What arcsin and arccos need.
   Checked by sampling, because x/4 is inside it on the range that matters
   and no structural rule says so. */
export function staysInUnitRange(node) {
  const f = Expr.compile(node);
  let seen = 0;
  for (let i = 0; i <= 60; i++) {
    const x = -6 + (i * 12) / 60;
    const v = f({ x });
    if (!isFinite(v)) continue;
    seen++;
    if (Math.abs(v) > 1) return false;
  }
  return seen > 20;
}

/* ------------------------------------------------------------- atoms */

/* The innermost pieces: what a composition is eventually "of". */
function monomial(r, { allowOne = true } = {}) {
  const a = r.nz(2, 9);
  const n = r.int(1, 3);
  const base = n === 1 ? X : pow(X, num(n));
  return allowOne && r() < 0.2 ? base : mul(num(a), base);
}

export function linearInner(r) {
  const a = r.nz(2, 9);
  const b = r.int(-9, 9);
  if (b === 0) return mul(num(a), X);
  return b > 0 ? add(mul(num(a), X), num(b)) : sub(mul(num(a), X), num(-b));
}

export function quadraticInner(r) {
  const a = r.nz(2, 9);
  const b = r.int(-9, 9);
  const c = r.int(-20, 20);
  let out = mul(num(a), pow(X, num(2)));
  if (b) out = b > 0 ? add(out, mul(num(b), X)) : sub(out, mul(num(-b), X));
  if (c) out = c > 0 ? add(out, num(c)) : sub(out, num(-c));
  return out;
}

/* A polynomial that is positive everywhere, for the insides of logs and
   square roots. a x^2 + c with both positive cannot be negative. */
export function positiveInner(r) {
  const a = r.int(1, 6);
  const c = r.int(1, 12);
  if (r() < 0.35) return add(pow(X, num(2)), num(c));
  return add(mul(num(a), pow(X, num(2))), num(c));
}

/* The inside of a composition, at a given level. */
export function innerFor(r, level) {
  if (level <= 1) return linearInner(r);
  const roll = r();
  if (level === 2) return roll < 0.55 ? linearInner(r) : quadraticInner(r);
  if (roll < 0.3) return linearInner(r);
  if (roll < 0.75) return quadraticInner(r);
  return monomial(r, { allowOne: false });
}

/* ------------------------------------------------------------- wrapping */

/* Put `inner` inside a function of the named family, obeying rule 1.
   Returns null when the pairing would not make a usable question. */
export function wrap(r, family, inner) {
  switch (family) {
    case 'trig': {
      const name = r.pick(TRIG);
      return undoes(name, inner) ? null : fn(name, inner);
    }
    case 'plaintrig': {
      const name = r.pick(PLAIN_TRIG);
      return undoes(name, inner) ? null : fn(name, inner);
    }
    case 'exp':
      /* An exponent is linear or bounded, or the values run away faster
         than any sampler can follow. */
      if (!isBounded(inner) && degree(inner) > 1) return null;
      return fn('exp', inner);
    case 'log':
      /* ln of something that is never positive is never anything. */
      if (!definedSomewhere(fn('ln', inner))) return null;
      return fn('ln', inner);
    case 'sqrt':
      /* sqrt of an even power is an absolute value wearing a disguise:
         sqrt((3x^2-4x-13)^2) is |3x^2-4x-13|, which is a question about
         something else entirely. */
      if (isEvenPower(inner)) return null;
      if (!definedSomewhere(fn('sqrt', inner))) return null;
      return fn('sqrt', inner);
    case 'invtrig': {
      const name = r.pick(INVERSE_TRIG);
      /* A function wrapped around its own inverse is the identity wearing
         a hat: arcsin(sin u) is u, and asking for its derivative teaches
         somebody to apply the chain rule to a question that does not need
         it. */
      if (undoes(name, inner)) return null;
      if (name === 'atan') return fn('atan', inner);
      /* arcsin and arccos only accept something that stays inside [-1, 1]. */
      if (!staysInUnitRange(inner)) return null;
      return fn(name, inner);
    }
    case 'power': {
      /* A power of a single term is not a chain rule question: (8x^3)^2 is
         64x^6, and dressing it up as a composition teaches the wrong
         lesson about when the chain rule is needed. */
      if (inner.t !== 'add' && inner.t !== 'sub' && inner.t !== 'fn') return null;
      const k = r.int(2, 5);
      return pow(inner, num(k));
    }
    default:
      return null;
  }
}

/* Would putting `name` around `inner` simply undo it? */
const INVERSE_OF = {
  sin: 'asin', cos: 'acos', tan: 'atan',
  asin: 'sin', acos: 'cos', atan: 'tan',
  exp: 'ln', ln: 'exp',
};
export function undoes(name, inner) {
  return !!(inner && inner.t === 'fn' && INVERSE_OF[name] === inner.n);
}

/* Is this a perfect square (or fourth power) as written? Used to keep
   square roots away from things they would simply undo. */
export function isEvenPower(node) {
  if (!node) return false;
  if (node.t === 'pow' && node.b.t === 'num' && node.b.v % 2 === 0) return true;
  if (node.t === 'mul') return isEvenPower(node.a) || isEvenPower(node.b);
  return false;
}

/* The degree of a polynomial-ish expression, or Infinity for anything that
   is not one. Only has to be right for the shapes this file builds. */
export function degree(node) {
  if (!node) return Infinity;
  switch (node.t) {
    case 'num':
    case 'const':
      return 0;
    case 'var':
      return 1;
    case 'neg':
      return degree(node.a);
    case 'add':
    case 'sub':
      return Math.max(degree(node.a), degree(node.b));
    case 'mul':
      return degree(node.a) + degree(node.b);
    case 'div':
      return node.b.t === 'num' ? degree(node.a) : Infinity;
    case 'pow':
      return node.b.t === 'num' && Number.isInteger(node.b.v) && node.b.v >= 0
        ? degree(node.a) * node.b.v : Infinity;
    default:
      return Infinity;
  }
}

/* ------------------------------------------------------------- checking */

/* Is there enough of the real line where this means anything? The sampler
   that grades an answer needs points where both sides are defined, so a
   function that exists only on a sliver cannot be marked. */
export function definedSomewhere(node, want = 18) {
  let f;
  try {
    f = Expr.compile(node);
  } catch (err) {
    return false;
  }
  let seen = 0;
  for (let i = 0; i <= 80; i++) {
    const x = -6 + (i * 12) / 80;
    const v = f({ x });
    if (isFinite(v) && Math.abs(v) < 1e8) seen++;
    if (seen >= want) return true;
  }
  return false;
}

/* The whole question has to be gradeable, legible, and not secretly
   trivial. Everything this file hands back has been through here. */
export function usable(f, opts = {}) {
  if (!f) return false;
  const stem = text(f);
  if (stem.length > (opts.maxStem || MAX_STEM)) return false;
  if (!definedSomewhere(f)) return false;
  let d;
  try {
    d = simplify(derivative(f));
  } catch (err) {
    return false;
  }
  if (Expr.isIdenticallyZero(d)) return false;
  if (text(d).length > (opts.maxAnswer || MAX_ANSWER)) return false;
  /* Both the function and its derivative have to be defined on enough
     shared points, or "is this the same function" cannot be answered. */
  if (!definedSomewhere(d, 14)) return false;
  return true;
}

/* ------------------------------------------------------------- building */

/* One composed function, or null if the dice produced something unusable.
   Callers retry; every generator in this project already does.

   `spec.outer` is the family the OUTSIDE of the function belongs to, which
   is what keeps a question about the exponential skill about exponentials
   even when it has a sine buried in it. */
export function composeFunction(r, spec = {}) {
  const level = Math.max(1, Math.min(3, spec.level || 2));
  const outer = spec.outer || 'trig';
  const depth = spec.depth
    || (level >= 3 ? (r() < 0.55 ? 2 : 1) : (level === 2 && r() < 0.3 ? 2 : 1));

  let inner = innerFor(r, level);

  /* A second layer: e^(sin 5x) rather than e^(5x). This is the thing the
     old generators could not reach. */
  if (depth >= 2) {
    const middleFamily = pickMiddle(r, outer);
    const middle = wrap(r, middleFamily, inner);
    if (!middle) return null;
    inner = middle;
  }

  let f = wrap(r, outer, inner);
  if (!f) return null;

  /* A coefficient out front, sometimes, and at the top level only. */
  if (r() < 0.45) {
    const a = r.nz(2, 9);
    f = mul(num(a), f);
  }

  /* And sometimes something alongside it, which is where the sum rule
     comes from: e^(sin 5x) + 3x². */
  const companion = spec.companionChance || 0;
  if (level >= 2 && companion > 0 && r() < companion) {
    f = add(f, monomial(r));
  }

  return usable(f, spec) ? { f, inner } : null;
}

/* What may sit between the outside and the polynomial. Chosen to keep the
   pairing sensible: an exponent wants something bounded, so the middle of
   an exponential is a sine or an arctangent rather than another
   exponential. */
function pickMiddle(r, outer) {
  if (outer === 'exp') return r.pick(['plaintrig', 'invtrig']);
  if (outer === 'log') return r.pick(['plaintrig', 'invtrig', 'power']);
  if (outer === 'invtrig') return r.pick(['plaintrig', 'power']);
  if (outer === 'sqrt') return r.pick(['plaintrig', 'power']);
  return r.pick(['plaintrig', 'exp', 'power', 'invtrig']);
}

/* Two composed things multiplied or divided, for the product and quotient
   skills - so those stop being "polynomial times sine" forever. */
export function composePair(r, spec = {}) {
  const level = Math.max(1, Math.min(3, spec.level || 2));
  const families = spec.families || ['plaintrig', 'exp', 'log', 'power', 'invtrig'];
  const leftFamily = r.pick(families);
  const rightFamily = r.pick(families.filter((f) => f !== leftFamily).concat(['poly']));

  const sideOf = (family) => {
    if (family === 'poly') return level >= 3 ? quadraticInner(r) : monomial(r);
    const built = composeFunction(r, {
      outer: family,
      level,
      depth: level >= 3 && r() < 0.35 ? 2 : 1,
      maxStem: 60,
      maxAnswer: 90,
    });
    return built ? built.f : null;
  };

  const left = sideOf(leftFamily);
  const right = sideOf(rightFamily);
  if (!left || !right) return null;

  const f = spec.quotient ? div(left, right) : mul(left, right);
  /* A quotient whose top and bottom are proportional is a constant, and a
     constant cannot be a derivative question. */
  if (spec.quotient && Expr.constantRatio(left, right, 1) !== null) return null;
  return usable(f, spec) ? { f, factors: [left, right] } : null;
}

export default {
  composeFunction, composePair, wrap, innerFor, linearInner, quadraticInner,
  positiveInner, isBounded, staysInUnitRange, definedSomewhere, degree, usable,
  TRIG, PLAIN_TRIG, INVERSE_TRIG,
};
