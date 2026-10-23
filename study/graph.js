/* The graphing calculator.

   Two implementations behind one interface, and the reason is the rule in
   CLAUDE.md that this tool works offline with no CDN.

   DESMOS is what Carter asked for and it is better than anything worth
   writing here: pinch, zoom, trace, sliders. It is also a script from
   desmos.com, which means it needs the network and an API key.

   So there is a PLOTTER underneath it. Canvas, a few hundred lines, no
   network, no key. It draws the same three curves and answers the same
   question - does my derivative match the real one - and it is what you get
   on a plane, on a locked-down school network, or before a key is set.

   The pedagogical point of the panel is narrow and worth stating: plot the
   true derivative and the student's answer on the same axes. If the answer
   is right the two curves sit exactly on top of each other, and if it is
   wrong you can SEE where. That is a different kind of knowing than being
   told the answer is wrong.

   Colours follow the palette rule: series blue and orange, never red and
   orange in the same chart. */

import Expr from './expr.js';

/* The key Desmos publishes in its own documentation. It works, but it draws
   a "Desmos Trial Key" watermark over the graph, so it is NOT the default: a
   nag screen on your own study tool is worse than a plainer picture. Put a
   key of your own in Settings - they are free for non-commercial use from
   desmos.com/my-api - and the full calculator takes over. */
const DEMO_KEY = 'dcb31709b452b1cf9dc26972add0fda6';
const DESMOS_SRC = (key) => `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(key)}`;

export const SERIES = {
  /* [light, dark] */
  original: ['#8b93a0', '#6c7482'],   /* f itself, kept quiet */
  truth: ['#2a78d6', '#3987e5'],      /* the real derivative */
  yours: ['#eb6834', '#d95926'],      /* what you typed */
};

let desmosLoad = null;

/* Load the Desmos script once per page. Resolves to false rather than
   throwing when it cannot be had, because every caller's answer to that is
   the same: use the plotter. */
function loadDesmos(key) {
  if (desmosLoad) return desmosLoad;
  desmosLoad = new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(false); return; }
    if (window.Desmos) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = DESMOS_SRC(key || DEMO_KEY);
    script.async = true;
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };
    script.onload = () => done(!!window.Desmos);
    script.onerror = () => done(false);
    /* Offline, the error event can take a while. Do not make the panel wait
       on it; the plotter is right there. */
    setTimeout(() => done(!!window.Desmos), 2500);
    document.head.appendChild(script);
  });
  return desmosLoad;
}

/* ----------------------------------------------------------------- plotter */

/* Tick steps that read as round numbers: 1, 2, 5, 10, 20, 50 ... */
function niceStep(range, target = 6) {
  const raw = range / Math.max(1, target);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const scaled = raw / power;
  const step = scaled < 1.5 ? 1 : scaled < 3 ? 2 : scaled < 7 ? 5 : 10;
  return step * power;
}

/* A y-range that ignores poles. tan(x) and 1/x run to infinity, and letting
   them set the scale flattens every other curve to a horizontal line, so the
   range comes from the middle of the sorted values rather than the extremes. */
export function robustRange(values, pad = 0.12) {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!finite.length) return { lo: -5, hi: 5 };
  const at = (q) => finite[Math.min(finite.length - 1, Math.max(0, Math.floor(q * (finite.length - 1))))];
  /* Trimming the tails only makes sense with enough samples to have tails.
     On five points the 4th and 96th percentiles ARE the extremes, so the
     range came out narrower than the data it was supposed to contain. */
  const trim = finite.length >= 20;
  let lo = trim ? at(0.04) : finite[0];
  let hi = trim ? at(0.96) : finite[finite.length - 1];
  if (!(hi > lo)) { lo -= 1; hi += 1; }
  const span = hi - lo;
  lo -= span * pad;
  hi += span * pad;
  /* Always show the x-axis when it is anywhere near, because "where does it
     cross zero" is most of what these pictures are for. */
  if (lo > 0 && lo < span) lo = 0;
  if (hi < 0 && hi > -span) hi = 0;
  return { lo, hi };
}

