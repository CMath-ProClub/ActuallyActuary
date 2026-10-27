/* An expression engine: parse, differentiate, compare.

   This exists so a problem can ask for a DERIVATIVE rather than for f′(3).
   Everything before this graded by comparing numbers or exact strings, which
   is why every derivative topic in gen-calculus.js asks for the value at a
   point instead of the function. Asking for the function means accepting

       6x*cos(3x^2)      6xcos(3x²)      cos(3x^2)*6x      2*3x*cos(3x*x)

   as the same answer, and rejecting 6cos(3x^2) with a reason. No string
   comparison does that, so this does it numerically: parse both sides, then
   evaluate them at a few dozen random points and see whether they agree.

   Two rules this file is built around.

   1. GRADING IS DETERMINISTIC. The sample points come from a seed derived
      from the two expressions being compared, never from Math.random, so the
      same answer always gets the same verdict. A grader that is right 99% of
      the time is a grader that occasionally calls a correct answer wrong,
      and the student has no way to tell which happened.

   2. WHEN IT CANNOT TELL, IT SAYS SO. Sampling can fail: ln(x-9) has no
      valid points in the default window. `equivalent` then returns
      decided:false rather than guessing, and the caller shows the worked
      answer instead of marking anything wrong.

   The derivatives here are MECHANICAL. diff() applies the rules; it does not
   look up an answer a human typed in. That is what lets a generator build a
   function at random and still state the correct derivative, and it is
   checked in tools/test_expr.mjs against a central difference, which is an
   independent way of computing the same thing. */

import MathKit from './math.js';

const { rng, hashSeed } = MathKit;

/* ------------------------------------------------------------------ tables */

/* Functions a student may type, with their derivative rule. `d` returns the
   derivative of fn(u) with respect to its ARGUMENT; the chain rule factor is
   applied by diff() so each entry stays a one-liner. */
const FNS = {
  sin: { f: Math.sin, d: (u) => fn('cos', u) },
  cos: { f: Math.cos, d: (u) => neg(fn('sin', u)) },
  tan: { f: Math.tan, d: (u) => pow(fn('sec', u), num(2)) },
  sec: { f: (v) => 1 / Math.cos(v), d: (u) => mul(fn('sec', u), fn('tan', u)) },
  csc: { f: (v) => 1 / Math.sin(v), d: (u) => neg(mul(fn('csc', u), fn('cot', u))) },
  cot: { f: (v) => 1 / Math.tan(v), d: (u) => neg(pow(fn('csc', u), num(2))) },
  asin: { f: Math.asin, d: (u) => div(num(1), fn('sqrt', sub(num(1), pow(u, num(2))))) },
  acos: { f: Math.acos, d: (u) => neg(div(num(1), fn('sqrt', sub(num(1), pow(u, num(2)))))) },
  atan: { f: Math.atan, d: (u) => div(num(1), add(num(1), pow(u, num(2)))) },
  sinh: { f: Math.sinh, d: (u) => fn('cosh', u) },
  cosh: { f: Math.cosh, d: (u) => fn('sinh', u) },
  tanh: { f: Math.tanh, d: (u) => sub(num(1), pow(fn('tanh', u), num(2))) },
  ln: { f: Math.log, d: (u) => div(num(1), u) },
  log: { f: Math.log10, d: (u) => div(num(1), mul(u, fn('ln', num(10)))) },
  exp: { f: Math.exp, d: (u) => fn('exp', u) },
  sqrt: { f: Math.sqrt, d: (u) => div(num(1), mul(num(2), fn('sqrt', u))) },
  cbrt: { f: Math.cbrt, d: (u) => div(num(1), mul(num(3), pow(fn('cbrt', u), num(2)))) },
  /* abs is differentiable everywhere it matters here except 0, and the
     sampler throws out the point where it does not exist. */
  abs: { f: Math.abs, d: (u) => div(u, fn('abs', u)) },
};

/* Names a student might reasonably type for the same function. */
const FN_ALIAS = {
  arcsin: 'asin', arccos: 'acos', arctan: 'atan',
  loge: 'ln', log10: 'log', lg: 'log',
  tg: 'tan', ctg: 'cot', arctg: 'atan',
};

const CONSTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

/* Characters the page itself renders, so a student who copies the problem
   text and edits it gets a readable expression rather than a parse error.
   math.js writes exponents as Unicode superscripts for exactly that reason. */
const SUPERS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
  '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', 'ⁿ': 'n', 'ˣ': 'x' };

/* ---------------------------------------------------------------- builders */

const num = (v) => ({ t: 'num', v });
const vr = (n) => ({ t: 'var', n });
const cn = (n) => ({ t: 'const', n });
const neg = (a) => ({ t: 'neg', a });
const add = (a, b) => ({ t: 'add', a, b });
const sub = (a, b) => ({ t: 'sub', a, b });
const mul = (a, b) => ({ t: 'mul', a, b });
const div = (a, b) => ({ t: 'div', a, b });
const pow = (a, b) => ({ t: 'pow', a, b });
const fn = (n, a) => ({ t: 'fn', n, a });

/* ------------------------------------------------------------------ parser */

class ParseError extends Error {}

/* Read one brace group. s[i] must be the opening brace. Returns the contents
   and the index just past the close, or null when the braces do not balance.
   A regex cannot do this, because either argument of \frac can itself
   contain braces. */
function readGroup(s, i) {
  if (s[i] !== '{') {
    /* LaTeX allows a single token without braces: \frac12 is one half. */
    if (i < s.length && s[i] !== undefined && !' \t'.includes(s[i])) {
      return [s[i], i + 1];
    }
    return null;
  }
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') {
      depth--;
      if (depth === 0) return [s.slice(i + 1, j), j + 1];
    }
  }
  return null;
}

/* \frac and \sqrt, which take brace arguments rather than parentheses. */
function expandBraceCommands(src) {
  let s = src;
  for (let pass = 0; pass < 64; pass++) {
    const frac = s.indexOf('\\frac');
    const root = s.indexOf('\\sqrt');
    if (frac < 0 && root < 0) break;
    const first = frac < 0 ? root : root < 0 ? frac : Math.min(frac, root);
    if (first === frac) {
      let i = frac + 5;
      while (s[i] === ' ') i++;
      const top = readGroup(s, i);
      if (!top) break;
      let k = top[1];
      while (s[k] === ' ') k++;
      const bottom = readGroup(s, k);
      if (!bottom) break;
      s = `${s.slice(0, frac)}((${top[0]})/(${bottom[0]}))${s.slice(bottom[1])}`;
    } else {
      let i = root + 5;
      let index = null;
      if (s[i] === '[') {
        const close = s.indexOf(']', i);
        if (close < 0) break;
        index = s.slice(i + 1, close);
        i = close + 1;
      }
      while (s[i] === ' ') i++;
      const arg = readGroup(s, i);
      if (!arg) break;
      s = index
        ? `${s.slice(0, root)}((${arg[0]})^(1/(${index})))${s.slice(arg[1])}`
        : `${s.slice(0, root)}sqrt(${arg[0]})${s.slice(arg[1])}`;
    }
  }
  return s;
}

