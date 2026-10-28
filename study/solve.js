/* The working, derived rather than written.

   Every problem here already carries `steps`, but they were written by the
   builder that made the question, which means they describe the SHAPE the
   builder had in mind and go vague the moment a function is grown rather
   than filled in. "Apply the rule" is not working out.

   This walks the expression itself. Differentiating is a recursive
   procedure - at every node exactly one rule applies, and which one is
   visible in the node - so a real derivation falls out of the same walk
   the engine already does to get the answer. The result is the lines a
   person would write, in the order they would write them, for a function
   nobody anticipated.

   Two rules it follows, both learned from reading its own output:

   1. NAME THE RULE, then show it. "Product rule" over the line is the part
      that teaches; the algebra underneath is the part that convinces.
   2. STOP WHEN IT IS OBVIOUS. Expanding d/dx of 5 into "the derivative of
      a constant is zero" on its own line is noise, so trivial pieces are
      folded into their parent line instead of getting one of their own. */

import Expr from './expr.js';

const { num, neg, add, sub, mul, div, pow, fn, derivative, simplify, html } = Expr;

/* How a function's own derivative is said out loud. */
const SPOKEN = {
  sin: 'cos(u)',
  cos: '-sin(u)',
  tan: 'sec²(u)',
  sec: 'sec(u)tan(u)',
  csc: '-csc(u)cot(u)',
  cot: '-csc²(u)',
  asin: '1/√(1 - u²)',
  acos: '-1/√(1 - u²)',
  atan: '1/(1 + u²)',
  asec: '1/(|u|√(u² - 1))',
  acsc: '-1/(|u|√(u² - 1))',
  acot: '-1/(1 + u²)',
  ln: '1/u',
  log: '1/(u·ln 10)',
  exp: 'e^u',
  sqrt: '1/(2√u)',
  cbrt: '1/(3·∛(u²))',
  sinh: 'cosh(u)',
  cosh: 'sinh(u)',
  tanh: '1 - tanh²(u)',
  abs: 'u/|u|',
};

/* Written the way a textbook writes it. */
const SHOWN = {
  asin: 'arcsin', acos: 'arccos', atan: 'arctan',
  asec: 'arcsec', acsc: 'arccsc', acot: 'arccot',
};

/* Is this piece small enough that spelling out its derivative is noise? */
function trivial(node) {
  if (!node) return true;
  if (node.t === 'num' || node.t === 'const' || node.t === 'var') return true;
  /* a*x and x^n are one glance each. */
  if (node.t === 'mul') {
    return (node.a.t === 'num' && trivial(node.b)) || (node.b.t === 'num' && trivial(node.a));
  }
  if (node.t === 'pow') return node.a.t === 'var' && node.b.t === 'num';
  if (node.t === 'neg') return trivial(node.a);
  if (node.t === 'add' || node.t === 'sub') return trivial(node.a) && trivial(node.b);
  return false;
}

/* The rule that applies at this node, in words. */
export function ruleAt(node) {
  if (!node) return null;
  switch (node.t) {
    case 'num':
    case 'const':
      return 'A constant has no slope';
    case 'var':
      return 'The derivative of x is 1';
    case 'add':
      return 'Sum rule: differentiate each piece';
    case 'sub':
      return 'Difference rule: differentiate each piece';
    case 'neg':
      return 'The minus sign comes along unchanged';
    case 'mul':
      if (node.a.t === 'num' || node.b.t === 'num') return 'A constant multiple stays out front';
      return 'Product rule: first times the derivative of the second, plus the other way round';
    case 'div':
      if (node.b.t === 'num') return 'Dividing by a constant is multiplying by one';
      return 'Quotient rule: bottom times the top derivative, minus top times the bottom derivative, over the bottom squared';
    case 'pow': {
      if (node.b.t === 'num') {
        return node.a.t === 'var'
          ? 'Power rule: drop the exponent by one and multiply by the old one'
          : 'Chain rule through a power: the outside first, then the inside';
      }
      /* A variable exponent over a CONSTANT base is an exponential, not
         logarithmic differentiation. e^(2x) is the commonest function in
         the whole unit and calling it the hard thing would teach the wrong
         method for it. */
      if (node.a.t === 'num' || node.a.t === 'const') {
        const base = node.a.t === 'const' && node.a.n === 'e' ? 'e' : 'a';
        return base === 'e'
          ? 'e to a power reproduces itself, times the derivative of the exponent'
          : 'aᵘ differentiates to aᵘ·ln(a), times the derivative of the exponent';
      }
      return 'Both the base and the exponent move: take logs of both sides first';
    }
    case 'fn': {
      /* e^u is written as a power, not as a function called exp, and
         "d/du eᵘ(u)" is nonsense on the page. */
      if (node.n === 'exp') {
        return node.a && node.a.t === 'var'
          ? 'e to a power is its own derivative'
          : 'e to a power reproduces itself, times the derivative of the exponent';
      }
      /* The name a textbook uses, not the one the parser stores. */
      const name = SHOWN[node.n] || node.n;
      const said = SPOKEN[node.n] ? `d/du ${name}(u) = ${SPOKEN[node.n]}` : `the derivative of ${name}`;
      return node.a && node.a.t === 'var'
        ? said
        : `Chain rule: ${said}, times the derivative of what is inside`;
    }
    default:
      return null;
  }
}

