/* Calculus I generators.

   Same contract as gen-algebra.js. Most of these ask for a NUMBER rather than
   an expression - "find f'(2)" instead of "find f'(x)". That is deliberate: an
   expression answer has a dozen equally correct spellings and grading it by
   string match punishes the wrong thing. The worked solution always shows the
   general derivative, so the symbolic work is still on screen. */

import MathKit from './math.js';

const { sup, poly, coef, terms, frac, sqrt, num, linFactor, F } = MathKit;

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

const eq = (l, r) => `${l} = ${r}`;
const lim = (to, body) => `<span class="lim"><span class="limop">lim</span><span class="limsub">x → ${to}</span></span> ${body}`;
const dd = (body) => `${frac('d', 'dx')} [ ${body} ]`;

/* ===================================================================== limits */

export function limitBasic(rng, level) {
  if (level === 1) {
    /* 0/0 that resolves by factoring: (x-a)(x-b)/(x-a). */
    const [a, b] = rng.distinct(2, -7, 7);
    const topC = [1, -(a + b), a * b];
    return {
      stem: `Evaluate: ${lim(a, frac(poly(topC), linFactor(a)))}`,
      kind: 'numeric',
      answer: a - b,
      answerHtml: `${a - b}`,
      note: 'Direct substitution gives 0/0, which means "keep going", not "undefined".',
      hints: [`Substituting x = ${a} gives ${frac('0', '0')}. That is an indeterminate form, so factor first.`,
        `The numerator factors as ${linFactor(a)}${linFactor(b)}. Now cancel.`],
      steps: [
        { title: 'Try substitution', html: `Both top and bottom are 0 at x = ${a}: indeterminate.` },
        { title: 'Factor the numerator', html: `${poly(topC)} = ${linFactor(a)}${linFactor(b)}` },
        { title: 'Cancel and substitute', html: `${lim(a, linFactor(b))} = ${a} ${-b >= 0 ? '+' : '−'} ${Math.abs(b)} = ${a - b}` },
      ],
    };
  }

  if (level === 2) {
    /* Difference of squares over a linear factor. */
    const a = rng.nz(2, 8);
    return {
      stem: `Evaluate: ${lim(a, frac(`x${sup(2)} − ${a * a}`, `x − ${a}`))}`,
      kind: 'numeric',
      answer: 2 * a,
      answerHtml: `${2 * a}`,
      hints: ['The numerator is a difference of squares.',
        `x${sup(2)} − ${a * a} = (x − ${a})(x + ${a}).`],
      steps: [
        { title: 'Factor', html: `${frac(`(x − ${a})(x + ${a})`, `x − ${a}`)}` },
        { title: 'Cancel', html: `${lim(a, `x + ${a}`)} = ${2 * a}` },
      ],
    };
  }

  /* Level 3: a conjugate. */
  const a = rng.pick([1, 4, 9, 16, 25]);
  const r = Math.sqrt(a);
  return {
    stem: `Evaluate: ${lim(a, frac(`${sqrt('x')} − ${r}`, `x − ${a}`))}`,
    kind: 'numeric',
    answer: 1 / (2 * r),
    tol: 1e-6,
    answerHtml: frac('1', String(2 * r)),
    note: 'When a square root sits in an indeterminate form, multiply by the conjugate.',
    hints: ['Multiply top and bottom by the conjugate of the numerator.',
      `(${sqrt('x')} − ${r})(${sqrt('x')} + ${r}) = x − ${a}, which cancels the denominator.`],
    steps: [
      { title: 'Multiply by the conjugate', html: `${frac(`(${sqrt('x')} − ${r})(${sqrt('x')} + ${r})`, `(x − ${a})(${sqrt('x')} + ${r})`)}` },
      { title: 'The top collapses', html: `${frac(`x − ${a}`, `(x − ${a})(${sqrt('x')} + ${r})`)} = ${frac('1', `${sqrt('x')} + ${r}`)}` },
      { title: 'Substitute', html: `${frac('1', `${r} + ${r}`)} = ${frac('1', String(2 * r))}` },
    ],
  };
}

