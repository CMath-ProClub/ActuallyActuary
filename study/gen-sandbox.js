/* Sandbox problem builders: differentiate THIS, in any form you like.

   The curriculum generators in gen-calculus.js all ask for f′ at a point,
   because that was the only thing the old grader could mark. These ask for
   the function, which is what practising derivatives actually means.

   Built backward from the answer, the way CLAUDE.md says to build a
   generator, but one step further: nothing here states an answer at all. A
   builder picks a FUNCTION, and expr.js differentiates it mechanically. There
   is no hand-typed answer key that can disagree with the question, which is
   the failure mode that matters most in a study tool.

   Wrong answers are built the same way. `brokenDiff` differentiates with one
   rule deliberately sabotaged - the chain factor dropped, cosine's minus
   lost, the product rule applied as f′g′ - and each sabotage carries the
   sentence that names it. When a student's answer matches one of those, the
   hint can say what they did instead of "no". That is what makes "tell me if
   I am close" more than a guess.

   These are deliberately NOT in the generators.js REGISTRY. That registry is
   the curriculum, and tools/test_generators.mjs requires every entry in it to
   be named by a topic. Sandbox skills map ONTO curriculum topics for mastery
   (see SKILLS[].topicId) rather than becoming new ones, so practising chain
   rule here moves the same number that practising it there does. */

import MathKit from './math.js';
import Expr from './expr.js';
import * as compose from './compose.js';
import * as solve from './solve.js';

const { num, vr, neg, add, sub, mul, div, pow, fn, derivative, simplify,
  text, html, latex, equivalent } = Expr;

const X = vr('x');
const Y = vr('y');
/* Motion problems are in time, not x. */
const T = vr('t');

/* ------------------------------------------------------------- ingredients */

/* How often a question is GROWN from the grammar in compose.js rather than
   filled in from a template. The templates are not wrong - a plain
   e^(3x+1) is a fair question - they were just the only thing on offer,
   which is how "the same question with the numbers changed" happens. */
const COMPOSE_CHANCE = { 1: 0, 2: 0.55, 3: 0.85 };

/* Grow one, retrying: the grammar refuses a lot of what it rolls, on
   purpose, and a refusal should not cost the whole question. */
function grown(r, spec, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const built = compose.composeFunction(r, spec);
    if (built) return built;
  }
  return null;
}

function grownPair(r, spec, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const built = compose.composePair(r, spec);
    if (built) return built;
  }
  return null;
}

/* Should this question be grown? */
function composing(r, level) {
  return r() < (COMPOSE_CHANCE[level] || 0);
}

/* A linear inside function, the workhorse of every chain rule problem. */
function linear(r, { allowConstant = true, mustMove = false } = {}) {
  const a = r.nz(-6, 6);
  /* `mustMove` means this is going INSIDE something, where a bare ax is
     not a composition at all: (-5x)^3 is -125x^3 with a hat on, and
     asking for the chain rule on it teaches the rule where it is not
     needed. A non-zero constant makes it a real inside. */
  const b = mustMove ? r.nz(-8, 8) : (allowConstant ? r.int(-8, 8) : 0);
  return b === 0 ? mul(num(a), X) : add(mul(num(a), X), num(b));
}

/* A short polynomial, highest power first, never a constant. */
function polynomial(r, level) {
  const degree = level === 1 ? r.int(1, 2) : level === 2 ? r.int(2, 3) : r.int(3, 4);
  let out = null;
  for (let p = degree; p >= 0; p--) {
    const c = p === degree ? r.nz(-7, 7) : r.int(-8, 8);
    if (c === 0) continue;
    const termNode = p === 0 ? num(c)
      : p === 1 ? mul(num(c), X)
        : mul(num(c), pow(X, num(p)));
    out = out === null ? termNode : add(out, termNode);
  }
  return out || mul(num(3), pow(X, num(2)));
}

/* sin, cos and tan were the only three most generators ever reached, so
   secant, cosecant and cotangent turned up in about four questions in a
   hundred and nobody believed they were in there at all. They are on the
   formula sheet and they are on the test, so they are drawn from the same
   hat as the other three. */
const TRIG = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];
const TRIG_WIDE = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];

/* ------------------------------------------------------ the rest of trig */

/* Everything a calculus course actually asks about, rather than sine and
   cosine with a linear inside.

   Carter's words: "whether it be arc or whether it's cosecant or whether
   it's tan, I need to have all that junk in there." So: the three
   reciprocals, the three inverses, powers of trig functions, trig of a
   polynomial, products of two trig functions, and one trig function inside
   another. */
const TRIG_ALL = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];
const TRIG_INVERSE = ['asin', 'acos', 'atan', 'acot', 'asec', 'acsc'];

function trigShape(r, level) {
  /* Level 1 is a single function with a bare x: the rule on its own. */
  if (level === 1) {
    /* Even the easiest level sees all six, because "I have never met
       cosecant" is how somebody meets it first in an exam. */
    const name = r.pick(TRIG_ALL);
    const a = r.nz(2, 8);
    return { f: mul(num(a), fn(name, X)), inner: X };
  }

  const inside = add(mul(num(r.nz(-6, 6)), X), num(r.int(-8, 8)));

  if (level === 2) {
    const shape = r.int(0, 3);
    const name = r.pick(TRIG_ALL);
    if (shape === 0) return { f: mul(num(r.nz(2, 7)), fn(name, inside)), inner: inside };
    if (shape === 1) {
      /* A power of a trig function: the chain rule with the trig on the
         inside rather than the outside. */
      return {
        f: pow(fn(name, X), num(r.int(2, 4))),
        inner: fn(name, X),
        note: 'The outside is the power; the inside is the trig function.',
      };
    }
    if (shape === 2) {
      /* Trig of a polynomial. */
      const poly = add(mul(num(r.nz(2, 5)), pow(X, num(2))), num(r.int(-6, 6)));
      return { f: fn(name, poly), inner: poly };
    }
    /* A product of two different trig functions. */
    const other = r.pick(TRIG_ALL.filter((t) => t !== name));
    return {
      f: mul(fn(name, X), fn(other, X)),
      factors: [fn(name, X), fn(other, X)],
      note: 'Two trig functions multiplied: the product rule, then each derivative.',
    };
  }

  /* Level 3: inverses, nesting, and trig wrapped around something that
     needs its own chain rule. */
  const shape = r.int(0, 4);

  if (shape === 0) {
    const name = r.pick(TRIG_INVERSE);
    const arg = r() < 0.5 ? mul(num(r.nz(2, 4)), X) : pow(X, num(2));
    return {
      f: mul(num(r.nz(1, 5)), fn(name, arg)),
      inner: arg,
      note: `The derivative of ${name === 'atan' ? 'arctan' : name === 'asin' ? 'arcsin' : 'arccos'}(u) `
        + 'is an algebraic fraction, times u prime.',
    };
  }

  if (shape === 1) {
    /* One trig function inside another. */
    const outer = r.pick(['sin', 'cos', 'tan']);
    const inner = fn(r.pick(['sin', 'cos']), X);
    return {
      f: fn(outer, inner),
      inner,
      note: 'A trig function of a trig function. Outside first, then the inside.',
    };
  }

  if (shape === 2) {
    /* A power of a reciprocal trig function, which is where the sign and
       the extra factor both go missing. */
    const name = r.pick(['sec', 'csc', 'cot']);
    return {
      f: pow(fn(name, mul(num(r.nz(2, 4)), X)), num(r.int(2, 3))),
      inner: fn(name, mul(num(r.nz(2, 4)), X)),
      note: 'Three layers: the power, the trig function, and what is inside it.',
    };
  }

  if (shape === 3) {
    /* x times a trig function of a polynomial: product rule AND chain rule
       in the same question. */
    const poly = mul(num(r.nz(2, 4)), pow(X, num(2)));
    return {
      f: mul(X, fn(r.pick(['sin', 'cos']), poly)),
      factors: [X, fn('sin', poly)],
      note: 'Product rule on the outside, chain rule inside the second factor.',
    };
  }

  /* A quotient of two trig functions, which is not always worth rewriting
     as a single one. */
  const top = fn(r.pick(['sin', 'cos', 'tan']), X);
  const bottom = add(fn(r.pick(['sin', 'cos']), X), num(r.int(2, 5)));
  return { f: div(top, bottom), factors: [top, bottom] };
}

/* --------------------------------------------------------------- the skills */

/* Each builder returns { f, inner } where `inner` names the inside function
   when there is one, so a chain rule hint can print u′ specifically. */
