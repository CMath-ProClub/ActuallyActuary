/* Algebra II and precalculus generators.

   Contract for every generator here: (rng, level) -> Problem, where level is
   1, 2 or 3 and Problem is

     { stem, kind, answer|answers|choices, answerHtml, hints[], steps[], note? }

   kind is one of 'numeric' (parsed and compared with tolerance), 'set' (a
   comma-separated list compared without order), 'text' (normalized string
   match against answer plus accept[]), or 'choice' (multiple choice).

   Two rules that keep generated problems honest:

   1. Build BACKWARD from the answer. Pick the roots, then form the quadratic.
      Picking coefficients first and hoping gives you irrational answers in a
      "factor this" drill, which teaches the wrong lesson.
   2. Distractors are the actual mistakes, not random numbers. The wrong choice
      for a horizontal shift is the one that moved the other way, because that
      is the error worth catching. A distractor nobody would pick measures
      nothing. */

import MathKit from './math.js';

const { F, sup, poly, coef, terms, linFactor, frac, sqrt, num, gcd, esc } = MathKit;

/* Shuffle a correct answer in among its distractors, dropping any distractor
   that collided with the right answer (which happens for small coefficients
   and would otherwise show the same option twice). */
function mc(rng, correct, distractors) {
  const seen = new Set([String(correct)]);
  const opts = [{ html: correct, correct: true }];
  for (const d of distractors) {
    const k = String(d);
    if (seen.has(k)) continue;
    seen.add(k);
    opts.push({ html: d, correct: false });
  }
  return rng.shuffle(opts);
}

const eq = (lhs, rhs) => `${lhs} = ${rhs}`;
const x2 = `x${sup(2)}`;

/* ========================================================== linear equations */

