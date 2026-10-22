/* Intro CS generators.

   The code shown is Python, since that is what the intro course uses. Traces
   are computed by actually running the same loop in JavaScript rather than by
   a closed-form guess, so the stated answer cannot drift from the code on
   screen. */

import MathKit from './math.js';

const { sup, frac, num, esc } = MathKit;

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

const code = (lines) => `<pre class="code">${lines.map((l) => esc(l)).join('\n')}</pre>`;

export function codeTrace(rng, level) {
  const kind = rng.pick(level === 1 ? ['sum', 'count'] : ['sum', 'count', 'nested', 'while']);

  if (kind === 'sum') {
    const n2 = rng.int(4, 9);
    const step = rng.int(1, 4);
    const start = rng.int(0, 5);
    let total = 0;
    for (let i = 0; i < n2; i++) total += start + i * step;
    return {
      stem: `What does this print?${code([
        'total = 0',
        `for i in range(${n2}):`,
        `    total += ${start} + i * ${step}`,
        'print(total)',
      ])}`,
      kind: 'numeric',
      answer: total,
      answerHtml: String(total),
      hints: [`range(${n2}) gives i = 0, 1, ..., ${n2 - 1}. That is ${n2} iterations, not ${n2 + 1}.`,
        `The terms are ${Array.from({ length: Math.min(n2, 4) }, (_, i) => start + i * step).join(', ')}${n2 > 4 ? ', ...' : ''}.`],
      steps: [
        { title: 'What i runs over', html: `range(${n2}) → 0 through ${n2 - 1}` },
        { title: 'The terms', html: Array.from({ length: n2 }, (_, i) => start + i * step).join(' + ') },
        { title: 'Total', html: String(total) },
      ],
    };
  }

  if (kind === 'count') {
    const n2 = rng.int(10, 30);
    const d = rng.pick([2, 3, 4, 5]);
    let c = 0;
    for (let i = 1; i <= n2; i++) if (i % d === 0) c++;
    return {
      stem: `What does this print?${code([
        'count = 0',
        `for i in range(1, ${n2 + 1}):`,
        `    if i % ${d} == 0:`,
        '        count += 1',
        'print(count)',
      ])}`,
      kind: 'numeric',
      answer: c,
      answerHtml: String(c),
      note: `range(1, ${n2 + 1}) stops BEFORE ${n2 + 1}, so it covers 1 through ${n2}.`,
      hints: [`The loop runs over 1 through ${n2} (the upper bound is exclusive).`,
        `You are counting the multiples of ${d} in that range.`],
      steps: [
        { title: 'Range', html: `range(1, ${n2 + 1}) → 1, 2, ..., ${n2}` },
        { title: 'Condition', html: `i % ${d} == 0 is true for the multiples of ${d}.` },
        { title: 'Count them', html: `⌊${n2} / ${d}⌋ = ${c}` },
      ],
    };
  }

  if (kind === 'nested') {
    const n2 = rng.int(3, 6);
    let c = 0;
    for (let i = 0; i < n2; i++) for (let j = 0; j <= i; j++) c++;
    return {
      stem: `How many times does the print run?${code([
        `for i in range(${n2}):`,
        '    for j in range(i + 1):',
        '        print(i, j)',
      ])}`,
      kind: 'numeric',
      answer: c,
      answerHtml: `${c}, since the inner loop runs 1 + 2 + ... + ${n2} times`,
      hints: ['The inner loop does not run a fixed number of times. It depends on i.',
        `When i = 0 it runs once, when i = 1 it runs twice, and so on up to ${n2}.`],
      steps: [
        { title: 'Inner loop length', html: `For each i, range(i + 1) runs i + 1 times.` },
        { title: 'Add them up', html: `${Array.from({ length: n2 }, (_, i) => i + 1).join(' + ')} = ${c}` },
        { title: 'Formula', html: `${frac(`${n2}(${n2} + 1)`, '2')} = ${c}` },
      ],
    };
  }

  /* while loop with halving */
  const start = rng.pick([16, 32, 64, 100, 128, 200, 256]);
  let x = start, steps = 0;
  while (x > 1) { x = Math.floor(x / 2); steps++; }
  return {
    stem: `What does this print?${code([
      `n = ${start}`,
      'count = 0',
      'while n > 1:',
      '    n = n // 2',
      '    count += 1',
      'print(count)',
    ])}`,
    kind: 'numeric',
    answer: steps,
    answerHtml: String(steps),
    hints: ['Each pass halves n with integer division. Count how many halvings it takes to get to 1.',
      `${start} → ${Math.floor(start / 2)} → ${Math.floor(start / 4)} → ...`],
    steps: [
      { title: 'Trace it', html: (() => { const t = []; let y = start; while (y > 1) { y = Math.floor(y / 2); t.push(y); } return `${start} → ${t.join(' → ')}`; })() },
      { title: 'Count the arrows', html: String(steps) },
      { title: 'Why this matters', html: `Repeated halving is log₂ behavior, which is where O(log n) comes from.` },
    ],
  };
}

