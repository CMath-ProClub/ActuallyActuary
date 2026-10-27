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
  /* `vary` is how much a stylus's pressure is allowed to change the width.
     A pen varies a lot, a highlighter barely at all - a highlighter that
     thins out under a light touch looks broken rather than expressive. */
  pen: { width: 2.6, alpha: 1, composite: 'source-over', vary: 0.75 },
  marker: { width: 9, alpha: 0.38, composite: 'source-over', vary: 0.15 },
  /* A thin pen for annotating a graph, where the drawing has to stay
     readable over a grid. */
  fine: { width: 1.6, alpha: 1, composite: 'source-over', vary: 0.5 },
};

/* A mouse reports pressure 0.5 and never moves off it; a finger reports
   either 0 or 1. Only a real stylus reports anything in between, so only a
   real stylus gets variable width. */
const PEN_POINTER = 'pen';

/* Paper is white, in both themes.

   A dark whiteboard is a contradiction, and more to the point handwriting
   in white on navy is harder to read back than navy on white - which is
   what the board is FOR. So the surface stays paper-coloured whatever the
   rest of the page is doing, and the navy that used to be the background is
   now the default ink. */
export const PAPER = '#ffffff';
export const PAPER_LINE = '#e6ebf4';
export const PAPER_LINE_STRONG = '#d4dcea';

export const BOARD_COLORS = [
  { id: 'ink', label: 'Navy', light: '#17243d', dark: '#f3f1ec' },
  { id: 'blue', label: 'Blue', light: '#2a78d6', dark: '#3987e5' },
  { id: 'teal', label: 'Teal', light: '#14655a', dark: '#5fc2ae' },
  { id: 'red', label: 'Red', light: '#c23434', dark: '#e66767' },
  { id: 'grey', label: 'Pencil', light: '#6b7484', dark: '#949cab' },
  { id: 'orange', label: 'Orange', light: '#eb6834', dark: '#d95926' },
];

/* How far the pen sizes are apart. Stored on the stroke, so a thick line
   stays thick on the other person's screen. */
