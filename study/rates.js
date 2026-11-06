/* Related rates: one thing changing because another one is.

   The hard part is never the calculus. It is the thirty seconds before
   it - reading a paragraph of English, working out which quantities it
   names, which you were given, which it wants, and what equation ties
   them together. Differentiating is one line.

   So every shape carries all of that as DATA rather than as prose: the
   relation, the differentiated relation, each quantity with its units,
   what is constant, and a picture. That is what lets the tip button show
   the formula on one press and lay the variables out on the next, and
   what lets the diagram label itself.

   ==================================================================
   ANY ONE OF THE FOUR CAN BE THE UNKNOWN
   ==================================================================

   A related rates question has four quantities in it. For A = pi*r^2
   they are r, A, dr/dt and dA/dt - and the differentiated relation

       dA/dt = 2*pi*r . dr/dt

   contains only THREE of them, because A itself drops out. So a question
   can hide any one of:

       depRate      "how fast is the area growing?"         the usual one
       driverRate   "how fast is the radius growing?"
       driver       "at what radius is that happening?"
       depValue     "what is the area at that moment?"      no calculus

   and all four get asked here.

   A multiplier that does NOT contain the driver - 2*pi for a
   circumference, pi*r^2 for a cylinder of fixed radius, h/(H-h) for a
   lamppost shadow - cannot be solved backwards for the driver, because
   the driver is not in it. Those shapes say so with `usesDriver: false`
   and that variant is never asked, rather than asked and then marked
   against an answer that does not exist.

   ==================================================================
   BUILT FORWARD, SO EVERYTHING IS EXACT
   ==================================================================

   The temptation is to pick the givens and solve for the answer, which
   is how you end up storing 0.31830988 and then marking 1/pi wrong.
   Instead the driver value and its rate are CHOSEN as clean numbers, the
   multiplier and the dependent rate are computed exactly from them, and
   only then is one of the four hidden. Whatever is hidden, the answer is
   a number that was exact by construction and never had to be inverted
   or rounded.

   Values are exact rationals, optionally times pi. */

import MathKit from './math.js';

/* ------------------------------------------------------- exact arithmetic */

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

export function frac(num, den = 1, pi = false) {
  if (den < 0) { num = -num; den = -den; }
  const g = gcd(num, den);
  return { n: num / g, d: den / g, pi: !!pi };
}

export function value(f) {
  return f ? (f.n / f.d) * (f.pi ? Math.PI : 1) : NaN;
}

export const int = (n) => frac(n, 1, false);
const abs = (f) => frac(Math.abs(f.n), f.d, f.pi);

export function mulF(a, b) {
  /* pi times pi is pi squared, which no answer here needs and this
     representation cannot hold. Refused rather than silently dropped. */
  if (!a || !b || (a.pi && b.pi)) return null;
  return frac(a.n * b.n, a.d * b.d, a.pi || b.pi);
}

export function divF(a, b) {
  if (!a || !b || b.n === 0) return null;
  /* pi over pi cancels. A rational over pi does not, and is refused. */
  if (!a.pi && b.pi) return null;
  return frac(a.n * b.d, a.d * b.n, a.pi && !b.pi);
}

/* How a person writes it: "5/6", "-12", "8π", "π/3". */
export function show(f) {
  if (!f) return '?';
  if (f.n === 0) return '0';
  const sign = f.n < 0 ? '−' : '';
  const n = Math.abs(f.n);
  const top = f.pi ? (n === 1 ? 'π' : `${n}π`) : String(n);
  return f.d === 1 ? `${sign}${top}` : `${sign}${top}/${f.d}`;
}

/* The same thing in a form the expression engine parses. */
export function asText(f) {
  if (!f || f.n === 0) return '0';
  const top = f.pi ? `${f.n}*pi` : String(f.n);
  return f.d === 1 ? top : `(${top})/${f.d}`;
}

function amount(f, units) {
  return `${show(f)}${units ? ` ${units}` : ''}`;
}