export function limitInfinity(rng, level) {
  const a = rng.nz(2, 9), b = rng.nz(2, 9);
  const mode = level === 1 ? 'equal' : rng.pick(['equal', 'topsmaller', 'topbigger']);
  let topC, botC, answer, answerHtml, why;

  if (mode === 'equal') {
    topC = [a, rng.int(-6, 6), rng.int(-6, 6)];
    botC = [b, rng.int(-6, 6), rng.int(-6, 6)];
    answer = a / b;
    answerHtml = F(a, b).tex();
    why = 'Same degree on top and bottom, so the limit is the ratio of the leading coefficients.';
  } else if (mode === 'topsmaller') {
    topC = [a, rng.int(-6, 6)];
    botC = [b, rng.int(-6, 6), rng.int(-6, 6)];
    answer = 0;
    answerHtml = '0';
    why = 'The bottom grows faster, so the fraction is squeezed to zero.';
  } else {
    topC = [a, rng.int(-6, 6), rng.int(-6, 6)];
    botC = [b, rng.int(-6, 6)];
    answer = null;
    answerHtml = a / b > 0 ? '+∞ (no finite limit)' : '−∞ (no finite limit)';
    why = 'The top grows faster, so the fraction runs away without bound.';
  }

  if (answer === null) {
    const correct = answerHtml;
    return {
      stem: `Evaluate: ${lim('∞', frac(poly(topC), poly(botC)))}`,
      kind: 'choice',
      choices: mc(rng, correct, ['0', F(a, b).tex(), a / b > 0 ? '−∞ (no finite limit)' : '+∞ (no finite limit)']),
      answerHtml: `${correct}. ${why}`,
      hints: ['Compare the degree of the top with the degree of the bottom.',
        `Top is degree ${topC.length - 1}, bottom is degree ${botC.length - 1}.`],
      steps: [
        { title: 'Compare degrees', html: `Top degree ${topC.length - 1}, bottom degree ${botC.length - 1}.` },
        { title: 'Conclusion', html: why },
      ],
    };
  }

  return {
    stem: `Evaluate: ${lim('∞', frac(poly(topC), poly(botC)))}`,
    kind: 'numeric',
    answer,
    tol: 1e-9,
    answerHtml,
    hints: ['Only the highest-degree term on each side matters as x grows.',
      why],
    steps: [
      { title: 'Divide top and bottom by the highest power', html: `Every lower-order term goes to 0.` },
      { title: 'What is left', html: `${lim('∞', frac(coef(a, `x${sup(topC.length - 1)}`), coef(b, `x${sup(botC.length - 1)}`)))} = ${answerHtml}` },
      { title: 'Why', html: why },
    ],
  };
}

export function continuity(rng, level) {
  const a = rng.nz(1, 5);
  const c = rng.int(-8, 8);
  const d = rng.int(-8, 8);
  /* left: kx + c   right: x^2 + d   continuous at x=a when ka + c = a^2 + d */
  const k = (a * a + d - c) / a;
  return {
    stem: `For what value of k is this function continuous at x = ${a}?`
      + `<div class="piecewise"><span class="brace">{</span><span>`
      + `kx ${c >= 0 ? '+' : '−'} ${Math.abs(c)}<span class="cond">for x &lt; ${a}</span><br>`
      + `x${sup(2)} ${d >= 0 ? '+' : '−'} ${Math.abs(d)}<span class="cond">for x ≥ ${a}</span>`
      + `</span></div>`,
    kind: 'numeric',
    answer: k,
    tol: 1e-9,
    answerHtml: `k = ${num(k)}`,
    hints: ['Continuity means the two pieces must agree at the join.',
      `Set k(${a}) ${c >= 0 ? '+' : '−'} ${Math.abs(c)} equal to (${a})${sup(2)} ${d >= 0 ? '+' : '−'} ${Math.abs(d)}.`],
    steps: [
      { title: 'Left-hand value', html: `k(${a}) ${c >= 0 ? '+' : '−'} ${Math.abs(c)} = ${a}k ${c >= 0 ? '+' : '−'} ${Math.abs(c)}` },
      { title: 'Right-hand value', html: `(${a})${sup(2)} ${d >= 0 ? '+' : '−'} ${Math.abs(d)} = ${a * a + d}` },
      { title: 'Set them equal', html: `${a}k = ${a * a + d - c}, so k = ${num(k)}` },
    ],
  };
}

/* ================================================================ derivatives */

