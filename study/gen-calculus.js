/* Calculus I generators.

   Same contract as gen-algebra.js. Most of these ask for a NUMBER rather than
   an expression - "find f'(2)" instead of "find f'(x)". That is deliberate: an
   expression answer has a dozen equally correct spellings and grading it by
   string match punishes the wrong thing. The worked solution always shows the
   general derivative, so the symbolic work is still on screen. */

import MathKit from './math.js';

const { sup, poly, coef, terms, frac, sqrt, num, linFactor, F , plus } = MathKit;

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
      + `kx${plus(c)}<span class="cond">for x &lt; ${a}</span><br>`
      + `x${sup(2)}${plus(d)}<span class="cond">for x ≥ ${a}</span>`
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

/* The formal definition, asked as a number.

   Quiz 3 question 1, which is the one outcome in the Limits unit that was
   never practiseable here: there was no epsilon-delta generator at all, so
   "state and use the formal definition of a limit" could be revised for by
   reading and nothing else.

   Built backward, like everything else: pick the slope and the point, and
   the limit L = ma + b is then exact rather than rounded. For a linear
   function the proof is always the same move - |mx + b - L| = |m||x - a|,
   so |x - a| < e/|m| forces it under e - and the number being asked for is
   that e/|m|. Any SMALLER delta also works, which the marking has to know:
   the question asks for the largest one that does. */
export function epsilonDelta(rng, level) {
  const m = rng.nz(2, level >= 3 ? 12 : 9);
  const a = rng.int(-6, 7);
  const b = rng.int(-9, 9);
  const L = m * a + b;
  /* An epsilon with an exact quotient, so the answer is not a decimal that
     invites a rounded key - the trap that marked correct tangent work wrong. */
  const eps = Math.abs(m) * rng.pick([0.01, 0.05, 0.1, 0.25, 0.5]);
  const delta = eps / Math.abs(m);
  /* plus() renders nothing for a zero, which is the whole reason it
     exists: b is allowed to be 0 here and "5x + 0" is not a question
     anybody writes. test_generators fails the build on that string. */
  /* A real minus sign on every negative, like the rest of the page. */
  const show = (n) => num(n).replace('-', '−');
  const fx = `${m === 1 ? '' : m === -1 ? '−' : show(m)}x${plus(b)}`;
  return {
    stem: `Use the formal definition of a limit for `
      + `<span class="eq">lim<sub>x→${show(a)}</sub> (${fx}) = ${show(L)}</span>. `
      + `What is the largest δ that works for ε = ${num(eps)}?`,
    kind: 'numeric',
    answer: delta,
    tol: 1e-9,
    answerHtml: `δ = ${num(delta)}`,
    hints: ['Start from |f(x) − L| < ε and work back to a bound on |x − a|.',
      `|${fx} − (${L})| simplifies to ${Math.abs(m)}|x − ${a}|.`,
      `So you need ${Math.abs(m)}|x − ${a}| < ε, which is |x − ${a}| < ε/${Math.abs(m)}.`],
    steps: [
      { title: 'Write what you must force',
        html: `|(${fx}) − ${L}| &lt; ε` },
      { title: 'Simplify the left side',
        html: `|${fx} − (${L})| = |${m}x − ${m * a}| `
          + `= ${Math.abs(m)}|x − ${a}|` },
      { title: 'Solve for |x − a|',
        html: `${Math.abs(m)}|x − ${a}| &lt; ε, so |x − ${a}| &lt; ε/${Math.abs(m)}` },
      { title: 'Read off δ',
        html: `δ = ε/${Math.abs(m)} = ${num(eps)}/${Math.abs(m)} = ${num(delta)}` },
    ],
  };
}

/* ================================================= the five that were missing

   Carter's outcomes sheet lists 23 outcomes and five of them could not be
   practised here at all: L6, A2, A3, A8 and A9. Two of those are on a
   quiz he has not sat yet, with the exam eight days off.

   Each carries `probe`, a description of the question in a form a test can
   evaluate WITHOUT using the stated answer - the function as text, the
   interval, the point. tools/test_outcomes.mjs recomputes every answer
   from it by brute force. */

