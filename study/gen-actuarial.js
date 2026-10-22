/* Exam P and Exam FM generators.

   These follow the SOA syllabus wording and notation as closely as plain HTML
   allows, because recognizing the notation under time pressure is half of what
   the exam measures. a-angle-n is written a&#x332;<sub>n</sub>, the standard
   actuarial accent.

   Money answers are asked to the cent and graded with a tolerance that matches,
   so a correct method with a rounding difference in the last place still counts
   as correct. Rates are asked to 4 decimal places as a decimal, not a percent,
   which is the convention the exam tables use. */

import MathKit from './math.js';

const { sup, frac, sqrt, num, money, pct, nCr, nPr, fact, F } = MathKit;

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
/* Actuarial angle notation. The combining macron-below on the subscript is the
   closest Unicode gets to the bar over n, and it degrades to a plain n. */
const ang = (n) => `<span class="angle">${n}</span>`;
const aImm = (n, i) => `a${ang(n)}`;
const aDue = (n) => `ä${ang(n)}`;
const sImm = (n) => `s${ang(n)}`;

/* ============================================================ Exam P: counting */

export function counting(rng, level) {
  const kind = rng.pick(level === 1 ? ['comb', 'perm'] : ['comb', 'perm', 'word', 'committee']);

  if (kind === 'comb') {
    const n2 = rng.int(6, 12), r = rng.int(2, 4);
    return {
      stem: `A committee of ${r} is chosen from ${n2} people. How many different committees are possible?`,
      kind: 'numeric',
      answer: nCr(n2, r),
      answerHtml: `C(${n2}, ${r}) = ${nCr(n2, r)}`,
      hints: ['A committee has no ranks, so order does not matter. That makes it a combination.',
        `C(${n2}, ${r}) = ${frac(`${n2}!`, `${r}!(${n2 - r})!`)}`],
      steps: [
        { title: 'Order matters?', html: 'No. Swapping two members gives the same committee, so use a combination.' },
        { title: 'Apply the formula', html: `C(${n2}, ${r}) = ${frac(`${n2}!`, `${r}! · ${n2 - r}!`)} = ${nCr(n2, r)}` },
      ],
    };
  }

  if (kind === 'perm') {
    const n2 = rng.int(5, 10), r = rng.int(2, 4);
    return {
      stem: `${n2} runners finish a race. How many different ways can the top ${r} places be filled?`,
      kind: 'numeric',
      answer: nPr(n2, r),
      answerHtml: `P(${n2}, ${r}) = ${nPr(n2, r)}`,
      note: 'First and second are different outcomes, so this one is ordered.',
      hints: ['Finishing first is not the same as finishing second, so order matters: permutation.',
        `P(${n2}, ${r}) = ${n2} × ${n2 - 1}${r > 2 ? ` × ${n2 - 2}` : ''}${r > 3 ? ` × ${n2 - 3}` : ''}`],
      steps: [
        { title: 'Order matters?', html: 'Yes. Gold and silver are distinguishable, so use a permutation.' },
        { title: 'Count the choices', html: `${Array.from({ length: r }, (_, k) => n2 - k).join(' × ')} = ${nPr(n2, r)}` },
      ],
    };
  }

  if (kind === 'word') {
    /* Arrangements of a word with repeated letters. */
    const words = [['LEVEL', 5, [2, 2, 1]], ['BANANA', 6, [3, 2, 1]], ['SUCCESS', 7, [3, 2, 1, 1]],
      ['MISSISSIPPI', 11, [4, 4, 2, 1]], ['COFFEE', 6, [2, 2, 1, 1]]];
    const [w, n2, reps] = rng.pick(words);
    const denom = reps.reduce((acc, r) => acc * fact(r), 1);
    const val = fact(n2) / denom;
    return {
      stem: `How many distinct arrangements are there of the letters in ${w}?`,
      kind: 'numeric',
      answer: val,
      answerHtml: `${frac(`${n2}!`, reps.filter((r) => r > 1).map((r) => `${r}!`).join(' · ') || '1')} = ${val}`,
      note: 'Divide by a factorial for each repeated letter, or you count the same arrangement many times.',
      hints: [`There are ${n2} letters, so ${n2}! orderings if they were all different.`,
        `But the repeats (${reps.filter((r) => r > 1).join(', ')} of a kind) are indistinguishable, so divide by ${reps.filter((r) => r > 1).map((r) => `${r}!`).join(' · ')}.`],
      steps: [
        { title: 'If every letter were distinct', html: `${n2}! = ${fact(n2)}` },
        { title: 'Correct for repeats', html: `÷ ${reps.filter((r) => r > 1).map((r) => `${r}!`).join(' · ')} = ÷ ${denom}` },
        { title: 'Result', html: String(val) },
      ],
    };
  }

  /* Committee with a constraint: choose from two groups. */
  const m = rng.int(4, 8), w = rng.int(4, 8);
  const km = rng.int(1, 3), kw = rng.int(1, 3);
  const val = nCr(m, km) * nCr(w, kw);
  return {
    stem: `A committee of ${km + kw} must have exactly ${km} from a group of ${m} and ${kw} from a group of ${w}. `
      + `How many committees are possible?`,
    kind: 'numeric',
    answer: val,
    answerHtml: `C(${m}, ${km}) · C(${w}, ${kw}) = ${nCr(m, km)} · ${nCr(w, kw)} = ${val}`,
    hints: ['Choose from each group separately, then multiply: every choice from one pairs with every choice from the other.',
      `C(${m}, ${km}) = ${nCr(m, km)} and C(${w}, ${kw}) = ${nCr(w, kw)}.`],
    steps: [
      { title: 'First group', html: `C(${m}, ${km}) = ${nCr(m, km)}` },
      { title: 'Second group', html: `C(${w}, ${kw}) = ${nCr(w, kw)}` },
      { title: 'Multiply', html: `${nCr(m, km)} × ${nCr(w, kw)} = ${val}` },
    ],
  };
}