export function derivPower(rng, level) {
  const at = rng.nz(-4, 4);
  if (level === 1) {
    const c = [rng.nz(-5, 5), rng.nz(-7, 7), rng.nz(-7, 7), rng.int(-9, 9)];
    /* f = c0 x^3 + c1 x^2 + c2 x + c3 ; f' = 3c0 x^2 + 2c1 x + c2 */
    const dC = [3 * c[0], 2 * c[1], c[2]];
    const val = dC[0] * at * at + dC[1] * at + dC[2];
    return {
      stem: `If ${eq('f(x)', poly(c))}, find f′(${at}).`,
      kind: 'numeric',
      answer: val,
      answerHtml: `f′(x) = ${poly(dC)}, so f′(${at}) = ${val}`,
      hints: ['Power rule, term by term: bring the exponent down and drop it by one.',
        `f′(x) = ${poly(dC)}. Now substitute x = ${at}.`],
      steps: [
        { title: 'Differentiate each term', html: `f′(x) = ${poly(dC)}` },
        { title: 'Substitute', html: `f′(${at}) = ${dC[0]}(${at})${sup(2)} ${dC[1] >= 0 ? '+' : '−'} ${Math.abs(dC[1])}(${at}) ${dC[2] >= 0 ? '+' : '−'} ${Math.abs(dC[2])} = ${val}` },
      ],
    };
  }

  /* Levels 2-3: a negative and a fractional exponent, the two that get skipped. */
  const a = rng.nz(2, 6);
  const b = rng.nz(2, 6);
  const atPos = rng.pick([1, 4, 9, 16]);
  /* f = a*x^(1/2) + b*x^(-1) ; f' = (a/2)x^(-1/2) - b x^(-2) */
  const val = (a / 2) / Math.sqrt(atPos) - b / (atPos * atPos);
  return {
    stem: `If ${eq('f(x)', `${a}${sqrt('x')} + ${frac(String(b), 'x')}`)}, find f′(${atPos}).`,
    kind: 'numeric',
    answer: val,
    tol: 1e-6,
    answerHtml: `f′(x) = ${frac(String(a), `2${sqrt('x')}`)} − ${frac(String(b), `x${sup(2)}`)}, so f′(${atPos}) = ${num(val, 6)}`,
    note: 'Rewrite roots and fractions as powers first. The power rule only sees exponents.',
    hints: [`Rewrite: ${a}${sqrt('x')} = ${a}x${sup('1/2')} and ${frac(String(b), 'x')} = ${b}x${sup('−1')}.`,
      `Then f′(x) = ${frac(String(a), '2')}x${sup('−1/2')} − ${b}x${sup('−2')}.`],
    steps: [
      { title: 'Rewrite as powers', html: `f(x) = ${a}x${sup('1/2')} + ${b}x${sup('−1')}` },
      { title: 'Power rule', html: `f′(x) = ${frac(String(a), '2')}x${sup('−1/2')} − ${b}x${sup('−2')} = ${frac(String(a), `2${sqrt('x')}`)} − ${frac(String(b), `x${sup(2)}`)}` },
      { title: 'Substitute', html: `f′(${atPos}) = ${frac(String(a), String(2 * Math.sqrt(atPos)))} − ${frac(String(b), String(atPos * atPos))} = ${num(val, 6)}` },
    ],
  };
}

export function derivProduct(rng, level) {
  const a = rng.nz(-5, 5), b = rng.int(-7, 7);
  const c = rng.nz(-4, 4), d = rng.int(-8, 8);
  const at = rng.nz(-3, 3);
  /* f = (ax + b)(cx^2 + d)
     f' = a(cx^2 + d) + (ax + b)(2cx) */
  const val = a * (c * at * at + d) + (a * at + b) * (2 * c * at);
  return {
    stem: `If ${eq('f(x)', `(${terms([coef(a, 'x'), String(b)])})(${poly([c, 0, d])})`)}, find f′(${at}).`,
    kind: 'numeric',
    answer: val,
    answerHtml: `f′(${at}) = ${val}`,
    note: 'The derivative of a product is not the product of the derivatives.',
    hints: ['Product rule: (uv)′ = u′v + uv′.',
      `u = ${terms([coef(a, 'x'), String(b)])}, u′ = ${a}; v = ${poly([c, 0, d])}, v′ = ${coef(2 * c, 'x')}.`],
    steps: [
      { title: 'Name the pieces', html: `u = ${terms([coef(a, 'x'), String(b)])}, v = ${poly([c, 0, d])}` },
      { title: 'Their derivatives', html: `u′ = ${a}, v′ = ${coef(2 * c, 'x')}` },
      { title: `Apply u′v + uv′ at x = ${at}`, html: `${a}(${c * at * at + d}) + (${a * at + b})(${2 * c * at}) = ${val}` },
    ],
  };
}

export function derivQuotient(rng, level) {
  let a, b, c, d, at;
  do {
    a = rng.nz(-6, 6); b = rng.int(-8, 8);
    c = rng.nz(-5, 5); d = rng.int(-8, 8);
    at = rng.nz(-4, 4);
  } while (c * at + d === 0 || a * d - b * c === 0);
  /* f = (ax+b)/(cx+d) ; f' = (ad - bc)/(cx+d)^2 */
  const den = c * at + d;
  const val = (a * d - b * c) / (den * den);
  return {
    stem: `If ${eq('f(x)', frac(terms([coef(a, 'x'), String(b)]), terms([coef(c, 'x'), String(d)])))}, find f′(${at}).`,
    kind: 'numeric',
    answer: val,
    tol: 1e-9,
    answerHtml: `f′(x) = ${frac(String(a * d - b * c), `(${terms([coef(c, 'x'), String(d)])})${sup(2)}`)}, so f′(${at}) = ${num(val, 6)}`,
    hints: ['Quotient rule: (u/v)′ = (u′v − uv′) / v². The order of the subtraction matters.',
      `u′v − uv′ = ${a}(${terms([coef(c, 'x'), String(d)])}) − (${terms([coef(a, 'x'), String(b)])})(${c}), which simplifies to the constant ${a * d - b * c}.`],
    steps: [
      { title: 'Quotient rule', html: `f′ = ${frac('u′v − uv′', 'v²')}` },
      { title: 'The numerator collapses', html: `${a}(${terms([coef(c, 'x'), String(d)])}) − (${terms([coef(a, 'x'), String(b)])})(${c}) = ${a * d - b * c}` },
      { title: 'Substitute', html: `f′(${at}) = ${frac(String(a * d - b * c), `(${den})${sup(2)}`)} = ${num(val, 6)}` },
    ],
  };
}

