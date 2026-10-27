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
/* Zoom a window about a point, keeping that point where it is.

   Pulled out of the plotter because it is the part where being wrong is
   silent: the picture still moves, it just drifts away from whatever you
   were pointing at, and nobody can tell by looking whether the maths was
   right. tools/test_workspace.mjs checks the fixed point directly. */
export function zoomWindow(view, factor, ax, ay) {
  return {
    xmin: ax + (view.xmin - ax) * factor,
    xmax: ax + (view.xmax - ax) * factor,
    ymin: ay + (view.ymin - ay) * factor,
    ymax: ay + (view.ymax - ay) * factor,
  };
}

/* Move a window by a drag, in data units. */
export function panWindow(view, dx, dy) {
  return {
    xmin: view.xmin - dx,
    xmax: view.xmax - dx,
    ymin: view.ymin + dy,
    ymax: view.ymax + dy,
  };
}

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

/* The built-in plotter.

   Canvas, no network, no key. It draws the same curves Desmos would and
   answers the same question - does my derivative match the real one - but
   it also has to be somewhere you would WANT to spend time, because on a
   locked-down school network it is the only graph there is.

   So it pans, it zooms about the cursor, and it traces: put the pointer
   anywhere and it reads off x and the y of every curve at that x. That last
   one is the whole point of plotting your answer against the truth. "Where
   it leaves the solid line is where it went wrong" is only useful if you
   can see WHERE, and a number under the crosshair is a better answer than
   squinting at two lines. */