export function probBasic(rng, level) {
  const kind = rng.pick(level === 1 ? ['union', 'complement'] : ['union', 'complement', 'incexc']);

  if (kind === 'complement') {
    const p = rng.int(15, 85) / 100;
    return {
      stem: `P(A) = ${num(p)}. What is P(A′)?`,
      kind: 'numeric',
      answer: 1 - p,
      tol: 1e-6,
      answerHtml: num(1 - p),
      hints: ['The complement is everything else, and all probability sums to 1.',
        `1 − ${num(p)}`],
      steps: [{ title: 'Complement rule', html: `P(A′) = 1 − P(A) = 1 − ${num(p)} = ${num(1 - p)}` }],
    };
  }

  if (kind === 'union') {
    const pa = rng.int(20, 50) / 100;
    const pb = rng.int(20, 50) / 100;
    const pab = rng.int(5, Math.round(Math.min(pa, pb) * 100)) / 100;
    const val = pa + pb - pab;
    return {
      stem: `P(A) = ${num(pa)}, P(B) = ${num(pb)}, and P(A ∩ B) = ${num(pab)}. Find P(A ∪ B).`,
      kind: 'numeric',
      answer: val,
      tol: 1e-6,
      answerHtml: num(val),
      note: 'Subtract the overlap, or you count it twice.',
      hints: ['P(A ∪ B) = P(A) + P(B) − P(A ∩ B).',
        `${num(pa)} + ${num(pb)} − ${num(pab)}`],
      steps: [
        { title: 'Addition rule', html: `P(A ∪ B) = P(A) + P(B) − P(A ∩ B)` },
        { title: 'Substitute', html: `= ${num(pa)} + ${num(pb)} − ${num(pab)} = ${num(val)}` },
        { title: 'Why subtract', html: 'Adding P(A) and P(B) counts the overlap in both totals, so it has to come out once.' },
      ],
    };
  }

  /* Three-set inclusion-exclusion, built from disjoint regions so it is consistent. */
  const r = Array.from({ length: 7 }, () => rng.int(2, 14));
  const total = r.reduce((a, b) => a + b, 0) + rng.int(5, 20);
  const [abc, ab, ac, bc, aOnly, bOnly, cOnly] = r;
  const pa = (aOnly + ab + ac + abc) / total;
  const pb = (bOnly + ab + bc + abc) / total;
  const pc = (cOnly + ac + bc + abc) / total;
  const pab = (ab + abc) / total, pac = (ac + abc) / total, pbc = (bc + abc) / total;
  const pabc = abc / total;
  const val = pa + pb + pc - pab - pac - pbc + pabc;
  return {
    stem: `In a group of ${total} people: ${aOnly + ab + ac + abc} own a car, ${bOnly + ab + bc + abc} own a bike, `
      + `${cOnly + ac + bc + abc} own a scooter, ${ab + abc} own both a car and a bike, ${ac + abc} own both a car and a scooter, `
      + `${bc + abc} own both a bike and a scooter, and ${abc} own all three. `
      + `What is the probability a randomly chosen person owns at least one?`
      + `<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: val,
    tol: 2e-4,
    answerHtml: `${num(val, 4)} (that is ${r.reduce((a, b) => a + b, 0)} of ${total})`,
    hints: ['Inclusion-exclusion for three sets: add the singles, subtract the pairs, add the triple back.',
      `${aOnly + ab + ac + abc} + ${bOnly + ab + bc + abc} + ${cOnly + ac + bc + abc} − ${ab + abc} − ${ac + abc} − ${bc + abc} + ${abc} = ${r.reduce((a, b) => a + b, 0)}`],
    steps: [
      { title: 'Inclusion-exclusion', html: `|A ∪ B ∪ C| = |A| + |B| + |C| − |AB| − |AC| − |BC| + |ABC|` },
      { title: 'Count', html: `= ${r.reduce((a, b) => a + b, 0)} people own at least one` },
      { title: 'Probability', html: `${frac(String(r.reduce((a, b) => a + b, 0)), String(total))} = ${num(val, 4)}` },
    ],
  };
}

export function probConditional(rng, level) {
  const pab = rng.int(10, 30) / 100;
  const pb = rng.int(35, 70) / 100;
  const val = pab / pb;
  if (level >= 2 && rng() < 0.4) {
    /* Independence check, which tests understanding rather than arithmetic. */
    const pa = rng.int(20, 60) / 100;
    const independent = rng() < 0.5;
    const joint = independent ? pa * pb : Math.min(0.95, pa * pb + rng.int(5, 15) / 100);
    const correct = independent ? 'Independent' : 'Not independent';
    return {
      stem: `P(A) = ${num(pa)}, P(B) = ${num(pb)}, P(A ∩ B) = ${num(joint, 4)}. Are A and B independent?`,
      kind: 'choice',
      choices: mc(rng, correct, ['Not independent', 'Independent', 'Cannot be determined from this information']),
      answerHtml: `${correct}. P(A)P(B) = ${num(pa * pb, 4)}, and P(A ∩ B) = ${num(joint, 4)}.`,
      hints: ['Independence means the joint probability is exactly the product of the two.',
        `P(A)·P(B) = ${num(pa, 4)} × ${num(pb, 4)} = ${num(pa * pb, 4)}. Compare with ${num(joint, 4)}.`],
      steps: [
        { title: 'The test', html: 'A and B are independent exactly when P(A ∩ B) = P(A)P(B).' },
        { title: 'Compute the product', html: `${num(pa)} × ${num(pb)} = ${num(pa * pb, 4)}` },
        { title: 'Compare', html: `${num(joint, 4)} ${independent ? '=' : '≠'} ${num(pa * pb, 4)}, so they are ${independent ? '' : 'not '}independent.` },
      ],
    };
  }
  return {
    stem: `P(A ∩ B) = ${num(pab)} and P(B) = ${num(pb)}. Find P(A | B).`
      + `<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: val,
    tol: 2e-4,
    answerHtml: num(val, 4),
    hints: ['Conditioning on B means restricting the sample space to B.',
      `P(A | B) = ${frac('P(A ∩ B)', 'P(B)')} = ${frac(num(pab), num(pb))}`],
    steps: [
      { title: 'Definition', html: `P(A | B) = ${frac('P(A ∩ B)', 'P(B)')}` },
      { title: 'Substitute', html: `= ${frac(num(pab), num(pb))} = ${num(val, 4)}` },
      { title: 'Sanity check', html: 'A conditional probability is always at least as large as the joint it came from, since the denominator is at most 1.' },
    ],
  };
}