export function derivChain(rng, level) {
  const a = rng.nz(-5, 5), b = rng.int(-7, 7);
  const n2 = rng.int(2, 5);
  const at = rng.nz(-3, 3);
  const inner = a * at + b;
  /* f = (ax+b)^n ; f' = n a (ax+b)^(n-1) */
  const val = n2 * a * Math.pow(inner, n2 - 1);
  return {
    stem: `If ${eq('f(x)', `(${terms([coef(a, 'x'), String(b)])})${sup(n2)}`)}, find f′(${at}).`,
    kind: 'numeric',
    answer: val,
    answerHtml: `f′(x) = ${n2 * a}(${terms([coef(a, 'x'), String(b)])})${sup(n2 - 1)}, so f′(${at}) = ${val}`,
    note: 'Forgetting to multiply by the inside derivative is the single most common chain-rule error.',
    hints: ['Chain rule: differentiate the outside, keep the inside, then multiply by the inside derivative.',
      `Outside gives ${n2}(${terms([coef(a, 'x'), String(b)])})${sup(n2 - 1)}; the inside derivative is ${a}.`],
    steps: [
      { title: 'Outside derivative', html: `${n2}(${terms([coef(a, 'x'), String(b)])})${sup(n2 - 1)}` },
      { title: 'Times the inside derivative', html: `× ${a} → ${n2 * a}(${terms([coef(a, 'x'), String(b)])})${sup(n2 - 1)}` },
      { title: 'Substitute', html: `${n2 * a}(${inner})${sup(n2 - 1)} = ${val}` },
    ],
  };
}

export function derivTransc(rng, level) {
  const kind = rng.pick(level === 1 ? ['sin', 'exp'] : ['sin', 'cos', 'exp', 'ln']);
  const a = rng.nz(2, 5);
  const b = rng.int(1, 6);

  if (kind === 'sin') {
    const at = 0;
    const val = a * Math.cos(0);
    return {
      stem: `If ${eq('f(x)', `sin(${coef(a, 'x')})`)}, find f′(0).`,
      kind: 'numeric',
      answer: val,
      answerHtml: `f′(x) = ${a}cos(${coef(a, 'x')}), so f′(0) = ${a}`,
      hints: ['The derivative of sin(u) is cos(u) times u′.',
        `u = ${coef(a, 'x')}, so u′ = ${a}. And cos(0) = 1.`],
      steps: [
        { title: 'Chain rule', html: `f′(x) = cos(${coef(a, 'x')}) · ${a}` },
        { title: 'At x = 0', html: `${a}cos(0) = ${a}(1) = ${a}` },
      ],
    };
  }
  if (kind === 'cos') {
    const val = 0;
    return {
      stem: `If ${eq('f(x)', `cos(${coef(a, 'x')})`)}, find f′(0).`,
      kind: 'numeric',
      answer: val,
      answerHtml: `f′(x) = −${a}sin(${coef(a, 'x')}), so f′(0) = 0`,
      note: 'The derivative of cosine carries a minus sign.',
      hints: ['d/dx cos(u) = −sin(u) · u′. Do not lose the minus.',
        'sin(0) = 0, so the whole thing is 0 regardless of the coefficient.'],
      steps: [
        { title: 'Chain rule', html: `f′(x) = −sin(${coef(a, 'x')}) · ${a}` },
        { title: 'At x = 0', html: `−${a}sin(0) = 0` },
      ],
    };
  }
  if (kind === 'exp') {
    const val = a;
    return {
      stem: `If ${eq('f(x)', `e${sup(`${a === 1 ? '' : a}x`)}`)}, find f′(0).`,
      kind: 'numeric',
      answer: val,
      answerHtml: `f′(x) = ${a}e${sup(`${a === 1 ? '' : a}x`)}, so f′(0) = ${a}`,
      hints: ['eᵘ differentiates to eᵘ times u′. The exponential never changes shape.',
        `u = ${coef(a, 'x')}, u′ = ${a}, and e⁰ = 1.`],
      steps: [
        { title: 'Chain rule', html: `f′(x) = e${sup(`${a}x`)} · ${a}` },
        { title: 'At x = 0', html: `${a}e${sup(0)} = ${a}` },
      ],
    };
  }
  /* ln(ax + b) at a point where it is defined */
  const at = rng.int(1, 5);
  const val = a / (a * at + b);
  return {
    stem: `If ${eq('f(x)', `ln(${terms([coef(a, 'x'), String(b)])})`)}, find f′(${at}).`,
    kind: 'numeric',
    answer: val,
    tol: 1e-9,
    answerHtml: `f′(x) = ${frac(String(a), terms([coef(a, 'x'), String(b)]))}, so f′(${at}) = ${F(a, a * at + b).tex()}`,
    hints: ['d/dx ln(u) = u′ / u.',
      `u = ${terms([coef(a, 'x'), String(b)])}, u′ = ${a}.`],
    steps: [
      { title: 'Chain rule for ln', html: `f′(x) = ${frac('u′', 'u')} = ${frac(String(a), terms([coef(a, 'x'), String(b)]))}` },
      { title: 'Substitute', html: `${frac(String(a), String(a * at + b))} = ${num(val, 6)}` },
    ],
  };
}