const PI = true;

/* =============================================================== the shapes

   Each one gives:

     driver / dependent  the two quantities, with units
     relation            the untouched equation, for the first tip press
     differentiated      what it becomes after d/dt, for a later press
     pick(r, level)      the numbers, chosen so everything stays whole
     depValue(ctx)       the dependent quantity at the chosen driver value
     factor(ctx)         d(dependent)/d(driver) there - the multiplier in
                         the differentiated relation
     usesDriver          whether that multiplier contains the driver
     constants(ctx)      quantities that are fixed, shown in the setup
     setting / note      how to say it in English                        */

export const SHAPES = {

  /* -------------------------------------------------------------- 2D */

  circleArea: {
    name: 'Expanding circle',
    diagram: 'circle',
    kindOf: '2D',
    driver: { sym: 'r', label: 'radius', units: 'cm' },
    dependent: { sym: 'A', label: 'area', units: 'cm²' },
    relation: { html: 'A = πr²' },
    differentiated: { html: 'dA/dt = 2πr · dr/dt' },
    hint: 'Area of a circle. Differentiate both sides with respect to t - the '
      + 'r² needs the chain rule, which is where dr/dt comes from.',
    usesDriver: true,
    pick: (r) => ({ v: int(r.int(2, 14)), dv: int(r.int(1, 6)) }),
    depValue: (c) => frac(c.v.n * c.v.n, 1, PI),
    factor: (c) => frac(2 * c.v.n, 1, PI),
    setting: 'A stone is dropped into still water and the ripple spreads out as '
      + 'a perfect circle.',
    labels: { radius: 'r' },
  },

  circleCircumference: {
    name: 'Circle, radius and circumference',
    diagram: 'circle',
    kindOf: '2D',
    driver: { sym: 'r', label: 'radius', units: 'in' },
    dependent: { sym: 'C', label: 'circumference', units: 'in' },
    relation: { html: 'C = 2πr' },
    differentiated: { html: 'dC/dt = 2π · dr/dt' },
    hint: 'Circumference is a constant times r, so its rate is that same '
      + 'constant times dr/dt. No chain rule needed.',
    usesDriver: false,
    pick: (r) => ({ v: int(r.int(3, 20)), dv: int(r.int(1, 5)) }),
    depValue: (c) => frac(2 * c.v.n, 1, PI),
    factor: () => frac(2, 1, PI),
    setting: 'A circular hoop is being bent out into a larger circle.',
    labels: { radius: 'r' },
  },

  square: {
    name: 'Square growing',
    diagram: 'square',
    kindOf: '2D',
    driver: { sym: 's', label: 'side', units: 'cm' },
    dependent: { sym: 'A', label: 'area', units: 'cm²' },
    relation: { html: 'A = s²' },
    differentiated: { html: 'dA/dt = 2s · ds/dt' },
    hint: 'Area of a square is the side squared.',
    usesDriver: true,
    pick: (r) => ({ v: int(r.int(2, 15)), dv: int(r.int(1, 6)) }),
    depValue: (c) => int(c.v.n * c.v.n),
    factor: (c) => int(2 * c.v.n),
    setting: 'A square sheet of metal is heated and expands, staying square.',
    labels: { side: 's' },
  },

  triangle: {
    name: 'Triangle with a fixed height',
    diagram: 'triangle',
    kindOf: '2D',
    driver: { sym: 'b', label: 'base', units: 'cm' },
    dependent: { sym: 'A', label: 'area', units: 'cm²' },
    relation: { html: 'A = ½bh' },
    differentiated: { html: 'dA/dt = ½h · db/dt' },
    hint: 'Half base times height - and the height is CONSTANT here, so it is '
      + 'just a constant multiple and nothing happens to it.',
    usesDriver: false,
    pick: (r) => ({ v: int(r.int(4, 18)), dv: int(r.int(1, 5)), h: int(2 * r.int(2, 7)) }),
    depValue: (c) => frac(c.v.n * c.h.n, 2),
    factor: (c) => frac(c.h.n, 2),
    constants: (c) => [{ sym: 'h', label: 'height (constant)', value: c.h, units: 'cm' }],
    setting: (c) => `A triangle keeps a constant height of ${show(c.h)} cm while its `
      + 'base is stretched.',
    labels: { base: 'b', height: 'h' },
  },

  /* -------------------------------------------------------------- 3D */

  sphereVolume: {
    name: 'Sphere, radius and volume',
    diagram: 'sphere',
    kindOf: '3D',
    driver: { sym: 'r', label: 'radius', units: 'cm' },
    dependent: { sym: 'V', label: 'volume', units: 'cm³' },
    relation: { html: 'V = ⁴⁄₃πr³' },
    differentiated: { html: 'dV/dt = 4πr² · dr/dt' },
    hint: 'Volume of a sphere. The r³ brings down a 3 which cancels the 3 '
      + 'underneath, leaving 4πr² - the surface area, which is not a '
      + 'coincidence.',
    usesDriver: true,
    pick: (r) => ({ v: int(r.int(2, 10)), dv: int(r.int(1, 5)) }),
    depValue: (c) => frac(4 * c.v.n ** 3, 3, PI),
    factor: (c) => frac(4 * c.v.n * c.v.n, 1, PI),
    setting: 'A spherical balloon is being inflated.',
    labels: { radius: 'r' },
  },

  snowball: {
    name: 'Snowball, radius and surface area',
    diagram: 'sphere',
    kindOf: '3D',
    driver: { sym: 'r', label: 'radius', units: 'cm' },
    dependent: { sym: 'S', label: 'surface area', units: 'cm²' },
    relation: { html: 'S = 4πr²' },
    differentiated: { html: 'dS/dt = 8πr · dr/dt' },
    hint: 'Surface area of a sphere. It is melting, so dr/dt is NEGATIVE and '
      + 'the surface area shrinks with it.',
    usesDriver: true,
    pick: (r) => ({ v: int(r.int(3, 14)), dv: int(-r.int(1, 4)) }),
    depValue: (c) => frac(4 * c.v.n * c.v.n, 1, PI),
    factor: (c) => frac(8 * c.v.n, 1, PI),
    setting: 'A snowball melts, keeping its spherical shape.',
    labels: { radius: 'r' },
  },

  snowballDiameter: {
    name: 'Snowball, measured by diameter',
    diagram: 'sphere',
    kindOf: '3D',
    driver: { sym: 'd', label: 'diameter', units: 'cm' },
    dependent: { sym: 'S', label: 'surface area', units: 'cm²' },
    /* The point of this one: it is stated in DIAMETER and the formula
       everybody memorised is in radius. Substituting r = d/2 before
       differentiating is the step being practised, and skipping it is
       out by a factor of four. */
    relation: { html: 'S = 4πr² = πd² (since r = d/2)' },
    differentiated: { html: 'dS/dt = 2πd · dd/dt' },
    hint: 'Careful - you are given the DIAMETER and the formula is in terms of '
      + 'the radius. Put r = d/2 in first, so S = πd². Skip that and you are '
      + 'out by a factor of four.',
    usesDriver: true,
    pick: (r) => ({ v: int(2 * r.int(2, 9)), dv: int(-r.int(1, 3)) }),
    depValue: (c) => frac(c.v.n * c.v.n, 1, PI),
    factor: (c) => frac(2 * c.v.n, 1, PI),
    setting: 'A snowball melts, and it is being measured across - by diameter, '
      + 'not by radius.',
    labels: { diameter: 'd' },
  },

  cubeVolume: {
    name: 'Cube, edge and volume',
    diagram: 'cube',
    kindOf: '3D',
    driver: { sym: 's', label: 'edge', units: 'mm' },
    dependent: { sym: 'V', label: 'volume', units: 'mm³' },
    relation: { html: 'V = s³' },
    differentiated: { html: 'dV/dt = 3s² · ds/dt' },
    hint: 'Volume of a cube is the edge cubed.',
    usesDriver: true,
    pick: (r) => ({ v: int(r.int(2, 12)), dv: int(r.int(1, 5) * (r() < 0.4 ? -1 : 1)) }),
    depValue: (c) => int(c.v.n ** 3),
    factor: (c) => int(3 * c.v.n * c.v.n),
    setting: 'A cube of ice changes size, staying a cube.',
    labels: { side: 's' },
  },

  cubeSurface: {
    name: 'Cube, edge and surface area',
    diagram: 'cube',
    kindOf: '3D',
    driver: { sym: 's', label: 'edge', units: 'mm' },
    dependent: { sym: 'S', label: 'surface area', units: 'mm²' },
    relation: { html: 'S = 6s²' },
    differentiated: { html: 'dS/dt = 12s · ds/dt' },
    hint: 'Six faces, each s by s.',
    usesDriver: true,
    pick: (r) => ({ v: int(r.int(2, 12)), dv: int(r.int(1, 5)) }),
    depValue: (c) => int(6 * c.v.n * c.v.n),
    factor: (c) => int(12 * c.v.n),
    setting: 'A metal cube is heated and every edge grows at the same rate.',
    labels: { side: 's' },
  },

  cylinder: {
    name: 'Cylinder filling',
    diagram: 'cylinder',
    kindOf: '3D',
    per: 'min',
    driver: { sym: 'h', label: 'depth of water', units: 'm' },
    dependent: { sym: 'V', label: 'volume', units: 'm³' },
    relation: { html: 'V = πr²h' },
    differentiated: { html: 'dV/dt = πr² · dh/dt' },
    hint: 'The radius of a cylinder does not change as it fills, so πr² is a '
      + 'CONSTANT and only h moves. That is why a cylinder fills at a steady '
      + 'rate and a cone does not.',
    usesDriver: false,
    pick: (r) => ({ v: int(r.int(1, 9)), dv: int(r.int(1, 5)), R: int(r.int(2, 7)) }),
    depValue: (c) => frac(c.R.n * c.R.n * c.v.n, 1, PI),
    factor: (c) => frac(c.R.n * c.R.n, 1, PI),
    constants: (c) => [{ sym: 'r', label: 'tank radius (constant)', value: c.R, units: 'm' }],
    setting: (c) => `Water is poured into a cylindrical tank of radius ${show(c.R)} m.`,
    labels: { radius: 'r', height: 'h' },
  },

  coneFill: {
    name: 'Cone-shaped hole filling',
    diagram: 'cone',
    kindOf: '3D',
    per: 'min',
    driver: { sym: 'h', label: 'depth of water', units: 'm' },
    dependent: { sym: 'V', label: 'volume of water', units: 'm³' },
    /* A conical hole in the ground, point down. The cross-section widens
       as it fills, so the same volume per minute buys less and less
       height: dh/dt FALLS as h rises. That is the whole reason this
       shape is more interesting than a cylinder. */
    relation: {
      html: 'V = ⅓πr²h, r = (R/H)h so V = ⅓π(R/H)²h³',
    },
    differentiated: { html: 'dV/dt = π(R/H)²h² · dh/dt' },
    hint: 'The radius of the water is NOT constant - it widens as the water '
      + 'rises. Use similar triangles to write r in terms of h FIRST, so there '
      + 'is only one variable left to differentiate.',
    usesDriver: true,
    pick: (r) => {
      const [Rn, Hn] = r.pick([[1, 2], [1, 3], [2, 3], [1, 1], [3, 4], [2, 5]]);
      const k = r.int(2, 4);
      return {
        v: int(Hn * r.int(1, 3)),
        dv: int(r.int(1, 4)),
        R: int(Rn * k), H: int(Hn * k), Rn, Hn,
      };
    },
    depValue: (c) => frac(c.Rn * c.Rn * c.v.n ** 3, 3 * c.Hn * c.Hn, PI),
    factor: (c) => frac(c.Rn * c.Rn * c.v.n * c.v.n, c.Hn * c.Hn, PI),
    constants: (c) => [
      { sym: 'R', label: 'radius at ground level (constant)', value: c.R, units: 'm' },
      { sym: 'H', label: 'full depth of the hole (constant)', value: c.H, units: 'm' },
    ],
    setting: (c) => `A cone-shaped hole in the ground is ${show(c.H)} m deep and `
      + `${show(c.R)} m in radius at ground level. Rain fills it from the point up.`,
    note: (c) => `Similar triangles give r = (${show(c.R)}/${show(c.H)})h. Because the `
      + 'hole widens towards the top, the same volume per minute raises the '
      + 'level more slowly the fuller it gets.',
    labels: { radius: 'R', height: 'H', level: 'h' },
  },

  /* ----------------------------------- similar triangles, and Pythagoras */

  spotlightWall: {
    name: 'Spotlight on the floor, shadow on the wall',
    diagram: 'spotlight',
    kindOf: 'similar triangles',
    driver: { sym: 'x', label: 'distance from the spotlight', units: 'ft' },
    dependent: { sym: 'S', label: 'shadow height on the wall', units: 'ft' },
    /* NOT the lamppost. The light is on the floor, the wall is beyond
       the person, and walking towards the wall means walking away from
       the light - so the shadow SHRINKS. The lamppost has the opposite
       sign, which is exactly why both are here. */
    relation: { html: 'S / L = h / x so S = hL / x' },
    differentiated: { html: 'dS/dt = −hL/x² · dx/dt' },
    hint: 'Two similar triangles meet at the light on the floor: the small one '
      + 'is the person and their distance from it, the big one is the wall and '
      + 'its distance. S = hL/x, so S FALLS as x grows - walking towards the '
      + 'wall makes the shadow smaller.',
    usesDriver: true,
    pick: (r) => {
      const x = r.pick([2, 3, 4, 5, 6]);
      return {
        v: int(x),
        dv: int(r.int(1, 4)),
        h: int(r.int(5, 7)),
        L: int(x * x * r.int(2, 5)),
      };
    },
    depValue: (c) => frac(c.h.n * c.L.n, c.v.n),
    factor: (c) => frac(-c.h.n * c.L.n, c.v.n * c.v.n),
    constants: (c) => [
      { sym: 'h', label: 'person’s height (constant)', value: c.h, units: 'ft' },
      { sym: 'L', label: 'spotlight to wall (constant)', value: c.L, units: 'ft' },
    ],
    setting: (c) => `A spotlight sits on the floor, ${show(c.L)} ft from a wall. A `
      + `person ${show(c.h)} ft tall walks from the spotlight towards the wall, `
      + 'throwing a shadow onto it.',
    note: 'The shadow shrinks as the person approaches the wall, so the rate is '
      + 'negative.',
    labels: { lamp: 'spotlight', person: 'h', gap: 'x', shadow: 'S' },
  },

  lamppost: {
    name: 'Lamppost overhead, shadow on the ground',
    diagram: 'shadow',
    kindOf: 'similar triangles',
    driver: { sym: 'x', label: 'distance from the lamppost', units: 'ft' },
    dependent: { sym: 's', label: 'shadow length', units: 'ft' },
    relation: { html: 's / h = (x + s) / H so s = hx / (H − h)' },
    differentiated: { html: 'ds/dt = h/(H − h) · dx/dt' },
    hint: 'Similar triangles: the small one is the person and their shadow, the '
      + 'big one is the lamp and the whole distance. Solve for s BEFORE you '
      + 'differentiate - then h and H are only constants.',
    usesDriver: false,
    pick: (r) => {
      const [H, h] = r.pick([[15, 5], [18, 6], [20, 5], [12, 6], [16, 6], [24, 6], [21, 7]]);
      return { v: int(r.int(5, 30)), dv: int(r.int(2, 6)), H: int(H), h: int(h) };
    },
    depValue: (c) => frac(c.h.n * c.v.n, c.H.n - c.h.n),
    factor: (c) => frac(c.h.n, c.H.n - c.h.n),
    constants: (c) => [
      { sym: 'H', label: 'lamp height (constant)', value: c.H, units: 'ft' },
      { sym: 'h', label: 'person’s height (constant)', value: c.h, units: 'ft' },
    ],
    setting: (c) => `A street lamp is ${show(c.H)} ft tall. A person ${show(c.h)} ft `
      + 'tall walks away from it along level ground.',
    labels: { lamp: 'H', person: 'h', gap: 'x', shadow: 's' },
  },

  ladder: {
    name: 'Ladder sliding down a wall',
    diagram: 'ladder',
    kindOf: 'Pythagoras',
    driver: { sym: 'x', label: 'distance from the wall to the foot', units: 'ft' },
    dependent: { sym: 'y', label: 'height of the top up the wall', units: 'ft' },
    relation: { html: 'x² + y² = L²' },
    differentiated: { html: '2x · dx/dt + 2y · dy/dt = 0' },
    hint: 'Pythagoras. The ladder never changes length, so the right hand side '
      + 'differentiates to ZERO - which is what makes dy/dt come out negative.',
    usesDriver: true,
    pick: (r) => {
      const [a, b, c] = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17],
        [9, 12, 15], [7, 24, 25], [12, 16, 20]]);
      return { v: int(a), dv: int(r.int(1, 4)), b: int(b), L: int(c) };
    },
    depValue: (c) => c.b,
    factor: (c) => frac(-c.v.n, c.b.n),
    constants: (c) => [{ sym: 'L', label: 'ladder length (constant)', value: c.L, units: 'ft' }],
    setting: (c) => `A ${show(c.L)} ft ladder leans against a vertical wall and its `
      + 'foot slides away from the wall.',
    note: (c) => `y comes from Pythagoras: √(${show(c.L)}² − ${show(c.v)}²) = `
      + `${show(c.b)}.`,
    labels: { base: 'x', height: 'y', hyp: 'L' },
  },

  kite: {
    name: 'Kite on a string',
    diagram: 'kite',
    kindOf: 'Pythagoras',
    driver: { sym: 'x', label: 'horizontal distance out', units: 'm' },
    dependent: { sym: 'z', label: 'string let out', units: 'm' },
    relation: { html: 'z² = x² + h²' },
    differentiated: { html: 'z · dz/dt = x · dx/dt' },
    hint: 'The kite stays at a steady height, so h is a constant and only x and '
      + 'z move. Differentiate Pythagoras, then divide by z.',
    usesDriver: true,
    pick: (r) => {
      const [a, b, c] = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [20, 21, 29]]);
      return { v: int(a), dv: int(r.int(1, 6)), h: int(b), z: int(c) };
    },
    depValue: (c) => c.z,
    factor: (c) => frac(c.v.n, c.z.n),
    constants: (c) => [{ sym: 'h', label: 'height of the kite (constant)', value: c.h, units: 'm' }],
    setting: (c) => `A kite flies at a steady height of ${show(c.h)} m and drifts `
      + 'horizontally away.',
    note: (c) => `The string length comes from Pythagoras: √(${show(c.v)}² + `
      + `${show(c.h)}²) = ${show(c.z)}.`,
    labels: { base: 'x', height: 'h', hyp: 'z' },
  },
};