export function bayes(rng, level) {
  /* The classic screening-test setup, where the intuitive answer is badly
     wrong and the point is to see how much the base rate matters. */
  const prev = rng.pick([0.001, 0.002, 0.005, 0.01, 0.02]);
  const sens = rng.pick([0.95, 0.98, 0.99]);
  const spec = rng.pick([0.90, 0.95, 0.97, 0.99]);
  const tp = prev * sens;
  const fp = (1 - prev) * (1 - spec);
  const val = tp / (tp + fp);
  return {
    stem: `A disease affects ${pct(prev, 3)} of a population. A test detects it ${pct(sens, 1)} of the time when present, `
      + `and correctly returns negative ${pct(spec, 1)} of the time when absent. `
      + `A randomly chosen person tests positive. What is the probability they have the disease?`
      + `<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: val,
    tol: 2e-4,
    answerHtml: `${num(val, 4)}, or about ${pct(val, 1)}`,
    note: 'With a rare disease, most positives are false positives even with an excellent test. The base rate dominates.',
    hints: ['Split the positives into two groups: true positives and false positives.',
      `True positives: ${num(prev, 4)} × ${num(sens)} = ${num(tp, 6)}. False positives: ${num(1 - prev, 4)} × ${num(1 - spec, 4)} = ${num(fp, 6)}.`],
    steps: [
      { title: 'True positives', html: `P(disease)·P(+|disease) = ${num(prev, 4)} × ${num(sens)} = ${num(tp, 6)}` },
      { title: 'False positives', html: `P(no disease)·P(+|no disease) = ${num(1 - prev, 4)} × ${num(1 - spec, 4)} = ${num(fp, 6)}` },
      { title: 'Bayes', html: `P(disease | +) = ${frac(num(tp, 6), `${num(tp, 6)} + ${num(fp, 6)}`)} = ${num(val, 4)}` },
      { title: 'Read it', html: `Only about ${pct(val, 1)} of positives are real, because there are so many more healthy people to generate false alarms.` },
    ],
  };
}

export function discreteDist(rng, level) {
  const kind = rng.pick(level === 1 ? ['binomial'] : ['binomial', 'poisson', 'geometric', 'hyper']);

  if (kind === 'binomial') {
    const n2 = rng.int(5, 12);
    const p = rng.pick([0.2, 0.25, 0.3, 0.4, 0.5, 0.6]);
    const k = rng.int(1, Math.min(5, n2 - 1));
    const val = nCr(n2, k) * Math.pow(p, k) * Math.pow(1 - p, n2 - k);
    return {
      stem: `X ~ Binomial(n = ${n2}, p = ${p}). Find P(X = ${k}).`
        + `<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 2e-4,
      answerHtml: `C(${n2}, ${k})(${p})${sup(k)}(${num(1 - p)})${sup(n2 - k)} = ${num(val, 4)}`,
      hints: [`The binomial pmf is C(n, k) p${sup('k')}(1 − p)${sup('n−k')}.`,
        `C(${n2}, ${k}) = ${nCr(n2, k)}, so you need ${nCr(n2, k)} × ${p}${sup(k)} × ${num(1 - p)}${sup(n2 - k)}.`],
      steps: [
        { title: 'The pmf', html: `P(X = k) = C(n, k) p${sup('k')}(1−p)${sup('n−k')}` },
        { title: 'Count the arrangements', html: `C(${n2}, ${k}) = ${nCr(n2, k)}` },
        { title: 'Multiply', html: `${nCr(n2, k)} × ${num(Math.pow(p, k), 6)} × ${num(Math.pow(1 - p, n2 - k), 6)} = ${num(val, 4)}` },
      ],
    };
  }

  if (kind === 'poisson') {
    const lam = rng.pick([1.5, 2, 2.5, 3, 4, 5]);
    const k = rng.int(0, 5);
    const val = (Math.exp(-lam) * Math.pow(lam, k)) / fact(k);
    return {
      stem: `X ~ Poisson(λ = ${lam}). Find P(X = ${k}).`
        + `<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 2e-4,
      answerHtml: `${frac(`e${sup(`−${lam}`)} · ${lam}${sup(k)}`, `${k}!`)} = ${num(val, 4)}`,
      hints: [`The Poisson pmf is ${frac(`e${sup('−λ')}λ${sup('k')}`, 'k!')}.`,
        `e${sup(`−${lam}`)} = ${num(Math.exp(-lam), 6)} and ${k}! = ${fact(k)}.`],
      steps: [
        { title: 'The pmf', html: `P(X = k) = ${frac(`e${sup('−λ')}λ${sup('k')}`, 'k!')}` },
        { title: 'Substitute', html: `${frac(`${num(Math.exp(-lam), 6)} × ${num(Math.pow(lam, k), 4)}`, String(fact(k)))}` },
        { title: 'Evaluate', html: num(val, 4) },
      ],
    };
  }

  if (kind === 'geometric') {
    const p = rng.pick([0.1, 0.15, 0.2, 0.25, 0.3, 0.4]);
    const k = rng.int(2, 6);
    /* First success on trial k: (1-p)^(k-1) p */
    const val = Math.pow(1 - p, k - 1) * p;
    return {
      stem: `Independent trials each succeed with probability ${p}. What is the probability the first success is on trial ${k}?`
        + `<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 2e-4,
      answerHtml: `(${num(1 - p)})${sup(k - 1)}(${p}) = ${num(val, 4)}`,
      hints: [`You need ${k - 1} failures first, then one success.`,
        `(${num(1 - p)})${sup(k - 1)} × ${p}`],
      steps: [
        { title: 'What has to happen', html: `${k - 1} failures in a row, then a success.` },
        { title: 'Multiply the independent probabilities', html: `(${num(1 - p)})${sup(k - 1)} × ${p} = ${num(val, 4)}` },
      ],
    };
  }

  /* Hypergeometric: drawing without replacement. */
  const N = rng.int(10, 20);
  const K = rng.int(3, Math.min(8, N - 3));
  const n2 = rng.int(3, Math.min(7, N - 1));
  const k = rng.int(1, Math.min(K, n2));
  const val = (nCr(K, k) * nCr(N - K, n2 - k)) / nCr(N, n2);
  return {
    stem: `An urn holds ${N} balls, ${K} of them red. ${n2} are drawn without replacement. `
      + `Find the probability that exactly ${k} are red.`
      + `<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: val,
    tol: 2e-4,
    answerHtml: `${frac(`C(${K}, ${k}) · C(${N - K}, ${n2 - k})`, `C(${N}, ${n2})`)} = ${num(val, 4)}`,
    note: 'Without replacement means hypergeometric, not binomial. The draws are not independent.',
    hints: ['Choose the red ones and the non-red ones separately, over all ways to choose the sample.',
      `C(${K}, ${k}) = ${nCr(K, k)}, C(${N - K}, ${n2 - k}) = ${nCr(N - K, n2 - k)}, C(${N}, ${n2}) = ${nCr(N, n2)}.`],
    steps: [
      { title: 'Favorable', html: `C(${K}, ${k}) · C(${N - K}, ${n2 - k}) = ${nCr(K, k)} × ${nCr(N - K, n2 - k)} = ${nCr(K, k) * nCr(N - K, n2 - k)}` },
      { title: 'Total', html: `C(${N}, ${n2}) = ${nCr(N, n2)}` },
      { title: 'Divide', html: num(val, 4) },
    ],
  };
}

/* Standard normal CDF. Zelen & Severo 26.2.17 gives about 7 decimal places,
   which is more than the exam tables carry, so a student working from a printed
   table and this app will agree. */
function normCdf(z) {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t
    + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export function continuousDist(rng, level) {
  const kind = rng.pick(level === 1 ? ['uniform', 'exponential'] : ['uniform', 'exponential', 'normal']);

  if (kind === 'uniform') {
    const a = rng.int(0, 10);
    const b = a + rng.int(5, 20);
    const lo = a + rng.int(1, Math.floor((b - a) / 2));
    const hi = lo + rng.int(1, b - lo);
    const val = (hi - lo) / (b - a);
    return {
      stem: `X is uniform on [${a}, ${b}]. Find P(${lo} ≤ X ≤ ${hi}).`
        + `<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 2e-4,
      answerHtml: `${frac(`${hi} − ${lo}`, `${b} − ${a}`)} = ${num(val, 4)}`,
      hints: ['For a uniform distribution, probability is just the fraction of the interval you are asking about.',
        `${frac(String(hi - lo), String(b - a))}`],
      steps: [
        { title: 'Uniform density', html: `f(x) = ${frac('1', `${b} − ${a}`)} = ${frac('1', String(b - a))} on [${a}, ${b}]` },
        { title: 'Length of the target interval', html: `${hi} − ${lo} = ${hi - lo}` },
        { title: 'Probability', html: `${frac(String(hi - lo), String(b - a))} = ${num(val, 4)}` },
      ],
    };
  }

  if (kind === 'exponential') {
    const mean = rng.pick([2, 2.5, 4, 5, 10]);
    const lam = 1 / mean;
    const t = rng.int(1, Math.round(mean * 2));
    const ask = rng.pick(['greater', 'less']);
    const val = ask === 'greater' ? Math.exp(-lam * t) : 1 - Math.exp(-lam * t);
    return {
      stem: `The time until a claim arrives is exponential with mean ${mean}. `
        + `Find P(T ${ask === 'greater' ? '>' : '≤'} ${t}).`
        + `<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 2e-4,
      answerHtml: ask === 'greater'
        ? `e${sup(`−${t}/${mean}`)} = ${num(val, 4)}`
        : `1 − e${sup(`−${t}/${mean}`)} = ${num(val, 4)}`,
      note: 'Mean m means rate λ = 1/m. Mixing the two up is the standard exponential mistake.',
      hints: [`Mean ${mean} means λ = ${num(lam, 4)}. The survival function is P(T > t) = e${sup('−λt')}.`,
        `e${sup(`−${num(lam, 4)} × ${t}`)} = ${num(Math.exp(-lam * t), 6)}`],
      steps: [
        { title: 'Rate from the mean', html: `λ = ${frac('1', String(mean))} = ${num(lam, 4)}` },
        { title: 'Survival function', html: `P(T > ${t}) = e${sup(`−${num(lam, 4)}(${t})`)} = ${num(Math.exp(-lam * t), 6)}` },
        { title: 'Answer', html: ask === 'greater' ? num(val, 4) : `1 − ${num(Math.exp(-lam * t), 6)} = ${num(val, 4)}` },
      ],
    };
  }

  /* Normal: asked as a z-score so a student with a printed table can finish it. */
  const mu = rng.int(50, 200);
  const sd = rng.pick([5, 8, 10, 12, 15, 20]);
  const x = mu + rng.pick([-2, -1.5, -1, 1, 1.5, 2, 2.5]) * sd;
  const z = (x - mu) / sd;
  const p = normCdf(z);
  const ask = rng.pick(['z', 'p']);
  if (ask === 'z') {
    return {
      stem: `X ~ Normal(μ = ${mu}, σ = ${sd}). What is the z-score of x = ${num(x)}?`,
      kind: 'numeric',
      answer: z,
      tol: 1e-4,
      answerHtml: `z = ${frac(`${num(x)} − ${mu}`, String(sd))} = ${num(z, 4)}`,
      hints: ['A z-score counts standard deviations from the mean.',
        `z = ${frac('x − μ', 'σ')} = ${frac(`${num(x)} − ${mu}`, String(sd))}`],
      steps: [
        { title: 'Standardize', html: `z = ${frac('x − μ', 'σ')}` },
        { title: 'Substitute', html: `${frac(String(x - mu), String(sd))} = ${num(z, 4)}` },
      ],
    };
  }
  return {
    stem: `X ~ Normal(μ = ${mu}, σ = ${sd}). Find P(X ≤ ${num(x)}).`
      + `<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: p,
    tol: 1e-3,
    answerHtml: `z = ${num(z, 2)}, and Φ(${num(z, 2)}) = ${num(p, 4)}`,
    hints: [`Standardize first: z = ${frac(`${num(x)} − ${mu}`, String(sd))} = ${num(z, 2)}.`,
      `Now look up Φ(${num(z, 2)}) in the standard normal table.`],
    steps: [
      { title: 'Standardize', html: `z = ${frac(`${num(x)} − ${mu}`, String(sd))} = ${num(z, 4)}` },
      { title: 'Look up the CDF', html: `Φ(${num(z, 2)}) = ${num(p, 4)}` },
      { title: 'Answer', html: `P(X ≤ ${num(x)}) = ${num(p, 4)}` },
    ],
  };
}