/* Pythagorean triples give implicit-differentiation problems an exact answer
   at a point that is genuinely on the curve. */
const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25]];

export function derivImplicit(rng, level) {
  if (level === 1 || rng() < 0.6) {
    const [px, py, r] = rng.pick(TRIPLES);
    const sx = rng.sign() * px, sy = rng.sign() * py;
    /* x^2 + y^2 = r^2  ->  dy/dx = -x/y */
    const val = -sx / sy;
    return {
      stem: `The circle ${eq(`x${sup(2)} + y${sup(2)}`, r * r)} passes through (${sx}, ${sy}). Find ${frac('dy', 'dx')} there.`,
      kind: 'numeric',
      answer: val,
      tol: 1e-9,
      answerHtml: `${frac('dy', 'dx')} = ${frac('−x', 'y')} = ${F(-sx, sy).tex()}`,
      hints: ['Differentiate both sides with respect to x, remembering that y is a function of x.',
        `2x + 2y${frac('dy', 'dx')} = 0, so ${frac('dy', 'dx')} = ${frac('−x', 'y')}.`],
      steps: [
        { title: 'Differentiate both sides', html: `2x + 2y${frac('dy', 'dx')} = 0` },
        { title: 'Solve for dy/dx', html: `${frac('dy', 'dx')} = ${frac('−x', 'y')}` },
        { title: 'Substitute the point', html: `${frac(String(-sx), String(sy))} = ${num(val, 6)}` },
      ],
    };
  }

  /* xy = k, a hyperbola. dy/dx = -y/x. */
  const px = rng.nz(1, 6);
  const py = rng.nz(1, 6);
  const k = px * py;
  const val = -py / px;
  return {
    stem: `The curve ${eq('xy', k)} passes through (${px}, ${py}). Find ${frac('dy', 'dx')} there.`,
    kind: 'numeric',
    answer: val,
    tol: 1e-9,
    answerHtml: `${frac('dy', 'dx')} = ${frac('−y', 'x')} = ${F(-py, px).tex()}`,
    note: 'The left side is a product, so the product rule applies before you can solve for dy/dx.',
    hints: ['Differentiate xy with the product rule: it becomes y + x·dy/dx.',
      `y + x${frac('dy', 'dx')} = 0, so ${frac('dy', 'dx')} = ${frac('−y', 'x')}.`],
    steps: [
      { title: 'Product rule on the left', html: `y + x${frac('dy', 'dx')} = 0` },
      { title: 'Solve', html: `${frac('dy', 'dx')} = ${frac('−y', 'x')}` },
      { title: 'Substitute', html: `${frac(String(-py), String(px))} = ${num(val, 6)}` },
    ],
  };
}

/* =============================================================== applications */

export function tangentLine(rng, level) {
  const a = rng.nz(-3, 3), b = rng.nz(-6, 6), c = rng.int(-8, 8);
  const at = rng.nz(-3, 3);
  /* f = ax^2 + bx + c ; f' = 2ax + b */
  const m = 2 * a * at + b;
  const y0 = a * at * at + b * at + c;
  const yint = y0 - m * at;
  const ask = level === 1 ? 'slope' : 'intercept';
  if (ask === 'slope') {
    return {
      stem: `Find the slope of the tangent to ${eq('y', poly([a, b, c]))} at x = ${at}.`,
      kind: 'numeric',
      answer: m,
      answerHtml: `m = ${m}`,
      hints: ['The slope of the tangent is the derivative evaluated at that point.',
        `y′ = ${poly([2 * a, b])}, so at x = ${at} it is ${m}.`],
      steps: [
        { title: 'Differentiate', html: `y′ = ${poly([2 * a, b])}` },
        { title: 'Evaluate', html: `y′(${at}) = ${2 * a}(${at}) ${b >= 0 ? '+' : '−'} ${Math.abs(b)} = ${m}` },
      ],
    };
  }
  return {
    stem: `Find the y-intercept of the line tangent to ${eq('y', poly([a, b, c]))} at x = ${at}.`,
    kind: 'numeric',
    answer: yint,
    answerHtml: `The tangent is y = ${terms([coef(m, 'x'), String(yint)])}, so the y-intercept is ${yint}.`,
    hints: ['You need two things: the point on the curve, and the slope there.',
      `The point is (${at}, ${y0}) and the slope is ${m}. Now use point-slope.`],
    steps: [
      { title: 'Point on the curve', html: `y(${at}) = ${y0}, so the point is (${at}, ${y0})` },
      { title: 'Slope', html: `y′ = ${poly([2 * a, b])}, so m = ${m}` },
      { title: 'Point-slope to intercept', html: `b = ${y0} − (${m})(${at}) = ${yint}` },
    ],
  };
}

