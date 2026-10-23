/* The landing flow: a handful of questions before any problem appears.

       Working together, or studying alone?
         together -> side by side, or on the same problem?
         alone    -> who is this?
       then       -> homework, or studying?
         homework -> what are you working from? -> help with these, or more like them?
         study    -> what do you want to work on? -> practice, or a quiz?
                     quiz -> how long, and does partial credit count?

   Kept as DATA rather than as a pile of screens, for three reasons. The paths
   can be walked by a test, so a dead end or an unreachable step fails the
   build instead of being discovered on a Sunday night. Going back is one
   operation rather than per-screen bookkeeping. And the whole thing
   serialises into a few fields, which is what a collaboration room has to
   send to the other device so both people are looking at the same thing.

   This module holds no DOM. app.js renders it; the shape of the questions
   lives here. */

import { interpret, describe } from './ask.js';

/* A step is: what it asks, how it is answered, and where the answer leads.
   `next` returning null means the flow is finished and `plan()` can run. */
export const STEPS = {
  company: {
    id: 'company',
    title: 'Studying alone, or with someone?',
    kind: 'choice',
    options: [
      {
        value: 'alone',
        label: 'On my own',
        blurb: 'Problems, hints and your own history.',
      },
      {
        value: 'together',
        label: 'With someone else',
        blurb: 'Two people, one session.',
      },
    ],
    next: (a) => (a.company === 'together' ? 'proximity' : 'who'),
  },

  proximity: {
    id: 'proximity',
    title: 'Together how?',
    kind: 'choice',
    options: [
      {
        value: 'separate',
        label: 'Side by side, own work',
        blurb: 'Each of you gets your own problems. Either one can look in on '
          + 'the other when you want a hand.',
      },
      {
        value: 'shared',
        label: 'On the same problem',
        blurb: 'One shared board, the same problem in front of both of you, '
          + 'and a graph you can both draw on.',
      },
    ],
    next: () => 'who',
  },

  who: {
    id: 'who',
    title: 'Who is on this device?',
    /* Filled from the saved profiles rather than hard-coded, so renaming a
       profile in Settings renames it here too. */
    kind: 'who',
    next: () => 'intent',
  },

  intent: {
    id: 'intent',
    title: 'Homework, or studying?',
    kind: 'choice',
    options: [
      {
        value: 'homework',
        label: 'Homework in front of me',
        blurb: 'Work from a photo or a problem you type in.',
      },
      {
        value: 'study',
        label: 'Studying a topic',
        blurb: 'Generated problems, as many as you want.',
      },
    ],
    next: (a) => (a.intent === 'homework' ? 'source' : 'topic'),
  },

  /* ----------------------------------------------------------- homework */

  source: {
    id: 'source',
    title: 'What are you working from?',
    kind: 'choice',
    options: [
      {
        value: 'photo',
        label: 'A photo of the page',
        blurb: 'Point a camera at it. The transcription is yours to correct '
          + 'before anything is solved.',
      },
      {
        value: 'typed',
        label: 'I will type the problem',
        blurb: 'Faster when it is one problem, and never misreads anything.',
      },
    ],
    next: () => 'goal',
  },

  goal: {
    id: 'goal',
    title: 'What would help most?',
    kind: 'choice',
    options: [
      {
        value: 'walkthrough',
        label: 'Help with these ones',
        blurb: 'Work through what is actually on the page, a step at a time.',
      },
      {
        value: 'extra',
        label: 'More problems like them',
        blurb: 'Same shape, different numbers, until it sticks.',
      },
    ],
    next: () => null,
  },

  /* -------------------------------------------------------------- study */

  topic: {
    id: 'topic',
    title: 'What do you want to work on?',
    /* Free text, with the skill list underneath as chips. Typed answers go
       through ask.js; the chips are the same thing without the typing. */
    kind: 'ask',
    next: () => 'format',
  },

  format: {
    id: 'format',
    title: 'Practice, or a quiz?',
    kind: 'choice',
    options: [
      {
        value: 'practice',
        label: 'Practice',
        blurb: 'Endless, one at a time, hints when you want them. Nothing is '
          + 'being scored.',
      },
      {
        value: 'quiz',
        label: 'Quiz',
        blurb: 'A fixed number of questions, graded at the end.',
      },
    ],
    next: (a) => (a.format === 'quiz' ? 'quizOptions' : null),
  },

  quizOptions: {
    id: 'quizOptions',
    title: 'How should the quiz run?',
    kind: 'form',
    fields: [
      {
        name: 'count',
        label: 'How many questions',
        type: 'number',
        min: 3,
        max: 60,
        step: 1,
        value: 10,
      },
      {
        name: 'partial',
        label: 'Partial credit',
        type: 'toggle',
        value: true,
        /* Said plainly, because the two settings measure different things and
           the difference matters when you compare two attempts. */
        on: 'Count a nearly-right answer as part marks',
        off: 'Right or wrong, nothing in between',
      },
      {
        name: 'minutes',
        label: 'Time limit',
        type: 'number',
        min: 0,
        max: 180,
        step: 5,
        value: 0,
        hint: 'Zero means untimed.',
      },
    ],
    next: () => null,
  },
};