for (const [id, shape] of Object.entries(SHAPES)) shape.id = id;

export const SHAPE_IDS = Object.keys(SHAPES);
export const UNKNOWNS = ['depRate', 'driverRate', 'driver', 'depValue'];

/* --------------------------------------------------------- saying it aloud */

function question(shape, unknown) {
  const D = shape.driver;
  const P = shape.dependent;
  return {
    depRate: `How fast is the ${P.label} changing at that moment?`,
    driverRate: `How fast is the ${D.label} changing at that moment?`,
    driver: `At what ${D.label} is that happening?`,
    depValue: `What is the ${P.label} at that moment?`,
  }[unknown] || '';
}

/* Every fact the question states, which is everything except the unknown. */
function facts(shape, ctx, unknown) {
  const D = shape.driver;
  const P = shape.dependent;
  const out = [];

  const moving = (f) => (value(f) < 0 ? 'falling' : 'growing');

  /* Said in ONE clause when both the value and its rate are given.
     "the radius is 14 cm, and the radius is rising at 5 cm/s" names the
     same quantity twice in nine words, which reads like a form rather
     than like a sentence. */
  if (unknown !== 'driver' && unknown !== 'driverRate') {
    out.push(`the ${D.label} is ${amount(ctx.v, D.units)} and `
      + `${moving(ctx.dv)} at ${amount(abs(ctx.dv), `${D.units}/${ctx.per}`)}`);
  } else if (unknown !== 'driver') {
    out.push(`the ${D.label} is ${amount(ctx.v, D.units)}`);
  } else if (unknown !== 'driverRate') {
    out.push(`the ${D.label} is ${moving(ctx.dv)} at `
      + `${amount(abs(ctx.dv), `${D.units}/${ctx.per}`)}`);
  }
  /* The dependent rate is only stated when it is not what is being
     asked for - and when the question asks for the dependent VALUE,
     saying its rate as well would be a free extra fact. */
  if (unknown === 'driverRate' || unknown === 'driver') {
    out.push(`the ${P.label} is ${moving(ctx.depRate)} at `
      + `${amount(abs(ctx.depRate), `${P.units}/${ctx.per}`)}`);
  }
  return out;
}