export function relatedRates(rng, level) {
  if (level === 1 || rng() < 0.5) {
    /* Expanding sphere. */
    const dV = rng.pick([10, 12, 20, 24, 36, 48]);
    const r = rng.int(2, 6);
    const dr = dV / (4 * Math.PI * r * r);
    return {
      stem: `Air is pumped into a spherical balloon at ${dV} cm${sup(3)}/s. How fast is the radius growing when r = ${r} cm?`
        + `<div class="aside">Answer in cm/s, to 5 decimal places.</div>`,
      kind: 'numeric',
      answer: dr,
      tol: 1e-5,
      answerHtml: `${frac('dr', 'dt')} = ${frac(String(dV), `4π(${r})${sup(2)}`)} ≈ ${num(dr, 5)} cm/s`,
      hints: [`Start from the volume formula V = ${frac('4', '3')}πr${sup(3)} and differentiate both sides with respect to time.`,
        `${frac('dV', 'dt')} = 4πr${sup(2)}${frac('dr', 'dt')}. You know dV/dt and r, so solve for dr/dt.`],
      steps: [
        { title: 'Relate the quantities', html: `V = ${frac('4', '3')}πr${sup(3)}` },
        { title: 'Differentiate with respect to t', html: `${frac('dV', 'dt')} = 4πr${sup(2)} · ${frac('dr', 'dt')}` },
        { title: 'Substitute and solve', html: `${dV} = 4π(${r})${sup(2)}${frac('dr', 'dt')}, so ${frac('dr', 'dt')} = ${num(dr, 5)} cm/s` },
      ],
    };
  }

  /* Sliding ladder, using a triple so the geometry is exact. */
  const [px, py, L] = rng.pick(TRIPLES.filter((t) => t[2] <= 17));
  const dx = rng.pick([1, 2, 3]);
  const dy = -(px * dx) / py;
  return {
    stem: `A ${L} ft ladder leans against a wall. The base slides away at ${dx} ft/s. `
      + `How fast is the top sliding down when the base is ${px} ft from the wall?`
      + `<div class="aside">Answer in ft/s. A downward rate is negative.</div>`,
    kind: 'numeric',
    answer: dy,
    tol: 1e-6,
    answerHtml: `${frac('dy', 'dt')} = ${F(-px * dx, py).tex()} ft/s (the top slides down at ${num(Math.abs(dy), 4)} ft/s)`,
    note: 'The ladder length is constant, so its derivative is zero. That is what makes the equation work.',
    hints: [`x${sup(2)} + y${sup(2)} = ${L * L}. When x = ${px}, y = ${py}.`,
      `Differentiating gives 2x${frac('dx', 'dt')} + 2y${frac('dy', 'dt')} = 0.`],
    steps: [
      { title: 'Set up', html: `x${sup(2)} + y${sup(2)} = ${L}${sup(2)} = ${L * L}` },
      { title: 'Find y at that moment', html: `y = ${sqrt(`${L * L} − ${px * px}`)} = ${py} ft` },
      { title: 'Differentiate', html: `2x${frac('dx', 'dt')} + 2y${frac('dy', 'dt')} = 0` },
      { title: 'Solve', html: `${frac('dy', 'dt')} = ${frac(`−x${frac('dx', 'dt')}`, 'y')} = ${frac(String(-px * dx), String(py))} = ${num(dy, 4)} ft/s` },
    ],
  };
}