export const FIRST_STEP = 'company';

/* Walk the path the answers imply. Used for the breadcrumb, for Back, and by
   the tests to prove every step is reachable and every path terminates. */
export function pathFor(answers, people = ['carter']) {
  const path = [];
  let id = FIRST_STEP;
  let guard = 0;
  while (id && guard++ < 24) {
    const step = STEPS[id];
    if (!step) break;
    /* A skipped step is not a stopping point. Treating it as one left the
       path ending at "who" whenever there was only one profile, so the step
       actually on screen was not in the path at all and numbered itself
       Question 0. */
    if (skipped(step, answers, people)) {
      const filled = { ...answers };
      if (step.id === 'who') filled.who = people[0];
      id = step.next(filled);
      continue;
    }
    path.push(id);
    if (answers[id] === undefined) break;
    id = step.next(answers);
  }
  return path;
}

/* The who step is pointless with one profile, and asking a question with one
   possible answer is worse than not asking. */
function skipped(step, answers, people) {
  if (step.id === 'who') return people.length < 2;
  return false;
}

/* Which step is waiting for an answer, or null when the flow is done. */
export function currentStep(answers, people = ['carter']) {
  let id = FIRST_STEP;
  let guard = 0;
  while (id && guard++ < 24) {
    const step = STEPS[id];
    if (!step) return null;
    if (skipped(step, answers, people)) {
      /* A skipped step still has to produce its answer, or `next` has
         nothing to branch on. */
      const filled = { ...answers };
      if (step.id === 'who') filled.who = people[0];
      id = step.next(filled);
      continue;
    }
    if (answers[id] === undefined) return step;
    id = step.next(answers);
  }
  return null;
}

/* Remove an answer and everything that depended on it, so going back from
   the quiz options and choosing Practice instead cannot leave a stale
   question count behind. */
export function rewind(answers, stepId, people = ['carter']) {
  const path = pathFor(answers, people);
  const at = path.indexOf(stepId);
  if (at < 0) return { ...answers };
  const keep = {};
  for (const id of path.slice(0, at)) {
    if (answers[id] !== undefined) keep[id] = answers[id];
  }
  return keep;
}

export function previousStep(answers, people = ['carter']) {
  const path = pathFor(answers, people);
  const current = currentStep(answers, people);
  const index = current ? path.indexOf(current.id) : path.length;
  return index > 0 ? path[index - 1] : null;
}

/* Everything the session needs, assembled once the flow finishes.

   `mode` is what app.js switches on. Keeping the branch decision here rather
   than in the view means the tests can assert that every finished flow
   produces a mode that app.js actually implements. */
export const MODES = ['practice', 'quiz', 'homework-walkthrough', 'homework-extra'];

export function plan(answers, people = ['carter']) {
  if (currentStep(answers, people)) return null;
  const who = answers.who || people[0];
  const shared = answers.company === 'together' && answers.proximity === 'shared';
  const sideBySide = answers.company === 'together' && answers.proximity === 'separate';

  const base = {
    who,
    company: answers.company || 'alone',
    shared,
    sideBySide,
    /* A shared session needs a room name both devices can reach. Derived from
       the two profile names rather than random, so the second person does not
       have to be sent a code. */
    room: shared ? roomName(people) : null,
  };

  if (answers.intent === 'homework') {
    return {
      ...base,
      mode: answers.goal === 'extra' ? 'homework-extra' : 'homework-walkthrough',
      source: answers.source || 'typed',
    };
  }

  const ask = answers.topic && answers.topic.plan
    ? answers.topic.plan
    : interpret(answers.topic || '');
  const quiz = answers.quizOptions || {};
  const isQuiz = answers.format === 'quiz';

  return {
    ...base,
    mode: isQuiz ? 'quiz' : 'practice',
    skills: ask.skills || [],
    topicIds: ask.topicIds || [],
    level: ask.level || 2,
    /* Practice shows hints unless you said not to. A quiz does not, unless
       you said you wanted them: a hint during a graded run makes the grade
       mean something different. */
    hints: ask.hints === null ? !isQuiz : ask.hints,
    count: isQuiz ? Number(quiz.count || ask.count || 10) : null,
    minutes: isQuiz ? Number(quiz.minutes || 0) : 0,
    partial: isQuiz ? quiz.partial !== false : true,
    label: describe(ask),
    asked: ask.text || '',
  };
}

function roomName(people) {
  return [...people].map((p) => String(p).toLowerCase().replace(/[^a-z0-9]/g, ''))
    .sort()
    .join('-') || 'room';
}

export default { STEPS, FIRST_STEP, MODES, pathFor, currentStep, previousStep, rewind, plan };