const minus = (n) => num(n).replace('-', '−');

/* L6. The Intermediate Value Theorem, as the thing it is used for:
   trapping a root between two numbers. The cubic is x^3 + px + q with
   p >= 0, so it only ever rises and has exactly one real root - which is
   what makes "between which two integers" a question with one answer. */
export function ivtRoot(rng, level) {
  /* p >= 1 always: with p = 0 the gap between f(0) and f(1) is exactly 1,
     which leaves no whole number strictly between and puts the root ON
     an integer - a question whose answer is the question. */
  const p = rng.int(1, level >= 3 ? 7 : 4);
  const n = rng.int(level === 1 ? 0 : -3, 3);
  const f = (x) => x * x * x + p * x;
  /* q strictly between -f(n+1) and -f(n) puts the sign change in (n, n+1). */
  const lo = -f(n + 1) + 1;
  const hi = -f(n) - 1;
  const q = hi >= lo ? rng.int(lo, hi) : lo;
  const g = (x) => f(x) + q;
  const fx = `x${sup(3)}${p ? `${plus(p).replace(/(\d+)$/, p === 1 ? '' : '$1')}x` : ''}${plus(q)}`;
  return {
    stem: `<span class="eq">f(x) = ${fx}</span> is continuous everywhere and has exactly `
      + 'one real root. The Intermediate Value Theorem traps it between two '
      + 'consecutive integers. What is the smaller one?',
    kind: 'numeric',
    answer: n,
    tol: 1e-9,
    answerHtml: `${minus(n)} - the root is between ${minus(n)} and ${minus(n + 1)}`,
    probe: { type: 'ivt', f: `x^3 + ${p}*x + ${q}` },
    hints: ['Evaluate f at whole numbers until the sign changes.',
      'IVT needs two things said out loud: f is continuous on [a, b], and f(a) and f(b) have opposite signs.'],
    steps: [
      { title: 'Why IVT applies', html: 'f is a polynomial, so it is continuous on every closed interval.' },
      { title: 'Find a sign change',
        html: `f(${minus(n)}) = ${minus(g(n))} and f(${minus(n + 1)}) = ${minus(g(n + 1))}` },
      { title: 'Conclude',
        html: `0 is between ${minus(g(n))} and ${minus(g(n + 1))}, so f(c) = 0 for some c in (${minus(n)}, ${minus(n + 1)}).` },
    ],
  };
}

/* A2. L'Hospital's rule. Every form here is 0/0 or infinity/infinity BY
   CONSTRUCTION, and the first hint always says to check that - applying
   the rule to a limit that is not indeterminate is the classic way to
   get a confident wrong answer. */