const SKILLS = {
  power: {
    name: 'Power rule',
    topicId: 'calc.power',
    ask: 'polynomials, roots and negative powers',
    build(r, level) {
      if (level >= 2 && r() < 0.4) {
        /* A root or a reciprocal, written the way a textbook writes it. */
        const a = r.nz(2, 6);
        const b = r.nz(2, 9);
        return r() < 0.5
          ? { f: add(mul(num(a), fn('sqrt', X)), div(num(b), X)) }
          : { f: sub(mul(num(a), pow(X, num(r.int(2, 4)))), div(num(b), pow(X, num(2)))) };
      }
      return { f: polynomial(r, level) };
    },
  },

  trig: {
    name: 'Trig derivatives',
    topicId: 'calc.trigderiv',
    ask: 'sin, cos, tan, sec, csc, cot, powers and nests',
    build(r, level) {
      if (composing(r, level)) {
        const built = grown(r, { outer: 'trig', level, companionChance: 0.25 });
        if (built) return built;
      }
      return trigShape(r, level);
    },
  },

  chain: {
    name: 'Chain rule',
    topicId: 'calc.chain',
    ask: 'composite functions',
    build(r, level) {
      if (level === 1) {
        const inside = linear(r, { mustMove: true });
        return { f: pow(inside, num(r.int(2, 5))), inner: inside };
      }
      /* The chain rule is the one skill whose whole point is composition,
         so it reaches furthest into the grammar: two layers at the top
         level, which is where e^(sin 5x) and arctan(8x² - 3x + 20) live. */
      if (composing(r, level)) {
        const built = grown(r, {
          outer: r.pick(['plaintrig', 'exp', 'log', 'sqrt', 'power', 'invtrig']),
          level,
          depth: level >= 3 ? 2 : undefined,
        });
        if (built) return built;
      }
      const inside = level === 3
        ? add(mul(num(r.nz(-4, 4)), pow(X, num(r.int(2, 3)))), num(r.int(-7, 7)))
        : linear(r);
      const shape = r.int(0, 2);
      if (shape === 0) {
        /* Same rule at every level: a power of one term is not a chain. */
        const base = inside.t === 'mul' || inside.t === 'var'
          ? linear(r, { mustMove: true }) : inside;
        return { f: pow(base, num(r.int(2, 6))), inner: base };
      }
      if (shape === 1) return { f: fn(r.pick(TRIG), inside), inner: inside };
      /* A square root needs an inside that is positive somewhere sensible.
         sqrt(-5x - 7) exists only for x <= -1.4, which is a strange thing to
         hand someone practising the chain rule even though the engine can
         now grade it. */
      const positive = add(mul(num(r.int(1, 5)), X), num(r.int(1, 9)));
      return { f: fn('sqrt', positive), inner: positive };
    },
  },

  product: {
    name: 'Product rule',
    topicId: 'calc.product',
    ask: 'two factors multiplied',
    build(r, level) {
      if (composing(r, level)) {
        const built = grownPair(r, { level });
        if (built) return built;
      }
      const left = level === 1 ? polynomial(r, 1) : polynomial(r, 2);
      const right = level === 1
        ? polynomial(r, 1)
        : r() < 0.5 ? fn(r.pick(TRIG), X) : fn('exp', linear(r));
      return { f: mul(left, right), factors: [left, right] };
    },
  },

  quotient: {
    name: 'Quotient rule',
    topicId: 'calc.quotient',
    ask: 'one function over another',
    build(r, level) {
      if (composing(r, level)) {
        const built = grownPair(r, { level, quotient: true });
        if (built) return built;
      }
      const top = level === 1 ? linear(r) : polynomial(r, 2);
      const bottom = level === 1
        ? linear(r, { allowConstant: true })
        : r() < 0.5 ? add(pow(X, num(2)), num(r.int(1, 9))) : fn(r.pick(TRIG), X);
      /* Proportional top and bottom make the whole quotient a constant:
         (2x+1)/(-6x-3) is just -1/3, and its derivative is zero everywhere.
         Such a problem cannot be graded, because every wrong answer that
         happens to be zero grades as correct. Returning null retries. */
      if (Expr.constantRatio(top, bottom, 1) !== null) return null;
      return { f: div(top, bottom), factors: [top, bottom] };
    },
  },

  exp: {
    name: 'Exponential derivatives',
    topicId: 'calc.trigderiv',
    ask: 'e to a power, and a to the x',
    build(r, level) {
      if (composing(r, level)) {
        const built = grown(r, {
          outer: 'exp',
          level,
          depth: level >= 3 ? 2 : undefined,
          companionChance: level >= 3 ? 0.2 : 0,
        });
        if (built) return built;
      }
      if (level >= 2 && r() < 0.35) {
        /* A base that is not e, which is where ln(a) has to appear. */
        const base = r.pick([2, 3, 5, 10]);
        return { f: pow(num(base), level === 3 ? linear(r) : X) };
      }
      const inside = level === 1 ? mul(num(r.nz(2, 6)), X) : linear(r);
      const a = r.nz(1, 6);
      return { f: a === 1 ? fn('exp', inside) : mul(num(a), fn('exp', inside)), inner: inside };
    },
  },

  log: {
    name: 'Natural log derivatives',
    topicId: 'calc.trigderiv',
    ask: 'natural logs, chained',
    build(r, level) {
      if (composing(r, level)) {
        const built = grown(r, { outer: 'log', level, depth: level >= 3 ? 2 : 1 });
        if (built) return built;
      }
      const inside = level === 1
        ? linear(r)
        : r() < 0.5
          ? add(pow(X, num(r.int(2, 3))), num(r.int(1, 9)))
          : fn(r.pick(TRIG), X);
      const a = r.nz(1, 5);
      const f = a === 1 ? fn('ln', inside) : mul(num(a), fn('ln', inside));
      return { f, inner: inside };
    },
  },

  logdiff: {
    name: 'Logarithmic differentiation',
    topicId: 'calc.chain',
    ask: 'a variable in the exponent, where taking logs first is the move',
    build(r, level) {
      const shape = level === 1 ? 0 : r.int(0, 2);
      if (shape === 0) {
        /* x^x and friends: the general power rule is the only way through. */
        const a = r.nz(1, 4);
        const base = a === 1 ? X : mul(num(a), X);
        return { f: pow(base, X), note: 'A variable in both the base and the exponent.' };
      }
      if (shape === 1) {
        /* u^x only exists where u > 0, so the inside has to lean positive or
           the problem lives on a sliver of the far left axis. */
        const inside = add(mul(num(r.int(1, 4)), X), num(r.int(1, 8)));
        return { f: pow(inside, X), inner: inside };
      }
      return { f: pow(X, add(mul(num(r.nz(2, 4)), X), num(r.int(1, 5)))) };
    },
  },

  implicit: {
    name: 'Implicit differentiation',
    topicId: 'calc.implicit',
    ask: 'dy/dx when y will not come out of the equation',
    implicit: true,
    /* "give me some trig with implicit" should mean implicit equations WITH
       trig in them, not trig questions alternating with conics. When both
       are asked for, the equation is drawn from the families that have a
       trig function in them. */
    build(r, level, spec) {
      /* Lock-in asks for one of the four shapes by name. */
      const family = spec && spec.family ? FOCUS_FAMILIES[spec.family] : null;
      if (family) return family.pick(r, level);
      const wantsTrig = !!(spec && spec.skills
        && spec.skills.some((k) => k === 'trig' || k === 'invtrig'));
      if (!wantsTrig) return implicitEquation(r, level);
      for (let attempt = 0; attempt < 25; attempt++) {
        const equation = implicitEquation(r, Math.max(2, level));
        if (hasTrig(equation.left) || hasTrig(equation.right)) return equation;
      }
      return implicitEquation(r, level);
    },
  },

  invtrig: {
    name: 'Inverse trig derivatives',
    topicId: 'calc.trigderiv',
    ask: 'arcsin, arccos and arctan',
    build(r, level) {
      if (composing(r, level)) {
        const built = grown(r, { outer: 'invtrig', level, depth: level >= 3 ? 2 : 1 });
        if (built) return built;
      }
      const name = r.pick(TRIG_INVERSE);
      /* Each of the six accepts something different, and handing one an
         inside it cannot take makes a question with almost no domain:
         arcsin(x²) exists only on [-1, 1], and arcsec(x/5) only where
         |x| >= 5.

           arctan, arccot   anything
           arcsin, arccos   |u| <= 1, so x over something
           arcsec, arccsc   |u| >= 1, so a multiple of x */
      const wide = name === 'atan' || name === 'acot';
      const big = name === 'asec' || name === 'acsc';
      const arg = big
        ? mul(num(r.int(2, 6)), X)
        : level === 1 ? (wide ? X : div(X, num(r.int(2, 4))))
          : level === 2 ? (wide ? mul(num(r.nz(2, 5)), X) : div(X, num(r.int(2, 5))))
            : wide
              ? (r() < 0.5 ? pow(X, num(2)) : fn('exp', mul(num(r.nz(1, 3)), X)))
              : div(X, num(r.int(2, 5)));
      const a = r.nz(1, 6);
      return {
        f: a === 1 ? fn(name, arg) : mul(num(a), fn(name, arg)),
        inner: arg,
        note: 'An inverse trig derivative is an algebraic fraction, times the '
          + 'derivative of what is inside.',
      };
    },
  },
};

/* Everything after this point asks a different question - integrate this,
   factor this - and is marked differently, so the builders live apart and
   join SKILLS at the bottom of the file. */

/* ------------------------------------------------- the four shapes on the quiz */

/* Carter sat a quiz on implicit differentiation and came back with exactly
   which four kinds of question he could not do. They are all the same move -
   implicit differentiation combined with the chain rule - over four
   different outsides, and the thing that makes each hard is that the inside
   is a PRODUCT: differentiating xy brings the product rule with it before
   the chain rule has finished.

   These are named families rather than extra shapes in the pile, because
   the lock-in mode has to be able to ask for one on purpose. Everything
   else about them is ordinary: the engine still derives dy/dx, and
   test_sandbox still walks each one against its own curve. */
const FOCUS_FAMILIES = {
  'trig-xy': {
    label: 'Implicit + chain + product, inside a trig function',
    study: 'derivatives of trig functions, and differentiating xy',
    pick(r, level) {
      const a = level === 1 ? 1 : r.nz(1, 3);
      const inner = a === 1 ? mul(X, Y) : mul(num(a), mul(X, Y));
      const shape = r.int(0, 3);
      if (shape === 0) {
        return {
          left: fn('sin', inner),
          right: add(X, Y),
          note: 'The outside is sine, the inside is a product. Chain rule first, '
            + 'then the product rule on xy.',
        };
      }
      if (shape === 1) {
        return {
          left: add(fn('cos', inner), X),
          right: Y,
          note: 'd/dx cos(u) is MINUS sin(u) times u prime, and u = xy needs '
            + 'the product rule.',
        };
      }
      if (shape === 2) {
        return {
          left: fn('tan', inner),
          right: add(X, mul(num(r.nz(1, 3)), Y)),
          note: 'd/dx tan(u) is sec squared u, times the derivative of xy.',
        };
      }
      return {
        left: add(mul(X, fn('sin', Y)), mul(Y, fn('cos', X))),
        right: num(r.int(1, 5)),
        note: 'Two products, and each one contains a function of the other '
          + 'variable. Product rule on both, chain rule inside each.',
      };
    },
  },

  'cos-powers': {
    label: 'Implicit + chain: cosine and powers of y',
    study: 'derivatives of cosine, and powers of y',
    pick(r, level) {
      const n = level === 1 ? 2 : r.int(2, 4);
      const shape = r.int(0, 2);
      if (shape === 0) {
        return {
          left: fn('cos', pow(Y, num(n))),
          right: X,
          note: `A power of y inside a cosine: the chain rule runs cos, then `
            + `y^${n}, then the dy/dx.`,
        };
      }
      if (shape === 1) {
        return {
          left: add(fn('cos', Y), pow(Y, num(n))),
          right: pow(X, num(2)),
          note: 'Both terms on the left are functions of y, so both bring a '
            + 'dy/dx with them. Collect them.',
        };
      }
      return {
        left: add(pow(Y, num(3)), mul(num(r.nz(2, 4)), fn('cos', Y))),
        right: X,
        note: 'Everything on the left carries a dy/dx. Factor it out once you '
          + 'have differentiated.',
      };
    },
  },

  'exp-xy': {
    label: 'Implicit + e to a power + product rule',
    study: 'derivatives of e^u, and differentiating xy',
    pick(r, level) {
      const shape = r.int(0, 3);
      if (shape === 0) {
        return {
          left: fn('exp', mul(X, Y)),
          right: add(pow(X, num(2)), Y),
          note: 'e^(xy) reproduces itself, then multiplies by the derivative of '
            + 'xy - which is a product.',
        };
      }
      if (shape === 1) {
        /* The one he had on the quiz, give or take the numbers. */
        return {
          left: mul(X, fn('exp', Y)),
          right: add(mul(num(r.int(2, 4)), Y), pow(Y, num(3))),
          note: 'Product rule on the left, and every term on the right carries '
            + 'a dy/dx.',
        };
      }
      if (shape === 2) {
        return {
          left: add(mul(X, fn('exp', Y)), mul(Y, fn('exp', X))),
          right: num(r.int(1, 4)),
          note: 'Two products, one with e^y and one with e^x. Only the first '
            + 'brings a dy/dx out of the exponential.',
        };
      }
      return {
        left: mul(Y, fn('exp', mul(X, Y))),
        right: X,
        note: 'A product whose second factor is e^(xy), so the chain rule '
          + 'produces another product inside the first one.',
      };
    },
  },

  'log-xy': {
    label: 'Implicit + ln + chain + product rule',
    study: 'derivatives of ln(u), the chain rule, and differentiating xy',
    pick(r, level) {
      const shape = r.int(0, 2);
      if (shape === 0) {
        /* Getting the right side of this one right took three goes, and
           the curve solver caught both wrong ones by finding no points to
           test - which is the system working, but an equation with an empty
           graph is not a question.

           ln(xy) = x + y has no real solutions anywhere: ln t - t is at
           most -1, so the left can never catch the right. ln(xy) = ay only
           has them for x >= a*e, which is outside the range the solver
           samples. ln(xy) = x - ay always has exactly one: for any x it
           reduces to ln y + ay = x - ln x, and the left of that is strictly
           increasing from -infinity to infinity. */
        const a = r.int(1, 2);
        return {
          left: fn('ln', mul(X, Y)),
          right: sub(X, a === 1 ? Y : mul(num(a), Y)),
          domain: 'both-positive',
          note: 'd/dx ln(u) is u prime over u. Here u = xy, so u prime needs '
            + 'the product rule.',
        };
      }
      if (shape === 1) {
        return {
          left: fn('ln', mul(X, pow(Y, num(2)))),
          right: X,
          domain: 'both-positive',
          note: 'Either use the product rule inside the logarithm, or split it '
            + 'first: ln(xy^2) is ln x + 2 ln y.',
        };
      }
      return {
        left: mul(X, fn('ln', Y)),
        right: add(Y, num(r.int(1, 4))),
        domain: 'y-positive',
        note: 'A product with a logarithm of y in it: product rule outside, '
          + 'and ln(y) differentiates to dy/dx over y.',
      };
    },
  },
};

export const FOCUS_IDS = Object.keys(FOCUS_FAMILIES);

export function focusFamily(id) {
  return FOCUS_FAMILIES[id] || null;
}

/* Does this expression contain a trig function anywhere in it? */
function hasTrig(node) {
  if (!node) return false;
  if (node.t === 'fn' && /^(sin|cos|tan|sec|csc|cot|asin|acos|atan)$/.test(node.n)) return true;
  return hasTrig(node.a) || hasTrig(node.b);
}

/* ------------------------------------------------- integrals and algebra */

/* Antiderivative problems are built from the ANSWER outwards, like everything
   else here, and that is what makes them solvable. Pick an integrand from a
   family whose antiderivative is known, state both, and then check the pair
   mechanically before the problem is allowed out: differentiating the stated
   F has to give back the integrand. An integrand picked at random usually has
   no elementary antiderivative at all. */