export function bigO(rng, level) {
  const cases = [
    { lines: ['for i in range(n):', '    print(i)'], o: 'O(n)', why: 'One loop over n items.' },
    { lines: ['for i in range(n):', '    for j in range(n):', '        print(i, j)'], o: 'O(n²)', why: 'A loop over n inside a loop over n.' },
    { lines: ['while n > 1:', '    n = n // 2'], o: 'O(log n)', why: 'n halves each pass, so the count is log₂ n.' },
    { lines: ['for i in range(n):', '    for j in range(n):', '        for k in range(n):', '            pass'], o: 'O(n³)', why: 'Three nested loops over n.' },
    { lines: ['print(a[0])', 'print(a[len(a) - 1])'], o: 'O(1)', why: 'Indexing a list is constant time and the work does not grow with n.' },
    { lines: ['for i in range(n):', '    while m > 1:', '        m = m // 2'], o: 'O(n log n)', why: 'A log-time inner loop run n times.' },
  ];
  const c = rng.pick(cases);
  const all = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(n³)'];
  const others = rng.shuffle(all.filter((o) => o !== c.o)).slice(0, 3);
  return {
    stem: `What is the time complexity of this code?${code(c.lines)}`,
    kind: 'choice',
    choices: mc(rng, c.o, others),
    answerHtml: `${c.o}. ${c.why}`,
    hints: ['Count how the number of basic operations grows as n grows. Constants and lower-order terms drop out.',
      c.why],
    steps: [
      { title: 'Count the work', html: c.why },
      { title: 'Drop constants', html: `Big-O keeps only the fastest-growing term, so the answer is ${c.o}.` },
    ],
  };
}

export function booleanLogic(rng, level) {
  const kind = rng.pick(level === 1 ? ['evaluate'] : ['evaluate', 'demorgan', 'equivalent']);

  if (kind === 'evaluate') {
    const a = rng() < 0.5, b = rng() < 0.5, c = rng() < 0.5;
    const op = rng.pick(['and-or', 'or-and', 'not-and']);
    let valueExpr, val;
    if (op === 'and-or') { valueExpr = 'A and B or C'; val = (a && b) || c; }
    else if (op === 'or-and') { valueExpr = 'A or B and C'; val = a || (b && c); }
    else { valueExpr = 'not A and B'; val = (!a) && b; }
    const T = (v) => (v ? 'True' : 'False');
    return {
      stem: `If A = ${T(a)}, B = ${T(b)} and C = ${T(c)}, what is <code>${valueExpr}</code>?`,
      kind: 'choice',
      choices: mc(rng, T(val), [T(!val)]),
      answerHtml: `${T(val)}`,
      note: 'Precedence: not binds tightest, then and, then or.',
      hints: ['Evaluate `not` first, then `and`, then `or`. Python does not go left to right.',
        op === 'and-or' ? `(A and B) is ${T(a && b)}, then or C.`
          : op === 'or-and' ? `(B and C) is ${T(b && c)} binds first, then A or that.`
            : `(not A) is ${T(!a)}, then and B.`],
      steps: [
        { title: 'Apply precedence', html: op === 'and-or' ? '(A and B) or C' : op === 'or-and' ? 'A or (B and C)' : '(not A) and B' },
        { title: 'Substitute', html: `A = ${T(a)}, B = ${T(b)}, C = ${T(c)}` },
        { title: 'Evaluate', html: T(val) },
      ],
    };
  }

  if (kind === 'demorgan') {
    const useAnd = rng() < 0.5;
    const given = useAnd ? 'not (A and B)' : 'not (A or B)';
    const correct = useAnd ? 'not A or not B' : 'not A and not B';
    const wrong = useAnd ? 'not A and not B' : 'not A or not B';
    return {
      stem: `Which expression is equivalent to <code>${given}</code>?`,
      kind: 'choice',
      choices: mc(rng, correct, [wrong, 'A or B', 'A and B']),
      answerHtml: `${given} = ${correct}`,
      note: 'De Morgan: push the not inside and flip the operator.',
      hints: ['De Morgan’s law: distributing a `not` over `and`/`or` swaps the operator.',
        `not (A ${useAnd ? 'and' : 'or'} B) becomes not A ${useAnd ? 'or' : 'and'} not B.`],
      steps: [
        { title: 'De Morgan', html: `not (A and B) = not A or not B, and not (A or B) = not A and not B.` },
        { title: 'Apply it', html: `${given} = ${correct}` },
        { title: 'Check a case', html: `The flip is the whole point: negating an "and" gives an "or".` },
      ],
    };
  }

  const pairs = [
    { a: 'A and True', b: 'A' },
    { a: 'A or True', b: 'True' },
    { a: 'A and False', b: 'False' },
    { a: 'A or False', b: 'A' },
    { a: 'not (not A)', b: 'A' },
    { a: 'A or (A and B)', b: 'A' },
  ];
  const p = rng.pick(pairs);
  return {
    stem: `Simplify: <code>${p.a}</code>`,
    kind: 'choice',
    choices: mc(rng, p.b, rng.shuffle(['A', 'True', 'False', 'B', 'not A']).filter((o) => o !== p.b).slice(0, 3)),
    answerHtml: `<code>${p.a}</code> simplifies to <code>${p.b}</code>`,
    hints: ['Try both values of A and see what the whole expression does.',
      'If the result is the same for both, the expression is a constant.'],
    steps: [
      { title: 'A = True', html: `<code>${p.a}</code> with A True` },
      { title: 'A = False', html: `<code>${p.a}</code> with A False` },
      { title: 'Conclusion', html: `Both cases agree with <code>${p.b}</code>.` },
    ],
  };
}

