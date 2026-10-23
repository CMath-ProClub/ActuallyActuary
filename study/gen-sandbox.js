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

const { num, vr, neg, add, sub, mul, div, pow, fn, derivative, simplify,
  text, html, latex, equivalent } = Expr;

const X = vr('x');
const Y = vr('y');

/* ------------------------------------------------------------- ingredients */

/* A linear inside function, the workhorse of every chain rule problem. */
function linear(r, { allowConstant = true } = {}) {
  const a = r.nz(-6, 6);
  const b = allowConstant ? r.int(-8, 8) : 0;
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

const TRIG = ['sin', 'cos', 'tan'];
const TRIG_WIDE = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];

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
    ask: 'plain sin, cos and tan to differentiate',
    build(r, level) {
      const name = r.pick(level === 1 ? TRIG : TRIG_WIDE);
      if (level === 1) {
        /* Plain functions, exactly what "give me some plain ones" means:
           a coefficient outside, a bare x inside. */
        const a = r.nz(2, 8);
        return { f: mul(num(a), fn(name, X)), inner: X };
      }
      const inside = linear(r);
      const a = r.nz(2, 7);
      return { f: mul(num(a), fn(name, inside)), inner: inside };
    },
  },

  chain: {
    name: 'Chain rule',
    topicId: 'calc.chain',
    ask: 'composite functions',
    build(r, level) {
      if (level === 1) {
        const inside = linear(r);
        return { f: pow(inside, num(r.int(2, 5))), inner: inside };
      }
      const inside = level === 3
        ? add(mul(num(r.nz(-4, 4)), pow(X, num(r.int(2, 3)))), num(r.int(-7, 7)))
        : linear(r);
      const shape = r.int(0, 2);
      if (shape === 0) return { f: pow(inside, num(r.int(2, 6))), inner: inside };
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
    build(r, level) {
      const shape = level === 1 ? r.int(0, 1) : r.int(0, 3);
      if (shape === 0) {
        const rad = r.int(2, 7);
        return { F: add(pow(X, num(2)), pow(Y, num(2))), c: rad * rad, shape: 'circle' };
      }
      if (shape === 1) {
        return { F: mul(X, Y), c: r.nz(2, 9), shape: 'hyperbola' };
      }
      if (shape === 2) {
        const a = r.int(2, 5);
        const b = r.int(2, 5);
        return {
          F: add(mul(num(a), pow(X, num(2))), mul(num(b), pow(Y, num(2)))),
          c: a * b * r.int(2, 5),
          shape: 'ellipse',
        };
      }
      return {
        F: add(add(pow(X, num(2)), mul(X, Y)), pow(Y, num(2))),
        c: r.int(3, 12),
        shape: 'rotated conic',
      };
    },
  },
};

/* Everything after this point asks a different question - integrate this,
   factor this - and is marked differently, so the builders live apart and
   join SKILLS at the bottom of the file. */

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

/* -------------------------------------------------------- implicit curves */

/* Points that actually lie on F(x,y) = c.

   dy/dx for a circle is -x/y, and a student may legitimately write a form
   that only matches that ON the circle. Comparing across the whole plane
   would fail a correct answer, so solve for y by Newton's method and compare
   at those points instead. */
