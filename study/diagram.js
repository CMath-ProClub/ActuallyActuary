/* The picture, for a question that has a shape rather than a curve.

   A related rates problem is a paragraph of English about a physical
   thing, and nobody solves one without drawing it first. Drawing it is
   where you decide which length is x and which is y, and getting that
   wrong is most of how these go wrong - so the drawing is not
   decoration, it is the first step of the working.

   The graph panel is no use here: there is no function of x to plot.
   This replaces it.

   EVERY PART CAN BE LABELLED. Each shape exposes a few anchors - the
   radius line, the base, the wall, the shadow - and any of them can be
   given a name. That is the point: assigning your own variables to the
   picture is the step this is trying to make easier, so the labels are
   yours to set rather than printed on by the generator. The generator's
   own suggestion is offered as a starting point and can be overwritten
   or cleared.

   Plain SVG strings, no library, and it inherits the page's colours
   through currentColor so it works in both themes. */

const W = 340;
const H = 230;

/* A labelled anchor: where the label sits, and what the generator
   thinks it probably is. */
const at = (id, x, y, suggest, hint) => ({ id, x, y, suggest: suggest || '', hint: hint || '' });

/* Shared bits of drawing. `a` is an arrow marker id defined once below. */
const ARROW = `
  <defs>
    <marker id="dgArrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
    </marker>
  </defs>`;

const line = (x1, y1, x2, y2, cls = 'dgline') =>
  `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

const arrow = (x1, y1, x2, y2) =>
  `<line class="dgarrow" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#dgArrow)"/>`;