/* ==================================================================== build

   `wants` forces which variable is hidden, which the tests use to reach
   every variant deliberately rather than by waiting for the right seed. */
export function buildRate(seedOrRng, level = 2, only = null, wants = null) {
  const r = typeof seedOrRng === 'function' ? seedOrRng : MathKit.rng(seedOrRng >>> 0);
  const ids = only && only.length ? only.filter((id) => SHAPES[id]) : SHAPE_IDS;
  if (!ids.length) return null;

  for (let tries = 0; tries < 24; tries++) {
    const shape = SHAPES[r.pick(ids)];
    const ctx = shape.pick(r, level);
    if (!ctx) continue;
    ctx.per = shape.per || 's';

    const factor = shape.factor(ctx);
    const depValue = shape.depValue(ctx);
    if (!factor || !depValue) continue;

    const depRate = mulF(factor, ctx.dv);
    if (!depRate) continue;
    ctx.depRate = depRate;
    ctx.depValue = depValue;

    /* Level 1 always asks the ordinary question. Higher levels rotate
       through the rest, and "solve for the driver" is only offered where
       the driver is actually in the multiplier. */
    let pool = ['depRate'];
    if (level === 2) pool = ['depRate', 'depRate', 'driverRate', 'depValue'];
    if (level >= 3) pool = ['depRate', 'driverRate', 'driver', 'depValue'];
    if (!shape.usesDriver) pool = pool.filter((k) => k !== 'driver');
    const unknown = wants
      ? (pool.includes(wants) || (wants === 'driver' && !shape.usesDriver) ? wants : null)
      : r.pick(pool);
    if (!unknown) continue;
    if (wants === 'driver' && !shape.usesDriver) continue;

    const answer = { depRate, driverRate: ctx.dv, driver: ctx.v, depValue }[unknown];
    if (!answer) continue;

    /* AN ANSWER OF ZERO CANNOT BE MARKED: every wrong answer that also
       works out to zero grades correct, and so does doubling it. */
    const asNumber = value(answer);
    if (!Number.isFinite(asNumber) || Math.abs(asNumber) < 1e-12) continue;

    const D = shape.driver;
    const P = shape.dependent;
    const units = {
      depRate: `${P.units}/${ctx.per}`,
      driverRate: `${D.units}/${ctx.per}`,
      driver: D.units,
      depValue: P.units,
    }[unknown];
    const wantedSym = {
      depRate: `d${P.sym}/dt`,
      driverRate: `d${D.sym}/dt`,
      driver: D.sym,
      depValue: P.sym,
    }[unknown];

    const consts = shape.constants ? shape.constants(ctx) : [];
    const setting = typeof shape.setting === 'function' ? shape.setting(ctx) : shape.setting;
    const note = typeof shape.note === 'function' ? shape.note(ctx) : (shape.note || '');

    const quantities = [
      ...consts.map((c) => ({
        sym: c.sym, label: c.label, given: c.value, units: c.units, constant: true,
      })),
      {
        sym: D.sym, label: D.label, units: D.units,
        given: unknown === 'driver' ? null : ctx.v,
        wanted: unknown === 'driver',
      },
      {
        sym: P.sym, label: P.label, units: P.units,
        /* The dependent VALUE is shown only when the question is about
           it. Volunteering it elsewhere hands over half the working. */
        given: null,
        wanted: unknown === 'depValue',
      },
    ];

    const made = {
      shape: shape.id,
      shapeName: shape.name,
      kindOf: shape.kindOf,
      diagram: shape.diagram,
      unknown,
      formula: shape.relation,
      differentiated: shape.differentiated,
      hint: shape.hint,
      story: `${setting} At one moment ${facts(shape, ctx, unknown).join(', and ')}. `
        + question(shape, unknown),
      note,
      quantities,
      givenRate: unknown === 'driverRate' ? null
        : { sym: `d${D.sym}/dt`, value: ctx.dv, units: `${D.units}/${ctx.per}` },
      givenRate2: (unknown === 'driverRate' || unknown === 'driver')
        ? { sym: `d${P.sym}/dt`, value: depRate, units: `${P.units}/${ctx.per}` }
        : null,
      wantedRate: { sym: wantedSym, units },
      labels: shape.labels || {},
      answerExact: answer,
      answerText: asText(answer),
      answerShown: show(answer),
      answerUnits: units,
      answerValue: asNumber,
      /* Kept so a checker can re-derive everything independently. */
      given: {
        driver: ctx.v, driverRate: ctx.dv, depRate, depValue, factor, ctx,
      },
    };
    made.setup = setupLines(made);
    return made;
  }
  return null;
}

