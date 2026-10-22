/* The curriculum.

   A topic is the unit of mastery: one generator, one row on the dashboard, one
   thing that can be weak. Courses and units exist only to group them.

   `needs` is the part that earns its keep. When you keep missing related rates,
   the useful question is not "do more related rates" - it is whether the
   derivative rules underneath are solid. The scheduler walks `needs` backwards
   from a weak topic and checks the prerequisites before piling on more of the
   thing you are failing. Keep the edges honest: list what a problem genuinely
   cannot be done without, not everything vaguely upstream. */

export const COURSES = [
  { id: 'alg2', name: 'Algebra II', blurb: 'Functions, quadratics and the transformations that move them around.' },
  { id: 'precalc', name: 'Precalculus and Trig', blurb: 'The layer directly underneath calculus.' },
  { id: 'calc1', name: 'Calculus I', blurb: 'Limits, derivatives and the first integrals.' },
  { id: 'examp', name: 'Exam P (Probability)', blurb: 'The SOA Exam P syllabus, in practice-problem form.' },
  { id: 'examfm', name: 'Exam FM (Financial Math)', blurb: 'Interest theory, annuities, loans and bonds.' },
  { id: 'cs1', name: 'Intro to Computer Science', blurb: 'Tracing code, complexity, logic and number bases.' },
];

/* Topics. `gen` names a function in generators.js; a topic with no generator is
   deck-only (you or the local model supply the questions). */