function antiderivativePair(r, level) {
  const kind = level === 1
    ? r.pick(['power', 'trig', 'exp'])
    : r.pick(['power', 'trig', 'exp', 'linear', 'log', 'root']);
  const c = r.nz(2, 7);
  const k = r.nz(2, 5);

  if (kind === 'power') {
    const n = level === 1 ? r.int(1, 3) : r.int(2, 5);
    return {
      integrand: mul(num(c), pow(X, num(n))),
      F: div(mul(num(c), pow(X, num(n + 1))), num(n + 1)),
      note: 'Raise the power by one, then divide by the new power.',
    };
  }
  if (kind === 'trig') {
    const useSin = r() < 0.5;
    const inner = level === 1 ? X : mul(num(k), X);
    const scale = level === 1 ? 1 : k;
    return useSin
      ? {
        integrand: mul(num(c), fn('sin', inner)),
        F: neg(div(mul(num(c), fn('cos', inner)), num(scale))),
        note: 'The integral of sine is minus cosine.',
      }
      : {
        integrand: mul(num(c), fn('cos', inner)),
        F: div(mul(num(c), fn('sin', inner)), num(scale)),
        note: 'The integral of cosine is sine.',
      };
  }
  if (kind === 'exp') {
    const inner = level === 1 ? X : mul(num(k), X);
    const scale = level === 1 ? 1 : k;
    return {
      integrand: mul(num(c), fn('exp', inner)),
      F: div(mul(num(c), fn('exp', inner)), num(scale)),
      note: 'e to a power integrates to itself, divided by the coefficient inside.',
    };
  }
  if (kind === 'linear') {
    const a = r.nz(2, 4);
    const b = r.int(1, 7);
    const n = r.int(2, 4);
    const inside = add(mul(num(a), X), num(b));
    return {
      integrand: pow(inside, num(n)),
      F: div(pow(inside, num(n + 1)), num(a * (n + 1))),
      note: 'Raise the power by one, divide by the new power AND by the inside coefficient.',
    };
  }
  if (kind === 'log') {
    const a = r.nz(2, 5);
    const b = r.int(1, 8);
    return {
      integrand: div(num(a), add(mul(num(a), X), num(b))),
      F: fn('ln', add(mul(num(a), X), num(b))),
      note: 'A derivative over its own function integrates to a logarithm.',
    };
  }
  /* root */
  return {
    integrand: div(num(c), fn('sqrt', X)),
    F: mul(num(2 * c), fn('sqrt', X)),
    note: 'Write the root as a power of one half and use the power rule.',
  };
}

/* u-substitution: the chain rule undone. Built by picking the OUTSIDE and the
   INSIDE, so the integrand always carries the inside derivative that makes
   the substitution work. */
function uSubPair(r, level) {
  const a = r.nz(2, 4);
  const inside = r() < 0.5
    ? mul(num(a), pow(X, num(2)))
    : add(pow(X, num(2)), num(r.int(1, 6)));
  const outer = r.pick(['sin', 'cos', 'exp']);
  const dInside = derivative(inside);
  const F = outer === 'sin' ? neg(fn('cos', inside))
    : outer === 'cos' ? fn('sin', inside)
      : fn('exp', inside);
  /* d/dx of F is exactly (outer' of inside) * inside', which is the
     integrand. Stating it this way means the substitution is always clean. */
  const integrand = simplify(simplify(derivative(F)));
  return {
    integrand,
    F,
    inside,
    note: `Let u = ${text(inside)}, so du = ${text(dInside)} dx.`,
  };
}

/* Factoring and expanding are built from the ROOTS, as CLAUDE.md says to:
   pick what the answer factors into, then multiply it out to make the
   question. Picking coefficients first gives a quadratic that does not
   factor over the integers, which is not the drill. */
function quadraticFromRoots(r, level) {
  const lead = level === 3 ? r.pick([1, 2, 3]) : 1;
  let r1 = r.nz(-6, 6);
  let r2 = r.nz(-6, 6);
  if (level === 1) { r1 = Math.abs(r1) * (r() < 0.5 ? -1 : 1); r2 = r1 === r2 ? r2 + 1 : r2; }
  /* lead * (x - r1)(x - r2) */
  const factored = lead === 1
    ? mul(linearFactor(r1), linearFactor(r2))
    : mul(num(lead), mul(linearFactor(r1), linearFactor(r2)));
  const b = -(r1 + r2) * lead;
  const c = r1 * r2 * lead;
  const expanded = add(add(mul(num(lead), pow(X, num(2))), mul(num(b), X)), num(c));
  return { factored, expanded, roots: [r1, r2], lead };
}

function linearFactor(root) {
  return root === 0 ? X : add(X, num(-root));
}

const SKILL_EXTRAS = {
  antiderivative: {
    name: 'Antiderivatives',
    topicId: 'calc.antideriv',
    ask: 'indefinite integrals',
    integral: true,
    build(r, level) {
      const pair = antiderivativePair(r, level);
      if (level === 3 && r() < 0.4) {
        /* Two terms added, which is where sign slips happen. */
        const other = antiderivativePair(r, 2);
        return {
          integrand: add(pair.integrand, other.integrand),
          F: add(pair.F, other.F),
          note: 'Integrate term by term.',
        };
      }
      return pair;
    },
  },

  usub: {
    name: 'u-substitution',
    topicId: 'calc.usub',
    ask: 'integrals that need a substitution',
    integral: true,
    build(r, level) { return uSubPair(r, level); },
  },

  factor: {
    name: 'Factoring',
    topicId: 'alg2.factor',
    ask: 'factoring quadratics',
    form: 'factored',
    build(r, level) {
      const q = quadraticFromRoots(r, level);
      return { question: q.expanded, display: q.factored, roots: q.roots };
    },
  },

  expand: {
    name: 'Expanding',
    topicId: 'alg2.expand',
    ask: 'multiplying brackets out',
    form: 'expanded',
    build(r, level) {
      const q = quadraticFromRoots(r, level);
      if (level === 3 && r() < 0.4) {
        /* A squared bracket, where the middle term is the thing people drop. */
        const root = r.nz(-5, 5);
        const inner = linearFactor(root);
        return {
          question: pow(inner, num(2)),
          display: add(add(pow(X, num(2)), mul(num(-2 * root), X)), num(root * root)),
        };
      }
      return { question: q.factored, display: q.expanded };
    },
  },
};

/* ------------------------------------------------- the rest of a unit 2 */

/* Everything on Carter's Unit 2 review that the derivative skills did not
   already cover. Each is still built backward from a function the engine
   can differentiate, so none of them has a hand-written answer key. */

const EXAM_EXTRAS = {
  limitdef: {
    name: 'Limit definition',
    topicId: 'calc.power',
    ask: 'the derivative from the difference quotient',
    /* Asked line by line rather than as one answer, because one answer can
       be reached with the chain rule and the question is about the limit. */
    parts: true,
    build(r, level) {
      /* The three shapes the review uses: a cube, a root and a reciprocal.
         Each is chosen because the algebra works out, which is the whole
         point of the exercise.

         `cancelled` is what the quotient becomes once the h is gone. It is
         stated here because this engine cannot do polynomial division or
         conjugates symbolically - and then checked three ways against the
         engine in buildLimitDefinition before anybody sees it. */
      const shape = r.int(0, 2);
      const a = r.nz(1, 4);
      const b = r.int(1, 5);
      if (shape === 0) {
        const base = add(X, num(b));
        return {
          f: pow(base, num(3)),
          /* 3(x+b)^2 + 3(x+b)h + h^2 */
          cancelled: add(
            add(mul(num(3), pow(base, num(2))), mul(mul(num(3), base), vr('h'))),
            pow(vr('h'), num(2)),
          ),
          note: 'Expand (x + h + b)³, subtract, and every term left has an h in it.',
        };
      }
      if (shape === 1) {
        const k = a === 1 ? 2 : a;
        return {
          f: fn('sqrt', add(mul(num(k), X), num(b))),
          /* k / (√(k(x+h)+b) + √(kx+b)), which is what the conjugate gives. */
          cancelled: div(num(k), add(
            fn('sqrt', add(mul(num(k), add(X, vr('h'))), num(b))),
            fn('sqrt', add(mul(num(k), X), num(b))),
          )),
          note: 'Multiply above and below by the conjugate to clear the roots.',
        };
      }
      return {
        f: div(num(1), add(X, num(b))),
        /* -1 / ((x+h+b)(x+b)) */
        cancelled: neg(div(num(1), mul(
          add(add(X, vr('h')), num(b)),
          add(X, num(b)),
        ))),
        note: 'Put the two fractions over a common denominator first.',
      };
    },
  },

  tangent: {
    name: 'Tangent lines',
    topicId: 'calc.tangent',
    ask: 'the equation of a tangent line at a point',
    tangent: true,
    build(r, level) {
      const at = r.nz(-3, 3);
      const shape = level === 1 ? r.int(0, 1) : r.int(0, 2);
      if (shape === 0) {
        return { f: mul(add(X, num(r.nz(1, 4))), pow(sub(mul(num(2), X), num(1)), num(2))), at };
      }
      if (shape === 1) {
        return { f: div(num(1), pow(X, num(2))), at: r.nz(1, 4) };
      }
      return { f: mul(num(r.nz(2, 4)), fn('exp', mul(num(r.nz(1, 2)), X))), at: 0 };
    },
  },

  secondderiv: {
    name: 'Second derivatives',
    topicId: 'calc.power',
    ask: 'f double prime',
    order: 2,
    build(r, level) {
      if (level === 1) return { f: polynomial(r, 3) };
      const shape = r.int(0, 2);
      if (shape === 0) return { f: mul(num(r.nz(2, 5)), fn('sin', mul(num(r.nz(2, 3)), X))) };
      if (shape === 1) return { f: mul(X, fn('exp', mul(num(r.nz(1, 3)), X))) };
      return { f: div(num(r.nz(2, 6)), add(X, num(r.int(1, 4)))) };
    },
  },

  motion: {
    name: 'Velocity and acceleration',
    topicId: 'calc.related',
    ask: 'v(t) and a(t) from a position function',
    motion: true,
    build(r, level) {
      const shape = level === 1 ? 0 : r.int(0, 1);
      if (shape === 0) {
        /* The thrown-object shape from the review. */
        const v0 = r.int(3, 20) * 8;
        return {
          f: add(mul(num(-16), pow(T, num(2))), mul(num(v0), T)),
          wants: r() < 0.5 ? 'velocity' : 'acceleration',
          note: 'Position to velocity is one derivative; velocity to acceleration is another.',
        };
      }
      return {
        f: div(add(mul(num(2), T), num(1)), add(pow(T, num(2)), num(r.int(6, 14)))),
        wants: 'velocity',
        note: 'A quotient: bottom times the top derivative, minus top times the bottom derivative.',
      };
    },
  },
};

/* A tangent line is still an expression, so it is still gradeable: the
   answer is y = f(a) + f'(a)(x - a), written any way that is equal to it. */
