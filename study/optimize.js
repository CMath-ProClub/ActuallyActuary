/* Optimization: the largest or smallest something can be.

   The sibling of related rates, and hard in the same place. The
   calculus is one derivative and one solve; what defeats people is the
   two lines before it - writing down the CONSTRAINT, and using it to
   get the thing being maximised into ONE variable. Until that is done
   there is nothing to differentiate.

   So this is asked the way it is done:

       1. the quantity to optimise, in one variable
       2. where its derivative is zero
       3. the answer the question actually asked for

   and the tip button gives the constraint first, because the constraint
   is the step that is missing.

   =================================================================
   BUILT BACKWARD, so the optimum is a whole number
   =================================================================

   Picking the fence length first and solving gives x = 37.333..., which
   turns a calculus question into an arithmetic one and teaches that
   optimisation is ugly. It is not. The optimum is chosen first and the
   parameters are derived from it:

       pen against a river   optimum at x = P/4   -> choose x, set P = 4x
       box from a sheet      optimum at x = s/6   -> choose x, set s = 6x
       two numbers summing   optimum at x = S/2   -> choose x, set S = 2x
       can of fixed volume   optimum where h = 2r -> choose r, set V = 2(pi)r^3

   Every shape is checked against a numeric search before it ships, in
   tools/test_optimize.mjs - the stated optimum has to actually BE the
   optimum, found a different way. */

import MathKit from './math.js';
import Expr from './expr.js';

const { num, vr, add, sub, mul, div, pow, simplify, text, html } = Expr;
const X = vr('x');

/* A quantity, for the setup table the tip button draws. */
const q = (sym, label, units) => ({ sym, label, units });

export const SHAPES = {

  twoNumbers: {
    name: 'Two numbers',
    diagram: null,
    hint: 'Write the constraint first: the two numbers add to a fixed total, so '
      + 'if one is x the other is forced. That is what gets the product into one '
      + 'variable.',
    build(r) {
      const half = r.int(3, 30);
      const total = 2 * half;
      /* P(x) = x(S - x) = Sx - x^2, maximised at x = S/2. */
      const f = sub(mul(num(total), X), pow(X, num(2)));
      return {
        story: `Two positive numbers add to ${total}. Make their product as large `
          + 'as possible.',
        constraint: { html: `x + y = ${total}, so y = ${total} − x` },
        quantity: { sym: 'P', label: 'the product', html: `P = xy = x(${total} − x)` },
        f,
        at: half,
        kind: 'max',
        answer: half * half,
        answerLabel: 'the largest product',
        quantities: [q('x', 'one of the numbers', ''), q('y', 'the other', ''),
          q('P', 'their product', '')],
        asks: 'What is the largest their product can be?',
      };
    },
  },

  riverPen: {
    name: 'A pen against a river',
    diagram: 'rectangle',
    hint: 'Only THREE sides need fencing - the river is the fourth. Write the '
      + 'fencing constraint, use it to replace one variable, and then maximise '
      + 'the area.',
    build(r) {
      /* A = x(P - 2x), maximised at x = P/4. */
      const x = r.int(4, 40);
      const fence = 4 * x;
      const f = sub(mul(num(fence), X), mul(num(2), pow(X, num(2))));
      return {
        story: `A rectangular pen is built against a straight river, so only three `
          + `sides need fencing. There is ${fence} ft of fence.`,
        constraint: { html: `2x + y = ${fence}, so y = ${fence} − 2x` },
        quantity: {
          sym: 'A', label: 'the area',
          html: `A = xy = x(${fence} − 2x)`,
        },
        f,
        at: x,
        kind: 'max',
        answer: x * (fence - 2 * x),
        answerLabel: 'the largest area',
        units: 'ft²',
        quantities: [q('x', 'the two sides at right angles to the river', 'ft'),
          q('y', 'the side parallel to the river', 'ft'),
          q('A', 'the area enclosed', 'ft²')],
        asks: 'What is the largest area it can enclose?',
      };
    },
  },

  fencedPen: {
    name: 'A rectangular pen',
    diagram: 'rectangle',
    hint: 'All four sides are fenced. Write the perimeter constraint, replace one '
      + 'variable with the other, then maximise the area.',
    build(r) {
      /* A = x(P/2 - x), maximised at x = P/4: a square. */
      const x = r.int(4, 30);
      const fence = 4 * x;
      const half = fence / 2;
      const f = sub(mul(num(half), X), pow(X, num(2)));
      return {
        story: `A rectangular pen is fenced on all four sides with ${fence} ft of `
          + 'fencing.',
        constraint: { html: `2x + 2y = ${fence}, so y = ${half} − x` },
        quantity: { sym: 'A', label: 'the area', html: `A = xy = x(${half} − x)` },
        f,
        at: x,
        kind: 'max',
        answer: x * (half - x),
        answerLabel: 'the largest area',
        units: 'ft²',
        quantities: [q('x', 'one side', 'ft'), q('y', 'the other side', 'ft'),
          q('A', 'the area enclosed', 'ft²')],
        asks: 'What is the largest area it can enclose?',
        note: 'The answer is always a square, which is worth noticing once and '
          + 'then knowing.',
      };
    },
  },

  openBox: {
    name: 'An open box from a square sheet',
    diagram: 'cube',
    hint: 'Cutting x from each corner leaves a base of (s − 2x) by (s − 2x) '
      + 'and a height of x. Write the volume in terms of x alone before you '
      + 'differentiate.',
    build(r) {
      /* V = x(s - 2x)^2, maximised at x = s/6. */
      const x = r.int(1, 6);
      const side = 6 * x;
      const f = mul(X, pow(sub(num(side), mul(num(2), X)), num(2)));
      return {
        story: `An open-topped box is made from a ${side} in by ${side} in square `
          + 'sheet by cutting an x by x square from each corner and folding up the '
          + 'sides.',
        constraint: {
          html: `base = (${side} − 2x) by (${side} − 2x), height = x`,
        },
        quantity: {
          sym: 'V', label: 'the volume',
          html: `V = x(${side} − 2x)²`,
        },
        f,
        at: x,
        kind: 'max',
        answer: x * (side - 2 * x) * (side - 2 * x),
        answerLabel: 'the largest volume',
        units: 'in³',
        quantities: [q('x', 'the corner cut, and the height', 'in'),
          q('V', 'the volume', 'in³')],
        asks: 'What is the largest volume it can hold?',
        /* x = s/6 is one of two roots of V'; the other is s/2, which
           leaves no box at all. Worth saying, because dismissing it is
           part of the question. */
        note: `V′ = 0 also at x = ${side / 2}, which folds the sheet into nothing. `
          + 'A critical point outside the sensible range is not an answer.',
      };
    },
  },

  normanWindow: {
    name: 'A window with a semicircular top',
    diagram: null,
    hint: 'The perimeter is two sides, one width, and HALF a circle - not a whole '
      + 'one. Write that constraint carefully, then maximise the area.',
    build(r) {
      /* A Norman window of perimeter P: width x, rectangle height h,
         semicircle radius x/2.
           P = x + 2h + (pi)x/2  ->  h = (P - x - (pi)x/2)/2
           A = xh + (pi)x^2/8 = Px/2 - x^2/2 - (pi)x^2/8
         A' = P/2 - x - (pi)x/4 = 0  ->  x = P/(2 + pi/2) = 2P/(4 + pi)
         Not rational, so this one is asked for the CRITICAL POINT in
         terms of P rather than a whole number - and only at level 3. */
      const P = 4 * r.int(5, 25);
      const f = sub(sub(mul(num(P / 2), X), div(pow(X, num(2)), num(2))),
        div(mul(Expr.CONSTS ? num(Math.PI) : num(Math.PI), pow(X, num(2))), num(8)));
      const at = (2 * P) / (4 + Math.PI);
      return {
        story: `A window is a rectangle with a semicircle on top. Its whole `
          + `perimeter is ${P} ft.`,
        constraint: {
          html: `x + 2h + πx/2 = ${P} (the semicircle contributes πx/2, not πx)`,
        },
        quantity: {
          sym: 'A', label: 'the area',
          html: `A = xh + πx²/8 = ${P / 2}x − x²/2 − πx²/8`,
        },
        f,
        at,
        kind: 'max',
        answer: at,
        answerLabel: 'the width that maximises the area',
        units: 'ft',
        rounded: true,
        quantities: [q('x', 'the width, and the diameter of the top', 'ft'),
          q('h', 'the height of the rectangle', 'ft'),
          q('A', 'the area of the window', 'ft²')],
        asks: 'What width makes the area as large as possible?',
        note: 'This one does not come out whole. Give it to three decimals.',
      };
    },
  },
};