export function expectation(rng, level) {
  /* A pmf on a common denominator, so the probabilities visibly sum to 1. */
  const k = rng.int(3, 5);
  const den = rng.pick([8, 10, 12, 16, 20]);
  let weights = [];
  let left = den;
  for (let i = 0; i < k - 1; i++) {
    const w = rng.int(1, Math.max(1, left - (k - 1 - i)));
    weights.push(w);
    left -= w;
  }
  weights.push(left);
  if (weights.some((w) => w <= 0)) return expectation(rng, level);
  const xs = rng.shuffle(Array.from({ length: 10 }, (_, i) => i)).slice(0, k).sort((a, b) => a - b);
  const ps = weights.map((w) => w / den);
  const ex = xs.reduce((a, x, i) => a + x * ps[i], 0);
  const ex2 = xs.reduce((a, x, i) => a + x * x * ps[i], 0);
  const varx = ex2 - ex * ex;
  const ask = level === 1 ? 'mean' : rng.pick(['mean', 'var']);
  const table = `<table class="pmf"><tr><th>x</th>${xs.map((x) => `<td>${x}</td>`).join('')}</tr>`
    + `<tr><th>P(X = x)</th>${weights.map((w) => `<td>${frac(String(w), String(den))}</td>`).join('')}</tr></table>`;

  if (ask === 'mean') {
    return {
      stem: `Find E[X] for this distribution:${table}<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: ex,
      tol: 2e-4,
      answerHtml: `E[X] = ${num(ex, 4)}`,
      hints: ['Multiply each value by its probability and add.',
        `${xs.map((x, i) => `${x}·${frac(String(weights[i]), String(den))}`).join(' + ')}`],
      steps: [
        { title: 'Definition', html: `E[X] = Σ x · P(X = x)` },
        { title: 'Sum the products', html: `${frac(xs.map((x, i) => `${x}(${weights[i]})`).join(' + '), String(den))} = ${num(ex, 4)}` },
      ],
    };
  }
  return {
    stem: `Find Var(X) for this distribution:${table}<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: varx,
    tol: 2e-4,
    answerHtml: `Var(X) = E[X${sup(2)}] − (E[X])${sup(2)} = ${num(ex2, 4)} − ${num(ex * ex, 4)} = ${num(varx, 4)}`,
    note: 'Var(X) = E[X²] − (E[X])². Squaring the mean is not the same as the mean of the squares.',
    hints: [`First E[X] = ${num(ex, 4)}.`,
      `Then E[X²] = ${num(ex2, 4)}. Subtract the square of the mean.`],
    steps: [
      { title: 'Mean', html: `E[X] = ${num(ex, 4)}` },
      { title: 'Mean of the squares', html: `E[X${sup(2)}] = Σ x${sup(2)}P(X = x) = ${num(ex2, 4)}` },
      { title: 'Shortcut formula', html: `Var(X) = ${num(ex2, 4)} − (${num(ex, 4)})${sup(2)} = ${num(varx, 4)}` },
    ],
  };
}

export function transformRV(rng, level) {
  const ex = rng.int(2, 20);
  const varx = rng.int(2, 25);
  const a = rng.nz(-5, 5);
  const b = rng.int(-15, 15);
  const ask = rng.pick(['mean', 'var', 'sd']);
  if (ask === 'mean') {
    const val = a * ex + b;
    return {
      stem: `E[X] = ${ex} and Var(X) = ${varx}. Find E[${a}X ${b >= 0 ? '+' : '−'} ${Math.abs(b)}].`,
      kind: 'numeric',
      answer: val,
      answerHtml: `${a}(${ex}) ${b >= 0 ? '+' : '−'} ${Math.abs(b)} = ${val}`,
      hints: ['Expectation is linear: constants pull straight through.',
        `E[aX + b] = aE[X] + b.`],
      steps: [{ title: 'Linearity', html: `E[${a}X ${b >= 0 ? '+' : '−'} ${Math.abs(b)}] = ${a}(${ex}) ${b >= 0 ? '+' : '−'} ${Math.abs(b)} = ${val}` }],
    };
  }
  if (ask === 'var') {
    const val = a * a * varx;
    return {
      stem: `E[X] = ${ex} and Var(X) = ${varx}. Find Var(${a}X ${b >= 0 ? '+' : '−'} ${Math.abs(b)}).`,
      kind: 'numeric',
      answer: val,
      answerHtml: `(${a})${sup(2)} · ${varx} = ${val}`,
      note: 'Adding a constant shifts the whole distribution without changing its spread, so b disappears.',
      hints: ['Var(aX + b) = a²Var(X). The constant b does not affect spread at all.',
        `(${a})${sup(2)} = ${a * a}, so the answer is ${a * a} × ${varx}.`],
      steps: [
        { title: 'The rule', html: `Var(aX + b) = a${sup(2)}Var(X)` },
        { title: 'Why b drops', html: `Shifting every value by ${b} moves the mean by ${b} too, so every deviation from the mean is unchanged.` },
        { title: 'Compute', html: `${a * a} × ${varx} = ${val}` },
      ],
    };
  }
  const val = Math.abs(a) * Math.sqrt(varx);
  return {
    stem: `Var(X) = ${varx}. Find the standard deviation of ${a}X ${b >= 0 ? '+' : '−'} ${Math.abs(b)}.`
      + `<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: val,
    tol: 2e-4,
    answerHtml: `|${a}| · ${sqrt(String(varx))} = ${num(val, 4)}`,
    note: 'Standard deviation scales by |a|, not a. It can never be negative.',
    hints: ['Find the variance first, then take the square root.',
      `Var = ${a * a} × ${varx} = ${a * a * varx}, so SD = ${sqrt(String(a * a * varx))}.`],
    steps: [
      { title: 'Variance', html: `Var(${a}X + ${b}) = ${a * a} × ${varx} = ${a * a * varx}` },
      { title: 'Square root', html: `${sqrt(String(a * a * varx))} = ${num(val, 4)}` },
      { title: 'Sign', html: `The absolute value matters: a negative a flips the distribution but cannot give a negative spread.` },
    ],
  };
}

export function jointDist(rng, level) {
  /* A 2x2 joint pmf on a common denominator. */
  const den = rng.pick([10, 16, 20, 25]);
  let w = [];
  let left = den;
  for (let i = 0; i < 3; i++) {
    const v = rng.int(1, Math.max(1, left - (3 - i)));
    w.push(v);
    left -= v;
  }
  w.push(left);
  if (w.some((v) => v <= 0)) return jointDist(rng, level);
  const [w00, w01, w10, w11] = w;
  const xs = [0, 1], ys = [0, 1];
  const p = [[w00 / den, w01 / den], [w10 / den, w11 / den]];
  const px1 = p[1][0] + p[1][1];
  const py1 = p[0][1] + p[1][1];
  const exy = 1 * 1 * p[1][1];
  const cov = exy - px1 * py1;
  const table = `<table class="pmf joint"><tr><th></th><th>Y = 0</th><th>Y = 1</th></tr>`
    + `<tr><th>X = 0</th><td>${frac(String(w00), String(den))}</td><td>${frac(String(w01), String(den))}</td></tr>`
    + `<tr><th>X = 1</th><td>${frac(String(w10), String(den))}</td><td>${frac(String(w11), String(den))}</td></tr></table>`;
  const ask = level === 1 ? 'marginal' : rng.pick(['marginal', 'cov']);

  if (ask === 'marginal') {
    return {
      stem: `From this joint distribution, find P(X = 1):${table}<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: px1,
      tol: 2e-4,
      answerHtml: `${frac(String(w10 + w11), String(den))} = ${num(px1, 4)}`,
      hints: ['A marginal is the row (or column) total.',
        `Add across the X = 1 row: ${frac(String(w10), String(den))} + ${frac(String(w11), String(den))}.`],
      steps: [
        { title: 'Sum the row', html: `P(X = 1) = P(1, 0) + P(1, 1) = ${frac(String(w10), String(den))} + ${frac(String(w11), String(den))}` },
        { title: 'Total', html: `${frac(String(w10 + w11), String(den))} = ${num(px1, 4)}` },
      ],
    };
  }

  return {
    stem: `From this joint distribution, find Cov(X, Y):${table}<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: cov,
    tol: 2e-4,
    answerHtml: `E[XY] − E[X]E[Y] = ${num(exy, 4)} − (${num(px1, 4)})(${num(py1, 4)}) = ${num(cov, 4)}`,
    note: 'Both variables are 0 or 1, so E[XY] is just the probability that both are 1.',
    hints: ['Cov(X, Y) = E[XY] − E[X]E[Y].',
      `Since X and Y are indicators, E[XY] = P(X = 1, Y = 1) = ${num(exy, 4)}, E[X] = ${num(px1, 4)}, E[Y] = ${num(py1, 4)}.`],
    steps: [
      { title: 'E[XY]', html: `Only the (1, 1) cell contributes: ${frac(String(w11), String(den))} = ${num(exy, 4)}` },
      { title: 'Marginal means', html: `E[X] = ${num(px1, 4)}, E[Y] = ${num(py1, 4)}` },
      { title: 'Covariance', html: `${num(exy, 4)} − ${num(px1 * py1, 6)} = ${num(cov, 4)}` },
      { title: 'Read the sign', html: cov > 0 ? 'Positive: they tend to be high together.' : cov < 0 ? 'Negative: when one is 1, the other tends to be 0.' : 'Zero: uncorrelated (and for indicators, that also means independent).' },
    ],
  };
}

/* ====================================================================== Exam FM */

const v = (i, n2) => Math.pow(1 + i, -n2);
const annImm = (i, n2) => (1 - Math.pow(1 + i, -n2)) / i;
const annDue = (i, n2) => annImm(i, n2) * (1 + i);
const accum = (i, n2) => (Math.pow(1 + i, n2) - 1) / i;

export function interestBasic(rng, level) {
  const P = rng.pick([1000, 2500, 5000, 8000, 10000, 15000]);
  const i = rng.pick([0.03, 0.04, 0.05, 0.06, 0.07, 0.08]);
  const n2 = rng.int(3, 15);
  const dir = level === 1 ? 'future' : rng.pick(['future', 'present', 'simple']);

  if (dir === 'future') {
    const val = P * Math.pow(1 + i, n2);
    return {
      stem: `${money(P)} is invested at an annual effective rate of ${pct(i, 0)}. What is it worth after ${n2} years?`
        + `<div class="aside">Round to the nearest cent.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 0.02,
      answerHtml: `${money(P)}(1.${String(i * 100).padStart(2, '0')})${sup(n2)} = ${money(val)}`,
      hints: [`Accumulated value is PV(1 + i)${sup('n')}.`,
        `${P} × ${num(Math.pow(1 + i, n2), 6)}`],
      steps: [
        { title: 'Accumulation', html: `AV = PV(1 + i)${sup('n')}` },
        { title: 'Growth factor', html: `(1 + ${i})${sup(n2)} = ${num(Math.pow(1 + i, n2), 6)}` },
        { title: 'Multiply', html: `${money(P)} × ${num(Math.pow(1 + i, n2), 6)} = ${money(val)}` },
      ],
    };
  }

  if (dir === 'present') {
    const val = P * Math.pow(1 + i, -n2);
    return {
      stem: `What is the present value of ${money(P)} payable in ${n2} years at an annual effective rate of ${pct(i, 0)}?`
        + `<div class="aside">Round to the nearest cent.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 0.02,
      answerHtml: `${money(P)}v${sup(n2)} = ${money(val)}`,
      hints: [`Present value divides by the growth factor: PV = AV(1 + i)${sup('−n')}.`,
        `v${sup(n2)} = ${num(Math.pow(1 + i, -n2), 6)}`],
      steps: [
        { title: 'Discount factor', html: `v = ${frac('1', `1 + ${i}`)}, so v${sup(n2)} = ${num(Math.pow(1 + i, -n2), 6)}` },
        { title: 'Multiply', html: `${money(P)} × ${num(Math.pow(1 + i, -n2), 6)} = ${money(val)}` },
      ],
    };
  }

  const val = P * (1 + i * n2);
  return {
    stem: `${money(P)} is invested at ${pct(i, 0)} SIMPLE interest for ${n2} years. What is the accumulated value?`
      + `<div class="aside">Round to the nearest cent.</div>`,
    kind: 'numeric',
    answer: val,
    tol: 0.02,
    answerHtml: `${money(P)}(1 + ${i} × ${n2}) = ${money(val)}`,
    note: 'Simple interest never compounds: the interest is always on the original principal.',
    hints: ['Simple interest is AV = P(1 + in), not P(1 + i)ⁿ.',
      `1 + ${i}(${n2}) = ${num(1 + i * n2, 6)}`],
    steps: [
      { title: 'Simple interest', html: `AV = P(1 + in)` },
      { title: 'Substitute', html: `${money(P)}(1 + ${i} × ${n2}) = ${money(P)} × ${num(1 + i * n2, 6)} = ${money(val)}` },
      { title: 'Compare', html: `Compound would have given ${money(P * Math.pow(1 + i, n2))}, which is ${money(P * Math.pow(1 + i, n2) - val)} more.` },
    ],
  };
}

export function interestRates(rng, level) {
  const i = rng.pick([0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10]);
  const m = rng.pick([2, 4, 12]);
  const kind = rng.pick(level === 1 ? ['nominal', 'force'] : ['nominal', 'force', 'discount', 'toeffective']);

  if (kind === 'nominal') {
    /* Effective -> nominal convertible m-thly. */
    const val = m * (Math.pow(1 + i, 1 / m) - 1);
    return {
      stem: `The annual effective rate is ${pct(i, 0)}. Find the equivalent nominal rate convertible ${m === 2 ? 'semiannually' : m === 4 ? 'quarterly' : 'monthly'}, i${sup(`(${m})`)}.`
        + `<div class="aside">Round to 4 decimal places (as a decimal, not a percent).</div>`,
      kind: 'numeric',
      answer: val,
      tol: 2e-4,
      answerHtml: `i${sup(`(${m})`)} = ${m}[(1.${String(Math.round(i * 100)).padStart(2, '0')})${sup(`1/${m}`)} − 1] = ${num(val, 4)}`,
      hints: [`The relationship is (1 + ${frac(`i${sup(`(${m})`)}`, String(m))})${sup(m)} = 1 + i.`,
        `So ${frac(`i${sup(`(${m})`)}`, String(m))} = (1 + ${i})${sup(`1/${m}`)} − 1 = ${num(Math.pow(1 + i, 1 / m) - 1, 6)}.`],
      steps: [
        { title: 'Equivalence', html: `(1 + ${frac(`i${sup(`(${m})`)}`, String(m))})${sup(m)} = 1 + i` },
        { title: 'Solve for the periodic rate', html: `(1 + ${i})${sup(`1/${m}`)} − 1 = ${num(Math.pow(1 + i, 1 / m) - 1, 6)}` },
        { title: 'Annualize', html: `× ${m} = ${num(val, 4)}` },
      ],
    };
  }

  if (kind === 'force') {
    const val = Math.log(1 + i);
    return {
      stem: `The annual effective rate is ${pct(i, 0)}. Find the equivalent force of interest δ.`
        + `<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 2e-4,
      answerHtml: `δ = ln(1 + ${i}) = ${num(val, 4)}`,
      hints: ['The force of interest is the continuously compounded equivalent: eδ = 1 + i.',
        `δ = ln(${num(1 + i)})`],
      steps: [
        { title: 'Equivalence', html: `e${sup('δ')} = 1 + i` },
        { title: 'Take logs', html: `δ = ln(1 + ${i}) = ${num(val, 6)}` },
        { title: 'Sanity check', html: `δ is always slightly less than i, because continuous compounding needs a smaller rate to reach the same place.` },
      ],
    };
  }

  if (kind === 'discount') {
    const val = i / (1 + i);
    return {
      stem: `The annual effective interest rate is ${pct(i, 0)}. Find the equivalent annual effective discount rate d.`
        + `<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 2e-4,
      answerHtml: `d = ${frac('i', '1 + i')} = ${frac(String(i), num(1 + i))} = ${num(val, 4)}`,
      note: 'Interest is paid at the end of the period; discount is paid at the start. That is the whole difference.',
      hints: [`d = ${frac('i', '1 + i')}, equivalently d = iv.`,
        `${frac(String(i), num(1 + i))}`],
      steps: [
        { title: 'Relationship', html: `d = ${frac('i', '1 + i')} = iv` },
        { title: 'Substitute', html: `${frac(String(i), num(1 + i))} = ${num(val, 6)}` },
        { title: 'Check', html: `d < i always, since d is the same interest measured at the start of the period instead of the end.` },
      ],
    };
  }

  /* Nominal -> effective. */
  const nom = rng.pick([0.04, 0.06, 0.08, 0.12]);
  const val = Math.pow(1 + nom / m, m) - 1;
  return {
    stem: `A nominal rate of ${pct(nom, 0)} is convertible ${m === 2 ? 'semiannually' : m === 4 ? 'quarterly' : 'monthly'}. Find the annual effective rate.`
      + `<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: val,
    tol: 2e-4,
    answerHtml: `(1 + ${frac(String(nom), String(m))})${sup(m)} − 1 = ${num(val, 4)}`,
    hints: [`The periodic rate is ${frac(String(nom), String(m))} = ${num(nom / m, 6)}. Compound it ${m} times.`,
      `(1 + ${num(nom / m, 6)})${sup(m)} = ${num(Math.pow(1 + nom / m, m), 6)}`],
    steps: [
      { title: 'Periodic rate', html: `${frac(String(nom), String(m))} = ${num(nom / m, 6)}` },
      { title: `Compound ${m} times`, html: `(1 + ${num(nom / m, 6)})${sup(m)} = ${num(Math.pow(1 + nom / m, m), 6)}` },
      { title: 'Subtract 1', html: num(val, 4) },
    ],
  };
}