/* LaTeX in, ordinary expression text out.

   The OCR model answers in LaTeX, and so does anything pasted out of a
   textbook PDF or a Desmos expression, so the parser accepts it rather than
   making every caller strip it first. Only the subset that turns up in this
   kind of problem is handled. Anything else survives as a backslash, which
   the tokenizer refuses by name, and that is the point: a silent misreading
   of someone's homework is worse than being told it could not be read. */
function latexToText(src) {
  let s = String(src);
  s = s.replace(/\$+/g, ' ')
    .replace(/\\left|\\right/g, '')
    .replace(/\\[,;:!]/g, ' ')
    .replace(/\\(?:displaystyle|textstyle|limits)\b/g, '')
    .replace(/\\(?:mathrm|operatorname|text|mathit|mathbf)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\tau\b/g, 'tau');
  s = expandBraceCommands(s);
  /* Function names. \ln and \sin are the same functions the tokenizer
     already knows, just spelled with a backslash. */
  s = s.replace(/\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|ln|log|exp|abs)\b/g, '$1');
  /* ^{...} becomes ^(...), innermost first so x^{2y^{3}} survives. */
  for (let pass = 0; pass < 12; pass++) {
    const next = s.replace(/\^\s*\{([^{}]*)\}/g, '^($1)');
    if (next === s) break;
    s = next;
  }
  /* Any grouping braces left over behave exactly like parentheses. */
  s = s.replace(/\{/g, '(').replace(/\}/g, ')');
  return s;
}

/* Turn source text into tokens. Normalizing happens here so the parser only
   ever sees ASCII: unicode minus, the multiplication and division signs,
   superscript digits and √ all arrive from copied problem text, and LaTeX
   arrives from the OCR model and from pasted textbook material. */
function normalize(src) {
  let s = String(src == null ? '' : src);
  /* Braces alone are enough to mean LaTeX: e^{5x} carries no backslash and
     no dollar signs, and it is exactly what gets pasted out of a PDF. */
  if (/[\\${}]/.test(s)) s = latexToText(s);
  s = s.replace(/[−–—]/g, '-')   /* − – — */
    .replace(/[·•×∗]/g, '*') /* · • × ∗ */
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
    .replace(/[π]/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/[“”‘’]/g, '');
  /* A run of superscripts becomes ^(...). Done as a run so x²³ is x^(23). */
  s = s.replace(/[⁰¹²³⁴-⁹⁻ⁿˣ]+/g,
    (run) => '^(' + [...run].map((c) => SUPERS[c] || '').join('') + ')');
  return s.trim();
}

