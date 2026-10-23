/* The whiteboard: somewhere to actually do the work.

   Three decisions here are about what comes later rather than what it does
   today.

   1. STROKES ARE STORED IN 0..1 COORDINATES, not pixels. Two people on a
      laptop and a phone have nothing in common pixel-wise, so a stroke drawn
      on one has to mean the same thing on the other. Normalising at capture
      time is the only point where the aspect ratio is known for certain.

   2. THE LOG IS APPEND ONLY. Erasing marks a stroke dead rather than
      removing it, and clearing marks everything dead. That is the same rule
      the sync merge already follows for attempts: two devices that both drew
      while disconnected should end up with BOTH sets of marks, and union
      only works when nothing is ever deleted outright.

   3. EVERY STROKE CARRIES ITS AUTHOR. Not for permissions, but so the other
      person's work can be told apart from yours at a glance, which is the
      whole point of watching someone work through a problem.

   No dependency, no framework: a canvas, pointer events, and a redraw. */

const TOOLS = {
  pen: { width: 2.6, alpha: 1, composite: 'source-over' },
  marker: { width: 9, alpha: 0.38, composite: 'source-over' },
  /* A thin pen for annotating a graph, where the drawing has to stay
     readable over a grid. */
  fine: { width: 1.6, alpha: 1, composite: 'source-over' },
};

export const BOARD_COLORS = [
  { id: 'ink', label: 'Ink', light: '#141821', dark: '#f3f1ec' },
  { id: 'blue', label: 'Blue', light: '#2a78d6', dark: '#3987e5' },
  { id: 'teal', label: 'Teal', light: '#14655a', dark: '#5fc2ae' },
  { id: 'orange', label: 'Orange', light: '#eb6834', dark: '#d95926' },
];

function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
}

/* Distance from point p to the segment ab, used by the eraser. Comparing
   against the segments rather than the sampled points means a fast stroke,
   which has points far apart, still erases where you actually drag. */
function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function strokeHit(stroke, point, radius) {
  const pts = stroke.points;
  if (!pts || !pts.length) return false;
  if (pts.length === 1) return Math.hypot(pts[0].x - point.x, pts[0].y - point.y) <= radius;
  for (let i = 1; i < pts.length; i++) {
    if (distanceToSegment(point, pts[i - 1], pts[i]) <= radius) return true;
  }
  return false;
}