export function lhopital(rng, level) {
  const k = rng.int(2, 7);
  let m = rng.int(2, 7);
  if (m === k) m = k + 1;
  const kx = `${k}x`;
  const forms = level === 1 ? ['sin', 'exp', 'ln'] : level === 2 ? ['cos', 'exp2', 'quiz'] : ['tan3', 'sintan', 'lnpow', 'xlnx'];
  const form = rng.pick(forms);
  const q = (top, bot) => frac(top, bot);
  const out = (to, body, answer, answerHtml, text, at, steps, extra = {}) => ({
    stem: `Find the limit using L’Hospital’s Rule: ${lim(to, body)}`,
    kind: 'numeric',
    answer,
    tol: 1e-9,
    answerHtml,
    probe: { type: 'limit', f: text, at, ...extra },
    hints: ['Substitute first. L’Hospital only applies if you get 0/0 or ∞/∞.',
      'Differentiate the top and the bottom SEPARATELY - this is not the quotient rule.'],
    steps,
  });
  /* Reduced, and a whole number when it is one: 36/2 is 18. */
  const ratio = (a, b) => {
    let x = Math.abs(a); let y = Math.abs(b);
    while (y) { [x, y] = [y, x % y]; }
    return b / x === 1 ? String(a / x) : frac(String(a / x), String(b / x));
  };

  if (form === 'sin') {
    return out('0', q(`sin(${kx})`, `${m}x`), k / m, ratio(k, m), `sin(${k}*x)/(${m}*x)`, 0, [
      { title: 'Check the form', html: 'sin(0) = 0 on top and 0 underneath: 0/0.' },
      { title: 'Differentiate top and bottom', html: q(`${k}cos(${kx})`, String(m)) },
      { title: 'Substitute', html: `${q(`${k}·1`, String(m))} = ${ratio(k, m)}` },
    ]);
  }
  if (form === 'exp') {
    return out('0', q(`e${sup(kx)} − 1`, `${m}x`), k / m, ratio(k, m), `(e^(${k}*x) - 1)/(${m}*x)`, 0, [
      { title: 'Check the form', html: `e${sup('0')} − 1 = 0 on top and 0 underneath: 0/0.` },
      { title: 'Differentiate top and bottom', html: q(`${k}e${sup(kx)}`, String(m)) },
      { title: 'Substitute', html: ratio(k, m) },
    ]);
  }
  if (form === 'ln') {
    return out('1', q(`${k} ln x`, `${m}(x − 1)`), k / m, ratio(k, m), `${k}*ln(x)/(${m}*(x - 1))`, 1, [
      { title: 'Check the form', html: 'ln 1 = 0 on top and 0 underneath: 0/0.' },
      { title: 'Differentiate top and bottom', html: q(`${k}/x`, String(m)) },
      { title: 'Substitute x = 1', html: ratio(k, m) },
    ]);
  }
  if (form === 'cos') {
    return out('0', q(`1 − cos(${kx})`, `x${sup(2)}`), k * k / 2, ratio(k * k, 2), `(1 - cos(${k}*x))/(x^2)`, 0, [
      { title: 'Check the form', html: '1 − cos 0 = 0 over 0: 0/0.' },
      { title: 'First pass', html: `${q(`${k} sin(${kx})`, '2x')} - still 0/0, so go again.` },
      { title: 'Second pass', html: `${q(`${k * k} cos(${kx})`, '2')} → ${ratio(k * k, 2)}` },
    ]);
  }
  if (form === 'exp2') {
    return out('0', q(`e${sup(kx)} − 1 − ${kx}`, `x${sup(2)}`), k * k / 2, ratio(k * k, 2),
      `(e^(${k}*x) - 1 - ${k}*x)/(x^2)`, 0, [
        { title: 'Check the form', html: '1 − 1 − 0 = 0 over 0: 0/0.' },
        { title: 'First pass', html: `${q(`${k}e${sup(kx)} − ${k}`, '2x')} - still 0/0, so go again.` },
        { title: 'Second pass', html: `${q(`${k * k}e${sup(kx)}`, '2')} → ${ratio(k * k, 2)}` },
      ]);
  }
  if (form === 'quiz') {
    /* Quiz 7 question 2, with the constants free. */
    return out('π/2', q(`${k}(1 − sin x)`, `${m} cos x`), 0, '0',
      `${k}*(1 - sin(x))/(${m}*cos(x))`, Math.PI / 2, [
        { title: 'Check the form', html: '1 − sin(π/2) = 0 and cos(π/2) = 0: 0/0.' },
        { title: 'Differentiate top and bottom', html: q(`−${k} cos x`, `−${m} sin x`) },
        { title: 'Substitute x = π/2', html: `${q(`${k}·0`, `${m}·1`)} = 0` },
      ]);
  }
  if (form === 'tan3') {
    return out('0', q(`tan(${kx}) − ${kx}`, `x${sup(3)}`), k * k * k / 3, ratio(k * k * k, 3),
      `(tan(${k}*x) - ${k}*x)/(x^3)`, 0, [
        { title: 'Check the form', html: '0 − 0 over 0: 0/0.' },
        { title: 'First pass', html: `${q(`${k} sec${sup(2)}(${kx}) − ${k}`, `3x${sup(2)}`)} - still 0/0.` },
        { title: 'Use sec² − 1 = tan²', html: q(`${k} tan${sup(2)}(${kx})`, `3x${sup(2)}`) },
        { title: 'tan(kx)/x → k', html: `${q(`${k}·${k * k}`, '3')} = ${ratio(k * k * k, 3)}` },
      ]);
  }
  if (form === 'sintan') {
    return out('0', q(`sin(${kx})`, `tan(${m}x)`), k / m, ratio(k, m), `sin(${k}*x)/tan(${m}*x)`, 0, [
      { title: 'Check the form', html: '0 over 0: 0/0.' },
      { title: 'Differentiate top and bottom', html: q(`${k} cos(${kx})`, `${m} sec${sup(2)}(${m}x)`) },
      { title: 'Substitute', html: ratio(k, m) },
    ]);
  }
  if (form === 'lnpow') {
    return out('∞', q(`${k} ln x`, `x${sup(m)}`), 0, '0', `${k}*ln(x)/(x^${m})`, Infinity, [
      { title: 'Check the form', html: 'Both grow without bound: ∞/∞.' },
      { title: 'Differentiate top and bottom', html: `${q(`${k}/x`, `${m}x${sup(m - 1)}`)} = ${q(String(k), `${m}x${sup(m)}`)}` },
      { title: 'Let x grow', html: 'The bottom grows without bound, so the limit is 0.' },
    ]);
  }
  /* x ln x is 0 times minus infinity, which has to be REWRITTEN as a
     quotient before the rule can be used at all. */
  return {
    ...out(`0${sup('+')}`, `${k}x ln x`, 0, '0', `${k}*x*ln(x)`, 0, [
      { title: 'Check the form', html: '0 · (−∞) - indeterminate, but not yet a quotient.' },
      { title: 'Rewrite as a quotient', html: `${q(`${k} ln x`, '1/x')}, which is ∞/∞` },
      { title: 'Differentiate top and bottom', html: `${q(`${k}/x`, `−1/x${sup(2)}`)} = −${kx}` },
      { title: 'Let x → 0', html: '0' },
    ], { side: 'right' }),
    hints: ['This is 0 · ∞, which L’Hospital cannot be applied to directly.',
      'Move one factor into the denominator as a reciprocal: x ln x = (ln x)/(1/x).'],
  };
}