export function linEquation(rng, level) {
  if (level === 1) {
    const a = rng.nz(2, 9);
    const sol = rng.nz(-9, 9);
    const b = rng.int(-12, 12);
    const c = a * sol + b;
    return {
      stem: `Solve for x: ${eq(terms([coef(a, 'x'), String(b)]), c)}`,
      kind: 'numeric',
      answer: sol,
      answerHtml: `x = ${sol}`,
      hints: [
        `Get the x term by itself first. What do you do to both sides to clear the ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`}?`,
        `After subtracting ${b} from both sides you have ${coef(a, 'x')} = ${c - b}.`,
      ],
      steps: [
        { title: 'Isolate the x term', html: `${eq(coef(a, 'x'), `${c} − (${b})`)} = ${c - b}` },
        { title: `Divide both sides by ${a}`, html: `x = ${frac(String(c - b), String(a))} = ${sol}` },
      ],
    };
  }

  if (level === 2) {
    /* Variable on both sides. */
    const sol = rng.nz(-8, 8);
    const a = rng.nz(2, 7);
    const b = rng.int(-9, 9);
    let c = rng.nz(-7, 7);
    while (c === a) c = rng.nz(-7, 7);         /* a == c cancels x entirely */
    const d = a * sol + b - c * sol;
    return {
      stem: `Solve for x: ${eq(terms([coef(a, 'x'), String(b)]), terms([coef(c, 'x'), String(d)]))}`,
      kind: 'numeric',
      answer: sol,
      answerHtml: `x = ${sol}`,
      hints: [
        'Collect every x on one side and every constant on the other.',
        `Subtracting ${coef(c, 'x')} from both sides leaves ${coef(a - c, 'x')} on the left.`,
      ],
      steps: [
        { title: 'Collect the x terms', html: `${eq(coef(a - c, 'x'), `${d} − (${b})`)} = ${d - b}` },
        { title: `Divide by ${a - c}`, html: `x = ${frac(String(d - b), String(a - c))} = ${sol}` },
      ],
    };
  }

  /* Level 3: distributed over parentheses with a fractional coefficient. */
  const sol = rng.nz(-8, 8);
  const a = rng.nz(2, 6);
  const b = rng.int(-7, 7);
  const c = rng.nz(2, 5);
  const inner = sol + b;
  const rhsConst = a * inner - c * sol;
  return {
    stem: `Solve for x: ${eq(`${a}(x ${b >= 0 ? '+' : '−'} ${Math.abs(b)})`,
      terms([coef(c, 'x'), String(rhsConst)]))}`,
    kind: 'numeric',
    answer: sol,
    answerHtml: `x = ${sol}`,
    hints: [
      `Distribute the ${a} across the parentheses before you do anything else.`,
      `The left side becomes ${terms([coef(a, 'x'), String(a * b)])}.`,
    ],
    steps: [
      { title: 'Distribute', html: `${eq(terms([coef(a, 'x'), String(a * b)]), terms([coef(c, 'x'), String(rhsConst)]))}` },
      { title: 'Collect', html: `${eq(coef(a - c, 'x'), String(rhsConst - a * b))}` },
      { title: 'Divide', html: `x = ${sol}` },
    ],
  };
}

export function lineEquation(rng, level) {
  const x1 = rng.int(-6, 6);
  const y1 = rng.int(-8, 8);
  const m = rng.nz(-5, 5);

  if (level === 1) {
    const dx = rng.nz(1, 4);
    const x22 = x1 + dx;
    const y22 = y1 + m * dx;
    return {
      stem: `Find the slope of the line through (${x1}, ${y1}) and (${x22}, ${y22}).`,
      kind: 'numeric',
      answer: m,
      answerHtml: `m = ${m}`,
      hints: ['Slope is rise over run: the change in y divided by the change in x.',
        `${frac(`${y22} − (${y1})`, `${x22} − (${x1})`)}`],
      steps: [
        { title: 'Apply the slope formula', html: `m = ${frac(`y₂ − y₁`, `x₂ − x₁`)} = ${frac(String(y22 - y1), String(x22 - x1))} = ${m}` },
      ],
    };
  }

  if (level === 2) {
    const b = y1 - m * x1;
    return {
      stem: `Write the equation of the line with slope ${m} through (${x1}, ${y1}), in slope-intercept form.`,
      kind: 'text',
      answer: `y=${m}x${b >= 0 ? '+' : ''}${b}`,
      accept: [`y=${coef(m, 'x')}${b >= 0 ? '+' : ''}${b}`, `y = ${m}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)}`],
      answerHtml: `y = ${terms([coef(m, 'x'), String(b)])}`,
      hints: ['Start from y = mx + b. You know m, so the only unknown is b.',
        `Substitute the point: ${y1} = ${m}(${x1}) + b.`],
      steps: [
        { title: 'Substitute the point into y = mx + b', html: `${y1} = ${m}(${x1}) + b = ${m * x1} + b` },
        { title: 'Solve for b', html: `b = ${y1} − ${m * x1} = ${b}` },
        { title: 'Write it out', html: `y = ${terms([coef(m, 'x'), String(b)])}` },
      ],
    };
  }

  /* Level 3: perpendicular through a point. The reciprocal-and-negate step is
     the one people drop. */
  const mp = F(-1, 1).div(F(m, 1));
  const bp = F(y1, 1).sub(mp.mul(F(x1, 1)));
  return {
    stem: `A line has slope ${m}. Find the equation of the line perpendicular to it through (${x1}, ${y1}), in slope-intercept form.`,
    kind: 'text',
    answer: `y=${mp.toString()}x${bp.valueOf() >= 0 ? '+' : ''}${bp.toString()}`,
    accept: [`y=${mp.toString()}x+${bp.toString()}`],
    answerHtml: `y = ${mp.tex()}x ${bp.valueOf() >= 0 ? '+' : '−'} ${F(Math.abs(bp.n), bp.d).tex()}`,
    hints: ['Perpendicular slopes are negative reciprocals: flip it and change the sign.',
      `The perpendicular slope is ${mp.tex()}.`],
    steps: [
      { title: 'Negative reciprocal', html: `m⊥ = −1 / (${m}) = ${mp.tex()}` },
      { title: 'Substitute the point', html: `${y1} = ${mp.tex()}(${x1}) + b` },
      { title: 'Solve for b', html: `b = ${bp.tex()}` },
    ],
  };
}

export function system2(rng, level) {
  const x0 = rng.int(-6, 6);
  const y0 = rng.int(-6, 6);
  let a1, b1, a2, b2;
  /* Reject a singular or near-trivial system: parallel lines have no unique
     solution, and a zero row is not a system. */
  do {
    a1 = rng.nz(-5, 5); b1 = rng.nz(-5, 5);
    a2 = rng.nz(-5, 5); b2 = rng.nz(-5, 5);
  } while (a1 * b2 - a2 * b1 === 0);
  const c1 = a1 * x0 + b1 * y0;
  const c2 = a2 * x0 + b2 * y0;
  const row = (a, b, c) => `${eq(terms([coef(a, 'x'), coef(b, 'y')]), c)}`;
  return {
    stem: `Solve the system:<div class="stack">${row(a1, b1, c1)}<br>${row(a2, b2, c2)}</div>`
      + `Give your answer as <code>x, y</code>.`,
    kind: 'set',
    answers: [x0, y0],
    ordered: true,
    answerHtml: `x = ${x0}, y = ${y0}`,
    hints: ['Elimination: scale one or both equations so one variable cancels when you add.',
      `Multiply the first by ${b2} and the second by ${-b1} and the y terms cancel.`],
    steps: [
      { title: 'Eliminate y', html: `${b2}·(${row(a1, b1, c1)}) ${b1 >= 0 ? '−' : '+'} ${Math.abs(b1)}·(${row(a2, b2, c2)})` },
      { title: 'Solve for x', html: `${coef(a1 * b2 - a2 * b1, 'x')} = ${c1 * b2 - c2 * b1}, so x = ${x0}` },
      { title: 'Back-substitute', html: `y = ${y0}` },
    ],
  };
}

/* ================================================================ quadratics */

export function expandBinomial(rng, level) {
  if (level === 1) {
    const a = rng.nz(-9, 9);
    const b = rng.nz(-9, 9);
    /* (x+a)(x+b) */
    const mid = a + b;
    const last = a * b;
    return {
      stem: `Expand and simplify: (x ${a >= 0 ? '+' : '−'} ${Math.abs(a)})(x ${b >= 0 ? '+' : '−'} ${Math.abs(b)})`,
      kind: 'text',
      answer: `x^2${mid >= 0 ? '+' : ''}${mid}x${last >= 0 ? '+' : ''}${last}`,
      accept: [`x²${mid >= 0 ? '+' : ''}${mid}x${last >= 0 ? '+' : ''}${last}`],
      answerHtml: poly([1, mid, last]),
      hints: ['FOIL: first, outer, inner, last.',
        `The outer and inner terms are ${coef(b, 'x')} and ${coef(a, 'x')}, which combine to ${coef(mid, 'x')}.`],
      steps: [
        { title: 'FOIL', html: `${x2} ${b >= 0 ? '+' : '−'} ${Math.abs(b)}x ${a >= 0 ? '+' : '−'} ${Math.abs(a)}x ${last >= 0 ? '+' : '−'} ${Math.abs(last)}` },
        { title: 'Combine the middle', html: poly([1, mid, last]) },
      ],
    };
  }

  if (level === 2) {
    /* (ax+b)(cx+d) */
    const a = rng.nz(2, 6), b = rng.nz(-8, 8), c = rng.nz(2, 6), d = rng.nz(-8, 8);
    const A = a * c, B = a * d + b * c, C = b * d;
    return {
      stem: `Expand and simplify: (${coef(a, 'x')} ${b >= 0 ? '+' : '−'} ${Math.abs(b)})(${coef(c, 'x')} ${d >= 0 ? '+' : '−'} ${Math.abs(d)})`,
      kind: 'text',
      answer: `${A}x^2${B >= 0 ? '+' : ''}${B}x${C >= 0 ? '+' : ''}${C}`,
      accept: [`${A}x²${B >= 0 ? '+' : ''}${B}x${C >= 0 ? '+' : ''}${C}`],
      answerHtml: poly([A, B, C]),
      hints: ['Every term in the first bracket multiplies every term in the second.',
        `The x term is ${a}·${d} + ${b}·${c} = ${B}.`],
      steps: [
        { title: 'Multiply out', html: `${coef(A, x2)} + ${a * d}x + ${b * c}x + ${C}` },
        { title: 'Combine', html: poly([A, B, C]) },
      ],
    };
  }

  /* Level 3: a square of a binomial, where the cross term is the usual loss. */
  const a = rng.nz(2, 7), b = rng.nz(-9, 9);
  const A = a * a, B = 2 * a * b, C = b * b;
  return {
    stem: `Expand and simplify: (${coef(a, 'x')} ${b >= 0 ? '+' : '−'} ${Math.abs(b)})${sup(2)}`,
    kind: 'text',
    answer: `${A}x^2${B >= 0 ? '+' : ''}${B}x+${C}`,
    accept: [`${A}x²${B >= 0 ? '+' : ''}${B}x+${C}`],
    answerHtml: poly([A, B, C]),
    note: 'The cross term is the one that gets dropped. There are two of them.',
    hints: ['(p + q)² is p² + 2pq + q², not p² + q².',
      `Here p = ${coef(a, 'x')} and q = ${b}, so the middle is 2(${a})(${b})x = ${coef(B, 'x')}.`],
    steps: [
      { title: 'Use (p + q)² = p² + 2pq + q²', html: `p = ${coef(a, 'x')}, q = ${b}` },
      { title: 'Build each piece', html: `p² = ${coef(A, x2)}, 2pq = ${coef(B, 'x')}, q² = ${C}` },
      { title: 'Result', html: poly([A, B, C]) },
    ],
  };
}

export function factorQuadratic(rng, level) {
  if (level <= 2) {
    /* Monic: x² - (r+s)x + rs. Built from the roots so it always factors. */
    const span = level === 1 ? 7 : 11;
    const [r, s] = rng.distinct(2, -span, span, [0]);
    const b = -(r + s), c = r * s;
    const ans = `${linFactor(r)}${linFactor(s)}`;
    return {
      stem: `Factor completely: ${poly([1, b, c])}`,
      kind: 'text',
      answer: `(x${-r >= 0 ? '+' : ''}${-r})(x${-s >= 0 ? '+' : ''}${-s})`,
      accept: [`(x${-s >= 0 ? '+' : ''}${-s})(x${-r >= 0 ? '+' : ''}${-r})`],
      answerHtml: ans,
      hints: [`You need two numbers that multiply to ${c} and add to ${b}.`,
        `${-r} and ${-s} multiply to ${c}. Do they add to ${b}?`],
      steps: [
        { title: 'What do you need', html: `Two numbers with product ${c} and sum ${b}.` },
        { title: 'Find them', html: `${-r} and ${-s}: (${-r})(${-s}) = ${c} and (${-r}) + (${-s}) = ${b}. ✓` },
        { title: 'Write the factors', html: ans },
      ],
    };
  }

  /* Level 3: leading coefficient, built as (px+q)(rx+s) so it stays factorable
     over the integers. */
  const p = rng.int(2, 5), r = rng.int(2, 5);
  const q = rng.nz(-6, 6), s = rng.nz(-6, 6);
  const A = p * r, B = p * s + q * r, C = q * s;
  const sgn = (v) => (v >= 0 ? `+ ${v}` : `− ${Math.abs(v)}`);
  const ans = `(${coef(p, 'x')} ${sgn(q)})(${coef(r, 'x')} ${sgn(s)})`;
  return {
    stem: `Factor completely: ${poly([A, B, C])}`,
    kind: 'text',
    answer: `(${p}x${q >= 0 ? '+' : ''}${q})(${r}x${s >= 0 ? '+' : ''}${s})`,
    accept: [`(${r}x${s >= 0 ? '+' : ''}${s})(${p}x${q >= 0 ? '+' : ''}${q})`],
    answerHtml: ans,
    hints: [`Multiply a·c: ${A} × ${C} = ${A * C}. Find two numbers with that product that add to ${B}.`,
      `Those numbers are ${p * s} and ${q * r}. Split the middle term and factor by grouping.`],
    steps: [
      { title: 'Split the middle term', html: `${coef(A, x2)} + ${p * s}x + ${q * r}x ${sgn(C)}` },
      { title: 'Group in pairs', html: `(${coef(A, x2)} + ${p * s}x) + (${q * r}x ${sgn(C)})` },
      { title: 'Factor each group', html: ans },
    ],
  };
}

export function quadraticFormula(rng, level) {
  /* Deliberately NOT factorable: that is the whole point of the formula.
     Discriminant is forced positive and non-square so the roots are real and
     irrational. */
  let a, b, c, disc;
  let guard = 0;
  do {
    a = level === 1 ? 1 : rng.int(1, 4);
    b = rng.nz(-9, 9);
    c = rng.nz(-9, 9);
    disc = b * b - 4 * a * c;
    guard++;
  } while ((disc <= 0 || Number.isInteger(Math.sqrt(disc))) && guard < 200);

  const root = Math.sqrt(disc);
  const r1 = (-b - root) / (2 * a);
  const r2 = (-b + root) / (2 * a);
  return {
    stem: `Solve using the quadratic formula: ${eq(poly([a, b, c]), 0)}`
      + `<div class="aside">Give both roots to 3 decimal places, separated by a comma.</div>`,
    kind: 'set',
    answers: [r1, r2],
    tol: 2e-3,
    answerHtml: `x = ${frac(`−(${b}) ± ${sqrt(String(disc))}`, String(2 * a))} = ${num(r1, 3)} or ${num(r2, 3)}`,
    hints: [`a = ${a}, b = ${b}, c = ${c}. Substitute carefully, especially the sign of b.`,
      `The discriminant is ${b}² − 4(${a})(${c}) = ${disc}. It is positive and not a perfect square, so there are two irrational roots.`],
    steps: [
      { title: 'The formula', html: `x = ${frac(`−b ± ${sqrt('b² − 4ac')}`, '2a')}` },
      { title: 'Discriminant', html: `b² − 4ac = ${b * b} − ${4 * a * c} = ${disc}` },
      { title: 'Substitute', html: `x = ${frac(`${-b} ± ${sqrt(String(disc))}`, String(2 * a))}` },
      { title: 'Evaluate', html: `x ≈ ${num(r1, 3)} or x ≈ ${num(r2, 3)}` },
    ],
  };
}

export function completeSquare(rng, level) {
  if (level === 1) {
    /* Even b keeps b/2 an integer. */
    const h = rng.nz(-7, 7);
    const k = rng.int(-12, 12);
    const b = -2 * h, c = h * h + k;
    return {
      stem: `Write ${poly([1, b, c])} in vertex form a(x − h)${sup(2)} + k.`,
      kind: 'text',
      answer: `(x${-h >= 0 ? '+' : ''}${-h})^2${k >= 0 ? '+' : ''}${k}`,
      accept: [`(x${-h >= 0 ? '+' : ''}${-h})²${k >= 0 ? '+' : ''}${k}`],
      answerHtml: `${linFactor(h)}${sup(2)} ${k >= 0 ? '+' : '−'} ${Math.abs(k)}`,
      hints: [`Halve the coefficient of x and square it: (${b}/2)² = ${h * h}.`,
        `Add and subtract ${h * h}: ${poly([1, b, h * h])} ${c - h * h >= 0 ? '+' : '−'} ${Math.abs(c - h * h)}.`],
      steps: [
        { title: 'Half the x coefficient, squared', html: `(${frac(String(b), '2')})${sup(2)} = (${-h})${sup(2)} = ${h * h}` },
        { title: 'Add and subtract it', html: `(${poly([1, b, h * h])}) + ${c} − ${h * h}` },
        { title: 'Factor the perfect square', html: `${linFactor(h)}${sup(2)} ${k >= 0 ? '+' : '−'} ${Math.abs(k)}` },
      ],
    };
  }

  /* Levels 2-3: a leading coefficient has to come out first, which is the step
     that gets skipped. */
  const a = rng.pick([2, 3, -2, 4]);
  const h = rng.nz(-5, 5);
  const k = rng.int(-10, 10);
  const b = -2 * a * h, c = a * h * h + k;
  return {
    stem: `Write ${poly([a, b, c])} in vertex form a(x − h)${sup(2)} + k.`,
    kind: 'text',
    answer: `${a}(x${-h >= 0 ? '+' : ''}${-h})^2${k >= 0 ? '+' : ''}${k}`,
    accept: [`${a}(x${-h >= 0 ? '+' : ''}${-h})²${k >= 0 ? '+' : ''}${k}`],
    answerHtml: `${a}${linFactor(h)}${sup(2)} ${k >= 0 ? '+' : '−'} ${Math.abs(k)}`,
    note: 'Factor the leading coefficient out of the x terms only, before completing the square.',
    hints: [`Factor ${a} out of the first two terms: ${a}(${poly([1, b / a])}) ${c >= 0 ? '+' : '−'} ${Math.abs(c)}.`,
      `Inside the bracket, half of ${b / a} squared is ${h * h}. Remember that adding it inside the bracket really adds ${a}·${h * h}.`],
    steps: [
      { title: `Factor ${a} from the x terms`, html: `${a}(${poly([1, b / a])}) ${c >= 0 ? '+' : '−'} ${Math.abs(c)}` },
      { title: 'Complete the square inside', html: `${a}(${poly([1, b / a, h * h])} − ${h * h}) ${c >= 0 ? '+' : '−'} ${Math.abs(c)}` },
      { title: 'Distribute the correction back out', html: `${a}${linFactor(h)}${sup(2)} − ${a * h * h} ${c >= 0 ? '+' : '−'} ${Math.abs(c)}` },
      { title: 'Simplify', html: `${a}${linFactor(h)}${sup(2)} ${k >= 0 ? '+' : '−'} ${Math.abs(k)}` },
    ],
  };
}

export function discriminant(rng, level) {
  const kind = rng.pick(['two', 'one', 'none']);
  let a, b, c;
  if (kind === 'one') {
    a = rng.int(1, 4);
    const r = rng.nz(-6, 6);
    b = -2 * a * r; c = a * r * r;
  } else if (kind === 'two') {
    const [r, s] = rng.distinct(2, -7, 7);
    a = rng.int(1, 3);
    b = -a * (r + s); c = a * r * s;
  } else {
    let d2 = 1;
    while (d2 >= 0) {
      a = rng.int(1, 4); b = rng.nz(-7, 7); c = rng.int(1, 12);
      d2 = b * b - 4 * a * c;
    }
  }
  const disc = b * b - 4 * a * c;
  const label = { two: 'Two distinct real roots', one: 'Exactly one real root (a repeated root)', none: 'No real roots (two complex roots)' };
  return {
    stem: `How many real roots does ${eq(poly([a, b, c]), 0)} have?`,
    kind: 'choice',
    choices: mc(rng, label[kind], [label.two, label.one, label.none].filter((l) => l !== label[kind])),
    answerHtml: `${label[kind]}, because b${sup(2)} − 4ac = ${disc}.`,
    hints: ['You do not need to solve it. Compute the discriminant b² − 4ac and look at its sign.',
      `b² − 4ac = (${b})² − 4(${a})(${c}) = ${disc}, which is ${disc > 0 ? 'positive' : disc === 0 ? 'zero' : 'negative'}.`],
    steps: [
      { title: 'Compute the discriminant', html: `Δ = (${b})${sup(2)} − 4(${a})(${c}) = ${b * b} − ${4 * a * c} = ${disc}` },
      { title: 'Read the sign', html: `Δ ${disc > 0 ? '> 0' : disc === 0 ? '= 0' : '< 0'} → ${label[kind].toLowerCase()}` },
    ],
  };
}

export function parabolaFeatures(rng, level) {
  const a = rng.pick([1, 1, 2, -1, -2, 3]);
  const h = rng.nz(-6, 6);
  const k = rng.int(-10, 10);
  const b = -2 * a * h, c = a * h * h + k;
  const ask = level === 1 ? 'vertex' : rng.pick(['vertex', 'axis', 'direction']);

  if (ask === 'axis') {
    return {
      stem: `What is the axis of symmetry of ${eq('y', poly([a, b, c]))}?<div class="aside">Answer with a number (the x value).</div>`,
      kind: 'numeric',
      answer: h,
      answerHtml: `x = ${h}`,
      hints: ['The axis runs through the vertex, at x = −b / 2a.',
        `x = −(${b}) / (2 · ${a})`],
      steps: [{ title: 'Apply x = −b / 2a', html: `x = ${frac(String(-b), String(2 * a))} = ${h}` }],
    };
  }

  if (ask === 'direction') {
    const correct = a > 0 ? 'Opens upward, and the vertex is a minimum' : 'Opens downward, and the vertex is a maximum';
    return {
      stem: `Describe the parabola ${eq('y', poly([a, b, c]))}.`,
      kind: 'choice',
      choices: mc(rng, correct, [
        a > 0 ? 'Opens downward, and the vertex is a maximum' : 'Opens upward, and the vertex is a minimum',
        'Opens upward, and the vertex is a maximum',
        'Opens downward, and the vertex is a minimum',
      ]),
      answerHtml: correct,
      hints: ['Only the sign of the leading coefficient decides which way it opens.',
        `a = ${a}, which is ${a > 0 ? 'positive' : 'negative'}.`],
      steps: [{ title: 'Look at a', html: `a = ${a} ${a > 0 ? '> 0, so it opens up and the vertex is the lowest point.' : '< 0, so it opens down and the vertex is the highest point.'}` }],
    };
  }

  return {
    stem: `Find the vertex of ${eq('y', poly([a, b, c]))}.<div class="aside">Answer as <code>h, k</code>.</div>`,
    kind: 'set',
    answers: [h, k],
    ordered: true,
    answerHtml: `(${h}, ${k})`,
    hints: ['Find h = −b / 2a first, then substitute it back in to get k.',
      `h = ${frac(String(-b), String(2 * a))} = ${h}. Now compute y at x = ${h}.`],
    steps: [
      { title: 'x coordinate', html: `h = ${frac('−b', '2a')} = ${frac(String(-b), String(2 * a))} = ${h}` },
      { title: 'y coordinate', html: `k = ${a}(${h})${sup(2)} ${b >= 0 ? '+' : '−'} ${Math.abs(b)}(${h}) ${c >= 0 ? '+' : '−'} ${Math.abs(c)} = ${k}` },
      { title: 'Vertex', html: `(${h}, ${k})` },
    ],
  };
}

/* =========================================================== transformations */

const PARENTS = [
  { key: 'lin', f: 'x', name: 'Linear', desc: 'a straight line through the origin' },
  { key: 'quad', f: `x${sup(2)}`, name: 'Quadratic', desc: 'a parabola with vertex at the origin' },
  { key: 'cubic', f: `x${sup(3)}`, name: 'Cubic', desc: 'an S-curve through the origin' },
  { key: 'abs', f: '|x|', name: 'Absolute value', desc: 'a V with its corner at the origin' },
  { key: 'sqrt', f: sqrt('x'), name: 'Square root', desc: 'half a sideways parabola, starting at the origin' },
  { key: 'recip', f: frac('1', 'x'), name: 'Reciprocal', desc: 'a hyperbola with both axes as asymptotes' },
  { key: 'exp', f: `2${sup('x')}`, name: 'Exponential', desc: 'flat on the left, steep on the right, y-intercept 1' },
  { key: 'log', f: 'log x', name: 'Logarithmic', desc: 'steep then flattening, with a vertical asymptote at x = 0' },
];

export function parentFunction(rng, level) {
  const p = rng.pick(PARENTS);
  const others = rng.shuffle(PARENTS.filter((q) => q.key !== p.key)).slice(0, 3);
  return {
    stem: `Which parent function is ${eq('f(x)', p.f)}?`,
    kind: 'choice',
    choices: mc(rng, p.name, others.map((o) => o.name)),
    answerHtml: `${p.name}: ${p.desc}.`,
    hints: ['Look at what is happening to x: a power, a root, an absolute value, or an exponent.',
      `This one is ${p.desc}.`],
    steps: [{ title: 'Identify the shape', html: `${p.f} is the ${p.name.toLowerCase()} parent function, ${p.desc}.` }],
  };
}

/* The horizontal direction is the single most-missed idea in this unit, so it
   gets its own generator and its distractors are always the opposite shift. */
export function transformShift(rng, level) {
  const p = rng.pick(PARENTS.filter((q) => ['quad', 'abs', 'sqrt', 'cubic'].includes(q.key)));
  const h = rng.nz(-5, 5);
  const k = rng.nz(-6, 6);
  const inner = h > 0 ? `x − ${h}` : `x + ${Math.abs(h)}`;
  const body = p.key === 'abs' ? `|${inner}|` : p.key === 'sqrt' ? sqrt(`${inner}`)
    : p.key === 'cubic' ? `(${inner})${sup(3)}` : `(${inner})${sup(2)}`;
  const gx = `${body} ${k > 0 ? '+' : '−'} ${Math.abs(k)}`;

  if (level === 1 || rng() < 0.5) {
    const correct = `${Math.abs(h)} unit${Math.abs(h) === 1 ? '' : 's'} ${h > 0 ? 'right' : 'left'} and `
      + `${Math.abs(k)} unit${Math.abs(k) === 1 ? '' : 's'} ${k > 0 ? 'up' : 'down'}`;
    const flipped = `${Math.abs(h)} unit${Math.abs(h) === 1 ? '' : 's'} ${h > 0 ? 'left' : 'right'} and `
      + `${Math.abs(k)} unit${Math.abs(k) === 1 ? '' : 's'} ${k > 0 ? 'up' : 'down'}`;
    const bothFlipped = `${Math.abs(h)} unit${Math.abs(h) === 1 ? '' : 's'} ${h > 0 ? 'left' : 'right'} and `
      + `${Math.abs(k)} unit${Math.abs(k) === 1 ? '' : 's'} ${k > 0 ? 'down' : 'up'}`;
    const swapped = `${Math.abs(k)} unit${Math.abs(k) === 1 ? '' : 's'} ${k > 0 ? 'right' : 'left'} and `
      + `${Math.abs(h)} unit${Math.abs(h) === 1 ? '' : 's'} ${h > 0 ? 'up' : 'down'}`;
    return {
      stem: `The graph of ${eq('g(x)', gx)} is the graph of ${eq('f(x)', p.f)} shifted how?`,
      kind: 'choice',
      choices: mc(rng, correct, [flipped, bothFlipped, swapped]),
      answerHtml: correct,
      note: 'Inside the function, the shift is the opposite of the sign you see. Outside, it matches.',
      hints: [
        'Split it into what happens inside the function and what happens outside.',
        `Inside you have (${inner}). A − ${h > 0 ? h : ''}${h > 0 ? '' : ''} inside moves the graph `
          + `${h > 0 ? 'right' : 'left'}, because x has to be ${h > 0 ? 'larger' : 'smaller'} to produce the same output.`,
      ],
      steps: [
        { title: 'Inside the function', html: `(${inner}) shifts horizontally ${Math.abs(h)} ${h > 0 ? 'right' : 'left'}. Inside changes are counterintuitive: the sign flips.` },
        { title: 'Outside the function', html: `${k > 0 ? '+' : '−'} ${Math.abs(k)} shifts vertically ${Math.abs(k)} ${k > 0 ? 'up' : 'down'}. Outside changes behave normally.` },
      ],
    };
  }

  /* The other direction: given a description, write the equation. */
  return {
    stem: `Write the equation for ${eq('f(x)', p.f)} shifted ${Math.abs(h)} unit${Math.abs(h) === 1 ? '' : 's'} `
      + `${h > 0 ? 'right' : 'left'} and ${Math.abs(k)} unit${Math.abs(k) === 1 ? '' : 's'} ${k > 0 ? 'up' : 'down'}.`,
    kind: 'choice',
    choices: mc(rng, gx, [
      /* shifted the wrong way horizontally */
      (p.key === 'abs' ? `|x ${h > 0 ? '+' : '−'} ${Math.abs(h)}|` : p.key === 'sqrt' ? sqrt(`x ${h > 0 ? '+' : '−'} ${Math.abs(h)}`)
        : `(x ${h > 0 ? '+' : '−'} ${Math.abs(h)})${sup(p.key === 'cubic' ? 3 : 2)}`) + ` ${k > 0 ? '+' : '−'} ${Math.abs(k)}`,
      /* right shape, wrong vertical sign */
      `${body} ${k > 0 ? '−' : '+'} ${Math.abs(k)}`,
      /* h and k swapped */
      (p.key === 'abs' ? `|x ${k > 0 ? '−' : '+'} ${Math.abs(k)}|` : p.key === 'sqrt' ? sqrt(`x ${k > 0 ? '−' : '+'} ${Math.abs(k)}`)
        : `(x ${k > 0 ? '−' : '+'} ${Math.abs(k)})${sup(p.key === 'cubic' ? 3 : 2)}`) + ` ${h > 0 ? '+' : '−'} ${Math.abs(h)}`,
    ]),
    answerHtml: `g(x) = ${gx}`,
    hints: ['A shift right by h means replacing x with (x − h), even though "right" and "minus" feel like opposites.',
      `Right ${Math.abs(h)} gives (${inner}); ${k > 0 ? 'up' : 'down'} ${Math.abs(k)} adds ${k} on the outside.`],
    steps: [
      { title: 'Horizontal first', html: `Shift ${h > 0 ? 'right' : 'left'} ${Math.abs(h)} → replace x with (${inner})` },
      { title: 'Then vertical', html: `Shift ${k > 0 ? 'up' : 'down'} ${Math.abs(k)} → add ${k} outside` },
      { title: 'Result', html: `g(x) = ${gx}` },
    ],
  };
}

export function transformStretch(rng, level) {
  const vertical = rng() < 0.5;
  const a = rng.pick([2, 3, 4, 5]);
  const p = rng.pick(PARENTS.filter((q) => ['quad', 'abs', 'cubic'].includes(q.key)));
  const pow = p.key === 'cubic' ? 3 : 2;
  const fx = p.key === 'abs' ? '|x|' : `x${sup(pow)}`;

  if (vertical) {
    const gx = p.key === 'abs' ? `${a}|x|` : `${a}x${sup(pow)}`;
    const correct = `Vertical stretch by a factor of ${a}`;
    return {
      stem: `How does the graph of ${eq('g(x)', gx)} compare with ${eq('f(x)', fx)}?`,
      kind: 'choice',
      choices: mc(rng, correct, [
        `Vertical compression by a factor of ${a}`,
        `Horizontal stretch by a factor of ${a}`,
        `Horizontal compression by a factor of ${a}`,
      ]),
      answerHtml: `${correct}. Every y value is multiplied by ${a}.`,
      hints: ['The multiplier is outside the function, so it acts on the output.',
        `Multiplying the output by ${a} > 1 pulls the graph away from the x-axis.`],
      steps: [
        { title: 'Where is the multiplier', html: `${a} multiplies the whole function, so it acts on y.` },
        { title: 'What that does', html: `Each output is ${a} times as far from the x-axis: a vertical stretch by ${a}.` },
      ],
    };
  }

  /* Horizontal: the factor is the reciprocal, which is the catch. */
  const gx = p.key === 'abs' ? `|${a}x|` : `(${a}x)${sup(pow)}`;
  const correct = `Horizontal compression by a factor of ${frac('1', String(a))}`;
  return {
    stem: `How does the graph of ${eq('g(x)', gx)} compare with ${eq('f(x)', fx)}?`,
    kind: 'choice',
    choices: mc(rng, correct, [
      `Horizontal stretch by a factor of ${a}`,
      `Vertical stretch by a factor of ${a}`,
      `Horizontal compression by a factor of ${a}`,
    ]),
    answerHtml: `${correct}. The graph is squeezed toward the y-axis by ${a}.`,
    note: 'Inside the function, the factor is the reciprocal of what you see.',
    hints: ['The multiplier is inside the function, so it acts on the input.',
      `To get the same output, x only has to be 1/${a} as big. The graph squeezes in by a factor of 1/${a}.`],
    steps: [
      { title: 'Where is the multiplier', html: `${a} multiplies x inside the function, so it acts on the input.` },
      { title: 'Reciprocal rule', html: `A factor of ${a} inside compresses horizontally by ${frac('1', String(a))}, not by ${a}.` },
    ],
  };
}

export function transformCombined(rng, level) {
  const a = rng.pick([-3, -2, -1, 2, 3]);
  const h = rng.nz(-4, 4);
  const k = rng.nz(-6, 6);
  const px = rng.int(-3, 3);
  const base = rng.pick(['quad', 'abs']);
  const fx = base === 'abs' ? '|x|' : `x${sup(2)}`;
  const inner = h > 0 ? `x − ${h}` : `x + ${Math.abs(h)}`;
  const body = base === 'abs' ? `|${inner}|` : `(${inner})${sup(2)}`;
  const gx = `${a === -1 ? '−' : a === 1 ? '' : a}${body} ${k > 0 ? '+' : '−'} ${Math.abs(k)}`;
  /* Evaluate g at px. */
  const u = px - h;
  const fu = base === 'abs' ? Math.abs(u) : u * u;
  const gval = a * fu + k;
  return {
    stem: `Given ${eq('g(x)', gx)}, find g(${px}).`,
    kind: 'numeric',
    answer: gval,
    answerHtml: `g(${px}) = ${gval}`,
    hints: [`Work from the inside out. First compute what is in the ${base === 'abs' ? 'absolute value' : 'parentheses'}: ${px} ${h > 0 ? '−' : '+'} ${Math.abs(h)} = ${u}.`,
      `Then ${base === 'abs' ? `|${u}| = ${fu}` : `(${u})${sup(2)} = ${fu}`}, then multiply by ${a} and add ${k}.`],
    steps: [
      { title: 'Inside first', html: `${px} ${h > 0 ? '−' : '+'} ${Math.abs(h)} = ${u}` },
      { title: 'Apply the parent function', html: base === 'abs' ? `|${u}| = ${fu}` : `(${u})${sup(2)} = ${fu}` },
      { title: 'Multiply and shift', html: `${a} × ${fu} ${k > 0 ? '+' : '−'} ${Math.abs(k)} = ${gval}` },
    ],
  };
}

export function transformDescribe(rng, level) {
  const a = rng.pick([-2, -1, 2, 3]);
  const h = rng.nz(-4, 4);
  const k = rng.nz(-5, 5);
  const inner = h > 0 ? `x − ${h}` : `x + ${Math.abs(h)}`;
  const gx = `${a === -1 ? '−' : a === 1 ? '' : a}f(${inner}) ${k > 0 ? '+' : '−'} ${Math.abs(k)}`;

  const pieces = [];
  if (a < 0) pieces.push('reflected over the x-axis');
  if (Math.abs(a) !== 1) pieces.push(`stretched vertically by ${Math.abs(a)}`);
  pieces.push(`shifted ${Math.abs(h)} ${h > 0 ? 'right' : 'left'}`);
  pieces.push(`shifted ${Math.abs(k)} ${k > 0 ? 'up' : 'down'}`);
  const correct = pieces.join(', ');

  const wrongH = pieces.slice();
  wrongH[wrongH.length - 2] = `shifted ${Math.abs(h)} ${h > 0 ? 'left' : 'right'}`;
  const wrongAxis = pieces.slice();
  if (a < 0) wrongAxis[0] = 'reflected over the y-axis';
  else wrongAxis.unshift('reflected over the y-axis');
  const wrongStretch = pieces.map((s) => s.replace(/stretched vertically by (\d+)/,
    (_m, n2) => `stretched horizontally by ${n2}`));

  return {
    stem: `Describe the transformation from ${eq('y', 'f(x)')} to ${eq('y', gx)}.`,
    kind: 'choice',
    choices: mc(rng, correct, [wrongH.join(', '), wrongAxis.join(', '), wrongStretch.join(', ')]),
    answerHtml: correct,
    hints: ['Take it in the standard order: reflect, stretch, shift horizontally, shift vertically.',
      `The ${inner} inside means a shift ${h > 0 ? 'right' : 'left'} by ${Math.abs(h)}, not ${h > 0 ? 'left' : 'right'}.`],
    steps: [
      { title: 'Outside multiplier', html: a < 0 ? `${a} reflects over the x-axis${Math.abs(a) !== 1 ? ` and stretches vertically by ${Math.abs(a)}` : ''}.` : `${a} stretches vertically by ${a}.` },
      { title: 'Inside', html: `(${inner}) shifts ${Math.abs(h)} ${h > 0 ? 'right' : 'left'}.` },
      { title: 'Constant outside', html: `${k > 0 ? '+' : '−'}${Math.abs(k)} shifts ${Math.abs(k)} ${k > 0 ? 'up' : 'down'}.` },
    ],
  };
}

/* ======================================================= exponentials and logs */

export function exponentRules(rng, level) {
  const kind = rng.pick(level === 1 ? ['product', 'quotient'] : ['product', 'quotient', 'power', 'negative']);
  const a = rng.int(2, 7), b = rng.int(2, 7), c = rng.int(2, 4);

  if (kind === 'product') {
    return {
      stem: `Simplify to a single power of x: x${sup(a)} · x${sup(b)}`,
      kind: 'numeric',
      answer: a + b,
      answerHtml: `x${sup(a + b)}, so the exponent is ${a + b}`,
      note: 'Answer with the exponent only.',
      hints: ['Same base, multiplied: the exponents add.', `${a} + ${b} = ?`],
      steps: [{ title: 'Product rule', html: `x${sup(a)} · x${sup(b)} = x${sup(`${a}+${b}`)} = x${sup(a + b)}` }],
    };
  }
  if (kind === 'quotient') {
    const hi = Math.max(a, b) + 2, lo = Math.min(a, b);
    return {
      stem: `Simplify to a single power of x: ${frac(`x${sup(hi)}`, `x${sup(lo)}`)}`,
      kind: 'numeric',
      answer: hi - lo,
      answerHtml: `x${sup(hi - lo)}, so the exponent is ${hi - lo}`,
      note: 'Answer with the exponent only.',
      hints: ['Same base, divided: the exponents subtract.', `${hi} − ${lo} = ?`],
      steps: [{ title: 'Quotient rule', html: `${frac(`x${sup(hi)}`, `x${sup(lo)}`)} = x${sup(`${hi}−${lo}`)} = x${sup(hi - lo)}` }],
    };
  }
  if (kind === 'power') {
    return {
      stem: `Simplify to a single power of x: (x${sup(a)})${sup(c)}`,
      kind: 'numeric',
      answer: a * c,
      answerHtml: `x${sup(a * c)}, so the exponent is ${a * c}`,
      note: 'Answer with the exponent only.',
      hints: ['A power raised to a power: the exponents multiply, they do not add.',
        `${a} × ${c} = ?`],
      steps: [{ title: 'Power rule', html: `(x${sup(a)})${sup(c)} = x${sup(`${a}·${c}`)} = x${sup(a * c)}` }],
    };
  }
  /* negative exponent evaluated numerically */
  const base = rng.pick([2, 3, 4, 5]);
  const n2 = rng.int(2, 4);
  const val = 1 / Math.pow(base, n2);
  return {
    stem: `Evaluate: ${base}${sup(`−${n2}`)}`,
    kind: 'numeric',
    answer: val,
    tol: 1e-9,
    answerHtml: `${frac('1', `${base}${sup(n2)}`)} = ${frac('1', String(Math.pow(base, n2)))}`,
    hints: ['A negative exponent means the reciprocal, not a negative number.',
      `${base}${sup(`−${n2}`)} = 1 / ${base}${sup(n2)} = 1/${Math.pow(base, n2)}`],
    steps: [
      { title: 'Negative exponent', html: `${base}${sup(`−${n2}`)} = ${frac('1', `${base}${sup(n2)}`)}` },
      { title: 'Evaluate', html: `= ${frac('1', String(Math.pow(base, n2)))}` },
    ],
  };
}

export function logRules(rng, level) {
  if (level === 1) {
    const b = rng.pick([2, 3, 5, 10]);
    const n2 = rng.int(2, 5);
    return {
      stem: `Evaluate: log${sup('')}<sub>${b}</sub>(${Math.pow(b, n2)})`,
      kind: 'numeric',
      answer: n2,
      answerHtml: `${n2}, because ${b}${sup(n2)} = ${Math.pow(b, n2)}`,
      hints: [`A log asks: ${b} to what power gives ${Math.pow(b, n2)}?`,
        `${b}${sup(n2 - 1)} = ${Math.pow(b, n2 - 1)}, which is too small. Try one more.`],
      steps: [{ title: 'Rewrite as an exponent', html: `log<sub>${b}</sub>(${Math.pow(b, n2)}) = n means ${b}${sup('n')} = ${Math.pow(b, n2)}, so n = ${n2}.` }],
    };
  }

  const kind = rng.pick(['product', 'quotient', 'power']);
  const b = rng.pick([2, 3, 10]);
  const m = rng.int(2, 9), n2 = rng.int(2, 9), p = rng.int(2, 4);
  const L = (arg) => `log<sub>${b}</sub>(${arg})`;
  if (kind === 'product') {
    return {
      stem: `Expand ${L(`${m}x`)} into a sum of logs.`,
      kind: 'choice',
      choices: mc(rng, `${L(m)} + ${L('x')}`, [`${L(m)} · ${L('x')}`, `${L(m)} − ${L('x')}`, `${L(`${m} + x`)}`]),
      answerHtml: `${L(`${m}x`)} = ${L(m)} + ${L('x')}`,
      hints: ['A log of a product becomes a sum of logs.', 'log(AB) = log A + log B.'],
      steps: [{ title: 'Product rule for logs', html: `log(AB) = log A + log B, so ${L(`${m}x`)} = ${L(m)} + ${L('x')}` }],
    };
  }
  if (kind === 'quotient') {
    return {
      stem: `Expand ${L(frac('x', String(n2)))} into a difference of logs.`,
      kind: 'choice',
      choices: mc(rng, `${L('x')} − ${L(n2)}`, [`${L(n2)} − ${L('x')}`, `${frac(L('x'), L(n2))}`, `${L('x')} + ${L(n2)}`]),
      answerHtml: `${L('x')} − ${L(n2)}`,
      note: 'A log of a quotient is a difference of logs, not a quotient of logs.',
      hints: ['log(A/B) = log A − log B.', 'The order matters: numerator first.'],
      steps: [{ title: 'Quotient rule for logs', html: `log(A/B) = log A − log B` }],
    };
  }
  return {
    stem: `Rewrite ${L(`x${sup(p)}`)} without an exponent inside the log.`,
    kind: 'choice',
    choices: mc(rng, `${p} ${L('x')}`, [`${L('x')}${sup(p)}`, `${L('x')} + ${p}`, `${frac(L('x'), String(p))}`]),
    answerHtml: `${L(`x${sup(p)}`)} = ${p} ${L('x')}`,
    hints: ['An exponent inside a log comes out front as a multiplier.', 'log(Aⁿ) = n log A.'],
    steps: [{ title: 'Power rule for logs', html: `log(A${sup('n')}) = n log A, so ${L(`x${sup(p)}`)} = ${p}${L('x')}` }],
  };
}

export function solveExponential(rng, level) {
  if (level === 1) {
    /* Same base both sides: no logs needed, which is the point. */
    const b = rng.pick([2, 3, 5]);
    const sol = rng.int(2, 6);
    const c = rng.int(1, 3), d = rng.int(-4, 4);
    const rhsExp = c * sol + d;
    return {
      stem: `Solve for x: ${eq(`${b}${sup(`${c === 1 ? '' : c}x${d >= 0 ? `+${d}` : d}`)}`, `${b}${sup(rhsExp)}`)}`,
      kind: 'numeric',
      answer: sol,
      answerHtml: `x = ${sol}`,
      hints: ['The bases match, so the exponents must be equal.',
        `${c === 1 ? '' : c}x ${d >= 0 ? '+' : '−'} ${Math.abs(d)} = ${rhsExp}`],
      steps: [
        { title: 'Equal bases, equal exponents', html: `${c === 1 ? '' : c}x ${d >= 0 ? '+' : '−'} ${Math.abs(d)} = ${rhsExp}` },
        { title: 'Solve', html: `x = ${sol}` },
      ],
    };
  }

  const a = rng.int(2, 8);
  const b = rng.pick([2, 3, 5, 7]);
  const target = a * Math.pow(b, rng.int(1, 3)) + rng.int(1, 20);
  const sol = Math.log(target / a) / Math.log(b);
  return {
    stem: `Solve for x: ${eq(`${a} · ${b}${sup('x')}`, target)}<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: sol,
    tol: 2e-4,
    answerHtml: `x = ${frac(`ln(${target}/${a})`, `ln ${b}`)} ≈ ${num(sol, 4)}`,
    hints: [`Divide by ${a} first so the exponential is alone.`,
      `${b}${sup('x')} = ${num(target / a, 6)}. Now take a log of both sides.`],
    steps: [
      { title: 'Isolate the exponential', html: `${b}${sup('x')} = ${frac(String(target), String(a))} = ${num(target / a, 6)}` },
      { title: 'Take logs of both sides', html: `x ln ${b} = ln(${num(target / a, 6)})` },
      { title: 'Divide', html: `x = ${frac(`ln(${num(target / a, 6)})`, `ln ${b}`)} ≈ ${num(sol, 4)}` },
    ],
  };
}

