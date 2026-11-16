/* The course, as the course lists it.

   Math 114 hands out a sheet of 23 outcomes - six on limits, eight on
   derivatives, nine on applications - with the lesson, the homework and
   the quiz each one belongs to, and a box to tick when it is mastered.
   The exam is that sheet. So this file is that sheet: the same ids, the
   same order, and for each one what in this app actually practises it.

   `status` is read off Carter's own copy on 16 November 2026:

     mastered   a smiley in the box
     retake     a star and an empty box - the quiz question was marked
                wrong and the quiz is being sat again
     ahead      Quiz 9, not yet sat when this was written

   It is a starting point, not a verdict. The page that shows it also
   shows what has been answered HERE since, which is the part that
   changes; the status only says where each outcome stood on the day.

   `skills` are gen-sandbox.js skills (the full working, marked line by
   line or as an expression). `topics` are topics.js ids (a quick
   question with a number for an answer). An outcome may have both.
   tools/test_outcomes.mjs fails if any of them names something that
   does not exist, because an outcome with a dead button is worse than
   an outcome with no button. */

export const OUTCOMES = [
  /* ------------------------------------------------------------ limits */
  { id: 'L1', unit: 'Limits', quiz: 'Quiz 1', status: 'mastered',
    name: 'Evaluate a limit numerically',
    topics: ['calc.limit'] },
  { id: 'L2', unit: 'Limits', quiz: 'Quiz 1, 2', status: 'mastered',
    name: 'Evaluate a limit algebraically',
    topics: ['calc.limit'] },
  { id: 'L3', unit: 'Limits', quiz: 'Quiz 2', status: 'mastered',
    name: 'Limits at infinity',
    topics: ['calc.limitinf'] },
  { id: 'L4', unit: 'Limits', quiz: 'Quiz 3', status: 'retake',
    name: 'The formal definition of a limit',
    skills: ['epsilondelta'], topics: ['calc.epsilondelta'] },
  { id: 'L5', unit: 'Limits', quiz: 'Quiz 3', status: 'mastered',
    name: 'Continuity at a point',
    topics: ['calc.continuity'] },
  { id: 'L6', exam: true, unit: 'Limits', quiz: 'Quiz 3', status: 'mastered',
    name: 'Intermediate Value Theorem',
    topics: ['calc.ivt'] },

  /* ------------------------------------------------------- derivatives */
  { id: 'D1', unit: 'Derivatives', quiz: 'Quiz 4', status: 'retake',
    name: 'The limit definition of the derivative',
    skills: ['limitdef'] },
  { id: 'D2', unit: 'Derivatives', quiz: 'Quiz 4', status: 'mastered',
    name: 'Rates of change and tangent lines',
    skills: ['tangent'] },
  { id: 'D3', unit: 'Derivatives', quiz: 'Quiz 4', status: 'mastered',
    name: 'Power functions and exponentials',
    skills: ['power', 'exp'] },
  { id: 'D4', unit: 'Derivatives', quiz: 'Quiz 5', status: 'mastered',
    name: 'Product and quotient rules',
    skills: ['product', 'quotient'] },
  { id: 'D5', unit: 'Derivatives', quiz: 'Quiz 5', status: 'mastered',
    name: 'Higher derivatives, velocity and acceleration',
    skills: ['secondderiv', 'motion'] },
  { id: 'D6', unit: 'Derivatives', quiz: 'Quiz 6', status: 'retake',
    name: 'The chain rule',
    skills: ['chain'] },
  { id: 'D7', unit: 'Derivatives', quiz: 'Quiz 6', status: 'retake',
    name: 'Implicit differentiation',
    skills: ['implicit'] },
  { id: 'D8', unit: 'Derivatives', quiz: 'Quiz 6', status: 'mastered',
    name: 'Logarithmic differentiation',
    skills: ['logdiff'] },

  /* ------------------------------------------------------ applications */
  { id: 'A1', exam: true, unit: 'Applications', quiz: 'Quiz 7', status: 'retake',
    name: 'Related rates',
    skills: ['rates'] },
  { id: 'A2', exam: true, unit: 'Applications', quiz: 'Quiz 7', status: 'mastered',
    name: 'L’Hospital’s Rule',
    topics: ['calc.lhopital'] },
  { id: 'A3', exam: true, unit: 'Applications', quiz: 'Quiz 7', status: 'mastered',
    name: 'Extreme Value Theorem: absolute max and min',
    topics: ['calc.absextrema'] },
  { id: 'A4', unit: 'Applications', quiz: 'Quiz 8', status: 'mastered',
    name: 'Increasing, decreasing and local extrema',
    skills: ['extrema'] },
  { id: 'A5', unit: 'Applications', quiz: 'Quiz 8', status: 'mastered',
    name: 'Concavity and inflection points',
    skills: ['concavity'] },
  { id: 'A6', unit: 'Applications', quiz: 'Quiz 8', status: 'mastered',
    name: 'Sketching a graph from its derivatives',
    skills: ['extrema', 'concavity'],
    /* Said on the page, because pretending is worse: there is no
       question here that asks for a drawing and marks it. */
    note: 'No question here marks a sketch. This practises the two things a '
      + 'sketch is built from - where it rises and falls, and how it bends.' },
  { id: 'A7', exam: true, unit: 'Applications', quiz: 'Quiz 9', status: 'ahead',
    name: 'Optimization',
    skills: ['optimize'] },
  { id: 'A8', exam: true, unit: 'Applications', quiz: 'Quiz 9', status: 'ahead',
    name: 'Mean Value Theorem',
    topics: ['calc.mvt'] },
  { id: 'A9', unit: 'Applications', quiz: 'Quiz 9', status: 'ahead',
    name: 'Linear approximation and differentials',
    topics: ['calc.linear'] },
];

/* What is on the exam, and when.

   From Carter, 16 November 2026: the exam on Tuesday 24 November covers
   IVT, EVT, MVT, related rates, optimization and L'Hospital - six
   outcomes, marked `exam: true` above - and nothing from before Quiz 6
   that was already on the earlier test. That is his reading of it ("I
   think"), so the other seventeen are still one tap away on the same
   page rather than removed.

   The date is a DEFAULT, used only until somebody types their own and
   only while it is still in the future. */
export const EXAM_DATE = '2026-11-24';
export const EXAM_OUTCOMES = OUTCOMES.filter((o) => o.exam);

export function examDateFor(settings, today = new Date()) {
  if (settings && settings.examDate) return settings.examDate;
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`
    + `${String(today.getDate()).padStart(2, '0')}`;
  return EXAM_DATE >= iso ? EXAM_DATE : '';
}

export const STATUS_LABEL = {
  retake: 'Retake',
  ahead: 'Not sat yet',
  mastered: 'Passed',
};

/* The curriculum topic ids an outcome's attempts are recorded under,
   whichever kind of question was used: a sandbox skill records against
   its own topicId, which the caller looks up. */
export function topicIdsFor(outcome, skillTopic) {
  const ids = new Set(outcome.topics || []);
  for (const skill of outcome.skills || []) {
    const id = skillTopic(skill);
    if (id) ids.add(id);
  }
  return [...ids];
}

/* What to work on first: the retakes, then what has not been sat, then
   the rest. Stable within each group, so it reads in sheet order. */
export function byUrgency(list = OUTCOMES) {
  const rank = { retake: 0, ahead: 1, mastered: 2 };
  return list.slice().sort((a, b) => rank[a.status] - rank[b.status]);
}

export default {
  OUTCOMES, EXAM_OUTCOMES, EXAM_DATE, examDateFor, STATUS_LABEL, topicIdsFor, byUrgency,
};