export const TOPICS = [

  /* ------------------------------------------------------------- Algebra II */
  { id: 'alg2.lin', course: 'alg2', unit: 'Linear foundations', name: 'Solving linear equations',
    gen: 'linEquation', blurb: 'One variable, both sides, fractions and all.' },
  { id: 'alg2.slope', course: 'alg2', unit: 'Linear foundations', name: 'Slope and line equations',
    gen: 'lineEquation', needs: ['alg2.lin'], blurb: 'Point-slope, slope-intercept, parallel and perpendicular.' },
  { id: 'alg2.systems', course: 'alg2', unit: 'Linear foundations', name: 'Systems of equations',
    gen: 'system2', needs: ['alg2.lin'], blurb: 'Two equations, two unknowns, by substitution or elimination.' },

  { id: 'alg2.expand', course: 'alg2', unit: 'Quadratics', name: 'Expanding and multiplying',
    gen: 'expandBinomial', blurb: 'FOIL, squares of binomials, difference of squares.' },
  { id: 'alg2.factor', course: 'alg2', unit: 'Quadratics', name: 'Factoring quadratics',
    gen: 'factorQuadratic', needs: ['alg2.expand'], blurb: 'Leading coefficient 1 and beyond.' },
  { id: 'alg2.quadformula', course: 'alg2', unit: 'Quadratics', name: 'The quadratic formula',
    gen: 'quadraticFormula', needs: ['alg2.factor'],
    blurb: 'Where it comes from, and using it when factoring will not work.' },
  { id: 'alg2.complete', course: 'alg2', unit: 'Quadratics', name: 'Completing the square',
    gen: 'completeSquare', needs: ['alg2.expand'], blurb: 'Standard form to vertex form by hand.' },
  { id: 'alg2.discriminant', course: 'alg2', unit: 'Quadratics', name: 'The discriminant',
    gen: 'discriminant', needs: ['alg2.quadformula'], blurb: 'How many real roots, before solving.' },
  { id: 'alg2.vertex', course: 'alg2', unit: 'Quadratics', name: 'Vertex, axis and intercepts',
    gen: 'parabolaFeatures', needs: ['alg2.complete'], blurb: 'Reading a parabola off its equation.' },

  { id: 'alg2.parent', course: 'alg2', unit: 'Transformations', name: 'Parent functions',
    gen: 'parentFunction', blurb: 'Recognizing the eight shapes everything else is built from.' },
  { id: 'alg2.shift', course: 'alg2', unit: 'Transformations', name: 'Shifts and reflections',
    gen: 'transformShift', needs: ['alg2.parent'],
    blurb: 'Why f(x + 3) goes left and not right.' },
  { id: 'alg2.stretch', course: 'alg2', unit: 'Transformations', name: 'Stretches and compressions',
    gen: 'transformStretch', needs: ['alg2.shift'], blurb: 'Vertical versus horizontal, and which one is the reciprocal.' },
  { id: 'alg2.compose', course: 'alg2', unit: 'Transformations', name: 'Combined transformations',
    gen: 'transformCombined', needs: ['alg2.stretch'],
    blurb: 'Full a·f(b(x − h)) + k, in the order they actually apply.' },
  { id: 'alg2.describe', course: 'alg2', unit: 'Transformations', name: 'Describing a transformation',
    gen: 'transformDescribe', needs: ['alg2.compose'], blurb: 'Given the graph or the equation, say what was done.' },

  { id: 'alg2.exp', course: 'alg2', unit: 'Exponentials and logs', name: 'Exponent rules',
    gen: 'exponentRules', blurb: 'Products, quotients, powers, negatives and zero.' },
  { id: 'alg2.logs', course: 'alg2', unit: 'Exponentials and logs', name: 'Logarithm rules',
    gen: 'logRules', needs: ['alg2.exp'], blurb: 'Product, quotient, power and change of base.' },
  { id: 'alg2.solveexp', course: 'alg2', unit: 'Exponentials and logs', name: 'Solving exponential equations',
    gen: 'solveExponential', needs: ['alg2.logs'], blurb: 'Taking a log of both sides and meaning it.' },

  { id: 'alg2.rational', course: 'alg2', unit: 'Rational and radical', name: 'Rational expressions',
    gen: 'rationalSimplify', needs: ['alg2.factor'], blurb: 'Simplify, multiply, and find the domain restrictions.' },
  { id: 'alg2.radical', course: 'alg2', unit: 'Rational and radical', name: 'Radical equations',
    gen: 'radicalEquation', needs: ['alg2.quadformula'], blurb: 'Squaring both sides, and checking for the answers it invents.' },
  { id: 'alg2.complex', course: 'alg2', unit: 'Rational and radical', name: 'Complex numbers',
    gen: 'complexArith', needs: ['alg2.expand'], blurb: 'Arithmetic, conjugates and powers of i.' },

  { id: 'alg2.seq', course: 'alg2', unit: 'Sequences', name: 'Arithmetic and geometric sequences',
    gen: 'sequences', blurb: 'nth term and partial sums.' },

  /* -------------------------------------------------------------- Precalc */
  { id: 'pre.polydiv', course: 'precalc', unit: 'Polynomials', name: 'Polynomial division',
    gen: 'polyDivision', needs: ['alg2.factor'], blurb: 'Synthetic and long division, and the remainder theorem.' },
  { id: 'pre.polyroots', course: 'precalc', unit: 'Polynomials', name: 'Roots and end behavior',
    gen: 'polyBehavior', needs: ['pre.polydiv'], blurb: 'Rational root theorem, multiplicity, and which way the ends go.' },
  { id: 'pre.unitcircle', course: 'precalc', unit: 'Trigonometry', name: 'The unit circle',
    gen: 'unitCircle', blurb: 'Exact values, in degrees and radians.' },
  { id: 'pre.trigid', course: 'precalc', unit: 'Trigonometry', name: 'Trig identities',
    gen: 'trigIdentity', needs: ['pre.unitcircle'], blurb: 'Pythagorean, double angle, and sum formulas.' },
  { id: 'pre.trigeq', course: 'precalc', unit: 'Trigonometry', name: 'Trig equations',
    gen: 'trigEquation', needs: ['pre.trigid'], blurb: 'All solutions on an interval, not just the first one.' },
  { id: 'pre.trigraph', course: 'precalc', unit: 'Trigonometry', name: 'Graphing sine and cosine',
    gen: 'trigGraph', needs: ['pre.unitcircle', 'alg2.compose'], blurb: 'Amplitude, period, phase shift and midline.' },
  { id: 'pre.inverse', course: 'precalc', unit: 'Functions', name: 'Inverse functions',
    gen: 'inverseFunction', needs: ['alg2.compose'], blurb: 'Finding them, and when one exists at all.' },
  { id: 'pre.compose', course: 'precalc', unit: 'Functions', name: 'Composition of functions',
    gen: 'composeFunction', needs: ['alg2.parent'], blurb: 'f(g(x)), and the domain that survives it.' },

  /* ------------------------------------------------------------- Calculus I */
  { id: 'calc.limit', course: 'calc1', unit: 'Limits', name: 'Evaluating limits',
    gen: 'limitBasic', needs: ['alg2.factor', 'alg2.rational'], blurb: 'Direct substitution, factoring, and conjugates.' },
  { id: 'calc.limitinf', course: 'calc1', unit: 'Limits', name: 'Limits at infinity',
    gen: 'limitInfinity', needs: ['calc.limit'], blurb: 'Horizontal asymptotes and degree comparison.' },
  { id: 'calc.continuity', course: 'calc1', unit: 'Limits', name: 'Continuity',
    gen: 'continuity', needs: ['calc.limit'], blurb: 'Where a piecewise function breaks, and how to patch it.' },

  { id: 'calc.power', course: 'calc1', unit: 'Derivatives', name: 'Power rule',
    gen: 'derivPower', needs: ['alg2.exp'], blurb: 'Polynomials, roots and negative exponents.' },
  { id: 'calc.product', course: 'calc1', unit: 'Derivatives', name: 'Product rule',
    gen: 'derivProduct', needs: ['calc.power'], blurb: 'Two factors, in the right order.' },
  { id: 'calc.quotient', course: 'calc1', unit: 'Derivatives', name: 'Quotient rule',
    gen: 'derivQuotient', needs: ['calc.power'], blurb: 'Low d-high minus high d-low, over low squared.' },
  { id: 'calc.chain', course: 'calc1', unit: 'Derivatives', name: 'Chain rule',
    gen: 'derivChain', needs: ['calc.power'], blurb: 'The outside derivative times the inside one.' },
  { id: 'calc.trigderiv', course: 'calc1', unit: 'Derivatives', name: 'Trig and exponential derivatives',
    gen: 'derivTransc', needs: ['calc.chain', 'pre.unitcircle'], blurb: 'sin, cos, tan, eˣ and ln x, chained.' },
  { id: 'calc.implicit', course: 'calc1', unit: 'Derivatives', name: 'Implicit differentiation',
    gen: 'derivImplicit', needs: ['calc.chain'], blurb: 'dy/dx when y will not come out of the equation.' },

  { id: 'calc.tangent', course: 'calc1', unit: 'Applications', name: 'Tangent lines',
    gen: 'tangentLine', needs: ['calc.power', 'alg2.slope'], blurb: 'The line, not just the slope.' },
  { id: 'calc.related', course: 'calc1', unit: 'Applications', name: 'Related rates',
    gen: 'relatedRates', needs: ['calc.implicit'], blurb: 'Two things changing, one equation tying them together.' },
  { id: 'calc.extrema', course: 'calc1', unit: 'Applications', name: 'Critical points and extrema',
    gen: 'extrema', needs: ['calc.power', 'alg2.factor'], blurb: 'First and second derivative tests.' },
  { id: 'calc.optimize', course: 'calc1', unit: 'Applications', name: 'Optimization',
    gen: 'optimization', needs: ['calc.extrema'], blurb: 'Build the function first, then maximize it.' },

  { id: 'calc.antideriv', course: 'calc1', unit: 'Integration', name: 'Antiderivatives',
    gen: 'antiderivative', needs: ['calc.power'], blurb: 'The power rule run backwards, plus C.' },
  { id: 'calc.definite', course: 'calc1', unit: 'Integration', name: 'Definite integrals',
    gen: 'definiteIntegral', needs: ['calc.antideriv'], blurb: 'Evaluate, subtract, and mind the signs.' },
  { id: 'calc.usub', course: 'calc1', unit: 'Integration', name: 'u-substitution',
    gen: 'uSubstitution', needs: ['calc.antideriv', 'calc.chain'], blurb: 'The chain rule, undone.' },

  /* ---------------------------------------------------------------- Exam P */
  { id: 'p.counting', course: 'examp', unit: 'Foundations', name: 'Counting and combinatorics',
    gen: 'counting', blurb: 'Permutations, combinations, and when order matters.' },
  { id: 'p.basic', course: 'examp', unit: 'Foundations', name: 'Probability rules',
    gen: 'probBasic', needs: ['p.counting'], blurb: 'Unions, complements and inclusion-exclusion.' },
  { id: 'p.conditional', course: 'examp', unit: 'Foundations', name: 'Conditional probability',
    gen: 'probConditional', needs: ['p.basic'], blurb: 'P(A|B), independence, and the multiplication rule.' },
  { id: 'p.bayes', course: 'examp', unit: 'Foundations', name: 'Bayes theorem',
    gen: 'bayes', needs: ['p.conditional'], blurb: 'Flipping the condition around.' },

  { id: 'p.discrete', course: 'examp', unit: 'Distributions', name: 'Discrete distributions',
    gen: 'discreteDist', needs: ['p.basic'], blurb: 'Binomial, Poisson, geometric and hypergeometric.' },
  { id: 'p.continuous', course: 'examp', unit: 'Distributions', name: 'Continuous distributions',
    gen: 'continuousDist', needs: ['calc.definite', 'p.basic'], blurb: 'Uniform, exponential, normal and gamma.' },
  { id: 'p.expect', course: 'examp', unit: 'Distributions', name: 'Expectation and variance',
    gen: 'expectation', needs: ['p.discrete'], blurb: 'E[X], Var(X), and the shortcut formula.' },
  { id: 'p.transform', course: 'examp', unit: 'Distributions', name: 'Transformations of a variable',
    gen: 'transformRV', needs: ['p.expect'], blurb: 'E[aX + b], Var(aX + b), and why b drops out.' },
  { id: 'p.joint', course: 'examp', unit: 'Multivariate', name: 'Joint distributions',
    gen: 'jointDist', needs: ['p.expect'], blurb: 'Marginals, covariance and correlation.' },

  /* --------------------------------------------------------------- Exam FM */
  { id: 'fm.interest', course: 'examfm', unit: 'Interest theory', name: 'Simple and compound interest',
    gen: 'interestBasic', needs: ['alg2.exp'], blurb: 'Accumulation and present value.' },
  { id: 'fm.rates', course: 'examfm', unit: 'Interest theory', name: 'Nominal, effective and force',
    gen: 'interestRates', needs: ['fm.interest'], blurb: 'Converting between every rate the exam names.' },
  { id: 'fm.annuity', course: 'examfm', unit: 'Annuities', name: 'Level annuities',
    gen: 'annuityLevel', needs: ['fm.rates'], blurb: 'Immediate and due, present and accumulated value.' },
  { id: 'fm.annuityvar', course: 'examfm', unit: 'Annuities', name: 'Varying annuities',
    gen: 'annuityVarying', needs: ['fm.annuity'], blurb: 'Increasing, decreasing and perpetuities.' },
  { id: 'fm.loan', course: 'examfm', unit: 'Loans', name: 'Loan amortization',
    gen: 'loanAmort', needs: ['fm.annuity'], blurb: 'Payment, outstanding balance, and the interest-principal split.' },
  { id: 'fm.bond', course: 'examfm', unit: 'Bonds', name: 'Bond pricing',
    gen: 'bondPrice', needs: ['fm.annuity'], blurb: 'Price, premium, discount and yield.' },
  { id: 'fm.duration', course: 'examfm', unit: 'Bonds', name: 'Duration and convexity',
    gen: 'duration', needs: ['fm.bond'], blurb: 'Macaulay, modified, and what they are actually measuring.' },

  /* ------------------------------------------------------------------- CS 1 */
  { id: 'cs.trace', course: 'cs1', unit: 'Programming', name: 'Tracing code',
    gen: 'codeTrace', blurb: 'Loops and conditionals, by hand, one line at a time.' },
  { id: 'cs.bigo', course: 'cs1', unit: 'Analysis', name: 'Big-O complexity',
    gen: 'bigO', needs: ['cs.trace'], blurb: 'Counting operations, not stopwatch time.' },
  { id: 'cs.boolean', course: 'cs1', unit: 'Logic', name: 'Boolean logic',
    gen: 'booleanLogic', blurb: 'Truth tables and De Morgan.' },
  { id: 'cs.bases', course: 'cs1', unit: 'Representation', name: 'Binary and hexadecimal',
    gen: 'numberBases', blurb: 'Converting in both directions, and why 0.1 is not exact.' },
];