function buildTangent(id, skill, built, level, seed) {
  const { f, at } = built;
  if (!f || at === undefined) return null;
  const d = derivative(f);
  const value = Expr.evaluate(f, { x: at });
  const slope = Expr.evaluate(d, { x: at });
  if (!isFinite(value) || !isFinite(slope)) return null;
  /* Ugly numbers make this an arithmetic exercise rather than a calculus
     one, which is not what the question is for. */
  if (Math.abs(value) > 1e4 || Math.abs(slope) > 1e4) return null;
  if (Math.abs(slope) < 1e-9) return null;

  const line = simplify(add(num(round4(value)), mul(num(round4(slope)), sub(X, num(at)))));
  return {
    source: 'sandbox',
    kind: 'expression',
    skill: id,
    skillName: skill.name,
    topicName: skill.name,
    topicId: skill.topicId,
    difficulty: level,
    seed: seed >>> 0,
    key: `sandbox:${id}:${level}:${seed >>> 0}`,
    variable: 'x',
    stem: `Find the tangent line to <span class="eq">f(x) = ${html(f)}</span> at `
      + `<span class="eq">x = ${at}</span>. Give it as y = ...`,
    instruction: 'Any correct form of the line counts, expanded or not.',
    functionText: text(f),
    answerNode: line,
    answerText: text(line),
    answerHtml: `y = ${html(line)}`,
    answerLatex: latex(line),
    distractors: notTheAnswer(line, [
      {
        kind: 'tangent-slope-only',
        node: mul(num(round4(slope)), X),
        hint: 'That is the slope times x. The line also has to pass through the point.',
      },
      {
        kind: 'tangent-value-only',
        node: num(round4(value)),
        hint: `That is f(${at}), the height. The line needs the slope as well.`,
      },
    ]),
    original: f,
    note: built.note || null,
    hints: [
      `A tangent line needs two things: a point and a slope. The point is (${at}, ${round4(value)}).`,
      `f'(x) = ${html(d)}, so the slope at x = ${at} is ${round4(slope)}.`,
      `Point-slope: y = ${round4(value)} + ${round4(slope)}(x - ${at}).`,
    ],
    steps: [
      { title: 'The point', html: `f(${at}) = ${round4(value)}` },
      { title: 'The derivative', html: `f'(x) = ${html(d)}` },
      { title: 'The slope there', html: `f'(${at}) = ${round4(slope)}` },
      { title: 'Point-slope form', html: `y = ${html(line)}` },
    ],
    graph: { f: latex(f), derivative: latex(line) },
  };
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

/* Keep only the distractors that are genuinely wrong.

   A named mistake that happens to equal the right answer is worse than no
   distractor at all: it tells someone who did the problem correctly that
   they made a specific error. It happens for real reasons - the tangent to
   a curve through the origin IS just slope times x - so it is checked
   rather than assumed. */
function notTheAnswer(answer, list) {
  return list.filter((d) => {
    try {
      return !equivalent(d.node, answer, { variable: 'x' });
    } catch (e) {
      return false;
    }
  });
}

/* f'' and v(t)/a(t) are both "differentiate, then differentiate again", so
   they share a builder and differ only in what the question calls them. */
function buildRepeated(id, skill, built, level, seed) {
  const f = simplify(built.f);
  const variable = skill.motion ? 't' : 'x';
  const once = derivative(f, variable);
  const twice = simplify(simplify(derivative(once, variable)));
  const wants = built.wants === 'acceleration' ? 2 : skill.order === 2 ? 2 : 1;
  const answer = wants === 2 ? twice : simplify(simplify(once));
  if (Expr.isIdenticallyZero(answer)) return null;

  const name = skill.motion
    ? (wants === 2 ? 'a(t)' : 'v(t)')
    : (wants === 2 ? 'f″(x)' : 'f′(x)');
  const stem = skill.motion
    ? `A particle has position <span class="eq">s(t) = ${html(f)}</span>. Find `
      + `<span class="eq">${name}</span>.`
    : `Find <span class="eq">${name}</span> for <span class="eq">f(x) = ${html(f)}</span>.`;

  return {
    source: 'sandbox',
    kind: 'expression',
    skill: id,
    skillName: skill.name,
    topicName: skill.name,
    topicId: skill.topicId,
    difficulty: level,
    seed: seed >>> 0,
    key: `sandbox:${id}:${level}:${seed >>> 0}`,
    variable,
    stem,
    instruction: 'Any correct form counts. You do not have to simplify.',
    functionText: text(f),
    answerNode: answer,
    answerText: text(answer),
    answerHtml: html(answer),
    answerLatex: latex(answer),
    distractors: wants === 2 ? [{
      kind: 'only-once',
      node: simplify(simplify(once)),
      hint: `That is ${skill.motion ? 'the velocity' : 'the first derivative'}. `
        + 'Differentiate it once more.',
    }] : [],
    original: f,
    note: built.note || null,
    hints: [
      built.note || 'Differentiate once, tidy up, then differentiate again.',
      `The first derivative is ${html(simplify(simplify(once)))}.`,
      `Differentiating that gives ${html(answer)}.`,
    ],
    steps: wants === 2 ? [
      { title: 'First derivative', html: html(simplify(simplify(once))) },
      { title: 'Second derivative', html: html(twice) },
    ] : [
      { title: 'Differentiate the position', html: html(answer) },
    ],
    graph: { f: latex(f), derivative: latex(answer) },
  };
}

/* Build one of the problems above. Separate from buildProblem because these
   ask a different question and are marked a different way. */
function buildIntegral(id, skill, built, level, seed) {
  const { integrand, F } = built;
  if (!integrand || !F) return null;
  /* The generator checks its own answer key: differentiating the stated
     antiderivative has to give back the integrand. A pair that fails this is
     a bug, and a bug here would teach the wrong thing. */
  const back = derivative(F);
  if (!equivalent(back, integrand).equal) return null;
  if (Expr.isIdenticallyZero(integrand)) return null;

  const tidy = simplify(simplify(F));
  return {
    source: 'sandbox',
    kind: 'antiderivative',
    skill: id,
    skillName: skill.name,
    topicName: skill.name,
    topicId: skill.topicId,
    difficulty: level,
    seed: seed >>> 0,
    key: `sandbox:${id}:${level}:${seed >>> 0}`,
    variable: 'x',
    stem: `Find <span class="integral"><span class="intsign">∫</span>`
      + `<span class="integrand">${html(integrand)}</span>`
      + `<i class="dx">dx</i></span>`,
    instruction: 'Any correct antiderivative counts. You do not need to write + C.',
    functionText: text(integrand),
    integrand,
    answerNode: tidy,
    answerText: text(tidy),
    answerHtml: `${html(tidy)} + C`,
    answerLatex: latex(tidy),
    distractors: [],
    original: integrand,
    note: built.note || null,
    hints: [
      built.note || 'Work backwards from the derivative rules.',
      `Differentiating ${html(tidy)} gives you back ${html(integrand)}.`,
    ],
    steps: [
      built.inside
        ? { title: 'Substitute', html: `u = ${html(built.inside)}` }
        : { title: 'Which rule, backwards', html: built.note || '' },
      { title: 'The antiderivative', html: `${html(tidy)} + C` },
      /* The builder has already verified that differentiating F gives the
         integrand back, so show the integrand rather than the raw derivative,
         which arrives in whatever shape the rules produced it. */
      { title: 'Check it', html: `Differentiating that gives back ${html(integrand)}` },
    ],
    graph: { f: latex(integrand), derivative: latex(tidy) },
  };
}

function buildForm(id, skill, built, level, seed) {
  if (!built || !built.question || !built.display) return null;
  /* A difference of squares is built with a zero middle coefficient, and
     printing it as "x^2 + 0x - 36" is how a generated question announces
     that nobody looked at it. Tidying both sides before anything is
     rendered is the fix; the factored form is unaffected by it. */
  const question = simplify(simplify(built.question));
  const display = simplify(simplify(built.display));
  /* The two have to be the same thing written differently, or the problem
     asks for something impossible. */
  if (!equivalent(question, display).equal) return null;
  const factored = skill.form === 'factored';
  /* And the stated answer has to be in the form being asked for. */
  if (factored && !Expr.isFactored(display)) return null;
  if (!factored && !Expr.isExpanded(display)) return null;

  return {
    source: 'sandbox',
    kind: factored ? 'factored' : 'expanded',
    skill: id,
    skillName: skill.name,
    topicName: skill.name,
    topicId: skill.topicId,
    difficulty: level,
    seed: seed >>> 0,
    key: `sandbox:${id}:${level}:${seed >>> 0}`,
    variable: 'x',
    stem: factored
      ? `Factor <span class="eq">${html(question)}</span>`
      : `Multiply out <span class="eq">${html(question)}</span>`,
    instruction: factored
      ? 'Write it as a product of brackets.'
      : 'Write it as a sum of plain terms.',
    functionText: text(question),
    answerNode: question,
    answerText: text(display),
    answerHtml: html(display),
    answerLatex: latex(display),
    distractors: [],
    original: null,
    hints: factored
      ? ['Find two numbers that multiply to the constant and add to the middle coefficient.',
        `It factors as ${html(display)}.`]
      : ['Every term in the first bracket multiplies every term in the second.',
        `It comes out as ${html(display)}.`],
    steps: [
      { title: factored ? 'The factors' : 'Multiplied out', html: html(display) },
    ],
  };
}

/* ------------------------------------------------------- wrong on purpose */

/* Differentiate with one rule broken. Each mode is a mistake students
   actually make, and the hint says which one it was.

   This is why the hints can be specific. A generic grader can only say the
   answer is wrong; matching against a deliberately broken derivation says
   "you never multiplied by the inside derivative", which is the sentence the
   student needed. */
const BREAKS = {
  'chain-missing': {
    hint: 'You differentiated the outside and stopped. The inside derivative still has to multiply in.',
    apply: (node, v, rec) => {
      if (node.t === 'fn') return Expr.FNS[node.n].d(node.a);
      if (node.t === 'pow' && rec.constExp(node)) {
        return mul(node.b, pow(node.a, sub(node.b, num(1))));
      }
      return null;
    },
  },
  'cos-sign': {
    hint: 'The derivative of cosine carries a minus sign.',
    apply: (node, v, rec) => {
      if (node.t === 'fn' && node.n === 'cos') return mul(fn('sin', node.a), rec.go(node.a));
      return null;
    },
  },
  'sin-sign': {
    hint: 'Only cosine picks up the minus. The derivative of sine is plus cosine.',
    apply: (node, v, rec) => {
      if (node.t === 'fn' && node.n === 'sin') return neg(mul(fn('cos', node.a), rec.go(node.a)));
      return null;
    },
  },
  'product-naive': {
    hint: 'The derivative of a product is not the product of the derivatives. '
      + 'It is the first times the second’s derivative, plus the second times the first’s.',
    apply: (node, v, rec) => {
      if (node.t === 'mul' && !rec.isConst(node.a) && !rec.isConst(node.b)) {
        return mul(rec.go(node.a), rec.go(node.b));
      }
      return null;
    },
  },
  'quotient-swapped': {
    hint: 'The numerator is the wrong way round: it is bottom times the top’s derivative, '
      + 'minus top times the bottom’s, over the bottom squared.',
    apply: (node, v, rec) => {
      if (node.t === 'div' && !rec.isConst(node.b)) {
        return div(sub(mul(node.a, rec.go(node.b)), mul(rec.go(node.a), node.b)),
          pow(node.b, num(2)));
      }
      return null;
    },
  },
  'power-not-reduced': {
    hint: 'The power rule drops the exponent by one. Yours kept it.',
    apply: (node, v, rec) => {
      if (node.t === 'pow' && rec.constExp(node)) {
        return mul(mul(node.b, pow(node.a, node.b)), rec.go(node.a));
      }
      return null;
    },
  },
  'ln-chain-missing': {
    hint: 'd/dx ln(u) is u′/u. You have the 1/u but not the u′.',
    apply: (node, v, rec) => {
      if (node.t === 'fn' && node.n === 'ln') return div(num(1), node.a);
      return null;
    },
  },
  'exp-chain-missing': {
    hint: 'e to a power reproduces itself, and then the exponent’s derivative multiplies in.',
    apply: (node, v, rec) => {
      if (node.t === 'fn' && node.n === 'exp') return fn('exp', node.a);
      return null;
    },
  },
};

/* Walk the tree differentiating normally, except at the first node where the
   broken rule applies. One mistake per distractor, because that is how
   students make them, and because two mistakes rarely land on a clean form. */
function brokenDiff(node, mode, v = 'x') {
  const brk = BREAKS[mode];
  if (!brk) return null;
  let used = false;
  const rec = {
    isConst: (n) => Expr.vars(n).size === 0,
    constExp: (n) => Expr.vars(n.b).size === 0,
    go: (n) => walk(n),
  };
  function walk(n) {
    if (!used) {
      const swapped = brk.apply(n, v, rec);
      if (swapped) { used = true; return swapped; }
    }
    switch (n.t) {
      case 'num': case 'const': return num(0);
      case 'var': return num(n.n === v ? 1 : 0);
      case 'neg': return neg(walk(n.a));
      case 'add': return add(walk(n.a), walk(n.b));
      case 'sub': return sub(walk(n.a), walk(n.b));
      case 'mul': return add(mul(walk(n.a), n.b), mul(n.a, walk(n.b)));
      case 'div': return div(sub(mul(walk(n.a), n.b), mul(n.a, walk(n.b))), pow(n.b, num(2)));
      case 'pow': case 'fn': return Expr.diff(n, v);
      default: return num(0);
    }
  }
  const out = walk(node);
  if (!used) return null;
  const tidy = simplify(simplify(out));
  /* A sabotage that changes nothing is not a sabotage. Dropping the chain
     factor on x^4 leaves 4x^3, which is simply correct, because the inside
     derivative there is 1. Attaching "you forgot the inside derivative" to a
     right answer is worse than saying nothing at all, so those are reported
     as not applying. */
  if (Expr.equivalent(tidy, Expr.derivative(node, v)).equal) return null;
  return tidy;
}

/* Every broken derivation that actually differs from the right answer. A
   distractor equal to the correct answer would mark a correct student wrong,
   so those are dropped here rather than relied on not to happen. */
function distractorsFor(f, reference) {
  const out = [];
  for (const mode of Object.keys(BREAKS)) {
    const node = brokenDiff(f, mode);
    if (!node) continue;
    const v = equivalent(node, reference, { count: 30 });
    if (!v.decided || v.equal) continue;
    out.push({ kind: mode, node, hint: BREAKS[mode].hint });
  }
  return out;
}

/* ------------------------------------------------- implicit, properly */

/* An implicit problem is an EQUATION, not a conic with a number on the
   right. Writing it as left = right rather than F(x,y) = c is what allows

       e^y = 17 ln(x^sin(xy))

   which is the shape that actually turns up once a course is past circles:
   an exponential in y, a logarithm in x, and a trig function of both at
   once. Internally it is still F = left - right and dy/dx = -F_x/F_y; the
   equation form is for the student, and for the generator to be able to
   build something worth differentiating.

   `domain` says where the equation means anything. An equation with ln(x) in
   it has nothing to say about negative x, and sampling there would waste
   every attempt. */
function implicitEquation(r, level) {
  if (level === 1) {
    const shape = r.int(0, 2);
    if (shape === 0) {
      const rad = r.int(2, 7);
      return {
        left: add(pow(X, num(2)), pow(Y, num(2))),
        right: num(rad * rad),
        note: 'A circle. Differentiate both sides, remembering y is a function of x.',
      };
    }
    if (shape === 1) {
      return { left: mul(X, Y), right: num(r.nz(2, 9)), note: 'The left side is a product.' };
    }
    const a = r.int(2, 5);
    const b = r.int(2, 5);
    return {
      left: add(mul(num(a), pow(X, num(2))), mul(num(b), pow(Y, num(2)))),
      right: num(a * b * r.int(2, 5)),
      note: 'An ellipse.',
    };
  }

  if (level === 2) {
    const shape = r.int(0, 6);
    if (shape === 0) {
      return {
        left: add(add(pow(X, num(2)), mul(X, Y)), pow(Y, num(2))),
        right: num(r.int(3, 12)),
        note: 'The middle term needs the product rule before you can collect dy/dx.',
      };
    }
    if (shape === 1) {
      return {
        left: add(fn('exp', Y), pow(X, num(2))),
        right: num(r.int(2, 9)),
        note: 'd/dx of e^y is e^y times dy/dx.',
      };
    }
    if (shape === 2) {
      return {
        left: add(fn('sin', Y), mul(num(r.nz(2, 4)), pow(X, num(2)))),
        right: num(r.int(1, 4)),
        note: 'd/dx of sin(y) is cos(y) times dy/dx.',
      };
    }
    if (shape === 3) {
      return {
        left: sub(mul(X, pow(Y, num(2))), fn('cos', X)),
        right: num(r.int(1, 6)),
        note: 'The first term is a product of x and a function of y.',
      };
    }
    if (shape === 5) {
      /* The shape Carter had on a quiz and could not start:
         x e^y = 2y + y^3. The left is a product with e^y in it, the right
         is all y, and the whole thing has to be collected before dy/dx
         comes out. */
      const a = r.int(2, 5);
      const b = r.int(2, 4);
      return {
        left: mul(X, fn('exp', Y)),
        right: add(mul(num(a), Y), mul(num(b === 1 ? 1 : b), pow(Y, num(3)))),
        note: 'The left is a product and the right is all y. Differentiate both, '
          + 'then collect every dy/dx on one side.',
      };
    }
    if (shape === 6) {
      return {
        left: mul(Y, fn('exp', X)),
        right: add(pow(Y, num(2)), num(r.int(1, 5))),
        note: 'Both sides carry a dy/dx once you differentiate.',
      };
    }
    return {
      left: add(fn('ln', Y), mul(num(r.nz(2, 5)), X)),
      right: num(r.int(1, 6)),
      domain: 'y-positive',
      note: 'd/dx of ln(y) is dy/dx over y.',
    };
  }

  /* Level 3: both variables inside the same function, and more than one
     kind of function in the same equation. */
  const shape = r.int(0, 13);

  if (shape === 0) {
    /* The one Carter asked for. ln(x^u) is u ln(x) for positive x, so this
       is a product rule inside a logarithm inside an equation - about as
       much as one line can carry. */
    const a = r.int(2, 20);
    return {
      left: fn('exp', Y),
      right: mul(num(a), fn('ln', pow(X, fn('sin', mul(X, Y))))),
      domain: 'x-positive',
      note: 'Take the exponent out of the logarithm first: ln(x^u) is u ln(x).',
    };
  }

  if (shape === 1) {
    return {
      left: fn('sin', mul(X, Y)),
      right: add(X, Y),
      note: 'The left side needs the chain rule and then the product rule inside it.',
    };
  }

  if (shape === 2) {
    return {
      left: fn('exp', mul(X, Y)),
      right: add(pow(X, num(2)), Y),
      note: 'd/dx of e^(xy) is e^(xy) times the derivative of xy.',
    };
  }

  if (shape === 3) {
    return {
      left: fn('ln', add(pow(X, num(2)), pow(Y, num(2)))),
      right: mul(num(r.nz(1, 3)), X),
      note: 'A logarithm of something containing both variables.',
    };
  }

  if (shape === 4) {
    return {
      left: add(mul(X, fn('sin', Y)), mul(Y, fn('cos', X))),
      right: num(r.int(1, 5)),
      note: 'Both terms are products, and each contains a function of the other variable.',
    };
  }

  if (shape === 5) {
    return {
      left: fn('tan', add(X, Y)),
      right: mul(X, Y),
      note: 'The left side is a chain rule; the right is a product rule.',
    };
  }

  if (shape === 6) {
    /* An inverse trig function with both variables in it. */
    return {
      left: fn('atan', mul(X, Y)),
      right: add(X, Y),
      note: 'd/dx arctan(u) is u prime over 1 plus u squared.',
    };
  }

  if (shape === 7) {
    return {
      left: add(fn('asin', Y), pow(X, num(2))),
      right: num(r.int(1, 3)),
      note: 'd/dx arcsin(y) is dy/dx over the square root of 1 minus y squared.',
    };
  }

  if (shape === 8) {
    const name = r.pick(['sec', 'csc', 'cot']);
    return {
      left: fn(name, Y),
      right: add(mul(num(r.nz(2, 4)), X), Y),
      note: `The reciprocal trig functions each carry their own pair: `
        + `d/dx ${name}(y) brings a dy/dx with it.`,
    };
  }

  if (shape === 9) {
    /* e^y = sin(3xy). Exponential on one side, a chain-then-product on the
       other, and nothing to collect until both are differentiated. */
    return {
      left: fn('exp', Y),
      right: fn('sin', mul(num(3), mul(X, Y))),
      note: 'Left gives e^y·dy/dx. Right is cos(3xy) times the derivative of 3xy, '
        + 'which needs the product rule.',
    };
  }

  if (shape === 10) {
    /* e^(sin 4xy): a function inside a function inside a function, with
       both variables in the innermost one. */
    return {
      left: fn('exp', fn('sin', mul(num(4), mul(X, Y)))),
      right: add(X, Y),
      note: 'Three layers on the left: the exponential, the sine, then the product 4xy. '
        + 'Work outside in and multiply as you go.',
    };
  }

  if (shape === 11) {
    /* e^(tan xy). Same idea with tangent, so the inside derivative brings a
       secant squared with it. */
    return {
      left: fn('exp', fn('tan', mul(X, Y))),
      right: add(Y, num(r.int(2, 5))),
      note: 'd/dx tan(u) is sec²(u)·u′, and u = xy needs the product rule.',
    };
  }

  if (shape === 12) {
    /* y inside an exponent multiplied by a trig function of x. */
    return {
      left: fn('exp', mul(Y, fn('sin', X))),
      right: add(X, num(1)),
      note: 'The exponent is a product of y and sin(x), so its derivative has two terms.',
    };
  }

  /* x e^y against a polynomial in y, at the harder end: the same shape as
     the quiz question, with more on the right to collect. */
  return {
    left: mul(pow(X, num(2)), fn('exp', Y)),
    right: sub(pow(Y, num(3)), mul(num(r.int(2, 5)), Y)),
    note: 'Product rule on the left, and every term on the right carries a dy/dx.',
  };
}

/* Points that actually lie on left = right.

   Harder than it was for a circle. A transcendental equation has branches,
   gaps, and stretches of x where there is no real y at all, so this tries
   Newton from several starting points and falls back to hunting for a sign
   change and bisecting, which cannot miss a crossing that exists in the
   range it scans. Anything near a vertical tangent is dropped: dy/dx does
   not exist there and neither side of a comparison would mean anything. */
function curveScopes(F, c, seed, opts = {}) {
  const r = MathKit.rng(seed >>> 0);
  const Fy = derivative(F, 'y');
  const f = Expr.compile(F);
  const fy = Expr.compile(Fy);
  const domain = opts.domain || 'any';
  const residual = (x, y) => f({ x, y }) - c;

  const positiveY = domain === 'y-positive' || domain === 'both-positive';
  const pickX = () => {
    if (domain === 'x-positive' || domain === 'both-positive') return 0.25 + r() * 3.5;
    return (r() < 0.5 ? -1 : 1) * (0.3 + r() * 2.6);
  };
  const yStart = () => {
    if (positiveY) return 0.2 + r() * 3;
    return (r() < 0.5 ? -1 : 1) * (0.3 + r() * 2.6);
  };

  const newton = (x, start) => {
    let y = start;
    for (let k = 0; k < 60; k++) {
      const value = residual(x, y);
      const slope = fy({ x, y });
      if (!isFinite(value) || !isFinite(slope) || Math.abs(slope) < 1e-9) return null;
      const step = value / slope;
      y -= step;
      if (!isFinite(y)) return null;
      if (Math.abs(step) < 1e-13) return y;
    }
    return null;
  };

  /* Scan for a sign change and bisect. Slower, but it finds roots Newton
     walks straight past on a periodic equation. */
  const bisect = (x) => {
    const lo = positiveY ? 0.05 : -6;
    const hi = 6;
    const steps = 240;
    let previousY = lo;
    let previous = residual(x, lo);
    for (let i = 1; i <= steps; i++) {
      const y = lo + ((hi - lo) * i) / steps;
      const value = residual(x, y);
      if (isFinite(previous) && isFinite(value) && previous * value < 0) {
        let a = previousY;
        let b = y;
        for (let k = 0; k < 80; k++) {
          const mid = (a + b) / 2;
          const midValue = residual(x, mid);
          if (!isFinite(midValue)) break;
          if (residual(x, a) * midValue <= 0) b = mid;
          else a = mid;
        }
        return (a + b) / 2;
      }
      previousY = y;
      previous = value;
    }
    return null;
  };

  const out = [];
  let guard = 0;
  while (out.length < (opts.count || 26) && guard++ < (opts.count || 26) * 60) {
    const x = pickX();
    let y = null;
    for (let attempt = 0; attempt < 3 && y === null; attempt++) {
      y = newton(x, yStart());
    }
    if (y === null) y = bisect(x);
    if (y === null || !isFinite(y)) continue;
    if (positiveY && y <= 0) continue;
    if (Math.abs(residual(x, y)) > 1e-8 * Math.max(1, Math.abs(c))) continue;
    const slope = fy({ x, y });
    /* A vertical tangent, or a point where the implicit function theorem
       has nothing to say. */
    if (!isFinite(slope) || Math.abs(slope) < 1e-3) continue;
    const dydx = -Expr.compile(derivative(F, 'x'))({ x, y }) / slope;
    if (!isFinite(dydx) || Math.abs(dydx) > 1e4) continue;
    out.push({ x, y });
  }
  return out;
}

/* --------------------------------------------------------------- assembly */

/* One sandbox problem.

   `spec` is what the ask box produced: { skills, level, form }. Returns null
   when a builder cannot produce something checkable, which the caller
   retries, exactly like generate() does in generators.js. */
export function buildProblem(spec, seed) {
  const r = MathKit.rng(seed >>> 0);
  const level = Math.max(1, Math.min(3, Math.round(spec.level || 1)));
  const ids = (spec.skills && spec.skills.length ? spec.skills : ['power'])
    .filter((s) => SKILLS[s]);
  if (!ids.length) return null;
  const id = r.pick(ids);
  const skill = SKILLS[id];

  const built = skill.build(r, level, spec);
  if (!built) return null;

  if (skill.implicit) return implicitProblem(id, skill, built, level, seed);
  if (skill.integral) return buildIntegral(id, skill, built, level, seed);
  if (skill.form) return buildForm(id, skill, built, level, seed);
  if (skill.parts) return buildLimitDefinition(id, skill, built, level, seed);
  if (skill.tangent) return buildTangent(id, skill, built, level, seed);
  if (skill.zeroset) return buildZeroSet(id, skill, built, level, seed);
  if (skill.motion || skill.order === 2) return buildRepeated(id, skill, built, level, seed);

  /* Tidy before anything is rendered, for the same reason buildForm does:
     a term with a zero or one coefficient in a generated question is how it
     announces that nobody looked at it. */
  let f = simplify(built.f);
  /* At the top level, two skills at once is what "longer problems" means. */
  if (level === 3 && ids.length > 1 && r() < 0.5) {
    const otherId = r.pick(ids.filter((o) => o !== id && !SKILLS[o].implicit));
    if (otherId) {
      const other = SKILLS[otherId].build(r, 2);
      if (other && other.f) f = r() < 0.5 ? mul(f, other.f) : add(f, other.f);
    }
  }

  const reference = derivative(f);
  /* A derivative that is identically zero cannot be graded: every wrong
     answer that also works out to zero would grade as correct, and doubling
     the right answer would too. Checked numerically rather than by looking
     for variables in the tree, because the quotient rule on a disguised
     constant still produces an x-shaped expression that is zero everywhere. */
  if (Expr.isIdenticallyZero(reference)) return null;

  const distractors = distractorsFor(f, reference);

  return {
    source: 'sandbox',
    kind: 'expression',
    skill: id,
    skillName: skill.name,
    topicName: skill.name,
    topicId: skill.topicId,
    difficulty: level,
    seed: seed >>> 0,
    key: `sandbox:${id}:${level}:${seed >>> 0}`,
    variable: 'x',
    stem: id === 'limitdef'
      ? `Use the limit definition to find f′(x) for ${eqHtml('f(x)', html(f))}`
      : `Differentiate ${eqHtml('f(x)', html(f))}`,
    instruction: id === 'limitdef'
      ? 'The answer is the derivative itself. Any correct form counts.'
      : 'Any correct form counts. You do not have to simplify.',
    functionText: text(f),
    functionLatex: latex(f),
    answerNode: reference,
    answerText: text(reference),
    answerHtml: html(reference),
    answerLatex: latex(reference),
    distractors,
    inner: built.inner || null,
    original: f,
    note: built.note || null,
    hints: id === 'limitdef'
      ? limitDefHints(f, reference, built)
      : hintsFor(id, built, f, reference),
    steps: id === 'limitdef'
      ? limitDefSteps(f, reference, built)
      : stepsFor(id, built, f, reference),
    graph: {
      /* What the Desmos panel plots: the function, the student's attempt and
         the true derivative. Desmos computes its own derivative of f, so the
         two curves coinciding is an independent confirmation. */
      f: latex(f),
      derivative: latex(reference),
    },
  };
}

function implicitProblem(id, skill, built, level, seed) {
  const { left, right, domain } = built;
  if (!left || !right) return null;

  /* left = right becomes F = 0, which is the only form the rule needs.
     Keeping the equation around separately is for the student: nobody
     writes "e^y - 17 ln(x^sin(xy)) = 0" on a worksheet. */
  const F = sub(left, right);
  const Fx = simplify(derivative(F, 'x'));
  const Fy = simplify(derivative(F, 'y'));
  /* No y in the derivative means it was never an implicit problem. */
  if (Expr.vars(Fy).size === 0 && Expr.isIdenticallyZero(Fy)) return null;

  const reference = simplify(simplify(neg(div(Fx, Fy))));
  if (Expr.isIdenticallyZero(reference)) return null;

  const scopes = curveScopes(F, 0, seed, { domain });
  /* No usable points means no checkable problem. Better to skip it than to
     ask something that cannot be graded. The floor is comfortably above the
     minimum equivalent() wants, so a borderline curve does not produce a
     problem whose grading then reports "I cannot tell". */
  if (scopes.length < 14) return null;

  const distractors = [];
  const wrongWay = simplify(simplify(neg(div(Fy, Fx))));
  if (!equivalent(wrongWay, reference, { scopes }).equal) {
    distractors.push({
      kind: 'reciprocal',
      node: wrongWay,
      hint: 'That is dx/dy. Flip it: solve for dy/dx.',
    });
  }
  /* Treating y as a constant is THE implicit differentiation mistake: the
     y terms then contribute nothing and dy/dx comes out of the x terms
     alone. */
  const asConstant = simplify(simplify(neg(Fx)));
  if (!equivalent(asConstant, reference, { scopes }).equal) {
    distractors.push({
      kind: 'y-as-constant',
      node: asConstant,
      hint: 'y is a function of x, so differentiating a y term leaves a dy/dx behind. '
        + 'Yours treated y as a number.',
    });
  }

  const equation = `${html(left)} = ${html(right)}`;
  return {
    source: 'sandbox',
    kind: 'expression',
    skill: id,
    skillName: skill.name,
    topicName: skill.name,
    topicId: skill.topicId,
    difficulty: level,
    seed: seed >>> 0,
    key: `sandbox:${id}:${level}:${seed >>> 0}`,
    variable: 'x',
    implicit: true,
    domain: domain || 'any',
    stem: `For <span class="eq">${equation}</span>, find ${MathKit.frac('dy', 'dx')}.`,
    instruction: 'Your answer may use both x and y. Any correct form counts.',
    /* Both sides, so a reload and the test harness can both rebuild the
       curve rather than guessing at which part was the equation. */
    functionText: `${text(left)} = ${text(right)}`,
    curve: { left: text(left), right: text(right) },
    answerNode: reference,
    answerText: text(reference),
    answerHtml: html(reference),
    answerLatex: latex(reference),
    distractors,
    scopes,
    original: null,
    note: built.note || null,
    hints: [
      built.note || 'Differentiate both sides with respect to x, remembering that y is a function of x.',
      `Differentiating the left gives ${html(simplify(derivative(left, 'x')))} from the x terms `
        + `and ${html(simplify(derivative(left, 'y')))} times dy/dx from the y terms.`,
      'Collect every dy/dx on one side, factor it out, and divide.',
    ],
    steps: [
      {
        title: 'Differentiate both sides',
        html: `${html(Fx)} + ${html(Fy)}·${MathKit.frac('dy', 'dx')} = 0`,
      },
      { title: 'Solve for dy/dx', html: `${MathKit.frac('dy', 'dx')} = ${html(reference)}` },
    ],
    graph: { implicit: `${latex(left)}=${latex(right)}` },
  };
}

function eqHtml(left, right) {
  return `<span class="eq">${left} = ${right}</span>`;
}

/* Hints, in the order they should be revealed: the rule, then the pieces,
   then the assembled answer. Generic by skill, specific where the builder
   knows the inside function. */
function hintsFor(id, built, f, reference) {
  const out = [];
  switch (id) {
    case 'power':
      out.push('Each term on its own: multiply by the exponent, then drop it by one.');
      out.push('A root is a fractional power and 1/x is a negative one. Rewrite before differentiating.');
      break;
    case 'trig':
      out.push('sin goes to cos, cos goes to minus sin, tan goes to sec squared.');
      break;
    case 'chain':
      out.push('Outside derivative first, with the inside left alone, then multiply by the inside derivative.');
      break;
    case 'product':
      out.push('First times the derivative of the second, plus the second times the derivative of the first.');
      break;
    case 'quotient':
      out.push('Bottom times the derivative of the top, minus top times the derivative of the bottom, all over the bottom squared.');
      break;
    case 'exp':
      out.push('e to a power reproduces itself, times the derivative of the exponent. A different base picks up ln of that base.');
      break;
    case 'log':
      out.push('d/dx ln(u) is u′ over u.');
      break;
    case 'logdiff':
      out.push('With x in the exponent, take ln of both sides first, then differentiate implicitly.');
      break;
    default:
      break;
  }
  if (built && built.inner) {
    out.push(`The inside is ${html(simplify(built.inner))}, so u′ = `
      + `${html(simplify(derivative(built.inner)))}.`);
  }
  out.push(`The answer is ${html(reference)}, in one of its forms.`);
  return out;
}

function stepsFor(id, built, f, reference) {
  const steps = [];
  /* Everything shown in a step goes through simplify first, for the same
     reason the question does: the step said "-1x^3" while the question it
     was explaining said "-x^3", which reads like two different problems. */
  const show = (node) => html(simplify(node));
  if (built && built.inner) {
    steps.push({ title: 'Name the inside', html: `u = ${show(built.inner)}` });
    steps.push({ title: 'Its derivative', html: `u′ = ${show(derivative(built.inner))}` });
  }
  if (built && built.factors) {
    steps.push({ title: 'The two pieces', html: `${show(built.factors[0])} and ${show(built.factors[1])}` });
    steps.push({
      title: 'Their derivatives',
      html: `${show(derivative(built.factors[0]))} and ${show(derivative(built.factors[1]))}`,
    });
  }
  steps.push({ title: 'Apply the rule', html: html(reference) });
  return steps;
}

/* The limit definition is a different question from "differentiate this",
   even though the answer is the same, and the working is the whole point of
   asking it. Showing only the finished derivative would teach nothing: what
   the student is stuck on is the algebra that makes the h cancel. */
function limitDefHints(f, reference, built) {
  const shifted = substituteShift(f);
  return [
    'Write the quotient out first: f(x + h) minus f(x), all over h.',
    built.note || 'Expand and simplify until every surviving term has an h in it.',
    `With f(x + h) = ${html(shifted)}, the top becomes something every term of `
      + 'which carries an h, so the h cancels and the limit is what is left.',
    `The limit works out to ${html(reference)}.`,
  ];
}

function limitDefSteps(f, reference, built, cancelled) {
  const shifted = substituteShift(f);
  const quotient = MathKit.frac(
    `${html(shifted)} \u2212 ${html(f)}`,
    '<i>h</i>',
  );
  return [
    { title: 'The difference quotient', html: `f\u2032(x) = lim<sub>h\u21920</sub> ${quotient}` },
    { title: 'The move that makes it work', html: built.note || 'Simplify the top.' },
    cancelled
      ? { title: 'Once the h cancels', html: `lim<sub>h→0</sub> ${html(cancelled)}` }
      : null,
    { title: 'Now let h go to zero', html: html(reference) },
  ].filter(Boolean);
}

/* f(x + h), which is f with every x replaced by x + h. */
function substituteShift(node) {
  const walk = (n) => {
    if (!n) return n;
    if (n.t === 'var' && n.n === 'x') return add(X, H);
    if (n.t === 'num' || n.t === 'const') return n;
    if (n.t === 'fn') return fn(n.n, walk(n.a));
    if (n.t === 'neg') return neg(walk(n.a));
    if (n.a && n.b) return { t: n.t, a: walk(n.a), b: walk(n.b) };
    return n;
  };
  return walk(node);
}

/* ---------------------------------------------- where the tangent is flat */

/* "Find every x where the tangent is horizontal."

   Carter asked for more of these, and he is right that they are worth more
   than a plain derivative: you have to differentiate, factor, and then
   reason about which factors can actually be zero. e^(kx) never is. A
   denominator being zero is not a solution either.

   Built backward from the ROOTS, which is the only honest way to do it.
   Picking a function first and then solving f'(x) = 0 numerically would
   give a set of decimals that may or may not be the whole answer; picking
   the roots and integrating up to f means the answer is exact and complete
   by construction, and buildZeroSet re-checks completeness numerically
   before the problem is allowed out.

   These also carry noGraph. On a test this has to be shown with algebra,
   and a graph would hand over the answer - which Carter pointed out before
   I did. */
const ZERO_SET = {
  horizontal: {
    name: 'Horizontal tangents',
    topicId: 'calc.tangent',
    ask: 'every x where the tangent is flat',
    zeroset: true,
    build(r, level) {
      const shape = level === 1 ? r.int(0, 1)
        : level === 2 ? r.int(0, 4) : r.int(2, 7);

      /* A cubic with two flat spots. f' = 6(x - p)(x - q), integrated to
         keep every coefficient whole. */
      if (shape === 0 || shape === 1) {
        const p = r.int(-4, 3);
        const q = p + r.int(1, 4);
        /* f' = 6(x - p)(x - q), integrated. Signed terms are appended with a
           plus or a minus rather than carrying a negative coefficient,
           because "2x^3 - -3x^2" is not how a question is written down. */
        let f = mul(num(2), pow(X, num(3)));
        f = signedTerm(f, -3 * (p + q), pow(X, num(2)));
        f = signedTerm(f, 6 * p * q, X);
        if (shape === 1) f = signedTerm(f, r.int(-6, 6), num(1));
        return {
          f,
          roots: [root(p), root(q)],
          factored: `f′(x) = 6${bracketRoot(p)}${bracketRoot(q)}`,
          note: 'Differentiate, take out the common factor, then read off both roots.',
        };
      }

      /* x^2 e^(kx): the point of the question is that e^(kx) is never zero,
         so only the polynomial factor matters. */
      if (shape === 2) {
        const k = r.nz(1, 3) * (r() < 0.5 ? -1 : 1);
        return {
          f: mul(pow(X, num(2)), fn('exp', mul(num(k), X))),
          roots: [root(0), root(-2 / k, frac(-2, k))],
          factored: `f′(x) = x·e^(${k}x)(2 + ${k}x)`,
          note: 'Factor out the exponential. It is never zero, so it contributes '
            + 'no solutions at all.',
        };
      }

      /* x/(x^2 + c): flat where c - x^2 = 0, and the denominator never
         vanishes, so there is nothing to exclude. */
      if (shape === 3) {
        const m = r.int(1, 5);
        return {
          f: div(X, add(pow(X, num(2)), num(m * m))),
          roots: [root(-m), root(m)],
          factored: `f′(x) = (${m * m} − x²)/(x² + ${m * m})²`,
          note: 'A fraction is zero when its TOP is zero. Set the numerator to zero.',
        };
      }

      /* A quartic, flat in three places - the one students miss, because
         they divide by x instead of keeping it as a factor. */
      if (shape === 4) {
        const m = r.int(1, 3);
        return {
          f: sub(pow(X, num(4)), mul(num(2 * m * m), pow(X, num(2)))),
          roots: [root(-m), root(0), root(m)],
          factored: `f′(x) = 4x(x − ${m})(x + ${m})`,
          note: 'Three factors, three solutions. Do not divide the x away.',
        };
      }

      /* Trig, on a stated interval, with exact answers. Pick the family by
         the value the trig function has to take: 1/2 or -1/2 give sixths
         and thirds of pi, which is what a test asks for. */
      if (shape === 5) {
        /* f = x + 2cos x, f' = 1 - 2 sin x = 0 at pi/6 and 5pi/6. */
        return {
          f: add(X, mul(num(2), fn('cos', X))),
          roots: [root(Math.PI / 6, 'π/6'), root(5 * Math.PI / 6, '5π/6')],
          interval: [0, 2 * Math.PI],
          intervalText: '0 ≤ x < 2π',
          factored: 'f′(x) = 1 − 2sin(x), so sin(x) = 1/2',
          note: 'Solve sin(x) = 1/2 and keep every solution in the interval, '
            + 'not just the first one your calculator gives.',
        };
      }

      if (shape === 6) {
        /* f = x - 2 sin x, f' = 1 - 2cos x = 0 at pi/3 and 5pi/3. */
        return {
          f: sub(X, mul(num(2), fn('sin', X))),
          roots: [root(Math.PI / 3, 'π/3'), root(5 * Math.PI / 3, '5π/3')],
          interval: [0, 2 * Math.PI],
          intervalText: '0 ≤ x < 2π',
          factored: 'f′(x) = 1 − 2cos(x), so cos(x) = 1/2',
          note: 'Cosine is positive in two quadrants. Both of them are in range.',
        };
      }

      /* sin(x) + cos(x): flat where tan x = 1. */
      return {
        f: add(fn('sin', X), fn('cos', X)),
        roots: [root(Math.PI / 4, 'π/4'), root(5 * Math.PI / 4, '5π/4')],
        interval: [0, 2 * Math.PI],
        intervalText: '0 ≤ x < 2π',
        factored: 'f′(x) = cos(x) − sin(x), so tan(x) = 1',
        note: 'Divide through by cos(x) to turn it into tan(x) = 1.',
      };
    },
  },
};

/* Append a term with its sign, so a negative coefficient becomes a
   subtraction instead of "+ -3". */
function signedTerm(sofar, coefficient, factor) {
  if (!coefficient) return sofar;
  const size = Math.abs(coefficient);
  const piece = factor.t === 'num' && factor.v === 1
    ? num(size)
    : (size === 1 ? factor : mul(num(size), factor));
  return coefficient > 0 ? add(sofar, piece) : sub(sofar, piece);
}

/* (x - 3) or (x + 3), never (x - -3). */
function bracketRoot(value) {
  if (value === 0) return 'x';
  return value > 0 ? `(x − ${value})` : `(x + ${-value})`;
}

/* A root, with the exact form to show and the number to grade against. */
function root(value, label) {
  if (label !== undefined) return { value, label };
  const n = round4(value);
  return { value, label: n < 0 ? `−${-n}` : String(n) };
}

/* -2/k written as a fraction when it is not whole, because -0.6667 is not
   an answer anybody would write on a test. */
function frac(a, b) {
  if (a % b === 0) return String(a / b);
  const g = gcd(Math.abs(a), Math.abs(b));
  const sign = (a < 0) !== (b < 0) ? '−' : '';
  return `${sign}${Math.abs(a) / g}/${Math.abs(b) / g}`;
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a || 1;
}

/* Build the question, and refuse to ship it unless the stated roots are
   exactly the zeros of f' - every one of them a zero, and no others hiding
   in the range. An incomplete answer key on a "find them all" question is
   the worst thing this file could do, so it is checked rather than trusted:
   the roots came from the construction, but the integration, the
   simplification and the differentiation all sit between that and the
   question on screen. */
function buildZeroSet(id, skill, built, level, seed) {
  const f = simplify(built.f);
  const roots = built.roots || [];
  if (!roots.length) return null;
  const d = simplify(derivative(f));
  const at = (x) => Expr.evaluate(d, { x });

  for (const rt of roots) {
    const v = at(rt.value);
    if (!isFinite(v) || Math.abs(v) > 1e-7) return null;
  }

  const [lo, hi] = built.interval || [-9, 9];
  const steps = 4000;
  const seen = [];
  let prev = at(lo);
  for (let i = 1; i <= steps; i++) {
    const x = lo + ((hi - lo) * i) / steps;
    const cur = at(x);
    if (!isFinite(cur)) { prev = cur; continue; }
    if (isFinite(prev) && ((prev < 0 && cur > 0) || (prev > 0 && cur < 0))) {
      /* Bisect to place the crossing, then check it is one we know about. */
      let a = x - (hi - lo) / steps;
      let b = x;
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        if ((at(a) < 0) === (at(m) < 0)) a = m; else b = m;
      }
      seen.push((a + b) / 2);
    }
    prev = cur;
  }
  /* A touching zero (a repeated factor) does not change sign, so those are
     found by looking for a near-zero minimum of |f'| as well. */
  for (const rt of roots) {
    if (!seen.some((s) => Math.abs(s - rt.value) < 1e-4)) seen.push(rt.value);
  }
  for (const s of seen) {
    if (!roots.some((rt) => Math.abs(rt.value - s) < 1e-4)) return null;
  }
  if (seen.length !== roots.length) return null;

  const ordered = roots.slice().sort((a, b) => a.value - b.value);
  const answers = ordered.map((rt) => rt.value);
  const shown = ordered.map((rt) => `x = ${rt.label}`).join(' and ');
  const where = built.intervalText
    ? ` for <span class="eq">${built.intervalText}</span>`
    : '';

  return {
    source: 'sandbox',
    kind: 'set',
    skill: id,
    skillName: skill.name,
    topicName: skill.name,
    topicId: skill.topicId,
    difficulty: level,
    seed: seed >>> 0,
    key: `sandbox:${id}:${level}:${seed >>> 0}`,
    variable: 'x',
    stem: `Find every <span class="eq">x</span> where the graph of `
      + `<span class="eq">f(x) = ${html(f)}</span>&nbsp;has a horizontal tangent${where}.`,
    instruction: 'Give the x-values separated by commas. Exact values, so pi/6 '
      + 'rather than 0.5236.',
    /* The graph would hand this one over, and on the test the algebra is the
       whole question. */
    /* The interval the question restricts the answer to, in numbers as well
       as in words, so anything checking the answer key knows that a zero
       outside it is not a missing solution. */
    interval: built.interval || null,
    noGraph: true,
    noGraphWhy: 'This one has to come out of the algebra - reading the flat '
      + 'spots off a graph is not an answer you can write on the test.',
    functionText: text(f),
    answers,
    tol: 1e-4,
    answerText: ordered.map((rt) => rt.label).join(', '),
    answerHtml: shown,
    derivativeHtml: html(d),
    original: f,
    note: built.note || null,
    hints: [
      'A horizontal tangent means the derivative is zero. Start by differentiating.',
      `f′(x) = ${html(d)}`,
      built.factored || 'Factor it, then set each factor to zero in turn.',
      `The solutions are ${shown}.`,
    ],
    steps: [
      { title: 'Differentiate', html: html(d) },
      { title: 'Set it to zero and factor', html: built.factored || 'Factor and solve.' },
      { title: 'Every solution', html: shown },
      { title: 'Watch out for', html: built.note || '' },
    ],
    graph: null,
  };
}