function tokenize(src) {
  const s = normalize(src);
  const out = [];
  let i = 0;
  const isDigit = (c) => c >= '0' && c <= '9';
  const isAlpha = (c) => /[a-z]/i.test(c || '');
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (isDigit(c) || (c === '.' && isDigit(s[i + 1]))) {
      /* A mixed number: "2 1/4" is 2.25, not 2 times a quarter. math.js
         parseNumber already reads it that way and the two parsers must not
         disagree, or the same keystrokes mean different things in the
         numeric box and the expression box. */
      const mixed = s.slice(i).match(/^(\d+)[ \t]+(\d+)\/(\d+)(?![\d.])/);
      if (mixed) {
        out.push({ k: 'num', v: Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) });
        i += mixed[0].length;
        continue;
      }
      const m = s.slice(i).match(/^\d*\.?\d+/);
      out.push({ k: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (isAlpha(c)) {
      const word = s.slice(i).match(/^[a-z]+/i)[0].toLowerCase();
      /* Longest known name wins, so "sinh" never reads as "sin" then "h",
         and the leftovers of a word become single-letter variables, which is
         what makes xy mean x times y. */
      let taken = 0;
      for (let len = word.length; len > 0; len--) {
        const head = word.slice(0, len);
        const canon = FN_ALIAS[head] || head;
        if (FNS[canon]) { out.push({ k: 'fn', v: canon }); taken = len; break; }
        if (CONSTS[head]) { out.push({ k: 'const', v: head }); taken = len; break; }
      }
      if (!taken) { out.push({ k: 'var', v: word[0] }); taken = 1; }
      i += taken;
      continue;
    }
    if ('+-*/^(),'.includes(c)) { out.push({ k: c }); i++; continue; }
    throw new ParseError(`I do not know what to do with "${c}".`);
  }
  return out;
}

/* Recursive descent, with implicit multiplication.

   Unary minus binds LOOSER than ^, so -x^2 is -(x^2). math.js parseNumber
   made the same choice, and the two must agree: a student checking a number
   in one box and an expression in the other cannot get different answers. */
function parse(src, opts = null) {
  const toks = tokenize(src);
  let i = 0;
  const peek = (o = 0) => toks[i + o];
  const at = (k) => peek() && peek().k === k;
  const eat = (k) => { if (at(k)) { i++; return true; } return false; };

  function expression() {
    let v = term();
    for (;;) {
      if (eat('+')) v = add(v, term());
      else if (eat('-')) v = sub(v, term());
      else return v;
    }
  }

  function term() {
    let v = unary();
    for (;;) {
      if (eat('*')) v = mul(v, unary());
      else if (eat('/')) v = div(v, unary());
      else if (startsFactor()) v = mul(v, unary()); /* implicit: 2x, xy, 3(x+1) */
      else return v;
    }
  }

  /* Can a factor start here? Only then is juxtaposition a multiplication.
     A number may not follow a number (12 3 is a typo, not 36). */
  function startsFactor() {
    const p = peek();
    if (!p) return false;
    if (p.k === 'var' || p.k === 'const' || p.k === 'fn' || p.k === '(') return true;
    return false;
  }

  function unary() {
    if (eat('-')) return neg(unary());
    if (eat('+')) return unary();
    return power();
  }

  function power() {
    const base = atom();
    if (eat('^')) return pow(base, unary()); /* right associative, 2^-3 works */
    return base;
  }

  function atom() {
    const p = peek();
    if (!p) throw new ParseError('The expression stops early.');
    if (eat('(')) {
      const v = expression();
      if (!eat(')')) throw new ParseError('A closing parenthesis is missing.');
      return v;
    }
    if (p.k === 'num') { i++; return num(p.v); }
    if (p.k === 'var') { i++; return vr(p.v); }
    if (p.k === 'const') { i++; return cn(p.v); }
    if (p.k === 'fn') {
      i++;
      const name = p.v;
      /* sin^2(x) is how trig powers are written by hand, so accept it and
         read it as (sin x)^2 rather than sin(sin x). */
      let outerPow = null;
      if (eat('^')) outerPow = unary();
      const argument = functionArgument(name);
      const call = fn(name, argument);
      return outerPow ? pow(call, outerPow) : call;
    }
    throw new ParseError(`"${p.k === 'num' ? p.v : p.k}" cannot start a term.`);
  }

  /* Parentheses are the normal way to call a function. A bare argument is
     allowed only when it is a single number or variable AND nothing follows
     that could extend it, because "sin 2x" could mean sin(2x) or sin(2)·x
     and a grader must never quietly pick one. */
  function functionArgument(name) {
    if (at('(')) {
      i++;
      const v = expression();
      if (!eat(')')) throw new ParseError(`${name}( is never closed.`);
      return v;
    }
    const p = peek();
    const after = peek(1);
    const extendable = after && (after.k === 'var' || after.k === 'const'
      || after.k === 'num' || after.k === 'fn' || after.k === '(' || after.k === '^');
    if (p && (p.k === 'var' || p.k === 'num' || p.k === 'const') && !extendable) {
      i++;
      return p.k === 'num' ? num(p.v) : p.k === 'var' ? vr(p.v) : cn(p.v);
    }
    throw new ParseError(`Put ${name}'s argument in parentheses, like ${name}(2x).`);
  }

  const node = expression();
  if (i < toks.length) {
    throw new ParseError('There is something extra on the end I could not read.');
  }
  /* Single letters multiply, which is what makes xy mean x times y - and it
     also means PROSE parses as math. "Find dy/dx if x^2" reads as
     d*y/d*x*i*f*x^2 and would then be solved as though it were the problem.
     A caller that knows which letters are legitimate says so, and anything
     else is refused by name. Free typing passes no list and keeps the
     permissive behaviour. */
  if (opts && opts.vars) {
    const allowed = new Set(opts.vars);
    const strays = [...vars(node)].filter((v) => !allowed.has(v));
    if (strays.length) {
      throw new ParseError(
        `I read ${strays.map((v) => `"${v}"`).join(', ')} as `
        + `${strays.length === 1 ? 'a variable' : 'variables'}, and this problem `
        + `only uses ${opts.vars.join(' and ')}. Is there a word left in there?`);
    }
  }
  return node;
}

/* parse, but null instead of an exception. Callers that want the message use
   parse inside a try. */
function tryParse(src, opts = null) {
  try {
    return parse(src, opts);
  } catch (err) {
    return null;
  }
}

function parseMessage(src, opts = null) {
  try {
    parse(src, opts);
    return null;
  } catch (err) {
    return err instanceof ParseError ? err.message : 'I could not read that.';
  }
}

/* --------------------------------------------------------------- evaluate */

function evaluate(node, scope = {}) {
  switch (node.t) {
    case 'num': return node.v;
    case 'const': return CONSTS[node.n];
    case 'var': {
      const v = scope[node.n];
      return v === undefined ? NaN : v;
    }
    case 'neg': return -evaluate(node.a, scope);
    case 'add': return evaluate(node.a, scope) + evaluate(node.b, scope);
    case 'sub': return evaluate(node.a, scope) - evaluate(node.b, scope);
    case 'mul': return evaluate(node.a, scope) * evaluate(node.b, scope);
    case 'div': return evaluate(node.a, scope) / evaluate(node.b, scope);
    case 'pow': {
      const b = evaluate(node.a, scope);
      const e = evaluate(node.b, scope);
      /* A negative base with a fractional exponent is complex. JS says NaN,
         which the sampler drops, and that is the behaviour we want. */
      return Math.pow(b, e);
    }
    case 'fn': return FNS[node.n].f(evaluate(node.a, scope));
    default: return NaN;
  }
}

/* A reusable closure, for the thousands of evaluations a sampling comparison
   or a graph does. */
function compile(node) {
  return (scope) => evaluate(node, scope);
}

function vars(node, into = new Set()) {
  if (node.t === 'var') into.add(node.n);
  if (node.a) vars(node.a, into);
  if (node.b) vars(node.b, into);
  return into;
}

/* ------------------------------------------------------------ differentiate */

/* d/dv of node. Mechanical, rule by rule. The only interesting case is pow,
   where the general rule u^w covers x^2, 2^x and x^x at once; the constant
   exponent case is spelled out separately because it keeps the answers
   readable (3x² rather than 3x²(2·ln(x)·0 + ...)). */
function diff(node, v = 'x') {
  switch (node.t) {
    case 'num':
    case 'const':
      return num(0);
    case 'var':
      return num(node.n === v ? 1 : 0);
    case 'neg':
      return neg(diff(node.a, v));
    case 'add':
      return add(diff(node.a, v), diff(node.b, v));
    case 'sub':
      return sub(diff(node.a, v), diff(node.b, v));
    case 'mul':
      return add(mul(diff(node.a, v), node.b), mul(node.a, diff(node.b, v)));
    case 'div':
      return div(
        sub(mul(diff(node.a, v), node.b), mul(node.a, diff(node.b, v))),
        pow(node.b, num(2)),
      );
    case 'pow': {
      const base = node.a;
      const expo = node.b;
      const dBase = diff(base, v);
      const dExpo = diff(expo, v);
      const expoConst = isZero(simplify(dExpo));
      if (expoConst) {
        /* w constant: w·u^(w-1)·u′ */
        return mul(mul(expo, pow(base, sub(expo, num(1)))), dBase);
      }
      if (isZero(simplify(dBase))) {
        /* u constant: a^w · ln(a) · w′ */
        return mul(mul(pow(base, expo), fn('ln', base)), dExpo);
      }
      /* Both vary: u^w (w′·ln u + w·u′/u) */
      return mul(pow(base, expo),
        add(mul(dExpo, fn('ln', base)), div(mul(expo, dBase), base)));
    }
    case 'fn':
      return mul(FNS[node.n].d(node.a), diff(node.a, v));
    default:
      return num(0);
  }
}

/* --------------------------------------------------------------- simplify */

const isNum = (n) => n.t === 'num';
const isZero = (n) => n.t === 'num' && n.v === 0;
const isOne = (n) => n.t === 'num' && n.v === 1;
/* Structural identity, by comparing printed form. Cheap, and exact enough
   for the cancellations in simplify: two trees that print the same ARE the
   same tree. */
const sameTree = (a, b) => {
  try {
    return text(a) === text(b);
  } catch (err) {
    return false;
  }
};

/* Enough simplification to make a stated answer readable, and no more. This
   is not a CAS: it folds constants and drops identities, it does not collect
   like terms or factor. Anything it cannot tidy it leaves alone, because a
   long correct answer beats a short wrong one. */
function simplify(node) {
  switch (node.t) {
    case 'neg': {
      const a = simplify(node.a);
      if (isNum(a)) return num(-a.v);
      if (a.t === 'neg') return a.a;
      return neg(a);
    }
    case 'add': {
      const a = simplify(node.a);
      const b = simplify(node.b);
      if (isZero(a)) return b;
      if (isZero(b)) return a;
      if (isNum(a) && isNum(b)) return num(a.v + b.v);
      if (b.t === 'neg') return simplify(sub(a, b.a));
      return add(a, b);
    }
    case 'sub': {
      const a = simplify(node.a);
      const b = simplify(node.b);
      if (isZero(b)) return a;
      if (isZero(a)) return simplify(neg(b));
      if (isNum(a) && isNum(b)) return num(a.v - b.v);
      if (b.t === 'neg') return simplify(add(a, b.a));
      return sub(a, b);
    }
    case 'mul': {
      let a = simplify(node.a);
      let b = simplify(node.b);
      if (isZero(a) || isZero(b)) return num(0);
      if (isOne(a)) return b;
      if (isOne(b)) return a;
      if (isNum(a) && isNum(b)) return num(a.v * b.v);
      /* Numbers to the front, so 3x reads as 3x and not x·3. */
      if (isNum(b) && !isNum(a)) [a, b] = [b, a];
      /* -1 is a sign, not a coefficient: "-1x^2 - 6x" is not how anybody
         writes it down. */
      if (isNum(a) && a.v === -1) return simplify(neg(b));
      /* Fold a number into a nested numeric coefficient: 2·(3x) -> 6x. */
      if (isNum(a) && b.t === 'mul' && isNum(b.a)) {
        return simplify(mul(num(a.v * b.a.v), b.b));
      }
      /* And into a fraction: 6·(1/(2√x)) -> 6/(2√x), which then reduces. */
      if (isNum(a) && b.t === 'div' && isNum(b.a)) {
        return simplify(div(num(a.v * b.a.v), b.b));
      }
      if (a.t === 'neg') return simplify(neg(mul(a.a, b)));
      if (b.t === 'neg') return simplify(neg(mul(a, b.a)));
      /* (p/q)*q is p.

         Not a flourish. Differentiating ln(u) gives u'/u, so a chain
         rule through a logarithm leaves (1/u)*u sitting in the answer.
         On e^y = 17 ln(x^sin(xy)) that one rule is the difference
         between an answer somebody can read and a line of noise with
         the cancellation still in it. */
      if (a.t === 'div' && sameTree(a.b, b)) return simplify(a.a);
      if (b.t === 'div' && sameTree(b.b, a)) return simplify(b.a);
      /* n*(p/q) is (n*p)/q, which keeps the coefficient where it reads. */
      if (isNum(a) && b.t === 'div') return simplify(div(mul(a, b.a), b.b));
      /* A number buried in a product comes to the front: x*2*y is 2xy. */
      if (!isNum(a) && b.t === 'mul' && isNum(b.a)) {
        return simplify(mul(b.a, mul(a, b.b)));
      }
      return mul(a, b);
    }
    case 'div': {
      const a = simplify(node.a);
      const b = simplify(node.b);
      if (isZero(a)) return num(0);
      if (isOne(b)) return a;
      if (isNum(a) && isNum(b) && b.v !== 0 && Number.isInteger(a.v / b.v)) {
        return num(a.v / b.v);
      }
      /* p/(1/q) is p*q. d/dx ln(y) is 1/y, so dividing by it turns up
         every time a logarithm of y is differentiated implicitly. */
      if (b.t === 'div' && isOne(b.a)) return simplify(mul(a, b.b));
      /* p/p is 1, whatever p is. */
      if (sameTree(a, b)) return num(1);
      /* A minus sign in a fraction belongs in front of the fraction, not
         inside it. mul already does this; without it in div, an implicit
         answer comes out as -(-(3cos(3xy)y)/(...)) - correct, and not
         something anybody would copy down. */
      if (a.t === 'neg') return simplify(neg(div(a.a, b)));
      if (b.t === 'neg') return simplify(neg(div(a, b.a)));
      if (isNum(a) && a.v < 0 && !isNum(b)) return simplify(neg(div(num(-a.v), b)));
      return div(a, b);
    }
    case 'pow': {
      const a = simplify(node.a);
      const b = simplify(node.b);
      if (isZero(b)) return num(1);
      if (isOne(b)) return a;
      if (isNum(a) && isNum(b) && Number.isInteger(b.v) && Math.abs(b.v) <= 6) {
        return num(Math.pow(a.v, b.v));
      }
      return pow(a, b);
    }
    case 'fn': {
      const a = simplify(node.a);
      /* ln(e) is 1, and it turns up constantly: the general rule for a^u
         produces a^u·ln(a)·u′, so differentiating e^(5x) leaves a literal
         ln(e) sitting in an otherwise clean answer. */
      if (a.t === 'const' && a.n === 'e' && node.n === 'ln') return num(1);
      if (isNum(a) && node.n === 'ln' && a.v === 1) return num(0);
      if (isNum(a) && node.n === 'sqrt' && Number.isInteger(Math.sqrt(a.v))) {
        return num(Math.sqrt(a.v));
      }
      return fn(node.n, a);
    }
    default:
      return node;
  }
}

/* The derivative, tidied. What a generator states as its answer. */
function derivative(node, v = 'x') {
  return simplify(simplify(diff(node, v)));
}

/* ----------------------------------------------------------------- output */

/* Precedence, so printing only parenthesizes where it has to. */
const PREC = { add: 1, sub: 1, mul: 2, div: 2, neg: 3, pow: 4, fn: 5, num: 6, var: 6, const: 6 };

/* "3x + -5" is what a naive printer produces and no one writes. A term that
   is negative is SUBTRACTED, in every one of the three output formats. */
function negativePart(node) {
  if (node.t === 'neg') return node.a;
  if (node.t === 'num' && node.v < 0) return num(-node.v);
  /* A product with a negative in front: -3*x. The negative can be a literal
     number or a neg node, because "-2*x" parses as mul(neg(2), x) rather
     than mul(-2, x). */
  if (node.t === 'mul') {
    const head = negativePart(node.a);
    /* -1*cos(x) is "- cos(x)", not "- 1cos(x)". */
    if (head) return isOne(head) ? node.b : mul(head, node.b);
  }
  if (node.t === 'div') {
    const head = negativePart(node.a);
    if (head) return div(head, node.b);
  }
  return null;
}

function text(node, parent = 0) {
  const p = PREC[node.t] || 6;
  const wrap = (s) => (p < parent ? `(${s})` : s);
  switch (node.t) {
    case 'num': return String(round(node.v));
    case 'const': return node.n;
    case 'var': return node.n;
    case 'neg': return wrap(`-${text(node.a, PREC.neg)}`);
    case 'add': {
      const flip = negativePart(node.b);
      if (flip) return wrap(`${text(node.a, 1)} - ${text(flip, 2)}`);
      return wrap(`${text(node.a, 1)} + ${text(node.b, 1)}`);
    }
    case 'sub': return wrap(`${text(node.a, 1)} - ${text(node.b, 2)}`);
    case 'mul': {
      if (isOne(node.a)) return text(node.b, parent);
      if (isOne(node.b)) return text(node.a, parent);
      return wrap(`${text(node.a, 2)}*${text(node.b, 2)}`);
    }
    case 'div': return wrap(`${text(node.a, 2)}/${text(node.b, 3)}`);
    case 'pow': return wrap(`${text(node.a, 5)}^${text(node.b, 4)}`);
    case 'fn': return `${node.n}(${text(node.a, 0)})`;
    default: return '?';
  }
}

/* Rendered for the page, in the same vocabulary math.js already uses:
   Unicode superscripts, a stacked fraction, a real radical sign. */
function html(node, parent = 0) {
  const p = PREC[node.t] || 6;
  const wrap = (s) => (p < parent ? `(${s})` : s);
  switch (node.t) {
    case 'num': return String(round(node.v)).replace('-', '−');
    case 'const': return node.n === 'pi' ? 'π' : node.n;
    case 'var': return `<i>${MathKit.esc(node.n)}</i>`;
    case 'neg': return wrap(`−${html(node.a, PREC.neg)}`);
    case 'add': {
      const flip = negativePart(node.b);
      if (flip) return wrap(`${html(node.a, 1)} − ${html(flip, 2)}`);
      return wrap(`${html(node.a, 1)} + ${html(node.b, 1)}`);
    }
    case 'sub': return wrap(`${html(node.a, 1)} − ${html(node.b, 2)}`);
    case 'mul': {
      /* A coefficient of one is not written. x^2 reads as x^2, never 1x^2. */
      if (isOne(node.a)) return html(node.b, parent);
      if (isOne(node.b)) return html(node.a, parent);
      const left = html(node.a, 2);
      const right = html(node.b, 2);
      /* 3x and x·sin(x) need no dot. Two numbers do, or 2·3 reads as 23.
         Neither does a bracket: (x-4)(x-2) is how it is written by hand. */
      const bracketed = node.b.t === 'add' || node.b.t === 'sub' || node.b.t === 'neg';
      const bare = node.b.t === 'var' || node.b.t === 'pow' || bracketed
        || (node.b.t === 'fn' && isNum(node.a));
      const needsDot = isNum(node.a) && isNum(node.b);
      return wrap(`${left}${needsDot || !bare ? '·' : ''}${right}`);
    }
    case 'div': return wrap(MathKit.frac(html(node.a, 0), html(node.b, 0)));
    case 'pow': {
      const e = node.b;
      const plain = (isNum(e) && Number.isInteger(e.v))
        || e.t === 'var' || (e.t === 'neg' && isNum(e.a));
      /* sin(x)^2 is written sin^2(x). The exponent goes on the FUNCTION,
         which is the one piece of notation where maths puts it somewhere
         other than after the thing being raised. */
      if (plain && node.a.t === 'fn' && isNum(e) && e.v > 0
        && !['sqrt', 'exp', 'abs'].includes(node.a.n)) {
        const name = { asin: 'arcsin', acos: 'arccos', atan: 'arctan' }[node.a.n] || node.a.n;
        return `${name}${MathKit.sup(text(e))}(${html(node.a.a, 0)})`;
      }
      /* A base that already carries a superscript or a radical has to be
         bracketed, or (e^x)^2 and e^(x^2) look identical on the page, and
         so do the square of a root and the root of a square. */
      const ambiguous = (node.a.t === 'fn' && ['exp', 'sqrt', 'cbrt'].includes(node.a.n))
        || node.a.t === 'pow';
      const base = ambiguous ? `(${html(node.a, 0)})` : html(node.a, 5);
      if (plain) return wrap(`${base}${MathKit.sup(text(e))}`);
      return wrap(`${base}^(${html(e, 0)})`);
    }
    case 'fn': {
      if (node.n === 'sqrt') return MathKit.sqrt(html(node.a, 0));
      /* Nobody writes asin. The parser accepts both spellings; the page
         shows the one a textbook uses. */
      if (node.n === 'asin') return `arcsin(${html(node.a, 0)})`;
      if (node.n === 'acos') return `arccos(${html(node.a, 0)})`;
      if (node.n === 'atan') return `arctan(${html(node.a, 0)})`;
      /* e to a power. The exponent is rendered rather than printed as
         source, because sup() can only use Unicode superscripts for digits
         and falls back to literal text for anything else - which is how
         e^(2x) came out as "e2*x". */
      if (node.n === 'exp') {
        const e = node.a;
        const plain = (isNum(e) && Number.isInteger(e.v)) || e.t === 'var';
        return plain ? `e${MathKit.sup(text(e))}` : `e<span class="sup">${html(e, 0)}</span>`;
      }
      return `${node.n}(${html(node.a, 0)})`;
    }
    default: return '?';
  }
}

/* LaTeX, because that is the only language Desmos takes. */
function latex(node, parent = 0) {
  const p = PREC[node.t] || 6;
  const wrap = (s) => (p < parent ? `\\left(${s}\\right)` : s);
  switch (node.t) {
    case 'num': return String(round(node.v));
    case 'const': return node.n === 'pi' ? '\\pi' : node.n === 'tau' ? '\\tau' : 'e';
    case 'var': return node.n;
    case 'neg': return wrap(`-${latex(node.a, PREC.neg)}`);
    case 'add': {
      const flip = negativePart(node.b);
      if (flip) return wrap(`${latex(node.a, 1)}-${latex(flip, 2)}`);
      return wrap(`${latex(node.a, 1)}+${latex(node.b, 1)}`);
    }
    case 'sub': return wrap(`${latex(node.a, 1)}-${latex(node.b, 2)}`);
    case 'mul': return wrap(`${latex(node.a, 2)}\\cdot ${latex(node.b, 2)}`);
    case 'div': return `\\frac{${latex(node.a, 0)}}{${latex(node.b, 0)}}`;
    case 'pow': return wrap(`${latex(node.a, 5)}^{${latex(node.b, 0)}}`);
    case 'fn': {
      if (node.n === 'sqrt') return `\\sqrt{${latex(node.a, 0)}}`;
      if (node.n === 'exp') return `e^{${latex(node.a, 0)}}`;
      if (node.n === 'abs') return `\\left|${latex(node.a, 0)}\\right|`;
      if (node.n === 'ln') return `\\ln\\left(${latex(node.a, 0)}\\right)`;
      return `\\${node.n}\\left(${latex(node.a, 0)}\\right)`;
    }
    default: return '';
  }
}

function round(v) {
  if (!isFinite(v)) return v;
  if (Number.isInteger(v)) return v;
  return Number(v.toFixed(6));
}

/* --------------------------------------------------------------- sampling */

/* Points to test two expressions against each other.

   Deliberately NOT integers. Integer samples agree by coincidence far too
   often: x² and 2ˣ both give 4 at x = 2, and x/x² and 1/x agree everywhere
   an integer lands. Irrational-looking points make an accidental match
   essentially impossible.

   Three bands, because domains differ: positive only (ln, sqrt), the unit
   interval (asin, acos) and a wider two-sided band. A point is kept only
   when BOTH sides are finite there, which is what makes ln(x²) and 2ln(x)
   compare equal: they are equal everywhere both are defined. */
function samplePoints(names, seed, count = 48) {
  const r = rng(seed);
  const bands = [
    () => 0.17 + r() * 2.6,            /* positive */
    () => -2.8 + r() * 5.6,            /* two sided */
    () => (r() < 0.5 ? -1 : 1) * (0.08 + r() * 0.83), /* inside the unit circle */
  ];
  const out = [];
  for (let k = 0; k < count; k++) {
    const band = bands[k % bands.length];
    const scope = {};
    for (const n of names) {
      let v = band();
      /* Never land on an exact integer or exact zero. */
      if (Math.abs(v - Math.round(v)) < 1e-3) v += 0.137;
      scope[n] = v;
    }
    out.push(scope);
  }
  return out;
}

const BIG = 1e7;
const MIN_POINTS = 10;

/* Points where BOTH expressions are actually defined.

   The standard bands find them for almost everything, but a function can
   live on a narrow interval well away from the origin: sqrt(-5x - 7) exists
   only for x <= -1.4, and (2x - 4)^x needs 2x - 4 > 0, so x > 2. A sampler
   that only looks near zero finds nothing there and the comparison has to
   report "I cannot tell", which is honest but useless.

   So when the first pass comes up short, sweep a wide interval to find where
   the pair is alive, then sample around those anchors. The sweep is
   deterministic and the jitter is seeded, so a given comparison still always
   produces the same verdict. This matters beyond generated problems: a
   student pasting in their own homework function gets whatever domain it
   has. */
function validPoints(f, g, list, seed, want = 60) {
  const alive = (scope) => {
    const va = f(scope);
    const vb = g(scope);
    return isFinite(va) && isFinite(vb)
      && Math.abs(va) <= BIG && Math.abs(vb) <= BIG;
  };

  const keep = [];
  for (const scope of samplePoints(list, seed, want)) {
    if (alive(scope)) keep.push(scope);
  }
  if (keep.length >= MIN_POINTS) return keep;

  /* Pass two: hunt for the live region. One variable gets a fine sweep of
     the line, two get a coarse grid of the plane, which is all implicit
     problems need. The offset keeps the sweep off the integers, where poles
     and kinks cluster. */
  const single = list.length === 1;
  const span = single ? 24 : 9;
  const steps = single ? 720 : 90;
  const anchors = [];
  if (single) {
    const name = list[0];
    for (let k = 0; k <= steps; k++) {
      const scope = { [name]: -span + (2 * span * k) / steps + 0.0137 };
      if (alive(scope)) anchors.push(scope);
    }
  } else {
    for (let k = 0; k <= steps; k++) {
      for (let j = 0; j <= steps; j++) {
        const scope = {};
        list.forEach((name, idx) => {
          const t = idx === 0 ? k : j;
          scope[name] = -span + (2 * span * t) / steps + 0.0137;
        });
        if (alive(scope)) anchors.push(scope);
      }
    }
  }
  if (!anchors.length) return keep;

  const r = rng((seed ^ 0x5bf03635) >>> 0);
  const jitter = (2 * span) / steps;
  let guard = 0;
  while (keep.length < want && guard++ < want * 40) {
    const base = anchors[Math.floor(r() * anchors.length)];
    const scope = {};
    for (const name of list) scope[name] = base[name] + (r() - 0.5) * jitter;
    if (alive(scope)) keep.push(scope);
  }
  /* If even the jitter keeps falling outside the domain, the anchors
     themselves are valid points and are better than nothing. */
  if (keep.length < MIN_POINTS) {
    for (const a of anchors) {
      keep.push(a);
      if (keep.length >= want) break;
    }
  }
  return keep;
}

/* Are these the same function? Returns {equal, decided, used}.

   `decided:false` means sampling could not find enough points where both
   sides are defined. The caller must not treat that as wrong. */
function equivalent(a, b, opts = {}) {
  if (!a || !b) return { equal: false, decided: false, used: 0 };
  const tol = opts.tol || 1e-7;
  const names = new Set([...vars(a), ...vars(b)]);
  if (opts.allow) for (const n of opts.allow) names.add(n);
  /* A constant expression still needs one evaluation. */
  const list = names.size ? [...names] : ['x'];
  const seed = opts.seed != null ? opts.seed : hashSeed(`${text(a)}|${text(b)}`);
  const f = compile(a);
  const g = compile(b);
  /* `scopes` lets the caller supply its own points. Implicit differentiation
     needs this: dy/dx for x² + y² = 25 is -x/y, and a student may write a
     form that only agrees with it ON the curve. Sampling the whole plane
     would reject a correct answer, so the generator passes points it has
     solved onto the curve instead. Caller-supplied points are trusted, so a
     short list of them is enough to decide. */
  const points = opts.scopes || validPoints(f, g, list, seed, opts.count || 60);
  const need = opts.minPoints
    || (opts.scopes ? Math.min(MIN_POINTS, opts.scopes.length) : MIN_POINTS);
  let used = 0;
  let agree = 0;
  for (const scope of points) {
    const va = f(scope);
    const vb = g(scope);
    if (!isFinite(va) || !isFinite(vb)) continue;
    if (Math.abs(va) > BIG || Math.abs(vb) > BIG) continue;
    used++;
    const scale = Math.max(1, Math.abs(va), Math.abs(vb));
    if (Math.abs(va - vb) <= tol * scale) agree++;
  }
  if (used < need) return { equal: false, decided: false, used };
  return { equal: agree === used, decided: true, used, agree };
}

/* Is the ratio student/reference the same number everywhere? That is the
   signature of a dropped or doubled coefficient, which is the most common
   way a correct method produces a wrong answer. Returns the constant, or
   null. Same idea for a difference, which means a dropped term. */
function constantRatio(a, b, seed, scopes = null) {
  const names = new Set([...vars(a), ...vars(b)]);
  const list = names.size ? [...names] : ['x'];
  const f = compile(a);
  const g = compile(b);
  let first = null;
  let used = 0;
  for (const scope of scopes || validPoints(f, g, list, seed, 48)) {
    const va = f(scope);
    const vb = g(scope);
    if (!isFinite(va) || !isFinite(vb)) continue;
    if (Math.abs(vb) < 1e-6 || Math.abs(va) > BIG || Math.abs(vb) > BIG) continue;
    const q = va / vb;
    used++;
    if (first === null) first = q;
    else if (Math.abs(q - first) > 1e-6 * Math.max(1, Math.abs(first))) return null;
  }
  return used >= 8 ? first : null;
}

function constantDifference(a, b, seed, scopes = null) {
  const names = new Set([...vars(a), ...vars(b)]);
  const list = names.size ? [...names] : ['x'];
  const f = compile(a);
  const g = compile(b);
  let first = null;
  let used = 0;
  for (const scope of scopes || validPoints(f, g, list, seed, 48)) {
    const va = f(scope);
    const vb = g(scope);
    if (!isFinite(va) || !isFinite(vb)) continue;
    if (Math.abs(va) > BIG || Math.abs(vb) > BIG) continue;
    const d = va - vb;
    used++;
    if (first === null) first = d;
    else if (Math.abs(d - first) > 1e-6 * Math.max(1, Math.abs(first))) return null;
  }
  return used >= 8 ? first : null;
}

/* Is this expression identically zero over its own domain? A derivative that
   is means the function was secretly a constant, and such a problem cannot
   be graded: every wrong answer that is also zero grades as correct. */
function isIdenticallyZero(node) {
  const v = equivalent(node, num(0));
  return v.decided && v.equal;
}

/* ----------------------------------------------------------- term matching */

/* Flatten a sum into signed terms, so "3x - sin(x) + 2" is three things.
   This is what lets a hint say WHICH term is wrong instead of just "no". */
function terms(node, sign = 1, out = []) {
  if (node.t === 'add') {
    terms(node.a, sign, out);
    terms(node.b, sign, out);
  } else if (node.t === 'sub') {
    terms(node.a, sign, out);
    terms(node.b, -sign, out);
  } else if (node.t === 'neg') {
    terms(node.a, -sign, out);
  } else {
    out.push({ node, sign });
  }
  return out;
}

const signed = (t) => (t.sign < 0 ? neg(t.node) : t.node);

/* Pair up the student's terms with the reference's. Returns what matched and
   what did not, which is the whole basis of a useful hint. */
function matchTerms(student, reference) {
  const mine = terms(student);
  const theirs = terms(reference);
  const pool = theirs.map((t, idx) => ({ t, idx, taken: false }));
  const matched = [];
  const extra = [];
  for (const t of mine) {
    const hit = pool.find((c) => !c.taken
      && equivalent(signed(t), signed(c.t), { count: 24 }).equal);
    if (hit) { hit.taken = true; matched.push({ mine: t, theirs: hit.t }); }
    else extra.push(t);
  }
  const missing = pool.filter((c) => !c.taken).map((c) => c.t);
  return { matched, extra, missing, mineCount: mine.length, theirCount: theirs.length };
}

/* ------------------------------------------------------------ the verdict */

/* Grade a typed expression against the reference, and when it is wrong, say
   something specific about HOW.

   `context` may carry:
     original   the function being differentiated, so "that is f, not f′"
     inner      the inside function u, for chain rule diagnosis
     distractors  [{node, hint}] - deliberately broken derivations from the
                  generator, which give the sharpest hints of all because
                  they name the actual mistake

   Returns { correct, decided, kind, hint }. `kind` is a stable slug so the
   UI and the tests can both key off it. */
/* Parse what was typed, with the letters restricted to the ones the problem
   actually uses. Returns {node} or {error}. Shared by every judge below. */
function readAnswer(raw, reference, context = {}) {
  /* A typo like "6x cos" tokenizes to a product with c, o and s in it, and
     grading that silently is worse than refusing it. */
  const allowed = context.vars
    || (reference ? [...new Set([...vars(reference), 'x'])] : null);
  const limit = allowed ? { vars: allowed } : null;
  const error = parseMessage(raw, limit);
  if (error) return { error };
  return { node: parse(raw, limit) };
}

function judge(raw, reference, context = {}) {
  const read = readAnswer(raw, reference, context);
  if (read.error) {
    return { correct: false, decided: true, kind: 'unreadable', hint: read.error };
  }
  return diagnose(read.node, reference, context);
}

/* Compare a parsed answer against a parsed reference and say what went
   wrong. Split out from judge() so an antiderivative can run the SAME
   diagnostics on the derivative of what was typed. */
function diagnose(student, reference, context = {}) {
  /* Every comparison below has to use the SAME points as the first one, or a
     curve-restricted problem would be judged on the curve and then diagnosed
     off it. */
  const pts = context.scopes ? { scopes: context.scopes } : {};
  const base = equivalent(student, reference, pts);

  if (base.equal) {
    return { correct: true, decided: true, kind: 'correct', hint: '' };
  }
  if (!base.decided) {
    /* Nothing was sampled, so nothing is known. Say that rather than mark a
       possibly correct answer wrong. */
    return {
      correct: false,
      decided: false,
      kind: 'undecidable',
      hint: 'I could not check that automatically. Compare it against the worked answer.',
    };
  }

  const seed = hashSeed(`judge|${text(student)}|${text(reference)}`);

  /* The generator's own list of known wrong turns comes first: it knows the
     mistake by name. */
  for (const d of context.distractors || []) {
    if (!d || !d.node) continue;
    if (equivalent(student, d.node, { count: 36, ...pts }).equal) {
      return { correct: false, decided: true, kind: d.kind || 'known-error', hint: d.hint };
    }
  }

  if (equivalent(student, neg(reference), { count: 36, ...pts }).equal) {
    return {
      correct: false,
      decided: true,
      kind: 'sign',
      hint: 'Every sign is flipped. Check the one rule that introduces a minus here.',
    };
  }

  if (context.original && equivalent(student, context.original, { count: 36, ...pts }).equal) {
    return {
      correct: false,
      decided: true,
      kind: 'not-differentiated',
      hint: 'That is f itself, not its derivative.',
    };
  }

  /* Zero is its own mistake, not a coefficient that went astray. Reporting
     it as "off by a constant factor of 0" is arithmetically true and useless. */
  if (isIdenticallyZero(student)) {
    return {
      correct: false,
      decided: true,
      kind: 'zero',
      hint: 'That is zero for every x. Only a constant function has a zero derivative.',
    };
  }

  const ratio = constantRatio(student, reference, seed, context.scopes);
  if (ratio !== null && Math.abs(ratio - 1) > 1e-9 && Math.abs(ratio) > 1e-9) {
    const pretty = Math.abs(ratio - Math.round(ratio)) < 1e-9
      ? String(Math.round(ratio)) : round(ratio);
    return {
      correct: false,
      decided: true,
      kind: 'factor',
      hint: `The shape is right but it is off by a constant factor of ${pretty}. `
        + 'A coefficient went missing or got counted twice.',
    };
  }

  if (context.inner) {
    const dInner = derivative(context.inner);
    /* student = reference · u′ means the inside derivative was applied one
       time too many; the other way round means it was never applied. */
    if (ratio === null) {
      const r2 = constantRatio(student, mul(reference, dInner), seed, context.scopes);
      if (r2 !== null && Math.abs(r2 - 1) < 1e-9) {
        return {
          correct: false,
          decided: true,
          kind: 'chain-twice',
          hint: 'The inside derivative got multiplied in twice.',
        };
      }
      const r3 = constantRatio(mul(student, dInner), reference, seed, context.scopes);
      if (r3 !== null && Math.abs(r3 - 1) < 1e-9) {
        return {
          correct: false,
          decided: true,
          kind: 'chain-missing',
          hint: `You stopped after the outside derivative. Multiply by the inside `
            + `derivative, ${text(dInner)}.`,
        };
      }
    }
  }

  const diffConst = constantDifference(student, reference, seed, context.scopes);
  if (diffConst !== null && Math.abs(diffConst) > 1e-9) {
    return {
      correct: false,
      decided: true,
      kind: 'offset',
      hint: `Everything varies correctly, but the whole answer sits ${round(diffConst)} `
        + 'away from mine. A constant term is wrong.',
    };
  }

  /* Nothing global explains it, so look term by term. "Two of your three
     terms are right" is the hint the student actually wants. */
  const m = matchTerms(student, reference);
  if (m.matched.length && (m.extra.length || m.missing.length)) {
    const total = Math.max(m.theirCount, m.mineCount);
    const parts = [];
    parts.push(`${m.matched.length} of ${total} terms are right.`);
    if (m.extra.length === 1 && m.missing.length === 1) {
      parts.push(`The term ${text(signed(m.extra[0]))} is the one to look at again.`);
    } else if (m.extra.length) {
      parts.push(`${m.extra.length} of your terms do not belong.`);
    } else {
      parts.push(`You are ${m.missing.length} term${m.missing.length === 1 ? '' : 's'} short.`);
    }
    return { correct: false, decided: true, kind: 'partial', hint: parts.join(' '),
      matched: m.matched.length, total };
  }

  return {
    correct: false,
    decided: true,
    kind: 'wrong',
    hint: '',
  };
}

/* ------------------------------------------------- integrals and form */

/* An antiderivative is checked by DIFFERENTIATING it.

   There is no symbolic integration anywhere in this file, and none is
   needed: to mark the answer to the integral of 3x^2, differentiate what
   was typed and see whether it comes back as 3x^2. Every antiderivative
   that works is accepted, in any form, and the constant of integration
   looks after itself because differentiating kills it. x^3, x^3 + 7 and
   x^3 - 1/2 all pass without the grader knowing anything about C.

   That also means the problems cannot be unsolvable. The generator picks an
   F, differentiates it to get the integrand, and asks for the integral of
   that - so an elementary antiderivative is guaranteed to exist, which is
   not true of an integrand picked at random. */
function stripPlusC(raw) {
  /* "+ C", "+c", "+ constant". Students write it because they were told to,
     and the parser would otherwise call C an unknown variable. */
  return String(raw == null ? '' : raw)
    .replace(/\s*\+\s*(?:c|k|const(?:ant)?)\s*$/i, '')
    .trim();
}

function judgeAntiderivative(raw, integrand, context = {}) {
  const cleaned = stripPlusC(raw);
  if (!cleaned) {
    return { correct: false, decided: true, kind: 'unreadable', hint: 'No answer given.' };
  }
  const variable = context.variable || 'x';
  const read = readAnswer(cleaned, integrand, context);
  if (read.error) {
    return { correct: false, decided: true, kind: 'unreadable', hint: read.error };
  }

  let slope;
  try {
    slope = derivative(read.node, variable);
  } catch (err) {
    return { correct: false, decided: true, kind: 'unreadable', hint: 'I could not differentiate that to check it.' };
  }

  const verdict = diagnose(slope, integrand, { ...context, distractors: null });
  if (verdict.correct) return verdict;

  /* Answering with the integrand itself is common enough to name - but only
     AFTER the real check, because some functions are their own
     antiderivative. The integral of e^x is e^x, and calling that "you copied
     the question" would fail a correct answer. */
  if (equivalent(read.node, integrand, { count: 30 }).equal) {
    return {
      correct: false,
      decided: true,
      kind: 'not-integrated',
      hint: 'That is the function you were asked to integrate, not its antiderivative.',
    };
  }

  /* The diagnostics talk about the derivative, because that is what was
     compared. Translate the common ones back into integration. */
  if (verdict.kind === 'factor') {
    const match = /factor of (-?[\d.]+)/.exec(verdict.hint || '');
    const factor = match ? Number(match[1]) : null;
    if (factor) {
      return {
        ...verdict,
        hint: factor > 1 || factor < -1
          ? `Differentiating your answer gives something ${factor} times too big. `
            + `Dividing your answer by ${factor} fixes it, which is the step the inside function asks for.`
          : `Differentiating your answer comes up short by a factor of ${factor}. `
            + 'Check what the inside function contributes.',
      };
    }
  }
  if (verdict.kind === 'zero') {
    return { ...verdict, hint: 'Your answer is a constant, so its derivative is zero. '
      + 'A constant cannot be the antiderivative of anything but zero.' };
  }
  return verdict;
}

/* --------------------------------------------------------- written form */

/* Equivalence alone cannot mark "factor this". x^2 + 5x + 6 is equivalent to
   itself, so typing the question back would pass. These two ask the other
   half of the question: is it WRITTEN the way the instruction asked? */

const stripSign = (node) => (node.t === 'neg' ? stripSign(node.a) : node);

/* Peel a leading numeric coefficient: 3(x+1)(x+2) is factored, and so is
   (x+1)(x+2). */
function stripNumericFactor(node) {
  let core = stripSign(node);
  for (let guard = 0; guard < 8; guard++) {
    if (core.t === 'mul' && isNum(core.a)) { core = stripSign(core.b); continue; }
    if (core.t === 'mul' && isNum(core.b)) { core = stripSign(core.a); continue; }
    if (core.t === 'div' && isNum(core.b)) { core = stripSign(core.a); continue; }
    break;
  }
  return core;
}

const isSum = (node) => node.t === 'add' || node.t === 'sub';

/* Written as a product rather than a sum. */
export function isFactored(node) {
  if (!node) return false;
  const core = stripNumericFactor(node);
  if (core.t === 'mul') return true;
  /* (x + 2)^2 is factored; x^2 is not, since nothing was factored out. */
  if (core.t === 'pow' && isNum(core.b) && core.b.v >= 2 && isSum(core.a)) return true;
  return false;
}

/* A single term with no sum hiding inside it: 3, x, -2x^3, x^2/4. */
function isMonomial(node) {
  const core = stripSign(node);
  if (core.t === 'num' || core.t === 'var' || core.t === 'const') return true;
  if (core.t === 'pow') {
    return (core.a.t === 'var' || core.a.t === 'num') && isNum(core.b);
  }
  if (core.t === 'mul') return isMonomial(core.a) && isMonomial(core.b);
  if (core.t === 'div') return isMonomial(core.a) && isMonomial(core.b);
  return false;
}

/* Written out as a sum of plain terms, with nothing left in brackets. */
export function isExpanded(node) {
  if (!node) return false;
  return terms(node).every((t) => isMonomial(t.node));
}

/* Grade an answer that has to be equivalent AND written a particular way.
   `form` is 'factored' or 'expanded'. */
function judgeForm(raw, reference, form, context = {}) {
  const read = readAnswer(raw, reference, context);
  if (read.error) {
    return { correct: false, decided: true, kind: 'unreadable', hint: read.error };
  }
  const same = equivalent(read.node, reference, context.scopes ? { scopes: context.scopes } : {});
  if (!same.decided) {
    return {
      correct: false,
      decided: false,
      kind: 'undecidable',
      hint: 'I could not check that automatically. Compare it against the worked answer.',
    };
  }
  if (!same.equal) {
    /* Wrong value: fall through to the ordinary diagnostics, which can say
       which term is off. */
    return diagnose(read.node, reference, context);
  }
  /* Right value, wrong form. Worth saying clearly, because the student has
     done the arithmetic correctly and simply not answered the question. */
  const ok = form === 'factored' ? isFactored(read.node) : isExpanded(read.node);
  if (ok) return { correct: true, decided: true, kind: 'correct', hint: '' };
  return {
    correct: false,
    decided: true,
    kind: form === 'factored' ? 'not-factored' : 'not-expanded',
    hint: form === 'factored'
      ? 'That is equal to the original, which means your algebra is right, but it is '
        + 'not factored. The answer should be a product of brackets.'
      : 'That is equal to the original, but it is not multiplied out. The answer '
        + 'should be a sum of plain terms, with nothing left in brackets.',
  };
}

export const Expr = {
  parse, tryParse, parseMessage, ParseError, latexToText,
  evaluate, compile, vars,
  diff, derivative, simplify,
  text, html, latex,
  equivalent, judge, diagnose, judgeAntiderivative, judgeForm, stripPlusC,
  isFactored, isExpanded, matchTerms, terms, signed, isIdenticallyZero,
  constantRatio, constantDifference, samplePoints, validPoints,
  num, vr, cn, neg, add, sub, mul, div, pow, fn,
  FNS, CONSTS,
};

export default Expr;