/* The pieces this node is made of, with the names a person would use. */
function partsOf(node) {
  switch (node.t) {
    case 'mul':
      if (node.a.t === 'num') return [['the function', node.b]];
      if (node.b.t === 'num') return [['the function', node.a]];
      return [['the first factor', node.a], ['the second factor', node.b]];
    case 'div':
      if (node.b.t === 'num') return [['the top', node.a]];
      return [['the top', node.a], ['the bottom', node.b]];
    case 'add':
    case 'sub':
      return [['the first term', node.a], ['the second term', node.b]];
    case 'pow':
      return node.b.t === 'num' ? [['the inside', node.a]] : [['the base', node.a], ['the exponent', node.b]];
    case 'fn':
      return [['the inside', node.a]];
    case 'neg':
      return [['what is being negated', node.a]];
    default:
      return [];
  }
}

/* The derivation, as an ordered list of {rule, of, result, depth}.

   Depth is how far inside the expression the line is, so the page can
   indent the working the way a person does when they take a detour to
   differentiate the inside of something. */
export function steps(node, { depth = 0, max = 12 } = {}) {
  const out = [];
  walk(simplify(node), depth, out, max);
  return out;
}

function walk(node, depth, out, max) {
  if (!node || out.length >= max) return;
  if (trivial(node)) return;

  const rule = ruleAt(node);
  if (rule) {
    const got = simplify(derivative(node));
    out.push({
      depth,
      rule,
      of: html(node),
      result: html(got),
      /* Kept as a tree, not just as HTML, so a line somebody has typed can
         be compared against it. */
      node: got,
      source: node,
    });
  }

  /* Then the pieces that are themselves worth a line. A product of two
     polynomials needs no sub-working; a product with a chain rule inside
     one factor does. */
  for (const [, part] of partsOf(node)) {
    if (!trivial(part)) walk(part, depth + 1, out, max);
  }
}

/* A whole worked answer: what it is, the rules in order, and where it
   lands. Returned as data so the page can render it however it likes. */
export function workFor(node, variable = 'x') {
  let target;
  try {
    target = simplify(node);
  } catch (err) {
    return null;
  }
  const lines = steps(target);
  if (!lines.length) return null;
  let answer;
  try {
    answer = simplify(derivative(target, variable));
  } catch (err) {
    return null;
  }
  return {
    lines,
    answer: html(answer),
    /* The rules used, deduplicated, for a one-line summary: "product rule,
       then the chain rule twice". */
    rules: [...new Set(lines.map((l) => l.rule))],
  };
}

/* Where in the working is this?

   "Am I on track" used to mean only "how close is this to the final
   answer", which has nothing to say to somebody halfway through. The
   derivation gives every intermediate line a value, so a line that is NOT
   the answer can still be a correct line - and saying "that is the right
   line, one more rule to go" is worth more than "not yet".

   Compared numerically, like everything else here, so any equivalent form
   of the same line counts. */
export function whereAreYou(target, typed, variable = 'x') {
  if (!target || !typed) return null;
  let answer;
  try {
    answer = simplify(derivative(simplify(target), variable));
  } catch (err) {
    return null;
  }

  const same = (a, b) => {
    try {
      return Expr.equivalent(a, b, { count: 40 }).equal;
    } catch (err) {
      return false;
    }
  };

  if (same(typed, answer)) return { at: 'answer', total: 0 };

  const lines = steps(simplify(target));
  /* The outermost line IS the answer, so the interesting ones are the
     inner detours - the inside of a chain rule, one factor of a product. */
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.node) continue;
    if (same(typed, line.node)) {
      return {
        at: 'step',
        index: i,
        total: lines.length,
        rule: line.rule,
        of: line.of,
        remaining: i,
      };
    }
  }

  /* The function itself, written out again, is a common thing to do while
     thinking - and is not progress. */
  if (same(typed, simplify(target))) return { at: 'start', total: lines.length };
  return null;
}