/* ------------------------------------------- the limit definition, properly */

/* A limit definition question that cannot be answered with the chain rule.

   The old one asked for f'(x) and accepted it however you got there, which
   means it was not a limit definition question at all - it was a
   differentiate-this question with a sentence in front of it. Carter found
   that out the honest way: he chain-ruled it and was marked correct.

   So it is asked in four parts, which are the four lines you would write on
   paper:

     1. f(x + h)
     2. the difference quotient, before anything cancels
     3. the quotient after the h cancels
     4. the limit as h goes to zero

   Part 3 is the one that does the work. Its answer has to agree with the
   quotient everywhere h is not zero AND be defined AT h = 0, which is
   exactly what "the h cancelled" means and is not something you can produce
   by differentiating. Writing the uncancelled quotient there gets told that
   the h is still in the denominator.

   The cancelled form is stated by the builder rather than derived, because
   cancelling it symbolically needs polynomial division and conjugates that
   this engine does not do. It is then CHECKED against the engine three
   ways before the question is allowed out - agrees with the quotient, is
   finite at h = 0, and equals f'(x) there - so a wrong statement of it
   cannot reach a student. */

const H = vr('h');

function buildLimitDefinition(id, skill, built, level, seed) {
  const f = simplify(built.f);
  const cancelled = built.cancelled;
  if (!cancelled) return null;
  const shifted = substituteShift(f);
  const quotient = div(sub(shifted, f), H);
  const reference = simplify(derivative(f));
  if (Expr.isIdenticallyZero(reference)) return null;
  if (!checkCancellation(quotient, cancelled, reference)) return null;

  const frac = (a, b) => MathKit.frac(a, b);
  const lim = (inner) => `lim<sub>h→0</sub> ${inner}`;

  return {
    source: 'sandbox',
    kind: 'parts',
    skill: id,
    skillName: skill.name,
    topicName: skill.name,
    topicId: skill.topicId,
    difficulty: level,
    seed: seed >>> 0,
    key: `sandbox:${id}:${level}:${seed >>> 0}`,
    variable: 'x',
    stem: `Use the limit definition to find <span class="eq">f′(x)</span> for `
      + `<span class="eq">f(x) = ${html(f)}</span>. Write it out line by line.`,
    instruction: 'Four lines, the way you would write them on paper. Use h for '
      + 'the step.',
    functionText: text(f),
    parts: [
      {
        id: 'shifted',
        label: 'Substitute',
        promptHtml: `f(x + h) = `,
        answerNode: shifted,
        vars: ['x', 'h'],
        placeholder: 'f with every x replaced by (x + h)',
        hint: 'Every x in f becomes (x + h). Nothing else changes.',
      },
      {
        id: 'quotient',
        label: 'The difference quotient',
        promptHtml: `f′(x) = ${lim(frac('f(x + h) − f(x)', '<i>h</i>'))} = ${lim('')}`,
        answerNode: quotient,
        vars: ['x', 'h'],
        placeholder: '(f(x+h) - f(x))/h, written out',
        hint: 'Put what you wrote above over h, and subtract f(x) from it.',
      },
      {
        id: 'cancelled',
        label: 'After the h cancels',
        promptHtml: `= ${lim('')}`,
        answerNode: cancelled,
        vars: ['x', 'h'],
        /* The whole point of the question. */
        mustBeFiniteAtZero: true,
        placeholder: 'the same thing, with no h left on the bottom',
        hint: built.note || 'Simplify the top until every term has an h in it, '
          + 'then cancel it against the h underneath.',
      },
      {
        id: 'limit',
        label: 'Let h go to zero',
        promptHtml: `f′(x) = `,
        answerNode: reference,
        vars: ['x'],
        placeholder: 'put h = 0 into the line above',
        hint: 'Everything with an h in it goes to zero.',
      },
    ],
    answerNode: reference,
    answerText: text(reference),
    answerHtml: html(reference),
    answerLatex: latex(reference),
    partAnswers: [text(shifted), text(quotient), text(cancelled), text(reference)],
    original: f,
    note: built.note || null,
    hints: limitDefHints(f, reference, built),
    steps: limitDefSteps(f, reference, built, cancelled),
    graph: { f: latex(f), derivative: latex(reference) },
  };
}