/* The drawing surface. `canvas` is a <canvas>; everything else is optional. */
export function createBoard(canvas, options = {}) {
  const state = {
    strokes: [],
    tool: 'pen',
    color: 'ink',
    author: options.author || 'me',
    dark: !!options.dark,
    readOnly: !!options.readOnly,
  };
  const ctx = canvas.getContext('2d');
  let drawing = null;
  let size = { w: 1, h: 1 };

  const notify = (stroke, kind) => {
    if (typeof options.onChange === 'function') options.onChange(stroke, kind);
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    size = { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  /* Pixels to 0..1. x and y are normalised by the SAME dimension (the width)
     so a circle stays a circle: normalising each axis by its own length
     would squash drawings on a differently shaped screen. */
  const toNorm = (ev) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) / size.w,
      y: (ev.clientY - rect.top) / size.w,
    };
  };
  const toPixels = (p) => ({ x: p.x * size.w, y: p.y * size.w });

  function colorFor(stroke) {
    const entry = BOARD_COLORS.find((c) => c.id === stroke.color) || BOARD_COLORS[0];
    return state.dark ? entry.dark : entry.light;
  }

  function drawStroke(stroke) {
    if (stroke.dead) return;
    const spec = TOOLS[stroke.tool] || TOOLS.pen;
    const pts = stroke.points;
    if (!pts.length) return;
    ctx.save();
    ctx.globalAlpha = spec.alpha;
    ctx.strokeStyle = colorFor(stroke);
    ctx.lineWidth = spec.width * (stroke.scale || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const first = toPixels(pts[0]);
    ctx.moveTo(first.x, first.y);
    if (pts.length === 1) {
      /* A tap is a dot, not nothing. */
      ctx.lineTo(first.x + 0.1, first.y);
    } else {
      /* Midpoint curves: cheap smoothing that keeps handwriting legible
         without turning it into someone else's handwriting. */
      for (let i = 1; i < pts.length - 1; i++) {
        const a = toPixels(pts[i]);
        const b = toPixels(pts[i + 1]);
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      const last = toPixels(pts[pts.length - 1]);
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, size.w, size.h);
    for (const stroke of state.strokes) drawStroke(stroke);
  }

  function begin(ev) {
    if (state.readOnly) return;
    if (ev.button !== undefined && ev.button !== 0) return;
    canvas.setPointerCapture(ev.pointerId);
    const point = toNorm(ev);
    if (state.tool === 'eraser') {
      eraseAt(point);
      drawing = { erasing: true };
      return;
    }
    drawing = {
      id: uid(),
      tool: state.tool,
      color: state.color,
      author: state.author,
      points: [point],
      at: Date.now(),
    };
    state.strokes.push(drawing);
    redraw();
  }

  function extend(ev) {
    if (!drawing) return;
    const point = toNorm(ev);
    if (drawing.erasing) { eraseAt(point); return; }
    const pts = drawing.points;
    const last = pts[pts.length - 1];
    /* Drop points that add nothing. Fewer points means a smaller payload to
       send to the other device and a faster redraw. */
    if (Math.hypot(point.x - last.x, point.y - last.y) < 0.002) return;
    pts.push(point);
    redraw();
  }

  function end() {
    if (!drawing) return;
    const finished = drawing;
    drawing = null;
    if (finished.erasing) return;
    notify(finished, 'stroke');
  }

  function eraseAt(point) {
    const radius = 0.018;
    let killed = false;
    for (const stroke of state.strokes) {
      if (stroke.dead) continue;
      if (strokeHit(stroke, point, radius)) {
        stroke.dead = true;
        killed = true;
        notify(stroke, 'erase');
      }
    }
    if (killed) redraw();
  }

  canvas.addEventListener('pointerdown', begin);
  canvas.addEventListener('pointermove', extend);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);
  /* The page must not scroll while someone is drawing on a phone. */
  canvas.style.touchAction = 'none';

  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resize()) : null;
  if (observer) observer.observe(canvas);
  resize();

  return {
    get strokes() { return state.strokes; },
    setTool(tool) { state.tool = tool; },
    setColor(color) { state.color = color; },
    setDark(dark) { state.dark = !!dark; redraw(); },
    setAuthor(author) { state.author = author; },
    setReadOnly(flag) { state.readOnly = !!flag; },
    tool: () => state.tool,
    color: () => state.color,

    /* Undo removes YOUR last live stroke, not the other person's. */
    undo(author = state.author) {
      for (let i = state.strokes.length - 1; i >= 0; i--) {
        const stroke = state.strokes[i];
        if (!stroke.dead && stroke.author === author) {
          stroke.dead = true;
          redraw();
          notify(stroke, 'erase');
          return stroke;
        }
      }
      return null;
    },

    clear() {
      let any = false;
      for (const stroke of state.strokes) {
        if (!stroke.dead) { stroke.dead = true; any = true; }
      }
      if (any) { redraw(); notify(null, 'clear'); }
    },

    /* Apply a stroke that arrived from somewhere else. Keyed by id so the
       same stroke arriving twice is not drawn twice. */
    apply(stroke) {
      if (!stroke || !stroke.id) return;
      const existing = state.strokes.find((s) => s.id === stroke.id);
      if (existing) {
        if (stroke.dead) existing.dead = true;
        else existing.points = stroke.points;
      } else {
        state.strokes.push({ ...stroke });
      }
      redraw();
    },

    load(strokes) {
      state.strokes = Array.isArray(strokes) ? strokes.map((s) => ({ ...s })) : [];
      redraw();
    },

    /* Live strokes only, for saving. The dead ones matter for merging but
       not for a snapshot. */
    snapshot() {
      return state.strokes.filter((s) => !s.dead).map((s) => ({ ...s }));
    },

    toPNG() { return canvas.toDataURL('image/png'); },
    redraw,
    resize,
    destroy() {
      if (observer) observer.disconnect();
      canvas.removeEventListener('pointerdown', begin);
      canvas.removeEventListener('pointermove', extend);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('pointerleave', end);
    },
  };
}

/* Merge two stroke logs. Union by id, and dead wins over alive, which is what
   makes "I erased it on my phone" survive a reconnect. Pure, so the tests can
   drive it without a canvas. */
export function mergeStrokes(mine, theirs) {
  const byId = new Map();
  for (const stroke of [...(mine || []), ...(theirs || [])]) {
    if (!stroke || !stroke.id) continue;
    const existing = byId.get(stroke.id);
    if (!existing) {
      byId.set(stroke.id, { ...stroke });
    } else {
      /* Keep the longer version of a stroke still being drawn, and let an
         erase from either side stick. */
      const longer = (stroke.points || []).length > (existing.points || []).length
        ? stroke : existing;
      byId.set(stroke.id, {
        ...longer,
        dead: !!(existing.dead || stroke.dead),
      });
    }
  }
  return [...byId.values()].sort((a, b) => (a.at || 0) - (b.at || 0));
}

export default { createBoard, mergeStrokes, strokeHit, BOARD_COLORS };