/* ---------------------------------------------------------------- indexing */

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
export const COURSE_BY_ID = Object.fromEntries(COURSES.map((c) => [c.id, c]));

export function topicsIn(courseId) {
  return TOPICS.filter((t) => t.course === courseId);
}

/* Units in declaration order, which is teaching order. */
export function unitsIn(courseId) {
  const seen = [];
  for (const t of topicsIn(courseId)) if (!seen.includes(t.unit)) seen.push(t.unit);
  return seen.map((u) => ({ name: u, topics: TOPICS.filter((t) => t.course === courseId && t.unit === u) }));
}

/* Every prerequisite of a topic, nearest first, with cycles guarded against so
   a bad edge added later cannot hang the scheduler. */
export function prereqChain(topicId, depth = 3) {
  const out = [];
  const seen = new Set([topicId]);
  let frontier = [topicId];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next = [];
    for (const id of frontier) {
      for (const need of (TOPIC_BY_ID[id]?.needs || [])) {
        if (seen.has(need)) continue;
        seen.add(need);
        out.push(need);
        next.push(need);
      }
    }
    frontier = next;
  }
  return out;
}

/* The reverse edge: what this topic unlocks. Shown on the dashboard so a green
   prerequisite feels like it is going somewhere. */
export function unlockedBy(topicId) {
  return TOPICS.filter((t) => (t.needs || []).includes(topicId)).map((t) => t.id);
}

/* Free-text search over the tree, for the test builder's topic picker and for
   deciding whether a typed concept already exists before asking the model to
   invent questions for it. */
export function searchTopics(query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  const words = q.split(/\s+/);
  const scored = [];
  for (const t of TOPICS) {
    const hay = `${t.name} ${t.unit} ${COURSE_BY_ID[t.course].name} ${t.blurb || ''}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (t.name.toLowerCase().includes(w)) score += 3;
      else if (hay.includes(w)) score += 1;
    }
    if (score) scored.push({ topic: t, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.topic);
}
