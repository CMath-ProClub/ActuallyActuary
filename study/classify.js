/* What is this question about?

   Carter's description, and it is the right shape for the whole tool:
   "send it a picture of the worksheet, and then it would just be able to
   generate you a bunch of problems, generate you the concepts, identify
   what's going on, and then you can toggle on and off the concepts."

   The photograph needs a model that can read handwriting. Identifying the
   CONCEPTS does not: a derivative question is an expression, the expression
   parser is already here, and what a question is about is mostly visible in
   the shape of its tree. x·e^y = 2y + y³ is implicit differentiation with a
   product and an exponential in it, and that can be established by looking
   rather than by asking a 7B model to guess.

   So this half works today, on typed or pasted problems, and the model's
   job shrinks to turning a photograph into text - which is the thing it is
   actually good at.

   Everything here is a GUESS and is presented as one. A concept list that
   quietly drops the hardest question on the sheet is worse than no list,
   so anything unparseable is reported as unparseable rather than ignored. */

import Expr from './expr.js';

/* Words that give a question away before any parsing happens. Order
   matters: the first match wins for the phrase-only concepts. */
const PHRASES = [
  [/\blimit\s+definition|difference\s+quotient|first\s+principles/i, 'limitdef'],
  [/\bhorizontal\s+tangent|where.*\bf'?\s*\(?x\)?\s*=\s*0|critical\s+(number|point)/i, 'horizontal'],
  [/\btangent\s+line|equation\s+of\s+the\s+tangent|normal\s+line/i, 'tangent'],
  [/\bsecond\s+derivative|f\s*''|f\s*″|d²y|concavity/i, 'secondderiv'],
  [/\bvelocity|acceleration|position\s+function|\bs\s*\(\s*t\s*\)/i, 'motion'],
  [/\blogarithmic\s+differentiation|take\s+(the\s+)?log/i, 'logdiff'],
  [/\bimplicit/i, 'implicit'],
  [/\brelated\s+rates/i, 'motion'],
];

/* Trim the prose a worksheet wraps around its maths.

   A worksheet does not write expressions, it writes sentences with
   expressions in them: "3. Find dy/dx if x^2 + y^2 = 25", "Differentiate
   f(x) = x^2 sin(3x)", "y = x^x, use logarithmic differentiation". Getting
   the maths out of those is most of the job, and getting it wrong means
   the hardest question on the sheet is silently dropped. */

/* Leading enumerators: 1. 1) (1) Q3 */
const NUMBERED = /^\s*[(\[]?\s*(q|#)?\s*\d+\s*[.):\]]\s*/i;

/* The instruction in front of the maths.

   A regex LITERAL, deliberately. Built from a string this read
   new RegExp('^\s*(find|...')  - and in a JavaScript string "\s" is just
   "s", so the pattern silently became /^s*(find|.../ and matched nothing
   at all. Every line came back with its prose still attached and the
   classifier looked simply weak rather than broken. */
const VERBS = /^\s*(find|calculate|compute|determine|evaluate|differentiate|derive|give|state|write|obtain|work\s+out)\b(\s+(the|every|all|an?)\b)?(\s+(derivative|value|values|equation|slope|points?|x))?(\s+(of|for|to|where|at|if|when|such\s+that))?\s*/i;

/* Clauses tacked on the end. */
const TRAILERS = [
  /,?\s*(and\s+)?(then\s+)?(find|evaluate|determine|give|state)\b.*$/i,
  /,?\s*us(e|ing)\b.*$/i,
  /\bwith\s+respect\s+to\s+[a-z]\b.*$/i,
  /\bat\s+the\s+point\b.*$/i,
  /\bhas\s+a\b.*$/i,
  /\bis\s+(flat|horizontal)\b.*$/i,
];

/* "dy/dx if", "d/dx", "f'(x) =" and friends in front of the real thing. */
const OPERATORS = /^\s*(d\s*y\s*\/\s*d\s*x|d\s*\/\s*d\s*x|f\s*'\s*\(?x\)?|y\s*')\s*(of|for|if|when|,|:|=)?\s*/i;

/* A left-hand side that names the function rather than being part of it.
   "y = ln(cos 4x)" is an ordinary derivative question; "x e^y = 2y" is
   not, and the difference is entirely in what sits left of the equals. */
const SUBJECT = /^\s*([yvs]|[fghpqrs]\s*\(\s*[xt]\s*\)|[yv]\s*\(\s*[xt]\s*\))\s*$/i;

export function stripProse(line, { trailers = true } = {}) {
  let text = String(line || '').trim();
  text = text.replace(NUMBERED, '');
  for (let i = 0; i < 3; i++) {
    const before = text;
    text = text.replace(VERBS, '');
    text = text.replace(OPERATORS, '');
    if (text === before) break;
  }
  if (trailers) for (const trailer of TRAILERS) text = text.replace(trailer, '');
  return text.replace(/[.;,]\s*$/, '').trim();
}

/* The maths in a line, if any of it parses.

   Trailing clauses are stripped first, and then - if that left nothing to
   read - tried again WITHOUT stripping them. "x e^y = 2y, find dy/dx"
   needs the trailer gone; "Use the limit definition to find f'(x) for
   f(x) = 1/(x+2)" has its instruction in the middle, and stripping from
   "find" onwards takes the question with it. Rather than tune the regex
   until both happen to work, try both and keep whichever found maths. */
export function readMath(line) {
  const tight = readFrom(stripProse(line));
  if (tight) return tight;
  const loose = stripProse(line, { trailers: false });
  return readFrom(loose);
}

function readFrom(raw) {
  /* "d/dx [x^3 cos(x)]" wraps the whole thing in square brackets, which the
     parser has no use for. Only [] and {} are peeled: parentheses might be
     (x+1)(x+2), where the first and last are not a pair. */
  let text = String(raw || '').trim();
  if (/^[[{]/.test(text) && /[\]}]$/.test(text)) {
    text = text.slice(1, -1).trim();
  }
  if (!text) return null;
  const vars = { vars: ['x', 'y', 't'] };

  const halves = text.split('=');
  if (halves.length === 2) {
    const leftText = halves[0].trim();
    const rightText = halves[1].trim();
    /* "f(x) = ..." names the function; the question is about the right. */
    if (SUBJECT.test(leftText)) {
      const only = Expr.tryParse(rightText, vars);
      if (only) return { kind: 'expression', node: only, text: rightText };
    }
    const left = Expr.tryParse(leftText, vars);
    const right = Expr.tryParse(rightText, vars);
    if (left && right) return { kind: 'equation', left, right, text };
    if (right) return { kind: 'expression', node: right, text: rightText };
    if (left) return { kind: 'expression', node: left, text: leftText };
  }

  const node = Expr.tryParse(text, vars);
  if (node) return { kind: 'expression', node, text };

  /* Last try: the longest thing in brackets, which is how "d/dx [x sin x]"
     is usually written. */
  const bracketed = text.match(/[[({]([^[\]{}()]{3,})[\])}]/);
  if (bracketed) {
    const inner = Expr.tryParse(bracketed[1], vars);
    if (inner) return { kind: 'expression', node: inner, text: bracketed[1] };
  }
  return null;
}

/* Walk a tree and note what is in it. */
function survey(node, found, depth = 0) {
  if (!node || typeof node !== 'object') return;
  switch (node.t) {
    case 'var':
      if (node.n === 'y') found.add('has-y');
      if (node.n === 't') found.add('has-t');
      break;
    case 'fn': {
      const n = node.n;
      if (['sin', 'cos', 'tan', 'sec', 'csc', 'cot'].includes(n)) found.add('trig');
      if (['asin', 'acos', 'atan'].includes(n)) found.add('invtrig');
      if (n === 'exp') found.add('exp');
      if (n === 'ln' || n === 'log') found.add('log');
      if (n === 'sqrt' || n === 'cbrt') found.add('power');
      /* A function of anything other than a bare variable is a chain. */
      if (node.a && !(node.a.t === 'var')) found.add('chain');
      break;
    }
    case 'mul':
      /* Two factors that both move is a product rule. A number times
         something is not. */
      if (!isConstant(node.a) && !isConstant(node.b)) found.add('product');
      break;
    case 'div':
      if (!isConstant(node.b)) found.add('quotient');
      break;
    case 'pow':
      if (!isConstant(node.b)) {
        /* A variable in the exponent, over a base that also moves, is the
           shape that needs logs taken first: x^x, or (sin x)^x. Over a
           CONSTANT base it is just an exponential - e^(2x) is not
           logarithmic differentiation, and calling it that would send
           somebody to practise the wrong thing. */
        if (isConstant(node.a)) found.add('exp');
        else found.add('logdiff');
      } else {
        found.add('power');
        if (!isAtom(node.a)) found.add('chain');
      }
      break;
    default:
      break;
  }
  survey(node.a, found, depth + 1);
  survey(node.b, found, depth + 1);
}

function isConstant(node) {
  if (!node) return true;
  if (node.t === 'num' || node.t === 'const') return true;
  if (node.t === 'var') return false;
  if (node.t === 'fn') return isConstant(node.a);
  return isConstant(node.a) && isConstant(node.b);
}

function isAtom(node) {
  return !!node && (node.t === 'var' || node.t === 'num' || node.t === 'const');
}

/* The concepts one line of a worksheet is about, most important first.
   Returns { skills, reason, math } - and skills is empty when nothing
   could be read, which the caller must SAY rather than swallow. */
export function classifyLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return { skills: [], reason: 'blank', text: raw };

  const skills = [];
  const add = (skill) => { if (skill && !skills.includes(skill)) skills.push(skill); };

  /* What the words say. */
  for (const [pattern, skill] of PHRASES) {
    if (pattern.test(raw)) add(skill);
  }

  const math = readMath(raw);
  if (!math) {
    return {
      skills,
      reason: skills.length ? 'words only' : 'could not read the maths',
      text: raw,
      math: null,
    };
  }

  const found = new Set();
  if (math.kind === 'equation') {
    survey(math.left, found);
    survey(math.right, found);
    /* An equation with y in it that was not simply "y = something" is
       implicit differentiation, whatever else it contains. readMath has
       already peeled off the "f(x) =" case, so anything still an equation
       here has both sides in play. */
    if (found.has('has-y')) add('implicit');
  } else {
    survey(math.node, found);
    if (found.has('has-y')) add('implicit');
    if (found.has('has-t')) add('motion');
  }

  /* The function families, then the rules, then the fallback. Ordered so
     the list reads the way a person would say it: "implicit, with a
     product and an exponential". */
  for (const key of ['trig', 'invtrig', 'exp', 'log', 'logdiff']) {
    if (found.has(key)) add(key);
  }
  for (const key of ['product', 'quotient', 'chain']) {
    if (found.has(key)) add(key);
  }
  if (found.has('power')) add('power');
  if (!skills.length) add('power');

  return { skills, reason: 'read the maths', text: raw, math };
}

/* A whole worksheet: one line at a time, then counted up. */
export function classifySheet(text) {
  const lines = String(text || '')
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const rows = lines.map((line) => ({ line, ...classifyLine(line) }));
  const counts = new Map();
  for (const row of rows) {
    for (const skill of row.skills) counts.set(skill, (counts.get(skill) || 0) + 1);
  }
  const concepts = [...counts.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));

  return {
    rows,
    concepts,
    read: rows.filter((r) => r.math).length,
    unread: rows.filter((r) => !r.math).length,
  };
}

export default { classifyLine, classifySheet, readMath, stripProse: stripProse };