/* ======================================================== rational and radical */

export function rationalSimplify(rng, level) {
  /* (x-r)(x-s) / (x-r)(x-t): one factor cancels, and r is still excluded. */
  const [r, s, t] = rng.distinct(3, -7, 7);
  const numC = [1, -(r + s), r * s];
  const denC = [1, -(r + t), r * t];
  const ask = level === 1 ? 'simplify' : rng.pick(['simplify', 'domain']);

  if (ask === 'domain') {
    return {
      stem: `For what values of x is ${frac(poly(numC), poly(denC))} undefined?`
        + `<div class="aside">List every value, separated by commas.</div>`,
      kind: 'set',
      answers: [r, t],
      answerHtml: `x = ${r} and x = ${t}`,
      note: 'The cancelling factor still makes the original expression undefined.',
      hints: ['It is undefined where the denominator is zero, before any cancelling.',
        `Factor the denominator: ${linFactor(r)}${linFactor(t)}.`],
      steps: [
        { title: 'Factor the denominator', html: `${poly(denC)} = ${linFactor(r)}${linFactor(t)}` },
        { title: 'Set each factor to zero', html: `x = ${r}, x = ${t}` },
        { title: 'Note the trap', html: `${linFactor(r)} cancels, but x = ${r} is still excluded from the domain: the original expression is 0/0 there.` },
      ],
    };
  }

  return {
    stem: `Simplify: ${frac(poly(numC), poly(denC))}`,
    kind: 'text',
    answer: `(x${-s >= 0 ? '+' : ''}${-s})/(x${-t >= 0 ? '+' : ''}${-t})`,
    accept: [`${linFactor(s)}/${linFactor(t)}`.replace(/[−\s]/g, (m) => (m === '−' ? '-' : ''))],
    answerHtml: frac(linFactor(s), linFactor(t)),
    hints: ['Factor the top and bottom first, then look for a common factor.',
      `Both contain ${linFactor(r)}.`],
    steps: [
      { title: 'Factor both', html: `${frac(`${linFactor(r)}${linFactor(s)}`, `${linFactor(r)}${linFactor(t)}`)}` },
      { title: 'Cancel the common factor', html: frac(linFactor(s), linFactor(t)) },
      { title: 'State the restriction', html: `valid for x ≠ ${r} and x ≠ ${t}` },
    ],
  };
}