export function extrema(rng, level) {
  /* Build f' = 3(x - r)(x - s) so the critical points are integers. */
  const [r, s] = rng.distinct(2, -5, 5).sort((a, b) => a - b);
  /* f'(x) = 3x^2 - 3(r+s)x + 3rs  ->  f(x) = x^3 - (3/2)(r+s)x^2 + 3rs x + C
     Use a factor of 2 on f to keep every coefficient an integer. */
  const A = 2, B = -3 * (r + s), C = 6 * r * s, D = rng.int(-6, 6);
  /* f = 2x^3 + Bx^2 + Cx + D ; f' = 6x^2 + 2Bx + C = 6(x-r)(x-s) */
  const ask = rng.pick(['count', 'localmax', 'localmin']);

  if (ask === 'count') {
    return {
      stem: `How many critical points does ${eq('f(x)', poly([A, B, C, D]))} have?`,
      kind: 'numeric',
      answer: 2,
      answerHtml: `2, at x = ${r} and x = ${s}`,
      hints: ['Critical points are where f′(x) = 0 or is undefined.',
        `f′(x) = ${poly([3 * A, 2 * B, C])}, which factors as 6${linFactor(r)}${linFactor(s)}.`],
      steps: [
        { title: 'Differentiate', html: `f′(x) = ${poly([3 * A, 2 * B, C])}` },
        { title: 'Factor', html: `= 6${linFactor(r)}${linFactor(s)}` },
        { title: 'Set to zero', html: `x = ${r} and x = ${s}: two critical points.` },
      ],
    };
  }

  /* With a positive leading coefficient, the smaller root is the local max. */
  const wantMax = ask === 'localmax';
  const answer = wantMax ? r : s;
  return {
    stem: `At what x does ${eq('f(x)', poly([A, B, C, D]))} have a local ${wantMax ? 'maximum' : 'minimum'}?`,
    kind: 'numeric',
    answer,
    answerHtml: `x = ${answer}`,
    hints: [`f′(x) = ${poly([3 * A, 2 * B, C])} = 6${linFactor(r)}${linFactor(s)}, so the critical points are x = ${r} and x = ${s}.`,
      `The leading coefficient is positive, so f′ goes positive, negative, positive. That makes x = ${r} the local max and x = ${s} the local min.`],
    steps: [
      { title: 'Critical points', html: `f′(x) = 6${linFactor(r)}${linFactor(s)} = 0 at x = ${r}, ${s}` },
      { title: 'Sign of f′ around them', html: `f′ > 0 before ${r}, f′ < 0 between, f′ > 0 after ${s}.` },
      { title: 'Classify', html: `Rising then falling at x = ${r}: local maximum. Falling then rising at x = ${s}: local minimum.` },
      { title: 'Answer', html: `x = ${answer}` },
    ],
  };
}

export function optimization(rng, level) {
  if (level === 1 || rng() < 0.5) {
    /* Rectangle with fixed perimeter: the square always wins, which is worth
       internalizing. */
    const P = rng.pick([40, 60, 80, 100, 120, 200]);
    const side = P / 4;
    return {
      stem: `A rectangular pen is built with ${P} ft of fencing. What is the largest area it can enclose?`
        + `<div class="aside">Answer in square feet.</div>`,
      kind: 'numeric',
      answer: side * side,
      answerHtml: `${side} × ${side} = ${side * side} ft${sup(2)}`,
      hints: [`If one side is x, the other is ${frac(String(P), '2')} − x = ${P / 2} − x. Write the area in terms of x alone.`,
        `A(x) = x(${P / 2} − x) = ${P / 2}x − x${sup(2)}. Maximize it.`],
      steps: [
        { title: 'Constraint', html: `2x + 2y = ${P}, so y = ${P / 2} − x` },
        { title: 'Objective in one variable', html: `A(x) = x(${P / 2} − x) = ${P / 2}x − x${sup(2)}` },
        { title: 'Differentiate and solve', html: `A′ = ${P / 2} − 2x = 0 → x = ${side}` },
        { title: 'Area', html: `A = ${side} × ${side} = ${side * side} ft${sup(2)}` },
      ],
    };
  }

  /* Two numbers with a fixed sum, maximize the product. */
  const S = rng.pick([20, 30, 50, 60, 90, 100]);
  const half = S / 2;
  return {
    stem: `Two positive numbers add to ${S}. What is their largest possible product?`,
    kind: 'numeric',
    answer: half * half,
    answerHtml: `${half} × ${half} = ${half * half}`,
    hints: [`Call them x and ${S} − x. The product is P(x) = x(${S} − x).`,
      `P′(x) = ${S} − 2x. Set it to zero.`],
    steps: [
      { title: 'Write the product', html: `P(x) = x(${S} − x) = ${S}x − x${sup(2)}` },
      { title: 'Differentiate', html: `P′(x) = ${S} − 2x` },
      { title: 'Solve', html: `x = ${half}, so both numbers are ${half}` },
      { title: 'Product', html: `${half * half}` },
    ],
  };
}

/* ================================================================ integration */

