/* Dashboard charts: hand-written inline SVG, no library, no CDN.

   Conventions held throughout (they are not decoration - they are what makes
   these readable for everyone):

     - ONE value axis per chart. Never two scales in one frame.
     - Single series, so no legend box: the chart title names the series, and
       color carries no identity it has to.
     - Marks are thin, with a 4px rounded cap on the data end only; the
       baseline end stays square and anchored to zero.
     - Adjacent fills are separated by a 2px gap in the surface color, so bars
       never visually merge.
     - Grid and axis lines are recessive hairlines. Values and labels wear the
       text tokens, never the series color.
     - Every chart has a hover layer and a table view, because three of the
       light-mode palette steps sit under 3:1 contrast and the relief rule
       requires visible labels or a table.
     - Colors come from CSS custom properties defined in app.css, which are
       separately selected for light and dark. Dark is not an automatic flip.

   Everything is drawn into a viewBox and scaled with CSS, so it stays crisp
   and reflows on a phone without re-rendering. */

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, children = []) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    n.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

function fmtPct(v) { return `${Math.round(v * 100)}%`; }

function fmtDay(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------- the tooltip */

let tipEl = null;
function tooltip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'viz-tip';
    tipEl.setAttribute('role', 'status');
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function showTip(html, evt) {
  const t = tooltip();
  t.innerHTML = html;
  t.hidden = false;
  const pad = 12;
  const r = t.getBoundingClientRect();
  let x = evt.clientX + pad;
  let y = evt.clientY - r.height - pad;
  if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y < 8) y = evt.clientY + pad;
  t.style.left = `${Math.max(8, x)}px`;
  t.style.top = `${y}px`;
}

function hideTip() {
  if (tipEl) tipEl.hidden = true;
}

/* Attach a hover tooltip to a mark, and give it an accessible name so a
   screen reader walking the SVG still reads the value.

   Deliberately NOT focusable. A 30-bar chart plus a 24-point line would put
   50-odd invisible stops in the tab order before the next real control, which
   is worse for a keyboard user than having no tooltip at all. The table view
   every chart ships is the keyboard and screen-reader path, and it carries
   the same numbers with less work. */
function hoverable(node, html) {
  node.addEventListener('pointerenter', (e) => showTip(html, e));
  node.addEventListener('pointermove', (e) => showTip(html, e));
  node.addEventListener('pointerleave', hideTip);
  node.addEventListener('pointercancel', hideTip);
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  return node;
}

/* --------------------------------------------------------- activity (bars) */

/* Daily problem counts. One series, so magnitude is the only job and the bar
   is the right form. */
export function activityChart(data, { height = 118 } = {}) {
  const wrap = document.createElement('figure');
  wrap.className = 'viz viz-root';

  if (!data.length || data.every((d) => d.total === 0)) {
    wrap.appendChild(emptyNote('No practice recorded yet. The chart fills in as you answer questions.'));
    return wrap;
  }

  const W = 640, H = height;
  const padL = 30, padR = 8, padT = 12, padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(4, ...data.map((d) => d.total));
  /* A 2px gap between neighbours, in viewBox units after scaling. */
  const slot = plotW / data.length;
  const barW = Math.max(2, slot - 2);

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'viz-svg', preserveAspectRatio: 'none',
    role: 'group', 'aria-label': 'Problems answered per day',
  });

  /* Recessive gridlines at 0 and max only - more would be noise at this size. */
  for (const v of [0, max]) {
    const y = padT + plotH - (v / max) * plotH;
    svg.appendChild(el('line', {
      x1: padL, x2: W - padR, y1: y, y2: y,
      class: v === 0 ? 'viz-axis' : 'viz-grid',
    }));
    svg.appendChild(el('text', { x: padL - 6, y: y + 3.5, class: 'viz-tick', 'text-anchor': 'end' }, String(v)));
  }

  data.forEach((d, i) => {
    if (d.total === 0) return;
    const h = Math.max(2, (d.total / max) * plotH);
    const x = padL + i * slot + (slot - barW) / 2;
    const y = padT + plotH - h;
    /* Rounded data end, square at the baseline: a 4px radius on the top only,
       drawn as a path so the bottom corners stay sharp against the axis. */
    const r = Math.min(3, barW / 2, h);
    const bar = el('path', {
      d: `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${y + h} Z`,
      class: 'viz-bar',
    });
    const acc = d.total ? Math.round((d.correct / d.total) * 100) : 0;
    hoverable(bar, `<b>${fmtDay(d.day)}</b><br>${d.total} answered<br>${acc}% correct`);
    svg.appendChild(bar);
  });

  /* Direct labels at the ends only. A label on every bar would be unreadable
     and is explicitly the wrong move. */
  svg.appendChild(el('text', { x: padL, y: H - 6, class: 'viz-tick' }, fmtDay(data[0].day)));
  svg.appendChild(el('text', { x: W - padR, y: H - 6, class: 'viz-tick', 'text-anchor': 'end' },
    fmtDay(data[data.length - 1].day)));

  wrap.appendChild(svg);
  wrap.appendChild(tableToggle('Activity table', () => {
    const rows = data.filter((d) => d.total > 0).reverse()
      .map((d) => [fmtDay(d.day), String(d.total), `${Math.round((d.correct / d.total) * 100)}%`]);
    return { head: ['Day', 'Answered', 'Correct'], rows };
  }));
  return wrap;
}