export function numberBases(rng, level) {
  const dir = rng.pick(level === 1 ? ['tobin', 'frombin'] : ['tobin', 'frombin', 'tohex', 'fromhex']);
  const n2 = rng.int(level === 1 ? 5 : 20, level === 1 ? 63 : 255);

  if (dir === 'tobin') {
    const bin = n2.toString(2);
    return {
      stem: `Convert ${n2} from decimal to binary.`,
      kind: 'text',
      answer: bin,
      accept: [`0b${bin}`],
      answerHtml: `${n2} = ${bin}₂`,
      hints: ['Divide by 2 repeatedly and read the remainders from the bottom up.',
        `The largest power of 2 that fits is ${Math.pow(2, Math.floor(Math.log2(n2)))}.`],
      steps: [
        { title: 'Powers of 2', html: Array.from({ length: bin.length }, (_, k) => Math.pow(2, bin.length - 1 - k)).join(', ') },
        { title: 'Which ones are used', html: bin.split('').map((b, k) => (b === '1' ? Math.pow(2, bin.length - 1 - k) : null)).filter(Boolean).join(' + ') + ` = ${n2}` },
        { title: 'Read off the bits', html: `${bin}₂` },
      ],
    };
  }

  if (dir === 'frombin') {
    const bin = n2.toString(2);
    return {
      stem: `Convert ${bin}₂ to decimal.`,
      kind: 'numeric',
      answer: n2,
      answerHtml: String(n2),
      hints: ['Each bit is worth a power of 2, doubling from right to left.',
        `From the right: ${bin.split('').reverse().map((b, k) => `${b}×${Math.pow(2, k)}`).join(' + ')}`],
      steps: [
        { title: 'Place values', html: bin.split('').map((b, k) => `${b} × ${Math.pow(2, bin.length - 1 - k)}`).join(' + ') },
        { title: 'Add the ones', html: bin.split('').map((b, k) => (b === '1' ? Math.pow(2, bin.length - 1 - k) : null)).filter(Boolean).join(' + ') + ` = ${n2}` },
      ],
    };
  }

  if (dir === 'tohex') {
    const hex = n2.toString(16).toUpperCase();
    return {
      stem: `Convert ${n2} from decimal to hexadecimal.`,
      kind: 'text',
      answer: hex,
      accept: [`0x${hex}`, hex.toLowerCase()],
      answerHtml: `${n2} = ${hex}₁₆`,
      hints: ['Divide by 16 and read the remainders, using A through F for 10 through 15.',
        `${n2} ÷ 16 = ${Math.floor(n2 / 16)} remainder ${n2 % 16}.`],
      steps: [
        { title: 'Divide by 16', html: `${n2} = ${Math.floor(n2 / 16)} × 16 + ${n2 % 16}` },
        { title: 'Convert each digit', html: `${Math.floor(n2 / 16)} → ${Math.floor(n2 / 16).toString(16).toUpperCase()}, ${n2 % 16} → ${(n2 % 16).toString(16).toUpperCase()}` },
        { title: 'Result', html: `${hex}₁₆` },
      ],
    };
  }

  const hex = n2.toString(16).toUpperCase();
  return {
    stem: `Convert ${hex}₁₆ to decimal.`,
    kind: 'numeric',
    answer: n2,
    answerHtml: String(n2),
    hints: ['Each hex digit is worth a power of 16, and A through F are 10 through 15.',
      hex.length > 1 ? `${parseInt(hex[0], 16)} × 16 + ${parseInt(hex[hex.length - 1], 16)}` : `${hex} is a single digit.`],
    steps: [
      { title: 'Place values', html: hex.split('').map((d, k) => `${parseInt(d, 16)} × ${Math.pow(16, hex.length - 1 - k)}`).join(' + ') },
      { title: 'Add', html: String(n2) },
    ],
  };
}