export function annuityLevel(rng, level) {
  const pmt = rng.pick([100, 250, 500, 1000, 1200, 2000]);
  const i = rng.pick([0.04, 0.05, 0.06, 0.07, 0.08]);
  const n2 = rng.int(5, 25);
  const kind = level === 1 ? 'pv' : rng.pick(['pv', 'av', 'due']);

  if (kind === 'pv') {
    const a = annImm(i, n2);
    const val = pmt * a;
    return {
      stem: `Find the present value of an annuity-immediate paying ${money(pmt)} at the end of each year for ${n2} years, at ${pct(i, 0)} annual effective.`
        + `<div class="aside">Round to the nearest cent.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 0.05,
      answerHtml: `${money(pmt)} · ${aImm(n2)} = ${money(pmt)} × ${num(a, 6)} = ${money(val)}`,
      hints: [`${aImm(n2)} = ${frac(`1 − v${sup('n')}`, 'i')}.`,
        `v${sup(n2)} = ${num(v(i, n2), 6)}, so ${aImm(n2)} = ${frac(`1 − ${num(v(i, n2), 6)}`, String(i))} = ${num(a, 6)}.`],
      steps: [
        { title: 'Annuity-immediate formula', html: `${aImm(n2)} = ${frac(`1 − v${sup('n')}`, 'i')}` },
        { title: 'Discount factor', html: `v${sup(n2)} = (1 + ${i})${sup(-n2)} = ${num(v(i, n2), 6)}` },
        { title: 'Annuity factor', html: `${frac(`1 − ${num(v(i, n2), 6)}`, String(i))} = ${num(a, 6)}` },
        { title: 'Multiply by the payment', html: `${money(pmt)} × ${num(a, 6)} = ${money(val)}` },
      ],
    };
  }

  if (kind === 'av') {
    const s = accum(i, n2);
    const val = pmt * s;
    return {
      stem: `${money(pmt)} is deposited at the end of each year for ${n2} years into an account earning ${pct(i, 0)} annual effective. What is the balance right after the last deposit?`
        + `<div class="aside">Round to the nearest cent.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 0.05,
      answerHtml: `${money(pmt)} · ${sImm(n2)} = ${money(pmt)} × ${num(s, 6)} = ${money(val)}`,
      hints: [`${sImm(n2)} = ${frac(`(1 + i)${sup('n')} − 1`, 'i')}.`,
        `(1 + ${i})${sup(n2)} = ${num(Math.pow(1 + i, n2), 6)}`],
      steps: [
        { title: 'Accumulated annuity', html: `${sImm(n2)} = ${frac(`(1 + i)${sup('n')} − 1`, 'i')}` },
        { title: 'Substitute', html: `${frac(`${num(Math.pow(1 + i, n2), 6)} − 1`, String(i))} = ${num(s, 6)}` },
        { title: 'Multiply', html: `${money(pmt)} × ${num(s, 6)} = ${money(val)}` },
      ],
    };
  }

  const ad = annDue(i, n2);
  const val = pmt * ad;
  return {
    stem: `Find the present value of an annuity-DUE paying ${money(pmt)} at the START of each year for ${n2} years, at ${pct(i, 0)} annual effective.`
      + `<div class="aside">Round to the nearest cent.</div>`,
    kind: 'numeric',
    answer: val,
    tol: 0.05,
    answerHtml: `${money(pmt)} · ${aDue(n2)} = ${money(pmt)} × ${num(ad, 6)} = ${money(val)}`,
    note: 'An annuity-due is just an annuity-immediate shifted one period earlier, so it is worth (1 + i) times as much.',
    hints: [`${aDue(n2)} = ${aImm(n2)} × (1 + i).`,
      `${aImm(n2)} = ${num(annImm(i, n2), 6)}, so ${aDue(n2)} = ${num(annImm(i, n2), 6)} × ${num(1 + i)} = ${num(ad, 6)}.`],
    steps: [
      { title: 'Immediate first', html: `${aImm(n2)} = ${num(annImm(i, n2), 6)}` },
      { title: 'Shift one period earlier', html: `${aDue(n2)} = ${num(annImm(i, n2), 6)} × ${num(1 + i)} = ${num(ad, 6)}` },
      { title: 'Multiply', html: `${money(pmt)} × ${num(ad, 6)} = ${money(val)}` },
    ],
  };
}