export function radicalEquation(rng, level) {
  if (level === 1) {
    const a = rng.int(1, 4), c = rng.int(2, 7);
    const b = rng.int(-6, 6);
    const sol = (c * c - b) / a;
    return {
      stem: `Solve for x: ${eq(sqrt(terms([coef(a, 'x'), String(b)])), c)}`,
      kind: 'numeric',
      answer: sol,
      answerHtml: `x = ${num(sol)}`,
      hints: ['Square both sides to get rid of the radical.',
        `${terms([coef(a, 'x'), String(b)])} = ${c * c}`],
      steps: [
        { title: 'Square both sides', html: `${terms([coef(a, 'x'), String(b)])} = ${c}${sup(2)} = ${c * c}` },
        { title: 'Solve', html: `x = ${num(sol)}` },
        { title: 'Check', html: `${sqrt(String(c * c))} = ${c} ✓` },
      ],
    };
  }

  /* sqrt(x + b) = x + c, which produces one real and one extraneous root. The
     check step is the whole lesson. */
  let b, c, good, bad;
  let guard = 0;
  do {
    b = rng.int(1, 12);
    c = rng.int(-4, 1);
    /* x + b = (x+c)^2  ->  x^2 + (2c-1)x + (c^2 - b) = 0 */
    const B = 2 * c - 1, C = c * c - b;
    const disc = B * B - 4 * C;
    if (disc <= 0 || !Number.isInteger(Math.sqrt(disc))) { guard++; continue; }
    const rt = Math.sqrt(disc);
    const r1 = (-B - rt) / 2, r2 = (-B + rt) / 2;
    const ok = [r1, r2].filter((x) => x + b >= 0 && Math.abs(Math.sqrt(x + b) - (x + c)) < 1e-9);
    const no = [r1, r2].filter((x) => !ok.includes(x));
    if (ok.length === 1 && no.length === 1 && Number.isInteger(ok[0])) { good = ok[0]; bad = no[0]; break; }
    guard++;
  } while (guard < 400);

  if (good === undefined) return radicalEquation(rng, 1);

  return {
    stem: `Solve for x: ${eq(sqrt(`x + ${b}`), `x ${c >= 0 ? '+' : '−'} ${Math.abs(c)}`)}`
      + `<div class="aside">Give only the solutions that actually work.</div>`,
    kind: 'set',
    answers: [good],
    answerHtml: `x = ${good} only. x = ${bad} is extraneous.`,
    note: 'Squaring both sides can invent solutions. Always substitute back.',
    hints: ['Square both sides, then bring everything to one side as a quadratic.',
      `You will get two candidates. Only one of them satisfies the original equation, because the square root on the left cannot be negative.`],
    steps: [
      { title: 'Square both sides', html: `x + ${b} = (x ${c >= 0 ? '+' : '−'} ${Math.abs(c)})${sup(2)}` },
      { title: 'Rearrange', html: `${poly([1, 2 * c - 1, c * c - b])} = 0` },
      { title: 'Solve the quadratic', html: `x = ${good} or x = ${bad}` },
      { title: 'Check both', html: `x = ${good} works. x = ${bad} gives ${sqrt(String(bad + b))} = ${num(Math.sqrt(bad + b))} but the right side is ${num(bad + c)}, so it is extraneous.` },
    ],
  };
}