/* A3. Absolute extrema on a closed interval - the Extreme Value Theorem.
   Built backward from the critical points: f'(x) = 3(x - p)(x - q), so
   they are whole numbers, and p + q is kept even so the coefficients are
   too. The interval is chosen so the answer is sometimes at a critical
   point and sometimes at an endpoint, because "check the endpoints" is
   the half of the method that gets forgotten. */
export function absoluteExtrema(rng, level) {
  const wantMax = rng.pick([true, false]);
  let f; let fx; let a; let b; let crit; let text;
  if (level === 1) {
    /* A parabola: one critical point. */
    const h = rng.int(-4, 4);
    const k = rng.int(-9, 9);
    const up = rng.pick([1, -1]);
    f = (x) => up * (x - h) * (x - h) + k;
    const B = -2 * up * h;
    const C = up * h * h + k;
    fx = `${up === 1 ? '' : '−'}x${sup(2)}${B ? `${plus(B).replace(/(\d+)$/, Math.abs(B) === 1 ? '' : '$1')}x` : ''}${plus(C)}`;
    text = `${up}*x^2 + ${B}*x + ${C}`;
    a = h - rng.int(1, 3);
    b = h + rng.int(2, 5);
    crit = [h];
  } else {
    const p = rng.int(-5, 1);
    const q = p + 2 * rng.int(1, 3);
    const c = rng.int(-6, 6);
    const B = -3 * (p + q) / 2;
    const C = 3 * p * q;
    f = (x) => x * x * x + B * x * x + C * x + c;
    fx = `x${sup(3)}${B ? `${plus(B).replace(/(\d+)$/, Math.abs(B) === 1 ? '' : '$1')}x${sup(2)}` : ''}`
      + `${C ? `${plus(C).replace(/(\d+)$/, Math.abs(C) === 1 ? '' : '$1')}x` : ''}${plus(c)}`;
    text = `x^3 + ${B}*x^2 + ${C}*x + ${c}`;
    if (level === 2) {
      /* Only one of the two critical points inside. */
      a = p - rng.int(1, 2);
      b = p + rng.int(1, q - p - 1 || 1);
      if (b >= q) b = q - 1;
    } else {
      a = p - rng.int(1, 3);
      b = q + rng.int(1, 3);
    }
    crit = [p, q];
  }
  const inside = crit.filter((x) => x > a && x < b);
  const candidates = [a, ...inside, b];
  const values = candidates.map(f);
  const answer = wantMax ? Math.max(...values) : Math.min(...values);
  const where = candidates[values.indexOf(answer)];
  return {
    stem: `Find the absolute ${wantMax ? 'maximum' : 'minimum'} VALUE of `
      + `<span class="eq">f(x) = ${fx}</span> on the interval [${minus(a)}, ${minus(b)}].`,
    kind: 'numeric',
    answer,
    tol: 1e-9,
    answerHtml: `${minus(answer)}, at x = ${minus(where)}`,
    probe: { type: 'extreme', f: text, a, b, max: wantMax },
    hints: ['A continuous function on a closed interval has both, and they can only be at a critical point or an endpoint.',
      'Solve f′(x) = 0, throw away anything outside the interval, then compare f at what is left AND at both ends.'],
    steps: [
      { title: 'Critical points', html: `f′(x) = 0 at x = ${crit.map(minus).join(' and ')}` },
      { title: 'Keep the ones inside the interval',
        html: inside.length ? `x = ${inside.map(minus).join(' and ')}` : 'None of them is inside.' },
      { title: 'Compare the candidates',
        html: candidates.map((x, i) => `f(${minus(x)}) = ${minus(values[i])}`).join(', ') },
      { title: 'Read off the answer',
        html: `The ${wantMax ? 'largest' : 'smallest'} is ${minus(answer)}, at x = ${minus(where)}.` },
    ],
  };
}