export function annuityVarying(rng, level) {
  const i = rng.pick([0.04, 0.05, 0.06, 0.08]);
  const kind = rng.pick(level === 1 ? ['perp'] : ['perp', 'perpdue', 'increasing']);

  if (kind === 'perp') {
    const pmt = rng.pick([100, 250, 500, 1000]);
    const val = pmt / i;
    return {
      stem: `A perpetuity-immediate pays ${money(pmt)} at the end of each year forever. At ${pct(i, 0)} annual effective, what is its present value?`
        + `<div class="aside">Round to the nearest cent.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 0.05,
      answerHtml: `${frac(money(pmt), String(i))} = ${money(val)}`,
      hints: ['A perpetuity-immediate is worth payment divided by i.',
        `${pmt} ÷ ${i}`],
      steps: [
        { title: 'Perpetuity formula', html: `PV = ${frac('PMT', 'i')}` },
        { title: 'Substitute', html: `${frac(String(pmt), String(i))} = ${money(val)}` },
        { title: 'Why it is finite', html: 'Payments far in the future discount to almost nothing, so an infinite stream still has a finite value.' },
      ],
    };
  }

  if (kind === 'perpdue') {
    const pmt = rng.pick([100, 250, 500, 1000]);
    const d = i / (1 + i);
    const val = pmt / d;
    return {
      stem: `A perpetuity-DUE pays ${money(pmt)} at the start of each year forever. At ${pct(i, 0)} annual effective, what is its present value?`
        + `<div class="aside">Round to the nearest cent.</div>`,
      kind: 'numeric',
      answer: val,
      tol: 0.05,
      answerHtml: `${frac(money(pmt), 'd')} = ${frac(money(pmt), num(d, 6))} = ${money(val)}`,
      note: 'Perpetuity-due uses d, not i. It equals the immediate version plus one payment today.',
      hints: [`PV = ${frac('PMT', 'd')} where d = ${frac('i', '1 + i')} = ${num(d, 6)}.`,
        `Equivalently ${frac('PMT', 'i')} + PMT = ${money(pmt / i)} + ${money(pmt)}.`],
      steps: [
        { title: 'Find d', html: `d = ${frac('i', '1 + i')} = ${num(d, 6)}` },
        { title: 'Apply', html: `${frac(String(pmt), num(d, 6))} = ${money(val)}` },
        { title: 'Check another way', html: `Immediate (${money(pmt / i)}) plus the payment today (${money(pmt)}) = ${money(val)} ✓` },
      ],
    };
  }

  /* Increasing annuity (Ia)_n = (a-due_n - n v^n) / i */
  const n2 = rng.int(5, 15);
  const adue = annDue(i, n2);
  const val = (adue - n2 * v(i, n2)) / i;
  return {
    stem: `Find the present value of an increasing annuity-immediate paying 1 at the end of year 1, 2 at the end of year 2, up to ${n2} at the end of year ${n2}, at ${pct(i, 0)} annual effective.`
      + `<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: val,
    tol: 2e-3,
    answerHtml: `(I${aImm(n2)}) = ${frac(`${aDue(n2)} − n v${sup('n')}`, 'i')} = ${num(val, 4)}`,
    hints: [`The formula is (Ia)${ang(n2)} = ${frac(`${aDue(n2)} − nv${sup('n')}`, 'i')}.`,
      `${aDue(n2)} = ${num(adue, 6)} and ${n2}v${sup(n2)} = ${num(n2 * v(i, n2), 6)}.`],
    steps: [
      { title: 'Annuity-due factor', html: `${aDue(n2)} = ${num(adue, 6)}` },
      { title: 'The correction term', html: `n v${sup('n')} = ${n2} × ${num(v(i, n2), 6)} = ${num(n2 * v(i, n2), 6)}` },
      { title: 'Combine', html: `${frac(`${num(adue, 6)} − ${num(n2 * v(i, n2), 6)}`, String(i))} = ${num(val, 4)}` },
    ],
  };
}

export function loanAmort(rng, level) {
  const L = rng.pick([10000, 20000, 25000, 50000, 100000, 200000]);
  const i = rng.pick([0.04, 0.05, 0.06, 0.07]);
  const n2 = rng.pick([10, 15, 20, 25, 30]);
  const a = annImm(i, n2);
  const pmt = L / a;
  const kind = level === 1 ? 'payment' : rng.pick(['payment', 'balance', 'split']);

  if (kind === 'payment') {
    return {
      stem: `A ${money(L)} loan at ${pct(i, 0)} annual effective is repaid with ${n2} equal end-of-year payments. Find the annual payment.`
        + `<div class="aside">Round to the nearest cent.</div>`,
      kind: 'numeric',
      answer: pmt,
      tol: 0.05,
      answerHtml: `${frac(money(L), aImm(n2))} = ${frac(money(L), num(a, 6))} = ${money(pmt)}`,
      hints: [`The payments form an annuity-immediate whose present value is the loan: L = PMT · ${aImm(n2)}.`,
        `${aImm(n2)} = ${num(a, 6)}, so PMT = ${L} ÷ ${num(a, 6)}.`],
      steps: [
        { title: 'Equation of value', html: `${money(L)} = PMT · ${aImm(n2)}` },
        { title: 'Annuity factor', html: `${aImm(n2)} = ${frac(`1 − ${num(v(i, n2), 6)}`, String(i))} = ${num(a, 6)}` },
        { title: 'Solve', html: `PMT = ${frac(String(L), num(a, 6))} = ${money(pmt)}` },
      ],
    };
  }

  const k = rng.int(2, n2 - 2);
  const bal = pmt * annImm(i, n2 - k);

  if (kind === 'balance') {
    return {
      stem: `A ${money(L)} loan at ${pct(i, 0)} is repaid with ${n2} level annual payments of ${money(pmt)}. `
        + `What is the outstanding balance right after the ${k}th payment?`
        + `<div class="aside">Round to the nearest cent.</div>`,
      kind: 'numeric',
      answer: bal,
      tol: 0.1,
      answerHtml: `${money(pmt)} · ${aImm(n2 - k)} = ${money(pmt)} × ${num(annImm(i, n2 - k), 6)} = ${money(bal)}`,
      note: 'The prospective method: the balance is the present value of what is still owed.',
      hints: [`There are ${n2} − ${k} = ${n2 - k} payments left. The balance is their present value.`,
        `${aImm(n2 - k)} = ${num(annImm(i, n2 - k), 6)}`],
      steps: [
        { title: 'Payments remaining', html: `${n2} − ${k} = ${n2 - k}` },
        { title: 'Prospective balance', html: `B = PMT · ${aImm(n2 - k)} = ${money(pmt)} × ${num(annImm(i, n2 - k), 6)}` },
        { title: 'Result', html: money(bal) },
      ],
    };
  }

  /* Interest / principal split of a given payment. */
  const prevBal = pmt * annImm(i, n2 - (k - 1));
  const interest = i * prevBal;
  const principal = pmt - interest;
  return {
    stem: `A ${money(L)} loan at ${pct(i, 0)} is repaid with ${n2} level annual payments of ${money(pmt)}. `
      + `How much of payment number ${k} is INTEREST?`
      + `<div class="aside">Round to the nearest cent.</div>`,
    kind: 'numeric',
    answer: interest,
    tol: 0.1,
    answerHtml: `i · B<sub>${k - 1}</sub> = ${i} × ${money(prevBal)} = ${money(interest)}`,
    note: 'Interest is always charged on the balance BEFORE the payment, not after.',
    hints: [`Find the balance just after payment ${k - 1} first. That is the balance the interest is charged on.`,
      `B<sub>${k - 1}</sub> = PMT · ${aImm(n2 - k + 1)} = ${money(prevBal)}. Now take ${pct(i, 0)} of it.`],
    steps: [
      { title: 'Balance before this payment', html: `B<sub>${k - 1}</sub> = ${money(pmt)} × ${aImm(n2 - k + 1)} = ${money(prevBal)}` },
      { title: 'Interest portion', html: `${i} × ${money(prevBal)} = ${money(interest)}` },
      { title: 'Principal portion', html: `${money(pmt)} − ${money(interest)} = ${money(principal)}` },
    ],
  };
}

export function bondPrice(rng, level) {
  const Fv = rng.pick([1000, 1000, 5000]);
  const cr = rng.pick([0.04, 0.05, 0.06, 0.07, 0.08]);
  const y = rng.pick([0.03, 0.04, 0.05, 0.06, 0.07, 0.09]);
  const n2 = rng.pick([5, 8, 10, 15, 20]);
  const coupon = Fv * cr;
  const price = coupon * annImm(y, n2) + Fv * v(y, n2);
  const kind = level === 1 ? 'price' : rng.pick(['price', 'premium']);

  if (kind === 'price') {
    return {
      stem: `A ${money(Fv)} par-value bond pays annual coupons at ${pct(cr, 0)} and matures in ${n2} years. `
        + `At a yield of ${pct(y, 0)}, find the price.`
        + `<div class="aside">Round to the nearest cent.</div>`,
      kind: 'numeric',
      answer: price,
      tol: 0.1,
      answerHtml: `${money(coupon)} · ${aImm(n2)} + ${money(Fv)}v${sup(n2)} = ${money(price)}`,
      hints: [`Price = (coupon × annuity factor) + (redemption × discount factor).`,
        `Coupon = ${money(Fv)} × ${cr} = ${money(coupon)}. ${aImm(n2)} = ${num(annImm(y, n2), 6)}, v${sup(n2)} = ${num(v(y, n2), 6)}.`],
      steps: [
        { title: 'Coupon amount', html: `${money(Fv)} × ${pct(cr, 0)} = ${money(coupon)} per year` },
        { title: 'Present value of the coupons', html: `${money(coupon)} × ${num(annImm(y, n2), 6)} = ${money(coupon * annImm(y, n2))}` },
        { title: 'Present value of the redemption', html: `${money(Fv)} × ${num(v(y, n2), 6)} = ${money(Fv * v(y, n2))}` },
        { title: 'Add', html: money(price) },
      ],
    };
  }

  const correct = cr > y ? 'At a premium (price above par)' : cr < y ? 'At a discount (price below par)' : 'At par';
  return {
    stem: `A ${money(Fv)} par-value bond has a ${pct(cr, 0)} coupon rate and is priced to yield ${pct(y, 0)}. Is it trading at a premium or a discount?`,
    kind: 'choice',
    choices: mc(rng, correct, ['At a premium (price above par)', 'At a discount (price below par)', 'At par']),
    answerHtml: `${correct}. The price is ${money(price)} against a par value of ${money(Fv)}.`,
    note: 'Coupon above yield means the bond pays more than the market demands, so buyers bid the price above par.',
    hints: ['Compare the coupon rate with the yield.',
      `Coupon ${pct(cr, 0)} is ${cr > y ? 'above' : cr < y ? 'below' : 'equal to'} the yield ${pct(y, 0)}.`],
    steps: [
      { title: 'Compare the rates', html: `Coupon ${pct(cr, 0)} vs yield ${pct(y, 0)}` },
      { title: 'Conclusion', html: `${correct}: price ${money(price)}, par ${money(Fv)}.` },
    ],
  };
}

export function duration(rng, level) {
  const i = rng.pick([0.04, 0.05, 0.06, 0.08]);
  const n2 = rng.int(3, 12);
  const kind = level === 1 ? 'zero' : rng.pick(['zero', 'modified', 'annuity']);

  if (kind === 'zero') {
    return {
      stem: `What is the Macaulay duration of a zero-coupon bond maturing in ${n2} years, at ${pct(i, 0)} yield?`,
      kind: 'numeric',
      answer: n2,
      answerHtml: `${n2} years`,
      note: 'A zero-coupon bond has exactly one cash flow, so its duration is simply its maturity, whatever the yield.',
      hints: ['Duration is the weighted average time to the cash flows.',
        'There is only one cash flow here, so there is nothing to average.'],
      steps: [
        { title: 'Definition', html: `D = ${frac('Σ t · vᵗ · CFₜ', 'Σ vᵗ · CFₜ')}` },
        { title: 'One cash flow', html: `Both sums have a single term at t = ${n2}, so everything cancels and D = ${n2}.` },
        { title: 'Note', html: 'The yield does not appear in the answer, which is a useful check.' },
      ],
    };
  }

  if (kind === 'modified') {
    const mac = n2;
    const mod = mac / (1 + i);
    return {
      stem: `A zero-coupon bond matures in ${n2} years at a yield of ${pct(i, 0)}. Find its MODIFIED duration.`
        + `<div class="aside">Round to 4 decimal places.</div>`,
      kind: 'numeric',
      answer: mod,
      tol: 2e-4,
      answerHtml: `${frac(String(n2), `1 + ${i}`)} = ${num(mod, 4)}`,
      hints: ['Modified duration is Macaulay duration divided by (1 + i).',
        `Macaulay is ${n2}, so modified is ${n2} ÷ ${num(1 + i)}.`],
      steps: [
        { title: 'Macaulay first', html: `D = ${n2} (a single cash flow)` },
        { title: 'Modify', html: `D<sub>mod</sub> = ${frac('D', '1 + i')} = ${frac(String(n2), num(1 + i))} = ${num(mod, 4)}` },
        { title: 'What it means', html: `A 1 percentage point rise in yield moves the price by roughly ${num(mod, 2)}%.` },
      ],
    };
  }

  /* Macaulay duration of a level annuity-immediate, computed directly. */
  let numer = 0, denom = 0;
  for (let t = 1; t <= n2; t++) {
    const pv = Math.pow(1 + i, -t);
    numer += t * pv;
    denom += pv;
  }
  const mac = numer / denom;
  return {
    stem: `Find the Macaulay duration of a ${n2}-year annuity-immediate paying 1 per year, at ${pct(i, 0)} yield.`
      + `<div class="aside">Round to 4 decimal places.</div>`,
    kind: 'numeric',
    answer: mac,
    tol: 2e-3,
    answerHtml: `${frac('Σ t vᵗ', 'Σ vᵗ')} = ${frac(num(numer, 6), num(denom, 6))} = ${num(mac, 4)}`,
    hints: ['Duration is the present-value-weighted average of the payment times.',
      `The denominator is just ${aImm(n2)} = ${num(denom, 6)}. The numerator is Σ t·vᵗ = ${num(numer, 6)}.`],
    steps: [
      { title: 'Weights', html: `Each payment at time t has weight ${frac('vᵗ', `${aImm(n2)}`)}.` },
      { title: 'Numerator', html: `Σ t vᵗ = ${num(numer, 6)}` },
      { title: 'Denominator', html: `Σ vᵗ = ${aImm(n2)} = ${num(denom, 6)}` },
      { title: 'Divide', html: `${num(mac, 4)} years` },
    ],
  };
}