const dash = (x1, y1, x2, y2) =>
  `<line class="dgdash" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

/* A right-angle tick, which is what tells you it is Pythagoras. */
const rightAngle = (x, y, dx, dy) =>
  `<path class="dgline" fill="none" d="M ${x + dx} ${y} L ${x + dx} ${y + dy} L ${x} ${y + dy}"/>`;

export const DIAGRAMS = {

  circle: {
    title: 'A circle, growing outwards',
    draw: () => `${ARROW}
      <circle class="dgfill" cx="170" cy="115" r="78"/>
      <circle class="dgdash" cx="170" cy="115" r="98" fill="none"/>
      ${arrow(170, 115, 170 + 78, 115)}
      <circle class="dgdot" cx="170" cy="115" r="3"/>`,
    parts: [
      at('radius', 212, 104, 'r', 'the radius, from the centre to the edge'),
      at('edge', 170, 28, 'C', 'the edge itself - its length is the circumference'),
      at('inside', 118, 150, 'A', 'the area inside'),
    ],
  },

  square: {
    title: 'A square',
    draw: () => `${ARROW}
      <rect class="dgfill" x="100" y="45" width="140" height="140"/>
      ${arrow(100, 200, 240, 200)}`,
    parts: [
      at('side', 170, 213, 's', 'the side length'),
      at('inside', 170, 120, 'A', 'the area inside'),
    ],
  },

  triangle: {
    title: 'A triangle with a fixed height',
    draw: () => `${ARROW}
      <path class="dgfill" d="M 80 185 L 260 185 L 150 55 Z"/>
      ${dash(150, 55, 150, 185)}
      ${rightAngle(150, 185, 14, -14)}
      ${arrow(80, 200, 260, 200)}`,
    parts: [
      at('base', 170, 214, 'b', 'the base, which is changing'),
      at('height', 163, 118, 'h', 'the height, which stays the same'),
      at('inside', 118, 165, 'A', 'the area'),
    ],
  },

  sphere: {
    title: 'A sphere',
    draw: () => `${ARROW}
      <circle class="dgfill" cx="170" cy="115" r="76"/>
      <ellipse class="dgdash" cx="170" cy="115" rx="76" ry="24" fill="none"/>
      ${arrow(170, 115, 170 + 76, 115)}
      ${dash(170 - 76, 115, 170 + 76, 115)}
      <circle class="dgdot" cx="170" cy="115" r="3"/>`,
    parts: [
      at('radius', 212, 104, 'r', 'the radius - half the way across'),
      at('diameter', 170, 142, 'd', 'the diameter - all the way across'),
      at('surface', 170, 26, 'S', 'the surface, the skin of it'),
      at('inside', 112, 150, 'V', 'the volume inside'),
    ],
  },

  cube: {
    title: 'A cube',
    draw: () => `${ARROW}
      <rect class="dgfill" x="95" y="70" width="120" height="120"/>
      <path class="dgline" fill="none" d="M 95 70 L 135 36 L 255 36 L 215 70"/>
      <path class="dgline" fill="none" d="M 255 36 L 255 156 L 215 190"/>
      ${dash(95, 190, 135, 156)} ${dash(135, 156, 255, 156)} ${dash(135, 36, 135, 156)}
      ${arrow(95, 205, 215, 205)}`,
    parts: [
      at('side', 155, 219, 's', 'one edge'),
      at('face', 155, 134, 'S', 'the surface - six of these faces'),
      at('inside', 225, 100, 'V', 'the volume inside'),
    ],
  },

  cylinder: {
    title: 'A cylinder filling up',
    draw: () => `${ARROW}
      <path class="dgline" fill="none" d="M 110 55 L 110 185"/>
      <path class="dgline" fill="none" d="M 230 55 L 230 185"/>
      <ellipse class="dgline" cx="170" cy="55" rx="60" ry="18" fill="none"/>
      <path class="dgfill" d="M 110 130 L 110 185 A 60 18 0 0 0 230 185 L 230 130
                               A 60 18 0 0 1 110 130 Z"/>
      <ellipse class="dgwater" cx="170" cy="130" rx="60" ry="18" fill="none"/>
      ${arrow(170, 55, 230, 55)}
      ${arrow(252, 185, 252, 130)}
      ${dash(230, 185, 258, 185)} ${dash(230, 130, 258, 130)}`,
    parts: [
      at('radius', 200, 44, 'r', 'the radius - it does NOT change as it fills'),
      at('height', 276, 158, 'h', 'the depth of the water, which is rising'),
      at('inside', 150, 165, 'V', 'the volume of water'),
    ],
  },

  cone: {
    title: 'A cone-shaped hole, filling from the point up',
    draw: () => `${ARROW}
      <path class="dgline" fill="none" d="M 80 50 L 170 190 L 260 50"/>
      ${line(60, 50, 280, 50)}
      <path class="dgfill" d="M 125 120 L 170 190 L 215 120 Z"/>
      ${line(125, 120, 215, 120, 'dgwater')}
      ${arrow(170, 50, 260, 50)}
      ${dash(170, 50, 170, 190)}
      ${arrow(292, 190, 292, 50)}
      ${dash(260, 50, 300, 50)}
      ${arrow(104, 190, 104, 120)}
      ${dash(125, 120, 100, 120)}`,
    parts: [
      at('radius', 215, 38, 'R', 'the radius at ground level - a constant'),
      at('height', 310, 124, 'H', 'the full depth of the hole - a constant'),
      at('level', 80, 155, 'h', 'the depth of the water right now'),
      at('surfacer', 196, 112, 'r', 'the radius of the WATER - this widens as it fills'),
    ],
  },

  ladder: {
    title: 'A ladder sliding down a wall',
    draw: () => `${ARROW}
      ${line(70, 30, 70, 190)}
      ${line(50, 190, 290, 190)}
      <path class="dgfill" d="M 70 190 L 70 60 L 200 190 Z" fill-opacity="0.08"/>
      <line class="dgbold" x1="70" y1="60" x2="200" y2="190"/>
      ${rightAngle(70, 190, 16, -16)}
      ${arrow(200, 205, 240, 205)}
      ${arrow(55, 60, 55, 100)}`,
    parts: [
      at('base', 140, 219, 'x', 'from the wall to the foot - this is growing'),
      at('height', 34, 120, 'y', 'how far up the wall the top is - this is falling'),
      at('hyp', 152, 112, 'L', 'the ladder itself - its length never changes'),
    ],
  },

  shadow: {
    title: 'A lamppost overhead, shadow on the ground',
    draw: () => `${ARROW}
      ${line(50, 190, 310, 190)}
      ${line(70, 190, 70, 40)}
      <circle class="dgdot" cx="70" cy="36" r="6"/>
      ${line(170, 190, 170, 130)}
      ${dash(70, 40, 250, 190)}
      <path class="dgfill" d="M 170 190 L 250 190 L 250 186 L 170 186 Z"/>
      <line class="dgbold" x1="170" y1="190" x2="250" y2="190"/>
      ${arrow(170, 205, 215, 205)}`,
    parts: [
      at('lamp', 44, 110, 'H', 'the height of the lamp - a constant'),
      at('person', 182, 158, 'h', 'the person’s height - a constant'),
      at('gap', 118, 219, 'x', 'how far they are from the lamp'),
      at('shadow', 212, 219, 's', 'the shadow, which grows as they walk away'),
    ],
  },

  spotlight: {
    title: 'A spotlight on the floor, shadow on the wall',
    draw: () => `${ARROW}
      ${line(40, 190, 300, 190)}
      <line class="dgbold" x1="285" y1="40" x2="285" y2="190"/>
      <circle class="dgdot" cx="60" cy="190" r="7"/>
      ${line(150, 190, 150, 130)}
      ${dash(60, 190, 285, 46)}
      ${dash(60, 190, 285, 190)}
      <path class="dgfill" d="M 285 46 L 285 190 L 289 190 L 289 46 Z"/>
      <line class="dgbold" x1="285" y1="46" x2="285" y2="190"/>
      ${arrow(60, 205, 150, 205)}
      ${arrow(305, 190, 305, 46)}`,
    parts: [
      at('lamp', 60, 213, 'light', 'the spotlight, down on the floor'),
      at('person', 162, 158, 'h', 'the person’s height - a constant'),
      at('gap', 100, 219, 'x', 'how far they are from the light'),
      at('shadow', 318, 120, 'S', 'the shadow up the wall - it SHRINKS as they approach'),
      at('wall', 262, 32, 'L', 'light to wall - a constant'),
    ],
  },

  kite: {
    title: 'A kite on a string',
    draw: () => `${ARROW}
      ${line(40, 190, 310, 190)}
      <path class="dgfill" d="M 240 50 L 256 66 L 240 86 L 224 66 Z"/>
      <line class="dgbold" x1="80" y1="190" x2="240" y2="66"/>
      ${dash(240, 66, 240, 190)}
      ${dash(80, 190, 240, 190)}
      ${rightAngle(240, 190, -16, -16)}
      ${arrow(80, 205, 240, 205)}
      ${arrow(276, 190, 276, 66)}`,
    parts: [
      at('base', 160, 219, 'x', 'how far out it has drifted'),
      at('height', 300, 130, 'h', 'the height it is flying at - a constant'),
      at('hyp', 150, 112, 'z', 'the string that is out'),
    ],
  },
};

export const DIAGRAM_IDS = Object.keys(DIAGRAMS);

/* The whole picture as one SVG string, with no labels on it. The labels
   are separate DOM so they can be edited. */
export function svgFor(id) {
  const shape = DIAGRAMS[id];
  if (!shape) return '';
  return `<svg class="dgsvg" viewBox="0 0 ${W} ${H}" role="img" `
    + `aria-label="${shape.title}">${shape.draw()}</svg>`;
}

export function partsFor(id) {
  const shape = DIAGRAMS[id];
  return shape ? shape.parts.slice() : [];
}

export function titleFor(id) {
  const shape = DIAGRAMS[id];
  return shape ? shape.title : '';
}

/* Where a label sits, as a percentage, so it rides the SVG when the
   panel is resized rather than needing pixel maths in the page. */
export function placeOf(part) {
  return {
    left: `${(part.x / W) * 100}%`,
    top: `${(part.y / H) * 100}%`,
  };
}

export function has(id) {
  return !!DIAGRAMS[id];
}

export default { DIAGRAMS, DIAGRAM_IDS, svgFor, partsFor, titleFor, placeOf, has };