export function complexArith(rng, level) {
  const kind = level === 1 ? rng.pick(['power', 'add']) : rng.pick(['mul', 'conj', 'power']);
  if (kind === 'power') {
    const n2 = rng.int(4, 40);
    const vals = ['1', 'i', '−1', '−i'];
    const correct = vals[n2 % 4];
    return {
      stem: `Simplify: i${sup(n2)}`,
      kind: 'choice',
      choices: mc(rng, correct, vals.filter((v) => v !== correct)),
      answerHtml: `i${sup(n2)} = ${correct}, because ${n2} ÷ 4 leaves remainder ${n2 % 4}.`,
      hints: ['Powers of i cycle every four: i, −1, −i, 1.',
        `${n2} divided by 4 leaves a remainder of ${n2 % 4}.`],
      steps: [
        { title: 'The cycle', html: `i${sup(1)} = i, i${sup(2)} = −1, i${sup(3)} = −i, i${sup(4)} = 1, then it repeats.` },
        { title: 'Divide by 4', html: `${n2} = 4(${Math.floor(n2 / 4)}) + ${n2 % 4}, so i${sup(n2)} = i${sup(n2 % 4)} = ${correct}` },
      ],
    };
  }
  if (kind === 'add') {
    const a = rng.nz(-9, 9), b = rng.nz(-9, 9), c = rng.nz(-9, 9), d = rng.nz(-9, 9);
    const re = a + c, im = b + d;
    return {
      stem: `Simplify: (${a} ${b >= 0 ? '+' : '−'} ${Math.abs(b)}i) + (${c} ${d >= 0 ? '+' : '−'} ${Math.abs(d)}i)`,
      kind: 'text',
      answer: `${re}${im >= 0 ? '+' : ''}${im}i`,
      answerHtml: `${re} ${im >= 0 ? '+' : '−'} ${Math.abs(im)}i`,
      hints: ['Add the real parts and the imaginary parts separately.',
        `Real: ${a} + ${c}. Imaginary: ${b} + ${d}.`],
      steps: [{ title: 'Combine like terms', html: `(${a} + ${c}) + (${b} + ${d})i = ${re} ${im >= 0 ? '+' : '−'} ${Math.abs(im)}i` }],
    };
  }
  if (kind === 'conj') {
    const c = rng.nz(-6, 6), d = rng.nz(1, 6);
    const denom = c * c + d * d;
    return {
      stem: `What is the product (${c} + ${d}i)(${c} − ${d}i)?`,
      kind: 'numeric',
      answer: denom,
      answerHtml: `${denom}, a real number`,
      hints: ['A complex number times its conjugate is always real.',
        `It is a difference of squares: ${c}² − (${d}i)², and i² = −1.`],
      steps: [
        { title: 'Difference of squares', html: `(${c})${sup(2)} − (${d}i)${sup(2)} = ${c * c} − ${d * d}i${sup(2)}` },
        { title: 'Use i² = −1', html: `= ${c * c} + ${d * d} = ${denom}` },
      ],
    };
  }
  const a = rng.nz(-7, 7), b = rng.nz(-7, 7), c = rng.nz(-7, 7), d = rng.nz(-7, 7);
  const re = a * c - b * d, im = a * d + b * c;
  return {
    stem: `Multiply: (${a} ${b >= 0 ? '+' : '−'} ${Math.abs(b)}i)(${c} ${d >= 0 ? '+' : '−'} ${Math.abs(d)}i)`,
    kind: 'text',
    answer: `${re}${im >= 0 ? '+' : ''}${im}i`,
    answerHtml: `${re} ${im >= 0 ? '+' : '−'} ${Math.abs(im)}i`,
    hints: ['FOIL it, then replace i² with −1.',
      `The i² term is ${b}·${d}i² = ${-b * d}, which joins the real part.`],
    steps: [
      { title: 'FOIL', html: `${a * c} + ${a * d}i + ${b * c}i + ${b * d}i${sup(2)}` },
      { title: 'Replace i² with −1', html: `${a * c} − ${b * d} + (${a * d} + ${b * c})i` },
      { title: 'Combine', html: `${re} ${im >= 0 ? '+' : '−'} ${Math.abs(im)}i` },
    ],
  };
}