/* The three checks that let a stated cancelled form be trusted. Sampled at
   points where everything involved is actually defined, because a square
   root family has x values where neither side means anything. */
function checkCancellation(quotient, cancelled, reference) {
  const q = Expr.compile(quotient);
  const c = Expr.compile(cancelled);
  const d = Expr.compile(reference);
  let good = 0;
  for (let i = 0; i < 60 && good < 12; i++) {
    const x = ((i * 37) % 97) / 7 - 5;
    const h = (((i * 53) % 89) / 400) + 0.01;
    const qv = q({ x, h });
    const cv = c({ x, h });
    const zero = c({ x, h: 0 });
    const dv = d({ x });
    if (![qv, cv, zero, dv].every((v) => isFinite(v) && Math.abs(v) < 1e6)) continue;
    const scale = Math.max(1, Math.abs(qv), Math.abs(cv));
    /* Agrees with the quotient away from zero ... */
    if (Math.abs(qv - cv) > 1e-6 * scale) return false;
    /* ... and at h = 0 it IS the derivative. */
    if (Math.abs(zero - dv) > 1e-6 * Math.max(1, Math.abs(dv))) return false;
    good++;
  }
  return good >= 12;
}

/* Mark a part-by-part answer.

   Each part is an expression in x and h, graded the way every other
   expression here is. The third part has one extra condition, and it is the
   reason the question exists: it has to still be defined when h is zero. */