export function antiderivative(rng, level) {
  const c = [rng.nz(-5, 5), rng.nz(-6, 6), rng.int(-8, 8)];
  /* f = c0 x^2 + c1 x + c2 ; F = c0/3 x^3 + c1/2 x^2 + c2 x */
  const at = rng.nz(1, 4);
  const Fat = (c[0] / 3) * at ** 3 + (c[1] / 2) * at ** 2 + c[2] * at;
  return {
    stem: `If F is the antiderivative of ${eq('f(x)', poly(c))} with F(0) = 0, find F(${at}).`,
    kind: 'numeric',
    answer: Fat,
    tol: 1e-6,
    answerHtml: `F(x) = ${F(c[0], 3).tex()}x${sup(3)} + ${F(c[1], 2).tex()}x${sup(2)} + ${c[2]}x, so F(${at}) = ${num(Fat, 6)}`,
    hints: ['Run the power rule backwards: raise the exponent by one, then divide by the new exponent.',
      `F(x) = ${frac(String(c[0]), '3')}x${sup(3)} + ${frac(String(c[1]), '2')}x${sup(2)} + ${c[2]}x + C, and F(0) = 0 makes C = 0.`],
    steps: [
      { title: 'Integrate term by term', html: `F(x) = ${frac(String(c[0]), '3')}x${sup(3)} + ${frac(String(c[1]), '2')}x${sup(2)} + ${c[2]}x + C` },
      { title: 'Use the initial condition', html: `F(0) = C = 0` },
      { title: 'Evaluate', html: `F(${at}) = ${num(Fat, 6)}` },
    ],
  };
}

export function definiteIntegral(rng, level) {
  const c = [rng.nz(-4, 4), rng.nz(-6, 6), rng.int(-6, 6)];
  const a = rng.int(-3, 1);
  const b = a + rng.int(1, 4);
  const Fx = (t) => (c[0] / 3) * t ** 3 + (c[1] / 2) * t ** 2 + c[2] * t;
  const val = Fx(b) - Fx(a);
  return {
    stem: `Evaluate: <span class="intg">∫</span><sub class="ilo">${a}</sub><sup class="ihi">${b}</sup> `
      + `(${poly(c)}) dx`,
    kind: 'numeric',
    answer: val,
    tol: 1e-6,
    answerHtml: num(val, 6),
    hints: ['Find an antiderivative, then evaluate at the top limit minus the bottom limit.',
      `F(x) = ${frac(String(c[0]), '3')}x${sup(3)} + ${frac(String(c[1]), '2')}x${sup(2)} + ${c[2]}x. Now compute F(${b}) − F(${a}).`],
    steps: [
      { title: 'Antiderivative', html: `F(x) = ${frac(String(c[0]), '3')}x${sup(3)} + ${frac(String(c[1]), '2')}x${sup(2)} + ${c[2]}x` },
      { title: 'Top limit', html: `F(${b}) = ${num(Fx(b), 6)}` },
      { title: 'Bottom limit', html: `F(${a}) = ${num(Fx(a), 6)}` },
      { title: 'Subtract', html: `${num(Fx(b), 6)} − (${num(Fx(a), 6)}) = ${num(val, 6)}` },
    ],
  };
}

export function uSubstitution(rng, level) {
  const a = rng.nz(2, 5), b = rng.int(-6, 6);
  const n2 = rng.int(2, 4);
  const lo = 0, hi = rng.int(1, 3);
  /* integral of (ax+b)^n dx = (ax+b)^(n+1) / (a(n+1)) */
  const Fx = (t) => Math.pow(a * t + b, n2 + 1) / (a * (n2 + 1));
  const val = Fx(hi) - Fx(lo);
  return {
    stem: `Evaluate: <span class="intg">∫</span><sub class="ilo">${lo}</sub><sup class="ihi">${hi}</sup> `
      + `(${terms([coef(a, 'x'), String(b)])})${sup(n2)} dx`,
    kind: 'numeric',
    answer: val,
    tol: 1e-6,
    answerHtml: num(val, 6),
    note: 'When you substitute, the dx has to become du. That is where the 1/a comes from.',
    hints: [`Let u = ${terms([coef(a, 'x'), String(b)])}. Then du = ${a} dx, so dx = ${frac('du', String(a))}.`,
      `The integral becomes ${frac('1', String(a))}∫u${sup(n2)} du = ${frac(`u${sup(n2 + 1)}`, String(a * (n2 + 1)))}.`],
    steps: [
      { title: 'Substitute', html: `u = ${terms([coef(a, 'x'), String(b)])}, du = ${a} dx` },
      { title: 'Rewrite', html: `${frac('1', String(a))} ∫ u${sup(n2)} du = ${frac(`u${sup(n2 + 1)}`, String(a * (n2 + 1)))}` },
      { title: 'Back-substitute', html: `${frac(`(${terms([coef(a, 'x'), String(b)])})${sup(n2 + 1)}`, String(a * (n2 + 1)))}` },
      { title: `Evaluate from ${lo} to ${hi}`, html: `${num(Fx(hi), 6)} − (${num(Fx(lo), 6)}) = ${num(val, 6)}` },
    ],
  };
}