export function sequences(rng, level) {
  const geometric = rng() < 0.5;
  const n2 = rng.int(5, 14);
  if (!geometric) {
    const a1 = rng.int(-12, 12), d = rng.nz(-9, 9);
    const ask = level === 1 ? 'term' : rng.pick(['term', 'sum']);
    const an = a1 + (n2 - 1) * d;
    if (ask === 'term') {
      return {
        stem: `An arithmetic sequence starts ${a1}, ${a1 + d}, ${a1 + 2 * d}, ... What is the ${n2}th term?`,
        kind: 'numeric',
        answer: an,
        answerHtml: `a<sub>${n2}</sub> = ${an}`,
        hints: [`The common difference is ${d}. Use aₙ = a₁ + (n − 1)d.`,
          `a<sub>${n2}</sub> = ${a1} + (${n2} − 1)(${d})`],
        steps: [
          { title: 'Find d', html: `d = ${a1 + d} − ${a1} = ${d}` },
          { title: 'Apply the formula', html: `a<sub>${n2}</sub> = ${a1} + ${n2 - 1}(${d}) = ${an}` },
        ],
      };
    }
    const sum = (n2 * (a1 + an)) / 2;
    return {
      stem: `An arithmetic sequence starts ${a1}, ${a1 + d}, ${a1 + 2 * d}, ... What is the sum of the first ${n2} terms?`,
      kind: 'numeric',
      answer: sum,
      answerHtml: `S<sub>${n2}</sub> = ${num(sum)}`,
      hints: [`Sₙ = ${frac('n', '2')}(a₁ + aₙ). You need the ${n2}th term first.`,
        `a<sub>${n2}</sub> = ${an}, so S = ${frac(String(n2), '2')}(${a1} + ${an}).`],
      steps: [
        { title: 'Last term', html: `a<sub>${n2}</sub> = ${a1} + ${n2 - 1}(${d}) = ${an}` },
        { title: 'Sum formula', html: `S = ${frac(String(n2), '2')}(${a1} + ${an}) = ${num(sum)}` },
      ],
    };
  }

  const a1 = rng.nz(-6, 6);
  const r = rng.pick([2, 3, -2, -3]);
  const k = Math.min(n2, 9);
  const an = a1 * Math.pow(r, k - 1);
  return {
    stem: `A geometric sequence starts ${a1}, ${a1 * r}, ${a1 * r * r}, ... What is the ${k}th term?`,
    kind: 'numeric',
    answer: an,
    answerHtml: `a<sub>${k}</sub> = ${an}`,
    hints: [`The common ratio is ${r}. Use aₙ = a₁ · r${sup('n−1')}.`,
      `a<sub>${k}</sub> = ${a1} · (${r})${sup(k - 1)}`],
    steps: [
      { title: 'Find r', html: `r = ${a1 * r} ÷ ${a1} = ${r}` },
      { title: 'Apply the formula', html: `a<sub>${k}</sub> = ${a1}(${r})${sup(k - 1)} = ${an}` },
    ],
  };
}