export const SHAPE_IDS = Object.keys(SHAPES);

/* ==================================================================== build */

export function buildOptimize(seedOrRng, level = 2, only = null) {
  const r = typeof seedOrRng === 'function' ? seedOrRng : MathKit.rng(seedOrRng >>> 0);
  let ids = only && only.length ? only.filter((id) => SHAPES[id]) : SHAPE_IDS;
  /* The window needs a decimal answer, so it is a level 3 question only. */
  if (level < 3) ids = ids.filter((id) => id !== 'normanWindow');
  if (!ids.length) return null;

  for (let tries = 0; tries < 12; tries++) {
    const shape = SHAPES[r.pick(ids)];
    const made = shape.build(r, level);
    if (!made) continue;

    const f = simplify(made.f);
    const d = simplify(Expr.derivative(f, 'x'));

    /* THE STATED OPTIMUM HAS TO ACTUALLY BE ONE. f'(at) must vanish, and
       the value there must beat its neighbours in the right direction -
       checked here rather than trusted, because an optimisation question
       whose answer is not the optimum is worse than no question. */
    const slope = Expr.evaluate(d, { x: made.at });
    if (!isFinite(slope) || Math.abs(slope) > 1e-6) continue;

    const here = Expr.evaluate(f, { x: made.at });
    const step = Math.max(1e-3, Math.abs(made.at) * 1e-3);
    const lo = Expr.evaluate(f, { x: made.at - step });
    const hi = Expr.evaluate(f, { x: made.at + step });
    if (!isFinite(here) || !isFinite(lo) || !isFinite(hi)) continue;
    const isMax = here > lo && here > hi;
    const isMin = here < lo && here < hi;
    if (made.kind === 'max' && !isMax) continue;
    if (made.kind === 'min' && !isMin) continue;

    return {
      shape: shape.id || r.pick(ids),
      shapeName: shape.name,
      diagram: shape.diagram,
      hint: shape.hint,
      story: made.story,
      asks: made.asks,
      note: made.note || '',
      constraint: made.constraint,
      quantity: made.quantity,
      quantities: made.quantities,
      f,
      d,
      at: made.at,
      kind: made.kind,
      answer: made.answer,
      answerLabel: made.answerLabel,
      units: made.units || '',
      rounded: !!made.rounded,
    };
  }
  return null;
}

for (const [id, shape] of Object.entries(SHAPES)) shape.id = id;

export default { SHAPES, SHAPE_IDS, buildOptimize };