/* ----------------------------------------------------- accuracy (line) */

export function accuracyChart(points, { height = 140 } = {}) {
  const wrap = document.createElement('figure');
  wrap.className = 'viz viz-root';

  if (points.length < 2) {
    wrap.appendChild(emptyNote(
      'Not enough history yet for a trend. This appears once you have answered enough questions for a rolling average to mean something.'));
    return wrap;
  }

  const W = 640, H = height;
  const padL = 34, padR = 10, padT = 14, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xAt = (i) => padL + (i / (points.length - 1)) * plotW;
  const yAt = (v) => padT + plotH - v * plotH;      /* 0..1 accuracy, fixed scale */

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'viz-svg', preserveAspectRatio: 'none',
    role: 'group', 'aria-label': 'Rolling accuracy over recent attempts',
  });

  /* Fixed 0-100% scale: a trend chart that rescales to its own data makes a
     wobble between 72% and 75% look like a cliff. */
  for (const v of [0, 0.5, 1]) {
    const y = yAt(v);
    svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: v === 0 ? 'viz-axis' : 'viz-grid' }));
    svg.appendChild(el('text', { x: padL - 6, y: y + 3.5, class: 'viz-tick', 'text-anchor': 'end' }, fmtPct(v)));
  }

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.accuracy).toFixed(1)}`).join(' ');
  svg.appendChild(el('path', { d, class: 'viz-line' }));

  /* Markers at every point would be clutter; the last point is the one that
     gets a visible dot and a direct label. */
  const last = points[points.length - 1];
  const lx = xAt(points.length - 1), ly = yAt(last.accuracy);
  svg.appendChild(el('circle', { cx: lx, cy: ly, r: 4.5, class: 'viz-dot' }));
  const lbl = el('text', {
    x: lx - 8, y: ly - 9, class: 'viz-label', 'text-anchor': 'end',
  }, fmtPct(last.accuracy));
  svg.appendChild(lbl);

  /* Invisible hit bands give every point a hover target far bigger than the
     mark, which is what makes this usable on a trackpad. */
  points.forEach((p, i) => {
    const band = el('rect', {
      x: xAt(i) - plotW / points.length / 2, y: padT,
      width: plotW / points.length, height: plotH,
      class: 'viz-hit',
    });
    hoverable(band, `<b>${fmtPct(p.accuracy)}</b> correct<br>over the 20 attempts ending ${fmtDay(p.ts)}`);
    svg.appendChild(band);
  });

  svg.appendChild(el('text', { x: padL, y: H - 6, class: 'viz-tick' }, 'earlier'));
  svg.appendChild(el('text', { x: W - padR, y: H - 6, class: 'viz-tick', 'text-anchor': 'end' }, 'now'));

  wrap.appendChild(svg);
  wrap.appendChild(tableToggle('Accuracy table', () => ({
    head: ['Through', 'Attempts', 'Rolling accuracy'],
    rows: points.slice().reverse().map((p) => [fmtDay(p.ts), String(p.n), fmtPct(p.accuracy)]),
  })));
  return wrap;
}

/* ------------------------------------------------- mastery (horizontal bars) */

/* Accuracy per topic. Magnitude again, but the category labels are long, so
   horizontal bars - the form that gives a label room to be read. */
export function masteryChart(rows, { limit = 10, onPick = null } = {}) {
  const wrap = document.createElement('figure');
  wrap.className = 'viz viz-root viz-mastery';

  const shown = rows.filter((r) => r.enough).slice(0, limit);
  if (!shown.length) {
    wrap.appendChild(emptyNote(
      `Nothing measured yet. A topic needs a few attempts before an accuracy number means anything, so this stays empty until then.`));
    return wrap;
  }

  const list = document.createElement('div');
  list.className = 'bars';

  for (const r of shown) {
    const row = document.createElement(onPick ? 'button' : 'div');
    row.className = 'barrow';
    if (onPick) {
      row.type = 'button';
      row.addEventListener('click', () => onPick(r.topicId));
      row.title = `Practice ${r.name}`;
    }

    const name = document.createElement('span');
    name.className = 'barname';
    name.textContent = r.name;

    const track = document.createElement('span');
    track.className = 'bartrack';
    const fill = document.createElement('span');
    fill.className = 'barfill';
    fill.style.width = `${Math.max(2, r.accuracy * 100)}%`;
    /* Bucketed, not a continuous ramp: three steps of one hue read reliably,
       and the number beside it carries the precision. */
    fill.dataset.band = r.accuracy >= 0.8 ? 'high' : r.accuracy >= 0.6 ? 'mid' : 'low';
    track.appendChild(fill);

    /* The direct label is required here, not optional: it is the relief for
       the sub-3:1 contrast of the lighter fills. */
    const val = document.createElement('span');
    val.className = 'barval';
    val.textContent = fmtPct(r.accuracy);

    const meta = document.createElement('span');
    meta.className = 'barmeta';
    meta.textContent = `${r.correct}/${r.seen}`;

    row.append(name, track, val, meta);
    list.appendChild(row);
  }

  wrap.appendChild(list);

  const under = rows.filter((r) => !r.enough && r.seen > 0).length;
  if (under) {
    const note = document.createElement('p');
    note.className = 'viz-note';
    note.textContent = `${under} more topic${under === 1 ? ' has' : 's have'} been started but not answered enough times `
      + `to report an accuracy. Under four attempts the number is noise.`;
    wrap.appendChild(note);
  }
  return wrap;
}

/* ------------------------------------------------- test breakdown (by topic) */

export function breakdownChart(breakdown) {
  const wrap = document.createElement('figure');
  wrap.className = 'viz viz-root viz-mastery';
  const list = document.createElement('div');
  list.className = 'bars';

  for (const b of breakdown) {
    const acc = b.total ? b.correct / b.total : 0;
    const row = document.createElement('div');
    row.className = 'barrow';
    const name = document.createElement('span');
    name.className = 'barname';
    name.textContent = b.name;
    const track = document.createElement('span');
    track.className = 'bartrack';
    const fill = document.createElement('span');
    fill.className = 'barfill';
    fill.style.width = `${Math.max(2, acc * 100)}%`;
    fill.dataset.band = acc >= 0.8 ? 'high' : acc >= 0.6 ? 'mid' : 'low';
    track.appendChild(fill);
    const val = document.createElement('span');
    val.className = 'barval';
    val.textContent = `${b.correct}/${b.total}`;
    row.append(name, track, val);
    list.appendChild(row);
  }
  wrap.appendChild(list);
  return wrap;
}

/* ------------------------------------------------------------------ helpers */

function emptyNote(text) {
  const p = document.createElement('p');
  p.className = 'viz-empty';
  p.textContent = text;
  return p;
}

/* Every chart ships a table view. It is the accessible fallback, the
   colorblind fallback, and the "what was that number actually" fallback. */
function tableToggle(label, build) {
  const details = document.createElement('details');
  details.className = 'viz-table';
  const summary = document.createElement('summary');
  summary.textContent = label;
  details.appendChild(summary);
  let built = false;
  details.addEventListener('toggle', () => {
    if (!details.open || built) return;
    built = true;
    const { head, rows } = build();
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    for (const h of head) {
      const th = document.createElement('th');
      th.textContent = h;
      htr.appendChild(th);
    }
    thead.appendChild(htr);
    const tbody = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      for (const c of r) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    details.appendChild(table);
  });
  return details;
}

/* A single large number with its label. Not a chart - when the answer is one
   value, a chart is the wrong form and a stat tile is the right one. */
export function statTile(value, label, sub) {
  const d = document.createElement('div');
  d.className = 'stat';
  const v = document.createElement('div');
  v.className = 'statval';
  v.textContent = value;
  const l = document.createElement('div');
  l.className = 'statlabel';
  l.textContent = label;
  d.append(v, l);
  if (sub) {
    const s = document.createElement('div');
    s.className = 'statsub';
    s.textContent = sub;
    d.appendChild(s);
  }
  return d;
}