function createPlotter(container, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'plotcanvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let series = [];
  let dark = !!opts.dark;
  let size = { w: 1, h: 1 };

  /* The window on the plane. Set from the curves the first time they
     arrive, and owned by the person after that - until they ask for it
     back. */
  const view = { xmin: -6, xmax: 6, ymin: -4, ymax: 4 };
  let framed = false;
  let drag = null;
  let trace = null;

  const ink = () => (dark ? '#c3c9d2' : '#3b434e');
  const grid = () => (dark ? '#262c36' : '#e6e1d5');
  const axis = () => (dark ? '#39414d' : '#c9c2b2');
  const tick = () => (dark ? '#8b93a0' : '#7b8290');
  const surface = () => (dark ? '#161a21' : '#fffdf8');

  const PAD = { left: 46, right: 12, top: 12, bottom: 26 };
  const plotW = () => Math.max(1, size.w - PAD.left - PAD.right);
  const plotH = () => Math.max(1, size.h - PAD.top - PAD.bottom);

  const X = (x) => PAD.left + ((x - view.xmin) / (view.xmax - view.xmin)) * plotW();
  const Y = (y) => PAD.top + plotH() - ((y - view.ymin) / (view.ymax - view.ymin)) * plotH();
  const xAt = (px) => view.xmin + ((px - PAD.left) / plotW()) * (view.xmax - view.xmin);
  const yAt = (py) => view.ymin + ((PAD.top + plotH() - py) / plotH()) * (view.ymax - view.ymin);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    size = { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function valueAt(s, x) {
    if (!s.fn) return NaN;
    try {
      const y = s.fn({ x });
      return Number.isFinite(y) ? y : NaN;
    } catch (err) {
      return NaN;
    }
  }

  function sample() {
    const steps = Math.max(160, Math.floor(size.w * 1.5));
    return series.filter((s) => s.fn).map((s) => {
      const points = [];
      for (let i = 0; i <= steps; i++) {
        const x = view.xmin + ((view.xmax - view.xmin) * i) / steps;
        points.push({ x, y: valueAt(s, x) });
      }
      return { ...s, points };
    });
  }

  /* Frame the picture on the curves, once. A derivative that oscillates
     between -40 and 40 and an f that sits near zero need the same axes, so
     the range comes from all of them together. */
  function frame() {
    const all = [];
    for (const s of series) {
      if (!s.fn) continue;
      for (let i = 0; i <= 200; i++) {
        const x = -6 + (12 * i) / 200;
        const y = valueAt(s, x);
        if (Number.isFinite(y)) all.push(y);
      }
    }
    const { lo, hi } = robustRange(all);
    view.xmin = -6;
    view.xmax = 6;
    view.ymin = lo;
    view.ymax = hi;
    framed = true;
  }

  function drawAxes() {
    ctx.font = '11px ui-monospace, Consolas, monospace';
    ctx.strokeStyle = grid();
    ctx.fillStyle = tick();
    ctx.lineWidth = 1;

    const xStep = niceStep(view.xmax - view.xmin);
    for (let x = Math.ceil(view.xmin / xStep) * xStep; x <= view.xmax; x += xStep) {
      const px = Math.round(X(x)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, PAD.top);
      ctx.lineTo(px, PAD.top + plotH());
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(trim(x), px, size.h - 9);
    }

    const yStep = niceStep(view.ymax - view.ymin);
    for (let y = Math.ceil(view.ymin / yStep) * yStep; y <= view.ymax; y += yStep) {
      const py = Math.round(Y(y)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, py);
      ctx.lineTo(PAD.left + plotW(), py);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(trim(y), PAD.left - 7, py + 4);
    }

    /* The axes themselves, darker, and only when they are on screen. */
    ctx.strokeStyle = axis();
    ctx.lineWidth = 1.4;
    if (view.ymin < 0 && view.ymax > 0) {
      const py = Math.round(Y(0)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, py);
      ctx.lineTo(PAD.left + plotW(), py);
      ctx.stroke();
    }
    if (view.xmin < 0 && view.xmax > 0) {
      const px = Math.round(X(0)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, PAD.top);
      ctx.lineTo(px, PAD.top + plotH());
      ctx.stroke();
    }
  }

  function trim(v) {
    const r = Math.round(v * 1000) / 1000;
    if (Math.abs(r) < 1e-9) return '0';
    return String(r);
  }

  function drawCurves(plotted) {
    const span = view.ymax - view.ymin;
    for (const s of plotted) {
      ctx.strokeStyle = (SERIES[s.role] || SERIES.truth)[dark ? 1 : 0];
      ctx.lineWidth = s.role === 'yours' ? 2.6 : s.role === 'original' ? 1.4 : 2;
      ctx.setLineDash(s.role === 'yours' ? [7, 5] : []);
      ctx.beginPath();
      let down = false;
      let lastY = NaN;
      for (const p of s.points) {
        /* A pole is a break in the line, not a vertical stripe across the
           picture: tan(x) must not be joined up through infinity. */
        const offScreen = !Number.isFinite(p.y)
          || p.y < view.ymin - span * 2 || p.y > view.ymax + span * 2;
        const jumped = Number.isFinite(lastY) && Number.isFinite(p.y)
          && Math.abs(p.y - lastY) > span * 1.5;
        if (offScreen || jumped) { down = false; lastY = p.y; continue; }
        const px = X(p.x);
        const py = Y(p.y);
        if (!down) { ctx.moveTo(px, py); down = true; } else ctx.lineTo(px, py);
        lastY = p.y;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* The crosshair, and what every curve is worth where it sits. */
  function drawTrace() {
    if (trace == null) return;
    const x = trace;
    const px = X(x);
    if (px < PAD.left || px > PAD.left + plotW()) return;

    ctx.save();
    ctx.strokeStyle = axis();
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(px) + 0.5, PAD.top);
    ctx.lineTo(Math.round(px) + 0.5, PAD.top + plotH());
    ctx.stroke();
    ctx.setLineDash([]);

    const rows = [];
    for (const s of series) {
      if (!s.fn) continue;
      const y = valueAt(s, x);
      if (!Number.isFinite(y)) continue;
      const py = Y(y);
      if (py >= PAD.top && py <= PAD.top + plotH()) {
        ctx.fillStyle = (SERIES[s.role] || SERIES.truth)[dark ? 1 : 0];
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      rows.push({ label: s.label || s.role, y, role: s.role });
    }

    /* The readout, kept on screen whichever side the pointer is. */
    const lines = [`x = ${trim(Math.round(x * 1000) / 1000)}`]
      .concat(rows.map((r) => `${r.label}: ${trim(Math.round(r.y * 1000) / 1000)}`));
    ctx.font = '11px ui-monospace, Consolas, monospace';
    const wide = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
    const tall = lines.length * 15 + 8;
    const left = px + wide + 12 < size.w ? px + 10 : px - wide - 10;
    const top = PAD.top + 6;
    ctx.fillStyle = dark ? 'rgba(12,14,19,0.92)' : 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = axis();
    ctx.lineWidth = 1;
    ctx.fillRect(left, top, wide, tall);
    ctx.strokeRect(left + 0.5, top + 0.5, wide, tall);
    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? ink()
        : (SERIES[rows[i - 1].role] || SERIES.truth)[dark ? 1 : 0];
      ctx.fillText(line, left + 7, top + 17 + i * 15);
    });
    ctx.restore();
  }

  function draw() {
    if (!framed && series.length) frame();
    ctx.save();
    ctx.fillStyle = surface();
    ctx.fillRect(0, 0, size.w, size.h);
    drawAxes();
    drawCurves(sample());
    drawTrace();
    ctx.restore();
  }

  /* ---------------------------------------------------------- handling */

  function zoomBy(factor, px, py) {
    const ax = px == null ? (view.xmin + view.xmax) / 2 : xAt(px);
    const ay = py == null ? (view.ymin + view.ymax) / 2 : yAt(py);
    Object.assign(view, zoomWindow(view, factor, ax, ay));
    draw();
  }

  function onWheel(ev) {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomBy(ev.deltaY > 0 ? 1.12 : 1 / 1.12, ev.clientX - rect.left, ev.clientY - rect.top);
  }

  function onDown(ev) {
    canvas.setPointerCapture(ev.pointerId);
    drag = { x: ev.clientX, y: ev.clientY };
  }

  function onMove(ev) {
    const rect = canvas.getBoundingClientRect();
    if (drag) {
      const dx = (ev.clientX - drag.x) / plotW() * (view.xmax - view.xmin);
      const dy = (ev.clientY - drag.y) / plotH() * (view.ymax - view.ymin);
      Object.assign(view, panWindow(view, dx, dy));
      drag = { x: ev.clientX, y: ev.clientY };
      draw();
      return;
    }
    trace = xAt(ev.clientX - rect.left);
    draw();
  }

  function onUp() { drag = null; }
  function onLeave() { drag = null; trace = null; draw(); }

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.style.touchAction = 'none';

  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resize()) : null;
  if (observer) observer.observe(canvas);
  resize();

  return {
    kind: 'plotter',
    setFunctions(list) {
      series = list || [];
      framed = false;
      draw();
    },
    setWindow(xmin, xmax) {
      view.xmin = xmin;
      view.xmax = xmax;
      framed = true;
      draw();
    },
    setDark(flag) { dark = !!flag; draw(); },
    zoomIn() { zoomBy(1 / 1.3); },
    zoomOut() { zoomBy(1.3); },
    resetView() { framed = false; draw(); },
    view: () => ({ ...view }),
    redraw: draw,
    resize,
    destroy() {
      if (observer) observer.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      container.innerHTML = '';
    },
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
