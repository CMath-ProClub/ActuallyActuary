/* Math utilities: seeded randomness, exact rational arithmetic, and a small
   formula renderer.

   Why no KaTeX or MathJax: this site ships as static files with no CDN and has
   to work offline (same rule as the backtester's HTML reports). Everything a
   problem here needs - fractions, exponents, roots, integrals, piecewise - is
   reachable with Unicode plus a few spans, so that is what this does. If a
   future topic genuinely needs full LaTeX, vendoring KaTeX locally is the
   escape hatch, not a <script src> to a CDN.

   Every problem is generated from a SEED. The same seed always produces the
   same problem, which is what lets a mock test be stored as a list of seeds
   instead of a list of rendered questions, re-opened later, and synced to
   another device in a few hundred bytes. */

export const MathKit = (() => {

  /* ---------------------------------------------------------------- random */

  /* mulberry32. Small, fast, and good enough that consecutive problems do not
     visibly repeat. Seeded so a test is reproducible. */
  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    /* An integer in [lo,hi] that is never zero. Coefficients of 0 collapse the
       problem into a different (usually trivial) one, which is the single most
       common way a generated question turns out broken. */
    next.nz = (lo, hi) => {
      let v = 0;
      while (v === 0) v = next.int(lo, hi);
      return v;
    };
    next.sign = () => (next() < 0.5 ? -1 : 1);
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.shuffle = (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    };
    /* Sample k distinct values from lo..hi. Used wherever repeated roots or
       duplicate answer choices would give the problem away. */
    next.distinct = (k, lo, hi, exclude = []) => {
      const out = [];
      let guard = 0;
      while (out.length < k && guard++ < 500) {
        const v = next.int(lo, hi);
        if (!out.includes(v) && !exclude.includes(v)) out.push(v);
      }
      return out;
    };
    return next;
  }

  /* A seed from a string, so topic ids and profile ids can both feed in and a
     given user's "problem 3 of set X" is stable for them. */
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /* ---------------------------------------------------------- exact numbers */

  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };

  /* A rational kept in lowest terms with the sign on the numerator. Answers are
     compared exactly against these, so "1/3" never has to survive a round trip
     through 0.333333. */
  class Frac {
    constructor(n, d = 1) {
      if (d === 0) throw new Error('zero denominator');
      if (d < 0) { n = -n; d = -d; }
      const g = gcd(n, d);
      this.n = n / g;
      this.d = d / g;
    }
    static of(v) { return v instanceof Frac ? v : new Frac(v, 1); }
    add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
    div(o) { o = Frac.of(o); return new Frac(this.n * o.d, this.d * o.n); }
    neg() { return new Frac(-this.n, this.d); }
    get isInt() { return this.d === 1; }
    valueOf() { return this.n / this.d; }
    equals(o) { o = Frac.of(o); return this.n === o.n && this.d === o.d; }
    /* Plain text, for answer keys and the Ollama prompt. */
    toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
    /* Rendered, for the page. */
    tex() { return this.d === 1 ? String(this.n) : frac(String(Math.abs(this.n)), String(this.d), this.n < 0); }
  }

  const F = (n, d) => new Frac(n, d);

  /* --------------------------------------------------------------- rendering */

  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻', '+': '⁺', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'x': 'ˣ' };

  /* Unicode superscripts stay selectable and copyable and survive being pasted
     into a text field, which <sup> does not. Anything Unicode cannot express
     falls back to a styled span. */
  function sup(s) {
    s = String(s);
    if ([...s].every((c) => c in SUP)) return [...s].map((c) => SUP[c]).join('');
    return `<span class="sup">${esc(s)}</span>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* A real two-line fraction. CSS does the stacking; the markup stays one
     inline-block so it sits inside a sentence without wrecking the line box. */
  function frac(num, den, negative = false) {
    return `${negative ? '−' : ''}<span class="frac"><span class="num">${num}</span>`
      + `<span class="den">${den}</span></span>`;
  }

  function sqrt(inner, index) {
    const idx = index ? `<span class="rootidx">${index}</span>` : '';
    return `${idx}<span class="radical">√</span><span class="radicand">${inner}</span>`;
  }

  /* x -> "x", 1x -> "x", -1x -> "-x", 0x -> "". The small formatting rules that
     make generated algebra read like a human wrote it. */
  function coef(c, v) {
    if (c === 0) return '';
    if (!v) return String(c);
    if (c === 1) return v;
    if (c === -1) return `−${v}`;
    return `${c < 0 ? '−' : ''}${Math.abs(c)}${v}`;
  }

  /* Join signed terms: ["3x²", "-2x", "5"] -> "3x² − 2x + 5". Terms arriving as
     empty strings (zero coefficients) drop out entirely. */
  function terms(list) {
    const parts = list.filter((t) => t !== '' && t != null);
    if (!parts.length) return '0';
    let out = String(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      let t = String(parts[i]);
      if (t.startsWith('−')) out += ` − ${t.slice(1)}`;
      else if (t.startsWith('-')) out += ` − ${t.slice(1)}`;
      else out += ` + ${t}`;
    }
    return out;
  }

  /* A polynomial from a coefficient array, highest power first. */
  function poly(coeffs, v = 'x') {
    const n = coeffs.length - 1;
    return terms(coeffs.map((c, i) => {
      const p = n - i;
      if (c === 0) return '';
      if (p === 0) return String(c);
      if (p === 1) return coef(c, v);
      return coef(c, `${v}${sup(p)}`);
    }));
  }

  /* (x - r) with the sign folded in, the form every factoring answer wants. */
  function linFactor(r, v = 'x') {
    if (r === 0) return v;
    return `(${v} ${r > 0 ? '−' : '+'} ${Math.abs(r)})`;
  }

  /* ------------------------------------------------------------- comparison */

  /* Parse what a human typed into a number. Accepts 3/4, -2.5, 1 1/2, pi, e,
     sqrt(2), 2pi/3, and plain arithmetic. Returns null when it is not a number
     rather than throwing, so the caller can say "I could not read that".

     Deliberately NOT eval: the string is user input and this runs in their
     browser with their synced data in scope. */
  function parseNumber(raw) {
    if (raw == null) return null;
    let s = String(raw).trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/−/g, '-').replace(/\s+/g, ' ');
    s = s.replace(/[π]/g, 'pi');

    /* mixed number: "1 1/2" */
    const mixed = s.match(/^(-?\d+) (\d+)\/(\d+)$/);
    if (mixed) {
      const whole = Number(mixed[1]);
      const f = Number(mixed[2]) / Number(mixed[3]);
      return whole < 0 ? whole - f : whole + f;
    }

    /* A tiny recursive-descent evaluator over + - * / ^ ( ) and the constants
       pi and e, with sqrt/abs/ln/log/sin/cos/tan. Small enough to audit. */
    let i = 0;
    const peek = () => s[i];
    const eat = (c) => { if (s[i] === c) { i++; return true; } return false; };
    const ws = () => { while (s[i] === ' ') i++; };

    function expr() {
      ws();
      let v = term();
      if (v === null) return null;
      for (;;) {
        ws();
        if (eat('+')) { const r = term(); if (r === null) return null; v += r; }
        else if (eat('-')) { const r = term(); if (r === null) return null; v -= r; }
        else return v;
      }
    }
    function term() {
      ws();
      let v = unary();
      if (v === null) return null;
      for (;;) {
        ws();
        if (eat('*')) { const r = unary(); if (r === null) return null; v *= r; }
        else if (eat('/')) { const r = unary(); if (r === null) return null; if (r === 0) return null; v /= r; }
        else return v;
      }
    }
    /* Unary minus binds LOOSER than ^, so -2^2 is -(2^2) = -4, matching Python
       and ordinary math notation. Writing (-2)^2 gives 4, as it should. This
       ordering matters: a student checking their work against a calculator
       should not get a different number here. */
    function unary() {
      ws();
      if (eat('-')) { const v = unary(); return v === null ? null : -v; }
      if (eat('+')) return unary();
      return power();
    }
    function power() {
      const base = atom();
      if (base === null) return null;
      ws();
      if (eat('^')) {
        /* Right associative, and the exponent goes through unary() so 2^-3
           works. */
        const e2 = unary();
        if (e2 === null) return null;
        return Math.pow(base, e2);
      }
      return base;
    }
    function atom() {
      ws();
      if (eat('(')) {
        const v = expr();
        ws();
        if (!eat(')')) return null;
        return v;
      }
      const fn = s.slice(i).match(/^(sqrt|abs|ln|log|sin|cos|tan|asin|acos|atan)\s*\(/);
      if (fn) {
        i += fn[1].length;
        ws();
        eat('(');
        const v = expr();
        ws();
        if (!eat(')') || v === null) return null;
        switch (fn[1]) {
          case 'sqrt': return v < 0 ? null : Math.sqrt(v);
          case 'abs': return Math.abs(v);
          case 'ln': return v <= 0 ? null : Math.log(v);
          case 'log': return v <= 0 ? null : Math.log10(v);
          case 'sin': return Math.sin(v);
          case 'cos': return Math.cos(v);
          case 'tan': return Math.tan(v);
          case 'asin': return Math.asin(v);
          case 'acos': return Math.acos(v);
          case 'atan': return Math.atan(v);
          default: return null;
        }
      }
      if (s.startsWith('pi', i)) { i += 2; return Math.PI; }
      /* "e" is Euler's number only when it is not part of 1e5 or a word. */
      if (s[i] === 'e' && !/[0-9a-z]/.test(s[i + 1] || '')) { i += 1; return Math.E; }
      const num = s.slice(i).match(/^\d*\.?\d+(e[-+]?\d+)?/);
      if (num) { i += num[0].length; return Number(num[0]); }
      return null;
    }

    const val = expr();
    ws();
    if (val === null || i < s.length || !isFinite(val)) return null;
    return val;
  }

  /* Is the typed answer right? Tolerance is relative so that 0.001 and 150000
     are both judged sensibly, with an absolute floor for answers near zero. */
  function numericEqual(got, want, tol = 1e-6) {
    if (got == null || want == null) return false;
    const w = want instanceof Frac ? want.valueOf() : Number(want);
    const g = got instanceof Frac ? got.valueOf() : Number(got);
    if (!isFinite(g) || !isFinite(w)) return false;
    const scale = Math.max(1, Math.abs(w));
    return Math.abs(g - w) <= tol * scale;
  }

  /* Compare free-text answers (a factored form, a set of roots, a word).
     Whitespace, case, unicode minus and a trailing period never decide. */
  function textEqual(got, want) {
    const norm = (s) => String(s == null ? '' : s)
      .toLowerCase()
      .replace(/−/g, '-')
      .replace(/[\s,.;]+/g, '')
      .replace(/\*/g, '')
      .trim();
    if (Array.isArray(want)) return want.some((w) => norm(w) === norm(got));
    return norm(got) === norm(want);
  }

  /* A set of numbers in any order, which is what "the roots are ..." needs. */
  function setEqual(gotRaw, want, tol = 1e-6) {
    const got = String(gotRaw || '')
      .split(/[,;]|\band\b/)
      .map((p) => parseNumber(p))
      .filter((v) => v !== null);
    if (got.length !== want.length) return false;
    const pool = want.map((w) => (w instanceof Frac ? w.valueOf() : Number(w)));
    for (const g of got) {
      const idx = pool.findIndex((w) => numericEqual(g, w, tol));
      if (idx === -1) return false;
      pool.splice(idx, 1);
    }
    return true;
  }

  /* ------------------------------------------------------------- formatting */

  /* Round for display without the 0.30000000000000004 problem, and without
     printing "2.00" when the answer is just 2. */
  function num(v, places = 4) {
    if (v instanceof Frac) return v.toString();
    const n2 = Number(v);
    if (!isFinite(n2)) return String(v);
    if (Number.isInteger(n2)) return String(n2);
    const r = Number(n2.toFixed(places));
    return String(r);
  }

  function money(v) {
    const n2 = Number(v);
    const s = Math.abs(n2).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${n2 < 0 ? '−' : ''}$${s}`;
  }

  function pct(v, places = 2) {
    return `${num(Number(v) * 100, places)}%`;
  }

  /* Factorials and binomials turn up all over Exam P. Exact while they fit in a
     double, which covers every problem this app generates. */
  function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
  function nCr(n, r) {
    if (r < 0 || r > n) return 0;
    r = Math.min(r, n - r);
    let out = 1;
    for (let i = 0; i < r; i++) out = (out * (n - i)) / (i + 1);
    return Math.round(out);
  }
  function nPr(n, r) {
    if (r < 0 || r > n) return 0;
    let out = 1;
    for (let i = 0; i < r; i++) out *= n - i;
    return out;
  }

  return { rng, hashSeed, Frac, F, gcd, sup, esc, frac, sqrt, coef, terms, poly,
    linFactor, parseNumber, numericEqual, textEqual, setEqual, num, money, pct,
    fact, nCr, nPr };
})();

export default MathKit;