function curveScopes(F, c, seed, count = 26) {
  const r = MathKit.rng(seed);
  const Fy = derivative(F, 'y');
  const f = Expr.compile(F);
  const fy = Expr.compile(Fy);
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const x = (r() < 0.5 ? -1 : 1) * (0.3 + r() * 2.4);
    let y = (r() < 0.5 ? -1 : 1) * (0.4 + r() * 2.6);
    let ok = false;
    for (let k = 0; k < 40; k++) {
      const residual = f({ x, y }) - c;
      const slope = fy({ x, y });
      if (!isFinite(residual) || !isFinite(slope) || Math.abs(slope) < 1e-8) break;
      const step = residual / slope;
      y -= step;
      if (Math.abs(step) < 1e-13) { ok = true; break; }
    }
    if (!ok || !isFinite(y)) continue;
    /* A point where F_y vanishes is a vertical tangent: dy/dx does not exist
       there and neither side of the comparison means anything. */
    if (Math.abs(fy({ x, y })) < 1e-4) continue;
    if (Math.abs(f({ x, y }) - c) > 1e-9 * Math.max(1, Math.abs(c))) continue;
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

  const built = skill.build(r, level);
  if (!built) return null;

  if (skill.implicit) return implicitProblem(id, skill, built, level, seed);
  if (skill.integral) return buildIntegral(id, skill, built, level, seed);
  if (skill.form) return buildForm(id, skill, built, level, seed);

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
    stem: `Differentiate ${eqHtml('f(x)', html(f))}`,
    instruction: 'Any correct form counts. You do not have to simplify.',
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
    hints: hintsFor(id, built, f, reference),
    steps: stepsFor(id, built, f, reference),
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
  const { F, c } = built;
  const Fx = derivative(F, 'x');
  const Fy = derivative(F, 'y');
  if (Expr.vars(Fy).size === 0) return null;
  const reference = simplify(simplify(neg(div(Fx, Fy))));
  const scopes = curveScopes(F, c, seed);
  /* No usable points means no checkable problem. Better to skip it than to
     ask something that cannot be graded. The floor is comfortably above the
     minimum equivalent() wants, so a borderline curve does not produce a
     problem whose grading then reports "I cannot tell". */
  if (scopes.length < 14) return null;

  const wrongWay = simplify(simplify(neg(div(Fy, Fx))));
  const distractors = [];
  if (!equivalent(wrongWay, reference, { scopes }).equal) {
    distractors.push({
      kind: 'reciprocal',
      node: wrongWay,
      hint: 'That is dx/dy. Flip it: solve for dy/dx.',
    });
  }
  /* Treating y as a constant is THE implicit differentiation mistake: the
     y-terms then contribute nothing and dy/dx comes out of the x-terms
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
    stem: `For ${eqHtml(html(F), String(c))}, find ${MathKit.frac('dy', 'dx')}.`,
    instruction: 'Your answer may use both x and y. Any correct form counts.',
    functionText: `${Expr.text(F)} = ${c}`,
    answerNode: reference,
    answerText: text(reference),
    answerHtml: html(reference),
    answerLatex: latex(reference),
    distractors,
    scopes,
    original: null,
    hints: [
      'Differentiate both sides with respect to x, remembering that y is a function of x.',
      `The y terms give ${html(Fy)} times dy/dx, and the x terms give ${html(Fx)}.`,
      'Collect the dy/dx terms on one side and divide.',
    ],
    steps: [
      { title: 'Differentiate both sides', html: `${html(Fx)} + ${html(Fy)}·${MathKit.frac('dy', 'dx')} = 0` },
      { title: 'Solve for dy/dx', html: `${MathKit.frac('dy', 'dx')} = ${html(reference)}` },
    ],
    graph: {
      implicit: `${latex(F)}=${c}`,
    },
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
    out.push(`The inside is ${html(built.inner)}, so u′ = ${html(derivative(built.inner))}.`);
  }
  out.push(`The answer is ${html(reference)}, in one of its forms.`);
  return out;
}

function stepsFor(id, built, f, reference) {
  const steps = [];
  if (built && built.inner) {
    steps.push({ title: 'Name the inside', html: `u = ${html(built.inner)}` });
    steps.push({ title: 'Its derivative', html: `u′ = ${html(derivative(built.inner))}` });
  }
  if (built && built.factors) {
    steps.push({ title: 'The two pieces', html: `${html(built.factors[0])} and ${html(built.factors[1])}` });
    steps.push({
      title: 'Their derivatives',
      html: `${html(derivative(built.factors[0]))} and ${html(derivative(built.factors[1]))}`,
    });
  }
  steps.push({ title: 'Apply the rule', html: html(reference) });
  return steps;
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
  return Expr.judge(raw, problem.answerNode, context);
}

Object.assign(SKILLS, SKILL_EXTRAS);

export { SKILLS, BREAKS, SKILL_EXTRAS, brokenDiff, distractorsFor, curveScopes };