export function gradeParts(problem, answers) {
  const list = Array.isArray(answers) ? answers : [answers];
  const parts = problem.parts || [];
  const verdicts = parts.map((part, i) => {
    const raw = list[i] == null ? '' : String(list[i]).trim();
    if (!raw) {
      return { correct: false, decided: true, kind: 'blank', hint: 'Nothing written here yet.' };
    }
    const v = Expr.judge(raw, part.answerNode, { vars: part.vars || ['x', 'h'] });
    if (!v.correct || !part.mustBeFiniteAtZero) return v;
    /* Equal to the quotient is not enough on this line: so is the
       quotient, and writing it again is exactly the step being tested. */
    const node = Expr.tryParse(raw, { vars: part.vars || ['x', 'h'] });
    if (node && !finiteAtZero(node)) {
      return {
        correct: false,
        decided: true,
        kind: 'h-not-cancelled',
        hint: 'That is right, but the h is still on the bottom. It has to cancel '
          + 'before you can let h go to zero - otherwise this line is 0/0.',
      };
    }
    return v;
  });
  const firstWrong = verdicts.findIndex((v) => !v.correct);
  if (firstWrong === -1) {
    return { correct: true, decided: true, kind: '', hint: '', parts: verdicts };
  }
  const part = parts[firstWrong];
  return {
    correct: false,
    decided: verdicts[firstWrong].decided !== false,
    kind: verdicts[firstWrong].kind || 'wrong',
    hint: `Line ${firstWrong + 1} (${part.label}): ${verdicts[firstWrong].hint
      || 'that is not it.'}`,
    parts: verdicts,
  };
}