/* A8. The Mean Value Theorem: the c where the tangent is parallel to the
   chord. Three families, each chosen because c comes out exact - a
   parabola (c is the midpoint, which is worth noticing), x^3 + px on
   [-k, 2k] where c = k, and a square root on [a^2, b^2]. */
export function meanValue(rng, level) {
  let fx; let text; let a; let b; let c; let steps;
  if (level === 1) {
    const B = rng.int(-6, 6);
    const C = rng.int(-9, 9);
    a = rng.int(-4, 2);
    b = a + 2 * rng.int(1, 3);
    c = (a + b) / 2;
    fx = `x${sup(2)}${B ? `${plus(B).replace(/(\d+)$/, Math.abs(B) === 1 ? '' : '$1')}x` : ''}${plus(C)}`;
    text = `x^2 + ${B}*x + ${C}`;
    const slope = a + b + B;
    steps = [
      { title: 'Average rate of change', html: `${frac('f(b) − f(a)', 'b − a')} = ${minus(slope)}` },
      { title: 'Set f′(c) equal to it', html: `2c${plus(B)} = ${minus(slope)}` },
      { title: 'Solve', html: `c = ${minus(c)} - the midpoint, which is always true of a parabola` },
    ];
  } else if (level === 2) {
    const k = rng.int(1, 4);
    const p = rng.int(-5, 5);
    const q = rng.int(-6, 6);
    a = -k; b = 2 * k; c = k;
    fx = `x${sup(3)}${p ? `${plus(p).replace(/(\d+)$/, Math.abs(p) === 1 ? '' : '$1')}x` : ''}${plus(q)}`;
    text = `x^3 + ${p}*x + ${q}`;
    const slope = 3 * k * k + p;
    steps = [
      { title: 'Average rate of change', html: `${frac('f(b) − f(a)', 'b − a')} = ${minus(slope)}` },
      { title: 'Set f′(c) equal to it', html: `3c${sup(2)}${plus(p)} = ${minus(slope)}, so c${sup(2)} = ${k * k}` },
      { title: 'Keep the one INSIDE the interval',
        html: `c = ±${k}, and −${k} is an endpoint, not inside. So c = ${k}.` },
    ];
  } else {
    const lo = rng.int(1, 4);
    const hi = lo + 2 * rng.int(1, 3);
    const m = rng.int(1, 4);
    a = lo * lo; b = hi * hi; c = (lo + hi) * (lo + hi) / 4;
    fx = `${m === 1 ? '' : m}${sqrt('x')}`;
    text = `${m}*sqrt(x)`;
    steps = [
      { title: 'Average rate of change',
        html: `${frac(`${m * hi} − ${m * lo}`, `${b} − ${a}`)} = ${frac(String(m), String(lo + hi))}` },
      { title: 'Set f′(c) equal to it',
        html: `${frac(String(m), `2${sqrt('c')}`)} = ${frac(String(m), String(lo + hi))}, so ${sqrt('c')} = ${frac(String(lo + hi), '2')}` },
      { title: 'Solve', html: `c = ${num(c)}` },
    ];
  }
  return {
    stem: `<span class="eq">f(x) = ${fx}</span> on [${minus(a)}, ${minus(b)}]. Find the value of c `
      + 'that the Mean Value Theorem guarantees.',
    kind: 'numeric',
    answer: c,
    tol: 1e-9,
    answerHtml: `c = ${minus(c)}`,
    probe: { type: 'mvt', f: text, a, b },
    hints: ['MVT: somewhere inside, the instantaneous rate equals the average rate over the whole interval.',
      'Work out (f(b) − f(a))/(b − a) first, then solve f′(c) = that number - and keep only a c strictly between a and b.'],
    steps,
  };
}