function createPlotter(container, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'plotcanvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let series = [];
  let window_ = { xmin: -6, xmax: 6 };
  let dark = !!opts.dark;
  let size = { w: 1, h: 1 };

  const ink = () => (dark ? '#c3c9d2' : '#3b434e');
  const grid = () => (dark ? '#262c36' : '#e6e1d5');
  const axis = () => (dark ? '#39414d' : '#c9c2b2');
  const tick = () => (dark ? '#8b93a0' : '#7b8290');
  const surface = () => (dark ? '#161a21' : '#fffdf8');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    size = { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function sample() {
    const { xmin, xmax } = window_;
    const steps = Math.max(120, Math.floor(size.w));
    const out = [];
    for (const s of series) {
      if (!s.fn) continue;
      const points = [];
      for (let i = 0; i <= steps; i++) {
        const x = xmin + ((xmax - xmin) * i) / steps;
        let y = NaN;
        try { y = s.fn({ x }); } catch { y = NaN; }
        points.push({ x, y: Number.isFinite(y) ? y : NaN });
      }
      out.push({ ...s, points });
    }
    return out;
  }

  function draw() {
    const plotted = sample();
    const all = [];
    for (const s of plotted) for (const p of s.points) if (Number.isFinite(p.y)) all.push(p.y);
    const { lo, hi } = robustRange(all);

    const pad = { left: 44, right: 12, top: 12, bottom: 26 };
    const w = size.w - pad.left - pad.right;
    const h = size.h - pad.top - pad.bottom;
    const X = (x) => pad.left + ((x - window_.xmin) / (window_.xmax - window_.xmin)) * w;
    const Y = (y) => pad.top + h - ((y - lo) / (hi - lo)) * h;

    ctx.save();
    ctx.fillStyle = surface();
    ctx.fillRect(0, 0, size.w, size.h);

    /* grid and ticks */
    ctx.font = '11px ui-monospace, Consolas, monospace';
    ctx.strokeStyle = grid();
    ctx.fillStyle = tick();
    ctx.lineWidth = 1;
    const xStep = niceStep(window_.xmax - window_.xmin);
    for (let x = Math.ceil(window_.xmin / xStep) * xStep; x <= window_.xmax; x += xStep) {
      const px = Math.round(X(x)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, pad.top + h);
      ctx.stroke();
      if (Math.abs(x) > 1e-9) {
        ctx.textAlign = 'center';
        ctx.fillText(String(Number(x.toFixed(2))), px, pad.top + h + 16);
      }
    }
    const yStep = niceStep(hi - lo);
    for (let y = Math.ceil(lo / yStep) * yStep; y <= hi; y += yStep) {
      const py = Math.round(Y(y)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, py);
      ctx.lineTo(pad.left + w, py);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(String(Number(y.toFixed(2))), pad.left - 7, py + 4);
    }

    /* axes */
    ctx.strokeStyle = axis();
    ctx.lineWidth = 1.4;
    if (lo <= 0 && hi >= 0) {
      const py = Math.round(Y(0)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(pad.left + w, py); ctx.stroke();
    }
    if (window_.xmin <= 0 && window_.xmax >= 0) {
      const px = Math.round(X(0)) + 0.5;
      ctx.beginPath(); ctx.moveTo(px, pad.top); ctx.lineTo(px, pad.top + h); ctx.stroke();
    }

    /* curves */
    for (const s of plotted) {
      ctx.strokeStyle = (SERIES[s.role] || SERIES.truth)[dark ? 1 : 0];
      ctx.lineWidth = s.role === 'yours' ? 2.6 : s.role === 'original' ? 1.4 : 2;
      ctx.setLineDash(s.role === 'yours' ? [7, 5] : []);
      ctx.beginPath();
      let down = false;
      for (const p of s.points) {
        if (!Number.isFinite(p.y) || p.y < lo - (hi - lo) || p.y > hi + (hi - lo)) {
          down = false;
          continue;
        }
        const px = X(p.x);
        const py = Y(p.y);
        if (!down) { ctx.moveTo(px, py); down = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resize()) : null;
  if (observer) observer.observe(canvas);
  resize();

  return {
    kind: 'plotter',
    setFunctions(list) { series = list || []; draw(); },
    setWindow(xmin, xmax) { window_ = { xmin, xmax }; draw(); },
    setDark(flag) { dark = !!flag; draw(); },
    redraw: draw,
    destroy() { if (observer) observer.disconnect(); container.innerHTML = ''; },
  };
}

/* ------------------------------------------------------------------ desmos */

function createDesmos(container, opts = {}) {
  const host = document.createElement('div');
  host.className = 'desmoshost';
  container.appendChild(host);
  const calc = window.Desmos.GraphingCalculator(host, {
    keypad: false,
    /* The expression list would take half the panel to show three lines the
       page has already written out above it. */
    expressions: false,
    settingsMenu: false,
    zoomButtons: true,
    border: false,
    lockViewport: false,
    invertedColors: !!opts.dark,
  });

  return {
    kind: 'desmos',
    calculator: calc,
    setFunctions(list) {
      calc.setBlank();
      /* Frame the picture on the curves rather than on Desmos's default
         window, where an oscillating derivative is a blur at the origin. */
      const probe = [];
      for (const s of list || []) {
        if (!s.fn) continue;
        for (let i = 0; i <= 160; i++) {
          const x = -6 + (12 * i) / 160;
          try {
            const y = s.fn({ x });
            if (Number.isFinite(y)) probe.push(y);
          } catch { /* not plottable here */ }
        }
      }
      const { lo, hi } = robustRange(probe);
      calc.setMathBounds({ left: -6, right: 6, bottom: lo, top: hi });
      (list || []).forEach((s, i) => {
        if (!s.latex) return;
        calc.setExpression({
          id: `s${i}`,
          latex: `y=${s.latex}`,
          color: (SERIES[s.role] || SERIES.truth)[opts.dark ? 1 : 0],
          lineStyle: s.role === 'yours' ? 'DASHED' : 'SOLID',
          lineWidth: s.role === 'original' ? 1.5 : 2.5,
          secret: false,
        });
      });
    },
    setWindow(xmin, xmax) {
      calc.setMathBounds({ left: xmin, right: xmax, bottom: -10, top: 10 });
    },
    setDark(flag) { calc.updateSettings({ invertedColors: !!flag }); },
    redraw() {},
    destroy() { calc.destroy(); container.innerHTML = ''; },
  };
}

/* ----------------------------------------------------------------- public */

/* Build a panel in `container`. Resolves once it knows which of the two it
   got, so the caller can label it honestly. */
export async function createGraph(container, opts = {}) {
  container.innerHTML = '';
  /* Desmos only with a key of your own. Without one it is the plotter, which
     needs no network and leaves no watermark. */
  if (opts.preferPlotter !== true && opts.key) {
    const ok = await loadDesmos(opts.key);
    if (ok) {
      try {
        return createDesmos(container, opts);
      } catch (err) {
        /* Fall through to the plotter rather than showing a dead panel. */
        container.innerHTML = '';
      }
    }
  }
  return createPlotter(container, opts);
}

/* The three curves a derivative problem wants to show. Returns entries ready
   for setFunctions, skipping anything that will not compile. */
export function derivativeSeries(problem, studentText) {
  const out = [];
  const add = (node, role, label) => {
    if (!node) return;
    try {
      out.push({
        role,
        label,
        latex: Expr.latex(node),
        fn: Expr.compile(node),
      });
    } catch { /* not plottable, skip */ }
  };
  if (problem && problem.original) add(problem.original, 'original', 'f(x)');
  if (problem && problem.answerNode) add(problem.answerNode, 'truth', 'the derivative');
  if (studentText && String(studentText).trim()) {
    const node = Expr.tryParse(studentText, { vars: ['x'] });
    add(node, 'yours', 'your answer');
  }
  return out;
}

export default { createGraph, derivativeSeries, robustRange, SERIES };