/* -------------------------------------------------------------- the setup

   What the SECOND press of the tip button shows: the quantities written
   out the way you would write them on paper before touching any
   calculus -

       r     = 100
       dr/dt = -10 m/hr
       A     = ?
       dA/dt = ?

   It names the knowns and the unknown, which is the part people get
   stuck on, and leaves the differentiating alone - which is the part
   being practised. */
export function setupLines(made) {
  if (!made) return [];
  const lines = [];
  for (const q of made.quantities || []) {
    lines.push({
      sym: q.sym,
      eq: q.given ? show(q.given) : '?',
      units: q.units,
      known: !!q.given,
      constant: !!q.constant,
      label: q.label,
      wanted: !!q.wanted,
    });
  }
  for (const rate of [made.givenRate, made.givenRate2]) {
    if (!rate) continue;
    lines.push({
      sym: rate.sym, eq: show(rate.value), units: rate.units, known: true, rate: true,
    });
  }
  const wantedSym = made.wantedRate && made.wantedRate.sym;
  if (wantedSym && !lines.some((l) => l.sym === wantedSym)) {
    lines.push({
      sym: wantedSym, eq: '?', units: made.wantedRate.units,
      known: false, rate: true, wanted: true,
    });
  }
  return lines;
}

export default {
  SHAPES, SHAPE_IDS, UNKNOWNS, buildRate, setupLines,
  frac, show, asText, value, int, mulF, divF,
};