/* Is this expression still finite when h is zero? Checked at several x so
   that one unlucky point does not decide it. */
function finiteAtZero(node) {
  const fn0 = Expr.compile(node);
  let seen = 0;
  for (let i = 0; i < 40 && seen < 6; i++) {
    const x = ((i * 29) % 61) / 5 - 4;
    const v = fn0({ x, h: 0 });
    if (!isFinite(v) || Math.abs(v) > 1e9) {
      /* Undefined at this x for a reason that has nothing to do with h? */
      const near = fn0({ x, h: 1e-6 });
      if (isFinite(near) && Math.abs(near) < 1e9) return false;
      continue;
    }
    seen++;
  }
  return seen > 0;
}

/* Grade a typed expression for a sandbox problem. Thin wrapper over
   Expr.judge that hands it everything the problem knows: the broken
   derivations, the original function, the inside function, and the curve
   points for an implicit problem. */
export function gradeExpression(problem, raw) {
  if (!problem) return { correct: false, decided: true, kind: 'wrong', hint: '' };
  const context = {
    distractors: problem.distractors,
    original: problem.original,
    inner: problem.inner,
    scopes: problem.scopes,
    variable: problem.variable || 'x',
  };
  /* An antiderivative is marked by differentiating it, and a factoring
     question is marked on its FORM as well as its value. */
  if (problem.kind === 'antiderivative') {
    return Expr.judgeAntiderivative(raw, problem.integrand, context);
  }
  if (problem.kind === 'factored' || problem.kind === 'expanded') {
    return Expr.judgeForm(raw, problem.answerNode, problem.kind, context);
  }
  /* A question asked line by line is marked line by line. */
  if (problem.kind === 'parts') return gradeParts(problem, raw);
  /* "Find every x where ..." is answered with a set of values, not a
     function, so it is marked by comparing sets. */
  if (problem.kind === 'set') {
    const rep = MathKit.setReport(raw, problem.answers, problem.tol || 1e-4);
    if (rep.correct) return { correct: true, decided: true, kind: '', hint: '' };
    const fmt = (v) => MathKit.num(v, 4);
    if (rep.found.length && rep.missing.length) {
      return {
        correct: false,
        decided: true,
        kind: 'incomplete-set',
        hint: `You found ${rep.found.length} of the ${rep.wanted}. There `
          + `${rep.missing.length === 1 ? 'is one more' : `are ${rep.missing.length} more`}.`,
      };
    }
    if (rep.extra.length) {
      return {
        correct: false,
        decided: true,
        kind: 'extra-root',
        hint: `${rep.extra.map(fmt).join(', ')} `
          + `${rep.extra.length === 1 ? 'is not a solution' : 'are not solutions'}.`,
      };
    }
    return {
      correct: false,
      decided: true,
      kind: rep.unreadable ? 'unreadable' : 'wrong',
      hint: rep.unreadable
        ? 'Separate the values with commas, like 0, -2 or pi/3, 5*pi/3.'
        : `Expected ${rep.wanted} value${rep.wanted === 1 ? '' : 's'}, in any order.`,
    };
  }
  return Expr.judge(raw, problem.answerNode, context);
}

Object.assign(SKILLS, SKILL_EXTRAS, EXAM_EXTRAS, ZERO_SET);

/* ------------------------------------------------------ am I on track */

/* Checking without being marked.

   Carter's ask: "guiding hints to tell me whether or not I'm on the right
   track." The grader could already say what went wrong, but only once you
   had committed, which is no use halfway through an implicit problem where
   you have the numerator and are stuck on the denominator.

   So this looks at whatever is in the box right now and says where it sits
   relative to the answer, WITHOUT recording an attempt. The useful cases
   are the partial ones:

     - the top of the fraction is right, the bottom is not
     - the shape is right and a coefficient is out
     - every sign is flipped
     - two of the three terms are there

   Those are all things the engine can establish by comparison, and all
   things a person stuck on a problem wants to hear. Where there is nothing
   specific to say it falls back to the next hint rather than inventing
   encouragement, because "keep going" from a computer is worth nothing. */

/* Is what they have written a line of the working rather than the answer?

   Only for the ordinary differentiate-this questions: an implicit answer
   or a set of x values has no single derivation to be partway through. */
/* "One more rule to go" is worth more than "not yet", and "step 2 of 4" is
   worth more than either - it is the difference between knowing you are
   wrong and knowing how far you have got. `whereAreYou` has carried the
   index and the total all along; this is what says them out loud. */
function howFar(where) {
  if (!where || where.at !== 'step') return '';
  const left = Number(where.remaining);
  if (!Number.isFinite(left) || left <= 0) return '';
  const total = Number(where.total) || 0;
  const done = total > left ? total - left : 0;
  const position = total && done ? `Step ${done} of ${total}. ` : '';
  return `${position}${left === 1 ? 'One more rule' : `${left} more rules`} to go.`;
}

function whereOnThePath(problem, text) {
  if (!problem || problem.kind !== 'expression') return null;
  const allowed = problem.implicit ? { vars: ['x', 'y'] } : { vars: [problem.variable || 'x'] };
  const typed = Expr.tryParse(text, allowed);
  if (!typed) return null;

  let where = null;
  try {
    /* Implicit is the shape being got wrong, and it was the one shape
       with no step recognition at all - it returned null here and fell
       through to "how close is this to the answer", which has nothing to
       say to somebody who has correctly written the dy/dx coefficient and
       not yet divided by it. */
    where = problem.implicit
      ? solve.whereAreYouImplicit(problem.curve, typed)
      : (problem.original
        ? solve.whereAreYou(problem.original, typed, problem.variable || 'x')
        : null);
  } catch (err) {
    return null;
  }
  if (!where) return null;

  if (where.at === 'start') {
    return {
      state: 'off',
      message: problem.implicit
        ? 'That is the equation again, rearranged. Differentiate both sides '
          + 'first, remembering that every y carries a dy/dx with it.'
        : 'That is the function again, not its derivative. Start with the '
          + 'rule that applies to the outside.',
    };
  }

  if (where.at === 'step') {
    const onwards = howFar(where);
    if (problem.implicit) {
      const said = {
        'dydx-coefficient': 'That is exactly what multiplies dy/dx. Divide '
          + 'both sides by it and you are done.',
        'moved-across': 'That is the right-hand side once the dy/dx terms are '
          + 'on their own. Now divide by what multiplies dy/dx.',
        'x-side': 'That is the x side of the differentiated equation, but it '
          + 'has not been moved across yet - it changes sign on the way.',
      }[where.piece];
      return { state: 'partway', message: `${said} ${onwards}`.trim() };
    }
    const rule = String(where.rule || '').replace(/:.*$/, '').toLowerCase();
    return {
      state: 'partway',
      message: `That is a correct line - the ${rule} part of it. It is not the `
        + 'whole derivative yet: that piece still has to go back into the rule '
        + `it came out of. ${onwards}`.trim(),
    };
  }
  return null;
}

/* The top and bottom of an answer shaped like a fraction, if it is one.
   Implicit answers almost always are: -F_x/F_y. */
function fractionParts(node) {
  if (!node) return null;
  const core = node.t === 'neg' ? node.a : node;
  if (core.t !== 'div') return null;
  return { top: core.a, bottom: core.b, negated: node.t === 'neg' };
}

export function onTrack(problem, raw, { hintsShown = 0 } = {}) {
  const text = String(raw == null ? '' : raw).trim();
  const nextHint = () => {
    const hints = problem && problem.hints ? problem.hints : [];
    const hint = hints[Math.min(hintsShown, hints.length - 1)];
    return hint || '';
  };

  if (!text) {
    return {
      state: 'empty',
      message: problem && problem.note
        ? problem.note
        : nextHint() || 'Start by writing down which rule this needs.',
    };
  }

  /* An integral answer may end in + C, which is not part of the
     expression and must not be read as a stray variable. */
  const cleaned = problem && problem.kind === 'antiderivative'
    ? Expr.stripPlusC(text) : text;

  /* Before asking how close this is to the ANSWER, ask whether it is a
     line on the way there. Half of a chain rule is not a wrong answer, it
     is an unfinished one, and telling somebody "not yet" when they have
     just written a correct intermediate line is both wrong and
     discouraging. The derivation knows every line; this asks it. */
  const step = whereOnThePath(problem, cleaned);
  if (step) return step;

  const allowed = problem && problem.implicit ? { vars: ['x', 'y'] } : { vars: ['x'] };
  const node = Expr.tryParse(cleaned, allowed);
  if (!node) {
    return {
      state: 'unreadable',
      message: Expr.parseMessage(cleaned, allowed) || 'I cannot read that yet.',
    };
  }

  /* The real verdict first: if it is right, say so and stop. */
  const verdict = gradeExpression(problem, text);
  if (verdict.correct) {
    return { state: 'right', message: 'That is it. Check it in if you are happy.' };
  }

  const scopes = problem && problem.scopes ? { scopes: problem.scopes } : {};

  /* Half of a fraction is the most useful thing to be told, and the most
     common place to be stuck on an implicit problem. */
  const parts = fractionParts(problem && problem.answerNode);
  if (parts) {
    if (Expr.equivalent(node, parts.top, scopes).equal
      || Expr.equivalent(node, Expr.neg(parts.top), scopes).equal) {
      return {
        state: 'partway',
        message: 'That is the top of the fraction, and it is right. '
          + 'Now the bottom: it comes from the terms that carried a dy/dx.',
      };
    }
    if (Expr.equivalent(node, parts.bottom, scopes).equal
      || Expr.equivalent(node, Expr.neg(parts.bottom), scopes).equal) {
      return {
        state: 'partway',
        message: 'That is the bottom of the fraction, and it is right. '
          + 'The top comes from everything that did NOT carry a dy/dx.',
      };
    }
  }

  /* Otherwise the ordinary diagnosis, which already names the mistake. */
  if (verdict.hint) {
    const close = ['factor', 'sign', 'partial', 'offset', 'chain-missing', 'chain-twice'];
    return {
      state: close.includes(verdict.diagnosis || verdict.kind) ? 'close' : 'off',
      message: verdict.hint,
    };
  }

  return {
    state: 'off',
    message: nextHint() || 'Not there yet. Try the hint.',
  };
}

export { SKILLS, BREAKS, SKILL_EXTRAS, brokenDiff, distractorsFor, curveScopes };