/* A9. Linear approximation, and differentials for a maximum error.
   The numbers are chosen so the ESTIMATE is exact to write down - the
   square root of 25.2 is about 5.02 - because the answer being marked is
   the tangent-line value, not the true one, and a key rounded from the
   true value would mark the method wrong. */
export function linearApprox(rng, level) {
  if (level === 1) {
    const a = rng.int(2, 9);
    const t = rng.pick([0.01, 0.02, 0.05, -0.01, -0.02, -0.05]);
    const dx = 2 * a * t;
    const x = a * a + dx;
    const est = a + t;
    return {
      stem: `Use linear approximation to estimate <span class="eq">${sqrt(num(x))}</span>.`,
      kind: 'numeric',
      answer: est,
      tol: 1e-9,
      answerHtml: num(est),
      probe: { type: 'linear', f: 'sqrt(x)', at: a * a, x },
      hints: [`Pick the nearest value you can take the root of exactly: ${a * a}.`,
        'L(x) = f(a) + f′(a)(x − a), with f(x) = √x.'],
      steps: [
        { title: 'Choose a', html: `a = ${a * a}, so f(a) = ${a}` },
        { title: 'The slope there', html: `f′(x) = ${frac('1', `2${sqrt('x')}`)}, so f′(${a * a}) = ${frac('1', String(2 * a))}` },
        { title: 'The tangent line at the new point',
          html: `${a} + ${frac('1', String(2 * a))}(${minus(dx)}) = ${num(est)}` },
      ],
    };
  }
  if (level === 2) {
    const a = rng.int(2, 5);
    const t = rng.pick([0.01, 0.02, -0.01, -0.02]);
    const dx = 3 * a * a * t;
    const x = a * a * a + dx;
    const est = a + t;
    return {
      stem: `Use linear approximation to estimate the cube root of ${num(x)}.`,
      kind: 'numeric',
      answer: est,
      tol: 1e-9,
      answerHtml: num(est),
      probe: { type: 'linear', f: 'x^(1/3)', at: a * a * a, x },
      hints: [`The nearest perfect cube is ${a * a * a}.`,
        `L(x) = f(a) + f′(a)(x − a), with f(x) = x${sup('1/3')}.`],
      steps: [
        { title: 'Choose a', html: `a = ${a * a * a}, so f(a) = ${a}` },
        { title: 'The slope there', html: `f′(x) = ${frac('1', `3x${sup('2/3')}`)}, so f′(${a * a * a}) = ${frac('1', String(3 * a * a))}` },
        { title: 'The tangent line at the new point',
          html: `${a} + ${frac('1', String(3 * a * a))}(${minus(dx)}) = ${num(est)}` },
      ],
    };
  }
  /* Differentials: the maximum error in something computed from a
     measurement that is itself a little off. */
  const s = rng.int(3, 12);
  const e = rng.pick([0.01, 0.02, 0.05, 0.1]);
  const kind = rng.pick(['cube', 'square', 'sphere']);
  if (kind === 'cube') {
    const dV = 3 * s * s * e;
    return {
      stem: `The edge of a cube is measured as ${s} cm, with a possible error of ${num(e)} cm. `
        + 'Use differentials to estimate the maximum error in the computed volume, in cm³.',
      kind: 'numeric', answer: dV, tol: 1e-9, answerHtml: `${num(dV)} cm${sup(3)}`,
      probe: { type: 'differential', f: 'x^3', at: s, dx: e },
      hints: ['V = s³, so dV = 3s² ds.', 'ds is the measurement error; dV is what it does to the volume.'],
      steps: [
        { title: 'The formula', html: `V = s${sup(3)}` },
        { title: 'Its differential', html: `dV = 3s${sup(2)} ds` },
        { title: 'Put the numbers in', html: `3(${s})${sup(2)}(${num(e)}) = ${num(dV)}` },
      ],
    };
  }
  if (kind === 'square') {
    const dA = 2 * s * e;
    return {
      stem: `The side of a square is measured as ${s} cm, with a possible error of ${num(e)} cm. `
        + 'Use differentials to estimate the maximum error in the computed area, in cm².',
      kind: 'numeric', answer: dA, tol: 1e-9, answerHtml: `${num(dA)} cm${sup(2)}`,
      probe: { type: 'differential', f: 'x^2', at: s, dx: e },
      hints: ['A = s², so dA = 2s ds.', 'ds is the measurement error; dA is what it does to the area.'],
      steps: [
        { title: 'The formula', html: `A = s${sup(2)}` },
        { title: 'Its differential', html: 'dA = 2s ds' },
        { title: 'Put the numbers in', html: `2(${s})(${num(e)}) = ${num(dA)}` },
      ],
    };
  }
  const coef = 4 * s * s * e;
  return {
    stem: `The radius of a sphere is measured as ${s} cm, with a possible error of ${num(e)} cm. `
      + 'Use differentials to estimate the maximum error in the computed volume. '
      + 'Give the number that multiplies π.',
    kind: 'numeric', answer: coef, tol: 1e-9, answerHtml: `${num(coef)}π cm${sup(3)}`,
    probe: { type: 'differential', f: '4/3*x^3', at: s, dx: e },
    hints: ['V = (4/3)πr³, so dV = 4πr² dr.', 'dr is the measurement error; leave π out of the number you type.'],
    steps: [
      { title: 'The formula', html: `V = ${frac('4', '3')}πr${sup(3)}` },
      { title: 'Its differential', html: `dV = 4πr${sup(2)} dr` },
      { title: 'Put the numbers in', html: `4π(${s})${sup(2)}(${num(e)}) = ${num(coef)}π` },
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

/* Concavity: where the curve changes the way it bends.

   The quick-recall counterpart to the sandbox's three-line version, the
   same way `extrema` here asks "at what x" while the sandbox asks for
   the whole working. Both are wanted: one for a fast pass through a
   topic, one for practising the method.

   Built backward and INTEGRATED TWICE. f'' = 6(x - p) gives
   f = x^3 - 3px^2 + Ax + B, whose coefficients are all whole when p is.

   Level 3 asks the trap: f'' = 12(x - p)^2 vanishes at p and never
   changes sign, so there is NO inflection point - and "set the second
   derivative to zero" gets that wrong every time. */
export function concavity(rng, level) {
  if (level >= 3 && rng() < 0.4) {
    const p = rng.int(-3, 3);
    const c = rng.int(-5, 5);
    /* f = x^4 - 4px^3 + 6p^2x^2 + cx, so f'' = 12(x - p)^2. */
    const f = terms([
      coef(1, `x${sup(4)}`), coef(-4 * p, `x${sup(3)}`),
      coef(6 * p * p, `x${sup(2)}`), coef(c, 'x'),
    ]);
    return {
      stem: `How many inflection points does ${eq('f(x)', f)} have?`,
      kind: 'numeric',
      answer: 0,
      answerHtml: `None. f${sup(2)}\u2033(x) = 12(x ${p >= 0 ? '\u2212' : '+'} `
        + `${Math.abs(p)})${sup(2)}, which touches zero at x = ${p} without `
        + 'crossing it, so the concavity never changes.',
      note: 'f\u2033 = 0 is not enough. The second derivative has to CHANGE SIGN, '
        + 'and a perfect square never does.',
      hints: ['Differentiate twice, then factor what you get.',
        'If the second derivative is a perfect square it cannot change sign.'],
      steps: [
        { title: 'Second derivative', html: `f\u2033(x) = 12x${sup(2)} ${-24 * p >= 0 ? '+' : '\u2212'} ${Math.abs(24 * p)}x + ${12 * p * p}` },
        { title: 'Factor it', html: `12(x ${p >= 0 ? '\u2212' : '+'} ${Math.abs(p)})${sup(2)}` },
        { title: 'Does it change sign?', html: 'No - a square is never negative.' },
      ],
    };
  }

  const p = rng.int(-5, 5);
  const a = rng.int(-6, 6);
  const b = rng.int(-8, 8);
  /* f = x^3 - 3px^2 + ax + b, so f'' = 6x - 6p, zero at x = p. */
  const f = terms([
    coef(1, `x${sup(3)}`), coef(-3 * p, `x${sup(2)}`), coef(a, 'x'), String(b),
  ]);
  return {
    stem: `At what x does ${eq('f(x)', f)} have an inflection point?`,
    kind: 'numeric',
    answer: p,
    answerHtml: `f\u2033(x) = 6x ${-6 * p >= 0 ? '+' : '\u2212'} ${Math.abs(6 * p)}, `
      + `which is zero at x = ${p} and changes sign there.`,
    note: 'An inflection point needs the second derivative to change sign, not '
      + 'just to be zero.',
    hints: ['Inflection points come from the SECOND derivative.',
      `f\u2032(x) = 3x${sup(2)} ${-6 * p >= 0 ? '+' : '\u2212'} ${Math.abs(6 * p)}x `
        + `${a >= 0 ? '+' : '\u2212'} ${Math.abs(a)}, so differentiate once more.`],
    steps: [
      { title: 'Differentiate twice', html: `f\u2033(x) = 6x ${-6 * p >= 0 ? '+' : '\u2212'} ${Math.abs(6 * p)}` },
      { title: 'Set it to zero', html: `x = ${p}` },
      { title: 'Check it crosses', html: 'A linear second derivative always changes sign at its root.' },
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