/* ================================================================= precalculus */

export function polyDivision(rng, level) {
  const r = rng.nz(-5, 5);
  const deg = level === 1 ? 2 : 3;
  const co = [];
  for (let i = 0; i <= deg; i++) co.push(rng.nz(-6, 6));
  /* f(r) by Horner, which is also the remainder. */
  let rem = 0;
  for (const c of co) rem = rem * r + c;
  return {
    stem: `Find the remainder when ${poly(co)} is divided by ${linFactor(r)}.`,
    kind: 'numeric',
    answer: rem,
    answerHtml: `${rem}`,
    note: 'The remainder theorem turns a division problem into one substitution.',
    hints: [`The remainder theorem says the remainder is just f(${r}).`,
      `Substitute x = ${r} into the polynomial.`],
    steps: [
      { title: 'Remainder theorem', html: `Dividing by ${linFactor(r)} leaves remainder f(${r}).` },
      { title: 'Substitute', html: `f(${r}) = ${co.map((c, i) => `${c}(${r})${sup(deg - i)}`).join(' + ')} = ${rem}` },
      { title: 'Conclusion', html: rem === 0 ? `The remainder is 0, so ${linFactor(r)} is a factor.` : `The remainder is ${rem}.` },
    ],
  };
}

export function polyBehavior(rng, level) {
  const deg = rng.pick([2, 3, 4, 5]);
  const lead = rng.pick([-3, -2, -1, 1, 2, 3]);
  const even = deg % 2 === 0;
  const pos = lead > 0;
  const desc = even
    ? (pos ? 'Both ends go up' : 'Both ends go down')
    : (pos ? 'Left end goes down, right end goes up' : 'Left end goes up, right end goes down');
  const all = ['Both ends go up', 'Both ends go down',
    'Left end goes down, right end goes up', 'Left end goes up, right end goes down'];
  return {
    stem: `Describe the end behavior of a polynomial with degree ${deg} and leading coefficient ${lead}.`,
    kind: 'choice',
    choices: mc(rng, desc, all.filter((d) => d !== desc)),
    answerHtml: desc,
    hints: ['Only two things matter: whether the degree is even or odd, and the sign of the leading coefficient.',
      `Degree ${deg} is ${even ? 'even, so both ends match' : 'odd, so the ends go opposite ways'}; the leading coefficient is ${pos ? 'positive' : 'negative'}.`],
    steps: [
      { title: 'Parity of the degree', html: `${deg} is ${even ? 'even: both ends point the same way, like a parabola.' : 'odd: the ends point opposite ways, like a line or a cubic.'}` },
      { title: 'Sign of the lead', html: `${lead} is ${pos ? 'positive, so the right end goes up.' : 'negative, so the right end goes down.'}` },
      { title: 'Together', html: desc },
    ],
  };
}

/* Exact unit-circle values, stored as display strings so nothing is lost to
   floating point and the answer key reads the way a textbook would. */
const UNIT = [
  { deg: 0, rad: '0', sin: '0', cos: '1', tan: '0' },
  { deg: 30, rad: 'π/6', sin: '1/2', cos: `${sqrt('3')}/2`, tan: `${sqrt('3')}/3` },
  { deg: 45, rad: 'π/4', sin: `${sqrt('2')}/2`, cos: `${sqrt('2')}/2`, tan: '1' },
  { deg: 60, rad: 'π/3', sin: `${sqrt('3')}/2`, cos: '1/2', tan: sqrt('3') },
  { deg: 90, rad: 'π/2', sin: '1', cos: '0', tan: 'undefined' },
  { deg: 120, rad: '2π/3', sin: `${sqrt('3')}/2`, cos: '−1/2', tan: `−${sqrt('3')}` },
  { deg: 135, rad: '3π/4', sin: `${sqrt('2')}/2`, cos: `−${sqrt('2')}/2`, tan: '−1' },
  { deg: 150, rad: '5π/6', sin: '1/2', cos: `−${sqrt('3')}/2`, tan: `−${sqrt('3')}/3` },
  { deg: 180, rad: 'π', sin: '0', cos: '−1', tan: '0' },
  { deg: 210, rad: '7π/6', sin: '−1/2', cos: `−${sqrt('3')}/2`, tan: `${sqrt('3')}/3` },
  { deg: 225, rad: '5π/4', sin: `−${sqrt('2')}/2`, cos: `−${sqrt('2')}/2`, tan: '1' },
  { deg: 240, rad: '4π/3', sin: `−${sqrt('3')}/2`, cos: '−1/2', tan: sqrt('3') },
  { deg: 270, rad: '3π/2', sin: '−1', cos: '0', tan: 'undefined' },
  { deg: 300, rad: '5π/3', sin: `−${sqrt('3')}/2`, cos: '1/2', tan: `−${sqrt('3')}` },
  { deg: 315, rad: '7π/4', sin: `−${sqrt('2')}/2`, cos: `${sqrt('2')}/2`, tan: '−1' },
  { deg: 330, rad: '11π/6', sin: '−1/2', cos: `${sqrt('3')}/2`, tan: `−${sqrt('3')}/3` },
];