/* ================================================== implicit differentiation

   Everything above walks y = f(x). An implicit problem is F(x, y) = 0 and
   has a different shape of working, which until now had no derived
   version at all - only whatever canned steps the builder happened to
   carry. That was the wrong way round, because implicit is the thing
   being got wrong.

   Built BACKWARD from the pieces, like every generator here. For
   F(x, y) = left - right:

       F_x = ∂F/∂x        differentiate, y held still
       F_y = ∂F/∂y        differentiate, x held still
       dy/dx = -F_x / F_y

   which is the same answer the generator built the question from, arrived
   at independently - so if these two ever disagree, one of them is wrong
   and the tests will say so.

   The three lines above are also exactly what somebody writes on paper,
   in that order, which is what makes them worth recognising one at a
   time. */

function sides(curve) {
  if (!curve || !curve.left || !curve.right) return null;
  try {
    const allowed = { vars: ['x', 'y'] };
    const left = Expr.parse(String(curve.left), allowed);
    const right = Expr.parse(String(curve.right), allowed);
    return simplify(Expr.sub(left, right));
  } catch (err) {
    return null;
  }
}

/* The three pieces of an implicit derivative, or null. */
export function implicitParts(curve) {
  const F = sides(curve);
  if (!F) return null;
  try {
    const fx = simplify(Expr.derivative(F, 'x'));
    const fy = simplify(Expr.derivative(F, 'y'));
    /* A y that is not really there means this is not implicit at all, and
       -F_x/F_y would divide by zero. */
    if (Expr.isIdenticallyZero(fy)) return null;
    return {
      F,
      fx,
      fy,
      negFx: simplify(Expr.neg(fx)),
      answer: simplify(Expr.div(Expr.neg(fx), fy)),
    };
  } catch (err) {
    return null;
  }
}

/* The working for an implicit problem, in the shape it is written. */
export function implicitWork(curve) {
  const parts = implicitParts(curve);
  if (!parts) return null;
  return {
    lines: [
      {
        depth: 0,
        rule: 'differentiate both sides',
        of: html(parts.F),
        result: `${html(parts.fx)} + (${html(parts.fy)})·dy/dx`,
      },
      {
        depth: 1,
        rule: 'collect the dy/dx terms',
        of: `(${html(parts.fy)})·dy/dx`,
        result: html(parts.negFx),
      },
      {
        depth: 0,
        rule: 'divide by what multiplies dy/dx',
        of: `dy/dx`,
        result: html(parts.answer),
      },
    ],
    answer: html(parts.answer),
    rules: ['implicit differentiation'],
  };
}

/* Where in THAT working is this line?

   The same question as `whereAreYou`, for the other shape. Each of the
   named pieces is something people write down on the way, and each one
   deserves a different sentence: writing F_y means you are one division
   from the answer, writing F_x means you have not moved it across yet. */
export function whereAreYouImplicit(curve, typed) {
  const parts = implicitParts(curve);
  if (!parts || !typed) return null;

  const same = (a, b) => {
    try {
      return Expr.equivalent(a, b, { count: 40, vars: ['x', 'y'] }).equal;
    } catch (err) {
      return false;
    }
  };

  if (same(typed, parts.answer)) return { at: 'answer', total: 3 };

  /* Order matters: -F_x/F_y is checked first above, and F_y before F_x,
     because for a symmetric curve they can coincide and the more
     advanced reading is the kinder one. */
  if (same(typed, parts.fy)) {
    return {
      at: 'step',
      index: 1,
      total: 3,
      remaining: 1,
      piece: 'dydx-coefficient',
      rule: 'collect the dy/dx terms',
      next: 'divide by it',
    };
  }
  if (same(typed, parts.negFx) || same(typed, parts.fx)) {
    return {
      at: 'step',
      index: 1,
      total: 3,
      remaining: 2,
      piece: same(typed, parts.negFx) ? 'moved-across' : 'x-side',
      rule: 'differentiate both sides',
      next: 'divide by what multiplies dy/dx',
    };
  }
  if (same(typed, parts.F)) return { at: 'start', total: 3 };
  return null;
}

export default {
  steps, workFor, ruleAt, whereAreYou,
  implicitParts, implicitWork, whereAreYouImplicit,
};