export const PEN_SIZES = [
  { id: 'fine', label: 'Fine', scale: 0.6 },
  { id: 'normal', label: 'Normal', scale: 1 },
  { id: 'thick', label: 'Thick', scale: 1.9 },
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
    /* Pen thickness, carried on every stroke it draws. */
    scale: 1,
    /* A white surface with a faint grid, which is what a whiteboard is.
       The graph annotation layer passes paper: false and keeps the
       transparent overlay it needs. */
    paper: options.paper !== false,
    grid: options.grid !== false,
  };
  const ctx = canvas.getContext('2d');
  let drawing = null;
  let size = { w: 1, h: 1 };

  /* Where the window sits over an endless sheet. x and y are in the same
     0..1-of-the-width units as the strokes, so panning down by 1 moves by
     one canvas width. Zoom multiplies both. */
  const view = { x: 0, y: 0, zoom: 1 };
  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 6;

  /* Undone strokes, newest last. The log itself stays append-only - undo
     flips `dead` rather than removing anything - so redo is just flipping
     it back, and a stroke that was undone on one device still merges. */
  const undone = [];

  /* Once a stylus has been seen, fingers stop drawing.

     This is palm rejection, and on a touchscreen laptop it is the
     difference between writing on the board and smearing across it: the
     hand resting on the screen arrives as a touch pointer at the same time
     as the pen tip. Touch still pans and scrolls, it just stops marking. */
  let sawPen = false;

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
    const span = size.w * view.zoom;
    const point = {
      x: (ev.clientX - rect.left) / span + view.x,
      y: (ev.clientY - rect.top) / span + view.y,
    };
    /* Pressure, but only from something that actually has any. */
    if (ev.pointerType === PEN_POINTER && typeof ev.pressure === 'number'
      && ev.pressure > 0) {
      point.p = Math.max(0.05, Math.min(1, ev.pressure));
    }
    return point;
  };
  const toPixels = (p) => ({
    x: (p.x - view.x) * size.w * view.zoom,
    y: (p.y - view.y) * size.w * view.zoom,
  });

  function colorFor(stroke) {
    const entry = BOARD_COLORS.find((c) => c.id === stroke.color) || BOARD_COLORS[0];
    /* On white paper the light-mode ink is always the right one, whatever
       the page around it is doing. */
    if (state.paper) return entry.light;
    return state.dark ? entry.dark : entry.light;
  }

  /* Faint ruling, so the sheet moving under you is visible when you pan and
     a line of working can be written straight. Drawn in world units, so it
     scales with the zoom rather than sliding past the ink. */
  function drawGrid() {
    const span = size.w * view.zoom;
    const step = 0.05 * span;
    if (step < 6) return;
    ctx.save();
    ctx.lineWidth = 1;
    /* Indexed in WORLD units, not screen ones, so the darker fifth line is
       the same line after you pan rather than one that slides. */
    const firstX = Math.floor(view.x / 0.05);
    const firstY = Math.floor(view.y / 0.05);
    const lastX = Math.ceil((view.x + size.w / span) / 0.05);
    const lastY = Math.ceil((view.y + size.h / span) / 0.05);
    for (const major of [false, true]) {
      ctx.strokeStyle = major ? PAPER_LINE_STRONG : PAPER_LINE;
      ctx.beginPath();
      for (let k = firstX; k <= lastX; k++) {
        if ((k % 5 === 0) !== major) continue;
        const x = (k * 0.05 - view.x) * span;
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, size.h);
      }
      for (let k = firstY; k <= lastY; k++) {
        if ((k % 5 === 0) !== major) continue;
        const y = (k * 0.05 - view.y) * span;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(size.w, Math.round(y) + 0.5);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* The width of the ink at one point of one stroke. */
  function widthAt(stroke, spec, point) {
    const base = spec.width * (stroke.scale || 1) * view.zoom;
    const vary = spec.vary || 0;
    if (!vary || !point || point.p == null) return base;
    /* 0.5 is the resting value, so a firm press thickens and a light one
       thins, around the width the pen would have had anyway. */
    return base * (1 + vary * (point.p - 0.5) * 2);
  }

  /* One segment of a stroke, drawn with the midpoint smoothing the whole
     stroke uses, so an incrementally drawn line and a redrawn one are the
     same line. */
  function drawSegment(stroke, spec, i) {
    const pts = stroke.points;
    if (i < 1) return;
    const prev = toPixels(pts[i - 1]);
    const cur = toPixels(pts[i]);
    const before = i >= 2 ? toPixels(pts[i - 2]) : prev;
    const from = { x: (before.x + prev.x) / 2, y: (before.y + prev.y) / 2 };
    const to = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
    ctx.beginPath();
    ctx.lineWidth = widthAt(stroke, spec, pts[i]);
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(prev.x, prev.y, to.x, to.y);
    ctx.stroke();
  }

  function penFor(stroke, spec) {
    ctx.globalAlpha = spec.alpha;
    ctx.strokeStyle = colorFor(stroke);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function drawStroke(stroke) {
    if (stroke.dead) return;
    const spec = TOOLS[stroke.tool] || TOOLS.pen;
    const pts = stroke.points;
    if (!pts.length) return;
    ctx.save();
    penFor(stroke, spec);
    if (pts.length === 1) {
      /* A tap is a dot, not nothing. */
      const only = toPixels(pts[0]);
      ctx.beginPath();
      ctx.lineWidth = widthAt(stroke, spec, pts[0]);
      ctx.moveTo(only.x, only.y);
      ctx.lineTo(only.x + 0.1, only.y);
      ctx.stroke();
    } else {
      /* Segment at a time, because the width can change along the stroke
         and a single path can only have one. */
      for (let i = 1; i < pts.length; i++) drawSegment(stroke, spec, i);
    }
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, size.w, size.h);
    if (state.paper) {
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, size.w, size.h);
      if (state.grid) drawGrid();
    }
    for (const stroke of state.strokes) drawStroke(stroke);
  }

  function begin(ev) {
    if (state.readOnly) return;
    if (ev.pointerType === PEN_POINTER) sawPen = true;
    /* The hand resting on a touchscreen is not trying to write. */
    if (sawPen && ev.pointerType === 'touch') return;
    /* The far end of a stylus is an eraser, and people turn it round
       without thinking about it. */
    const inverted = ev.pointerType === PEN_POINTER && (ev.buttons & 32) !== 0;
    if (ev.button !== undefined && ev.button !== 0 && !inverted) return;
    canvas.setPointerCapture(ev.pointerId);
    /* The hand tool drags the sheet instead of marking it. */
    if (state.tool === 'pan') {
      drawing = { panning: true, from: { x: ev.clientX, y: ev.clientY } };
      return;
    }
    const point = toNorm(ev);
    if (state.tool === 'eraser' || inverted) {
      eraseAt(point);
      drawing = { erasing: true };
      return;
    }
    /* Drawing something new is the end of the redo trail, the same as in
       every editor. */
    undone.length = 0;
    drawing = {
      id: uid(),
      tool: state.tool,
      color: state.color,
      author: state.author,
      scale: state.scale,
      points: [point],
      at: Date.now(),
    };
    state.strokes.push(drawing);
    /* A new stroke only has to draw ITSELF. Redrawing the whole board on
       every pointer sample is what made writing feel like dragging. */
    ctx.save();
    penFor(drawing, TOOLS[drawing.tool] || TOOLS.pen);
    const only = toPixels(point);
    ctx.beginPath();
    ctx.lineWidth = widthAt(drawing, TOOLS[drawing.tool] || TOOLS.pen, point);
    ctx.moveTo(only.x, only.y);
    ctx.lineTo(only.x + 0.1, only.y);
    ctx.stroke();
    ctx.restore();
  }

  function extend(ev) {
    if (!drawing) return;
    if (sawPen && ev.pointerType === 'touch' && !drawing.panning) return;
    if (drawing.panning) {
      const span = size.w * view.zoom;
      view.x -= (ev.clientX - drawing.from.x) / span;
      view.y -= (ev.clientY - drawing.from.y) / span;
      drawing.from = { x: ev.clientX, y: ev.clientY };
      redraw();
      notifyView();
      return;
    }
    if (drawing.erasing) { eraseAt(toNorm(ev)); return; }

    /* Every sample the device took since the last frame, not just the one
       the browser chose to tell us about. A quick stroke on a 120Hz pen
       produces several of these per frame, and using them is the
       difference between a curve and a polygon. */
    const samples = typeof ev.getCoalescedEvents === 'function'
      ? ev.getCoalescedEvents() : [];
    const points = (samples.length ? samples : [ev]).map(toNorm);

    const spec = TOOLS[drawing.tool] || TOOLS.pen;
    ctx.save();
    penFor(drawing, spec);
    for (const point of points) {
      const pts = drawing.points;
      const last = pts[pts.length - 1];
      /* Drop points that add nothing. Fewer points means a smaller payload
         to send to the other device and a faster redraw. The threshold is
         in SCREEN terms, or zooming in would quietly coarsen the
         handwriting. */
      if (Math.hypot(point.x - last.x, point.y - last.y) < 0.0012 / view.zoom) continue;
      pts.push(point);
      /* Draw only what was just added. */
      drawSegment(drawing, spec, pts.length - 1);
    }
    ctx.restore();
  }

  function end() {
    if (!drawing) return;
    const finished = drawing;
    drawing = null;
    if (finished.erasing || finished.panning) return;
    /* One full redraw at the end, so the finished stroke is drawn by the
       same code that will draw it from then on. Incremental drawing and a
       redraw must agree, or a stroke would change shape the moment
       anything else happened. */
    redraw();
    notify(finished, 'stroke');
  }

  function eraseAt(point) {
    /* A constant size under the fingertip, whatever the zoom. */
    const radius = 0.018 / view.zoom;
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

  function notifyView() {
    if (typeof options.onView === 'function') options.onView(viewState());
  }

  function viewState() {
    return { x: view.x, y: view.y, zoom: view.zoom };
  }

  /* Zoom about a point on the screen, so whatever is under the cursor or
     between two fingers stays under it. */
  function zoomAt(factor, screenX, screenY) {
    const before = view.zoom;
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, before * factor));
    if (next === before) return;
    const px = screenX == null ? size.w / 2 : screenX;
    const py = screenY == null ? size.h / 2 : screenY;
    /* The world point under (px, py) must not move. */
    const worldX = px / (size.w * before) + view.x;
    const worldY = py / (size.w * before) + view.y;
    view.zoom = next;
    view.x = worldX - px / (size.w * next);
    view.y = worldY - py / (size.w * next);
    redraw();
    notifyView();
  }

  /* The wheel scrolls the sheet, which is what a wheel does. Holding ctrl
     (or cmd) zooms, which is what every drawing program does. */
  function onWheel(ev) {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) {
      const rect = canvas.getBoundingClientRect();
      zoomAt(ev.deltaY < 0 ? 1.12 : 1 / 1.12, ev.clientX - rect.left, ev.clientY - rect.top);
      return;
    }
    const span = size.w * view.zoom;
    view.x += ev.deltaX / span;
    view.y += ev.deltaY / span;
    redraw();
    notifyView();
  }

  canvas.addEventListener('pointerdown', begin);
  canvas.addEventListener('pointermove', extend);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);
  canvas.addEventListener('wheel', onWheel, { passive: false });
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

    setSize(scale) { state.scale = Number(scale) || 1; },
    size: () => state.scale,
    setPaper(flag) { state.paper = !!flag; redraw(); },
    setGrid(flag) { state.grid = !!flag; redraw(); },

    /* The view. zoomBy takes a factor; panBy takes screen pixels, which is
       what a button press or a drag has to hand. */
    zoomBy(factor, x, y) { zoomAt(factor, x, y); },
    zoom: () => view.zoom,
    panBy(dx, dy) {
      const span = size.w * view.zoom;
      view.x += dx / span;
      view.y += dy / span;
      redraw();
      notifyView();
    },
    /* A screenful further down the sheet: the "more room" button. */
    moreRoom() {
      const span = size.w * view.zoom;
      view.y += (size.h * 0.85) / span;
      redraw();
      notifyView();
    },
    view: viewState,
    setView(next) {
      if (!next) return;
      if (Number.isFinite(next.x)) view.x = next.x;
      if (Number.isFinite(next.y)) view.y = next.y;
      if (Number.isFinite(next.zoom)) {
        view.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next.zoom));
      }
      redraw();
      notifyView();
    },
    resetView() {
      view.x = 0;
      view.y = 0;
      view.zoom = 1;
      redraw();
      notifyView();
    },
    /* Is there anything above or to the left of where we are looking? The
       toolbar uses this to decide whether "back to the top" is worth
       offering. */
    movedAway: () => Math.abs(view.x) > 0.01 || Math.abs(view.y) > 0.01 || view.zoom !== 1,

    /* Undo removes YOUR last live stroke, not the other person's. */
    undo(author = state.author) {
      for (let i = state.strokes.length - 1; i >= 0; i--) {
        const stroke = state.strokes[i];
        if (!stroke.dead && stroke.author === author) {
          stroke.dead = true;
          undone.push(stroke.id);
          redraw();
          notify(stroke, 'erase');
          return stroke;
        }
      }
      return null;
    },

    /* And redo puts it back. The stroke was never removed - undo only set a
       flag - so this is the same flag going the other way, which keeps the
       log append-only and the sync merge honest. */
    redo() {
      while (undone.length) {
        const id = undone.pop();
        const stroke = state.strokes.find((s) => s.id === id);
        if (!stroke || !stroke.dead) continue;
        stroke.dead = false;
        redraw();
        notify(stroke, 'stroke');
        return stroke;
      }
      return null;
    },

    canUndo: (author = state.author) => state.strokes
      .some((s) => !s.dead && s.author === author),
    canRedo: () => undone.length > 0,

    clear() {
      let any = false;
      for (const stroke of state.strokes) {
        if (!stroke.dead) { stroke.dead = true; any = true; }
      }
      undone.length = 0;
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
      canvas.removeEventListener('wheel', onWheel);
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

export default {
  createBoard, mergeStrokes, strokeHit, BOARD_COLORS, PEN_SIZES, PAPER,
};