export function unitCircle(rng, level) {
  const pool = level === 1 ? UNIT.filter((u) => u.deg <= 90) : UNIT;
  const e2 = rng.pick(pool);
  const fn = rng.pick(level === 1 ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);
  const correct = e2[fn];
  /* Distractors: the same function at other angles, which is exactly the
     confusion the unit circle is meant to clear up. */
  const others = rng.shuffle(UNIT.filter((u) => u[fn] !== correct && u[fn] !== 'undefined'))
    .slice(0, 3).map((u) => u[fn]);
  const quadrant = e2.deg === 0 ? 'on the positive x-axis'
    : e2.deg < 90 ? 'in quadrant I' : e2.deg === 90 ? 'on the positive y-axis'
    : e2.deg < 180 ? 'in quadrant II' : e2.deg === 180 ? 'on the negative x-axis'
    : e2.deg < 270 ? 'in quadrant III' : e2.deg === 270 ? 'on the negative y-axis' : 'in quadrant IV';
  return {
    stem: `Evaluate exactly: ${fn}(${e2.rad})<div class="aside">That is ${e2.deg}°.</div>`,
    kind: 'choice',
    choices: mc(rng, correct, others),
    answerHtml: `${fn}(${e2.rad}) = ${correct}`,
    hints: [`${e2.rad} is ${quadrant}. What is the sign of ${fn} there?`,
      `The reference angle is ${e2.deg % 90 === 0 ? 'on an axis' : `${Math.min(e2.deg % 90, 90 - (e2.deg % 90)) || 45}°`}, and ${fn} is ${String(correct).startsWith('−') ? 'negative' : 'positive'} ${quadrant}.`],
    steps: [
      { title: 'Locate the angle', html: `${e2.rad} = ${e2.deg}°, ${quadrant}.` },
      { title: 'Sign in that quadrant', html: `${fn} is ${String(correct).startsWith('−') ? 'negative' : 'positive'} there.` },
      { title: 'Exact value', html: `${fn}(${e2.rad}) = ${correct}` },
    ],
  };
}

export function trigIdentity(rng, level) {
  const items = [
    { q: `sin${sup(2)}θ + cos${sup(2)}θ`, a: '1', why: 'The Pythagorean identity.' },
    { q: `1 + tan${sup(2)}θ`, a: `sec${sup(2)}θ`, why: 'Divide the Pythagorean identity by cos²θ.' },
    { q: `1 + cot${sup(2)}θ`, a: `csc${sup(2)}θ`, why: 'Divide the Pythagorean identity by sin²θ.' },
    { q: '2 sinθ cosθ', a: 'sin(2θ)', why: 'The double-angle identity for sine.' },
    { q: `cos${sup(2)}θ − sin${sup(2)}θ`, a: 'cos(2θ)', why: 'The double-angle identity for cosine.' },
    { q: `${frac('sinθ', 'cosθ')}`, a: 'tanθ', why: 'The quotient identity.' },
    { q: `1 − cos${sup(2)}θ`, a: `sin${sup(2)}θ`, why: 'Rearranged Pythagorean identity.' },
  ];
  const it = rng.pick(items);
  const others = rng.shuffle(items.filter((o) => o.a !== it.a)).slice(0, 3).map((o) => o.a);
  return {
    stem: `Simplify: ${it.q}`,
    kind: 'choice',
    choices: mc(rng, it.a, others),
    answerHtml: `${it.q} = ${it.a}. ${it.why}`,
    hints: ['Everything here comes from sin² + cos² = 1 or a double-angle formula.', it.why],
    steps: [{ title: 'Identity used', html: it.why }, { title: 'Result', html: `${it.q} = ${it.a}` }],
  };
}

export function trigEquation(rng, level) {
  const fn = rng.pick(['sin', 'cos']);
  const target = rng.pick(['1/2', `${sqrt('2')}/2`, `${sqrt('3')}/2`, '0', '1', '−1/2']);
  const matches = UNIT.filter((u) => u[fn] === target).map((u) => u.rad);
  if (!matches.length) return trigEquation(rng, 1);
  return {
    stem: `Find all solutions of ${eq(`${fn} x`, target)} on [0, 2π).`
      + `<div class="aside">How many solutions are there?</div>`,
    kind: 'numeric',
    answer: matches.length,
    answerHtml: `${matches.length}: x = ${matches.join(', ')}`,
    note: 'Sine and cosine take each value twice per revolution, except at their extremes.',
    hints: [`Where on the unit circle does ${fn} equal ${target}?`,
      `${fn} is ${target.startsWith('−') ? 'negative in two quadrants' : 'positive in two quadrants'}, unless the value is ±1, which happens once.`],
    steps: [
      { title: 'Reference angle', html: `Find the first-quadrant angle with ${fn} = ${target.replace('−', '')}.` },
      { title: 'All quadrants', html: `On [0, 2π) the solutions are x = ${matches.join(', ')}.` },
      { title: 'Count', html: `${matches.length} solution${matches.length === 1 ? '' : 's'}.` },
    ],
  };
}

export function trigGraph(rng, level) {
  const a = rng.pick([1, 2, 3, 4, -2, -3]);
  const b = rng.pick([1, 2, 3, 4]);
  const ask = rng.pick(['amplitude', 'period']);
  const fn = rng.pick(['sin', 'cos']);
  const stem = `${eq('y', `${a === 1 ? '' : a === -1 ? '−' : a}${fn}(${b === 1 ? '' : b}x)`)}`;
  if (ask === 'amplitude') {
    return {
      stem: `What is the amplitude of ${stem}?`,
      kind: 'numeric',
      answer: Math.abs(a),
      answerHtml: `${Math.abs(a)}`,
      note: 'Amplitude is a distance, so it is never negative.',
      hints: ['Amplitude is the absolute value of the coefficient in front.',
        `|${a}| = ${Math.abs(a)}`],
      steps: [{ title: 'Amplitude = |a|', html: `|${a}| = ${Math.abs(a)}${a < 0 ? '. The negative sign reflects the graph, but it does not make the amplitude negative.' : ''}` }],
    };
  }
  const period = 2 / b;
  return {
    stem: `What is the period of ${stem}?<div class="aside">Answer as a multiple of π, for example <code>2pi/3</code>.</div>`,
    kind: 'numeric',
    answer: period * Math.PI,
    tol: 1e-6,
    answerHtml: b === 1 ? '2π' : `${frac('2π', String(b))}`,
    hints: ['Period is 2π divided by the coefficient of x.',
      `2π / ${b}`],
    steps: [
      { title: 'Period formula', html: `period = ${frac('2π', '|b|')}` },
      { title: 'Substitute', html: `${frac('2π', String(b))}` },
    ],
  };
}

export function inverseFunction(rng, level) {
  const m = rng.nz(-5, 5);
  const b = rng.int(-9, 9);
  /* f(x) = mx + b  ->  f^-1(x) = (x - b)/m */
  const testY = rng.int(-10, 10);
  const inv = (testY - b) / m;
  return {
    stem: `If ${eq('f(x)', terms([coef(m, 'x'), String(b)]))}, find f${sup('−1')}(${testY}).`,
    kind: 'numeric',
    answer: inv,
    answerHtml: `f${sup('−1')}(${testY}) = ${num(inv)}`,
    hints: [`f⁻¹(${testY}) asks: what input to f gives an output of ${testY}?`,
      `Solve ${terms([coef(m, 'x'), String(b)])} = ${testY} for x.`],
    steps: [
      { title: 'Set f(x) equal to the value', html: `${eq(terms([coef(m, 'x'), String(b)]), testY)}` },
      { title: 'Solve for x', html: `${coef(m, 'x')} = ${testY - b}, so x = ${frac(String(testY - b), String(m))} = ${num(inv)}` },
      { title: 'Check', html: `f(${num(inv)}) = ${testY} ✓` },
    ],
  };
}

export function composeFunction(rng, level) {
  const m = rng.nz(-4, 4), b = rng.int(-6, 6);
  const p = rng.nz(-3, 3), q = rng.int(-5, 5);
  const at = rng.int(-4, 4);
  /* f(x) = mx + b, g(x) = px^2 + q  ->  f(g(at)) */
  const gv = p * at * at + q;
  const fgv = m * gv + b;
  return {
    stem: `Given ${eq('f(x)', terms([coef(m, 'x'), String(b)]))} and ${eq('g(x)', poly([p, 0, q]))}, find f(g(${at})).`,
    kind: 'numeric',
    answer: fgv,
    answerHtml: `f(g(${at})) = ${fgv}`,
    note: 'Inner function first. f(g(x)) is not g(f(x)).',
    hints: [`Compute g(${at}) first, then feed that into f.`,
      `g(${at}) = ${gv}. Now find f(${gv}).`],
    steps: [
      { title: 'Inner function', html: `g(${at}) = ${p}(${at})${sup(2)} ${q >= 0 ? '+' : '−'} ${Math.abs(q)} = ${gv}` },
      { title: 'Outer function', html: `f(${gv}) = ${m}(${gv}) ${b >= 0 ? '+' : '−'} ${Math.abs(b)} = ${fgv}` },
    ],
  };
}
