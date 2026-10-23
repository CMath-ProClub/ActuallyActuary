/* The study app: routing, views and the practice/test state machines.

   One page, hash-routed, no framework. The DOM is small enough that rebuilding
   a view on change is simpler and faster than diffing, and it keeps every view
   a pure function of state. */

import MathKit from './math.js';
import { COURSES, TOPIC_BY_ID, COURSE_BY_ID, topicsIn, unitsIn, searchTopics } from './topics.js';
import { generate, grade, inputHint, hasGenerator, generatableTopics, freshSeed } from './generators.js';
import { buildProblem, distractorsFor as sandboxDistractors,
  SKILLS as SANDBOX_SKILLS, onTrack } from './gen-sandbox.js';
import Expr from './expr.js';
import * as board from './board.js';
import * as graph from './graph.js';
import * as photo from './photo.js';
import * as flow from './flow.js';
import * as mistakes from './mistakes.js';
import * as persist from './persist.js';
import * as room from './room.js';
import * as ask from './ask.js';
import * as store from './store.js';
import * as sched from './scheduler.js';
import * as charts from './charts.js';
import * as ollama from './ollama.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function h(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return n;
}

const esc = MathKit.esc;

/* ===================================================================== state */

let session = null;     /* the live practice session, if any */
let testRun = null;     /* the live test, if any */

const ALL_TOPIC_IDS = generatableTopics();

/* ==================================================================== router */

const ROUTES = {
  '': renderStart,
  start: renderStart,
  workspace: renderWorkspace,
  quiz: renderQuiz,
  dashboard: renderDashboard,
  practice: renderPractice,
  test: renderTest,
  sets: renderSets,
  settings: renderSettings,
};

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = raw.split('/');
  /* No hash at all means the front page, which is the landing flow. It used
     to mean the dashboard, so opening the bare URL skipped the flow
     entirely - the one entry point most likely to be used. */
  return { name: name || 'start', args: rest };
}

function go(path) {
  location.hash = `#/${path}`;
}

function router() {
  const { name, args } = currentRoute();
  const view = ROUTES[name] || renderDashboard;
  /* Leaving practice or a test mid-way abandons it rather than silently
     keeping it alive behind another screen. A half-finished test that
     reappears later with a stale clock is worse than losing it. */
  if (name !== 'practice' && session) session = null;
  if (name !== 'test' && testRun && testRun.phase === 'running') {
    if (!confirm('Leave the test? Your answers so far will be discarded.')) {
      location.hash = '#/test';
      return;
    }
    testRun = null;
  }
  paintNav(name);
  const main = $('#view');
  main.innerHTML = '';
  main.scrollTop = 0;
  try {
    view(main, args);
  } catch (err) {
    console.error(err);
    main.appendChild(h('div', { class: 'card error' }, [
      h('h2', { text: 'Something broke rendering this page' }),
      h('p', { text: String(err && err.message || err) }),
      h('p', { class: 'muted', text: 'The console has the full trace. Your saved data is untouched.' }),
    ]));
  }
  window.scrollTo(0, 0);
}

function paintNav(active) {
  for (const a of $$('#nav a')) {
    const target = a.getAttribute('href').replace(/^#\/?/, '') || 'start';
    a.classList.toggle('on', target === (active || 'start'));
    if (target === (active || 'start')) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

/* ================================================================= dashboard */

function renderDashboard(root) {
  const p = store.activeProfile();
  const stats = sched.overallStats(p);

  root.appendChild(h('header', { class: 'pagehead' }, [
    h('h1', { text: `${greeting()}, ${p.name}` }),
    h('p', { class: 'lead', text: 'What to work on, and how it is going.' }),
  ]));

  root.appendChild(mistakesCard(p));

  /* Stat tiles. One number each, so not a chart. */
  const tiles = h('div', { class: 'tiles' }, [
    charts.statTile(String(stats.today), 'answered today',
      stats.today ? `${stats.todayCorrect} correct` : `goal ${p.settings.dailyGoal}`),
    charts.statTile(stats.streak ? `${stats.streak}` : '0', stats.streak === 1 ? 'day streak' : 'day streak',
      stats.streak ? '' : 'answer one question to start'),
    charts.statTile(stats.accuracy == null ? '—' : `${Math.round(stats.accuracy * 100)}%`,
      'accuracy, all time', `${stats.correct} of ${stats.total}`),
    charts.statTile(String(stats.topicsTouched), 'topics started', `of ${ALL_TOPIC_IDS.length} available`),
  ]);
  root.appendChild(tiles);

  /* Start practicing, prominently. */
  root.appendChild(h('div', { class: 'cta' }, [
    h('button', { class: 'btn big', onclick: () => startSession({ pool: ALL_TOPIC_IDS, label: 'Everything' }) },
      'Practice now'),
    h('a', { class: 'btn ghost', href: '#/test' }, 'Build a mock test'),
  ]));

  /* What to work on. */
  const weak = sched.weakTopics(ALL_TOPIC_IDS, p, 5);
  const due = sched.dueTopics(ALL_TOPIC_IDS, p, 6);

  const focus = h('section', { class: 'card' }, [h('h2', { text: 'Work on these' })]);
  if (weak.length) {
    focus.appendChild(h('p', { class: 'muted', text: 'Lowest recent accuracy, among topics you have answered at least four times.' }));
    const list = h('ul', { class: 'focuslist' });
    for (const w of weak) {
      const rem = sched.remediationFor(w.topicId, p);
      const li = h('li', {}, [
        h('button', {
          class: 'linkish', onclick: () => startTopic(w.topicId, w.name),
        }, w.name),
        h('span', { class: 'pill warn', text: `${Math.round(w.accuracy * 100)}%` }),
        h('span', { class: 'muted small', text: `${w.correct}/${w.seen}` }),
      ]);
      if (rem) {
        li.appendChild(h('p', { class: 'remnote', text: sched.remediationMessage(rem) }));
        li.appendChild(h('button', {
          class: 'linkish small',
          onclick: () => startTopic(rem.topicId, TOPIC_BY_ID[rem.topicId].name),
        }, `Practice ${TOPIC_BY_ID[rem.topicId].name} instead`));
      }
      list.appendChild(li);
    }
    focus.appendChild(list);
  } else if (stats.total < 10) {
    focus.appendChild(h('p', { text: 'Nothing to report yet. Answer a few questions and this fills in with whatever you are actually getting wrong.' }));
  } else {
    focus.appendChild(h('p', { text: 'No topic is currently under 70% with enough attempts to say so. Either things are going well, or you have not touched the harder topics yet.' }));
  }
  root.appendChild(focus);

  if (due.length) {
    const dueCard = h('section', { class: 'card' }, [
      h('h2', { text: 'Due for review' }),
      h('p', { class: 'muted', text: 'Spaced out so they come back just as they are starting to fade.' }),
    ]);
    const chips = h('div', { class: 'chips' });
    for (const d of due) {
      chips.appendChild(h('button', {
        class: 'chip', onclick: () => startTopic(d.topicId, d.name),
      }, d.name));
    }
    dueCard.appendChild(chips);
    dueCard.appendChild(h('button', {
      class: 'btn small', onclick: () => startSession({ pool: due.map((d) => d.topicId), label: 'Review' }),
    }, `Review all ${due.length}`));
    root.appendChild(dueCard);
  }

  /* Charts. */
  const act = h('section', { class: 'card' }, [
    h('h2', { text: 'Problems answered per day' }),
    h('p', { class: 'muted', text: 'Last 30 days.' }),
  ]);
  act.appendChild(charts.activityChart(sched.dailyActivity(p, 30)));
  root.appendChild(act);

  const trend = h('section', { class: 'card' }, [
    h('h2', { text: 'Accuracy trend' }),
    h('p', { class: 'muted', text: 'Rolling average over the last 20 attempts at each point.' }),
  ]);
  trend.appendChild(charts.accuracyChart(sched.accuracyTrend(p)));
  root.appendChild(trend);

  const mast = h('section', { class: 'card' }, [
    h('h2', { text: 'Accuracy by topic' }),
    h('p', { class: 'muted', text: 'Weakest first. Click a row to practice it.' }),
  ]);
  mast.appendChild(charts.masteryChart(sched.topicStats(ALL_TOPIC_IDS, p), {
    limit: 12,
    onPick: (id) => startTopic(id, TOPIC_BY_ID[id].name),
  }));
  root.appendChild(mast);

  /* The honesty note. Not dismissible, same as the leaderboard caveat on the
     backtester: a number that looks like a grade will be read as one. */
  root.appendChild(h('aside', { class: 'caveat' }, [
    h('strong', { text: 'What these numbers are, and are not. ' }),
    'They measure how you did on questions this app generated, which is a useful signal for what to study next '
    + 'and nothing more. They are not a grade, not a predicted exam score, and not proof a topic is learned. '
    + 'Practicing the same generated pattern until the percentage goes up is the easiest way to fool yourself here.',
  ]));

  /* Browse everything. */
  const browse = h('section', { class: 'card' }, [h('h2', { text: 'All topics' })]);
  for (const c of COURSES) {
    const topics = topicsIn(c.id).filter((t) => hasGenerator(t.id));
    if (!topics.length) continue;
    const det = h('details', { class: 'course' }, [
      h('summary', {}, [
        h('span', { class: 'cname', text: c.name }),
        h('span', { class: 'muted small', text: `${topics.length} topics` }),
      ]),
    ]);
    for (const u of unitsIn(c.id)) {
      const avail = u.topics.filter((t) => hasGenerator(t.id));
      if (!avail.length) continue;
      det.appendChild(h('h3', { class: 'unit', text: u.name }));
      const chips = h('div', { class: 'chips' });
      for (const t of avail) {
        const m = store.masteryOf(t.id, p);
        const acc = m && m.seen >= sched.MIN_ATTEMPTS ? store.recentAccuracy(t.id, 20, p) : null;
        const chip = h('button', {
          class: 'chip', title: t.blurb || t.name,
          onclick: () => startTopic(t.id, t.name),
        }, [
          t.name,
          acc != null ? h('span', {
            class: `dot ${acc >= 0.8 ? 'good' : acc >= 0.6 ? 'mid' : 'bad'}`,
            'aria-hidden': 'true',
          }) : null,
        ]);
        if (acc != null) chip.setAttribute('aria-label', `${t.name}, ${Math.round(acc * 100)} percent correct`);
        chips.appendChild(chip);
      }
      det.appendChild(chips);
      det.appendChild(h('button', {
        class: 'btn small ghost',
        onclick: () => startSession({ pool: avail.map((t) => t.id), label: `${c.name}: ${u.name}` }),
      }, `Practice this unit`));
    }
    browse.appendChild(det);
  }
  root.appendChild(browse);
}

function greeting() {
  const hr = new Date().getHours();
  if (hr < 5) return 'Still up';
  if (hr < 12) return 'Morning';
  if (hr < 18) return 'Afternoon';
  return 'Evening';
}

/* ================================================================== practice */

/* Which sandbox skill, if any, teaches a curriculum topic.

   Built by inverting the skill table rather than written out, so a skill
   that changes which topic it belongs to cannot leave a stale mapping
   behind. Several skills can point at one topic - trig, exp and log all sit
   under the same one - and the first is good enough to practise with. */
const SKILL_FOR_TOPIC = (() => {
  const map = new Map();
  for (const [id, skill] of Object.entries(SANDBOX_SKILLS)) {
    if (skill.topicId && !map.has(skill.topicId)) map.set(skill.topicId, id);
  }
  return map;
})();

/* Practising one topic should use the best question the tool can ask about
   it. For anything the sandbox covers that means the derivative itself
   rather than its value at a point, which is what the old generator was
   limited to. A topic with no sandbox skill carries on as before. */
function startTopic(topicId, label) {
  const skill = SKILL_FOR_TOPIC.get(topicId);
  if (skill) {
    startSession({
      label: label || (TOPIC_BY_ID[topicId] && TOPIC_BY_ID[topicId].name) || 'Practice',
      sandbox: { skills: [skill], level: 2, hints: true },
    });
    return;
  }
  startSession({ pool: [topicId], label });
}

function startSession({ pool, label, items = null, setId = null, sandbox = null }) {
  session = {
    pool: pool && pool.length ? pool : ALL_TOPIC_IDS,
    label: label || 'Practice',
    /* A sandbox session builds its problems from gen-sandbox.js, which asks
       for the derivative itself rather than its value at a point. */
    sandbox,
    items,                 /* fixed list (a custom set), or null for adaptive */
    setId,
    index: 0,
    answered: 0,
    correct: 0,
    current: null,
    startedAt: Date.now(),
    lastTopicId: null,
    history: [],
  };
  /* Assigning the SAME hash fires no hashchange event, so the router would
     never run; assigning a different one fires it and running router() here
     as well would build the first problem twice and throw one away. Decide
     from whether the hash actually changed. */
  const before = location.hash;
  go('practice');
  if (location.hash === before) router();
}

function savePractice() {
  if (!session) return;
  /* A fixed set walks a stored list of items rather than seeds, so it is not
     rebuildable this way and is left alone. */
  if (session.items) return;
  persist.saveSession(store.activeProfile().id, 'practice', {
    label: session.label,
    sandbox: session.sandbox || null,
    pool: session.pool,
    answered: session.answered,
    correct: session.correct,
    startedAt: session.startedAt,
    problem: persist.describeProblem(session.current),
  });
}

function renderPractice(root) {
  if (!session) {
    /* Same reasoning as the workspace: a refresh in the middle of a question
       should not cost you the session. */
    const saved = persist.loadSession(store.activeProfile().id, 'practice');
    if (saved && (saved.sandbox || (saved.pool && saved.pool.length))) {
      session = {
        pool: saved.pool && saved.pool.length ? saved.pool : ALL_TOPIC_IDS,
        label: saved.label || 'Practice',
        items: null,
        setId: null,
        sandbox: saved.sandbox || null,
        index: 0,
        answered: saved.answered || 0,
        correct: saved.correct || 0,
        current: null,
        startedAt: saved.startedAt || Date.now(),
        lastTopicId: null,
        history: [],
        resumeProblem: saved.problem || null,
      };
    }
  }
  if (!session) {
    root.appendChild(h('div', { class: 'card' }, [
      h('h2', { text: 'Nothing in progress' }),
      h('p', { text: 'Pick something to practice.' }),
      h('div', { class: 'cta' }, [
        h('button', { class: 'btn', onclick: () => startSession({ pool: ALL_TOPIC_IDS, label: 'Everything' }) }, 'Practice everything'),
        h('a', { class: 'btn ghost', href: '#/dashboard' }, 'Back to the dashboard'),
      ]),
    ]));
    return;
  }

  const bar = h('div', { class: 'sessionbar' }, [
    h('div', {}, [
      h('strong', { text: session.label }),
      h('span', { class: 'muted small', text: session.answered
        ? ` · ${session.correct}/${session.answered} correct` : ' · just started' }),
    ]),
    h('button', { class: 'btn small ghost', onclick: endSession }, 'End session'),
  ]);
  root.appendChild(bar);

  const stage = h('div', { id: 'stage' });
  root.appendChild(stage);
  nextProblem(stage);
}

function endSession() {
  const s = session;
  session = null;
  persist.clearSession(store.activeProfile().id, 'practice');
  if (!s || !s.answered) { go('dashboard'); return; }
  const main = $('#view');
  main.innerHTML = '';
  paintNav('practice');
  const pct = Math.round((s.correct / s.answered) * 100);
  const mins = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
  main.appendChild(h('section', { class: 'card result' }, [
    h('h1', { text: 'Session finished' }),
    h('p', { class: 'bignum', text: `${s.correct} / ${s.answered}` }),
    h('p', { class: 'lead', text: `${pct}% correct over about ${mins} minute${mins === 1 ? '' : 's'}.` }),
    s.answered < 10
      ? h('p', { class: 'muted', text: 'That is a short session, so the percentage does not mean much on its own.' })
      : null,
    /* The useful part is not the score, it is what went wrong more than
       once. Null most of the time, which is correct: one miss is a miss, not
       a pattern. */
    (() => {
      const note = mistakes.sessionNote(store.activeProfile().attempts, s.startedAt);
      return note ? h('p', { class: 'sessionnote', text: note }) : null;
    })(),
    h('div', { class: 'cta' }, [
      h('button', { class: 'btn', onclick: () => startSession({ pool: s.pool, label: s.label }) }, 'Go again'),
      h('a', { class: 'btn ghost', href: '#/dashboard' }, 'Dashboard'),
    ]),
  ]));
}

function nextProblem(stage) {
  const p = store.activeProfile();
  stage.innerHTML = '';

  let problem = null;
  let remediation = null;

  /* Coming back from a reload lands on the question that was on screen, not
     a new one, because the seed rebuilds it exactly. */
  if (session.resumeProblem) {
    const resumed = rebuildProblem(session.resumeProblem);
    session.resumeProblem = null;
    if (resumed) {
      session.current = resumed;
      session.lastTopicId = resumed.topicId;
      renderProblem(stage, resumed, { remediation: null, mode: 'practice' });
      return;
    }
  }

  if (session.sandbox) {
    /* Endless by design: this is the "keep them coming" mode. A builder can
       decline a draw (a derivative that came out identically zero cannot be
       graded), so try a few times before giving up. */
    for (let tries = 0; tries < 12 && !problem; tries++) {
      problem = buildProblem(session.sandbox, freshSeed());
    }
    if (!problem) {
      stage.appendChild(h('p', { class: 'muted', text: 'Could not build a problem for that selection.' }));
      return;
    }
    session.current = problem;
    session.lastTopicId = problem.topicId;
    savePractice();
    renderProblem(stage, problem, { remediation: null, mode: 'practice' });
    return;
  }

  if (session.items) {
    /* A fixed set: walk it in order, then stop. */
    if (session.index >= session.items.length) { endSession(); return; }
    problem = customToProblem(session.items[session.index], session.setId);
    session.index++;
  } else {
    const spec = sched.nextProblemSpec(session.pool, p, { lastTopicId: session.lastTopicId });
    if (!spec) {
      stage.appendChild(h('p', { class: 'muted', text: 'No practicable topics in this selection.' }));
      return;
    }
    remediation = spec.remediation;
    problem = generate(spec.topicId, spec.difficulty);
    if (!problem) {
      /* One bad draw should not end the session. */
      session.lastTopicId = spec.topicId;
      nextProblem(stage);
      return;
    }
  }

  session.current = problem;
  session.lastTopicId = problem.topicId;
  savePractice();
  renderProblem(stage, problem, { remediation, mode: 'practice' });
}

/* Turn a stored custom/AI item into the same shape the generators produce, so
   one renderer handles both. */
function customToProblem(item, setId) {
  return {
    ...item,
    topicId: `custom:${setId || 'adhoc'}`,
    topicName: item.concept || 'Custom',
    courseId: 'custom',
    difficulty: item.difficulty || 2,
    seed: 0,
    key: item.id,
    untrusted: item.source === 'ollama',
  };
}

/* The one problem renderer, used by practice, custom sets and test review. */
function renderProblem(stage, problem, { remediation, mode }) {
  const p = store.activeProfile();
  const started = Date.now();
  let hintsShown = 0;
  let settled = false;

  const card = h('section', { class: 'card problem' });

  if (remediation) {
    card.appendChild(h('div', { class: 'rembanner' }, [
      h('strong', { text: 'Stepping back a moment. ' }),
      sched.remediationMessage(remediation),
    ]));
  }

  card.appendChild(h('div', { class: 'ptop' }, [
    h('span', { class: 'ptopic', text: problem.topicName }),
    h('span', { class: 'plevel', text: `level ${problem.difficulty}` }),
    problem.untrusted
      ? h('span', { class: 'pill ai', title: 'Written by your local model, not verified by the app.', text: 'AI-written' })
      : null,
  ]));

  card.appendChild(h('div', { class: 'stem', html: problem.stem }));

  const form = h('form', { class: 'answerform' });
  let getResponse;

  if (problem.kind === 'choice') {
    const group = h('div', { class: 'choices', role: 'radiogroup' });
    problem.choices.forEach((c, i) => {
      const id = `ch${i}`;
      const lab = h('label', { class: 'choice', for: id }, [
        h('input', { type: 'radio', name: 'choice', id, value: String(i) }),
        h('span', { class: 'cbody', html: c.html }),
      ]);
      group.appendChild(lab);
    });
    form.appendChild(group);
    getResponse = () => {
      const sel = form.querySelector('input[name=choice]:checked');
      return sel ? sel.value : '';
    };
  } else {
    const input = h('input', {
      type: 'text', class: 'answerinput', autocomplete: 'off', autocapitalize: 'off',
      spellcheck: 'false', placeholder: inputHint(problem), 'aria-label': 'Your answer',
    });
    form.appendChild(input);
    /* Only where an expression is expected. Echoing a plain number back at
       someone would be noise. */
    if (['expression', 'antiderivative', 'factored', 'expanded'].includes(problem.kind)) {
      const keys = mathKeys(input);
      if (keys) form.appendChild(keys);
      form.appendChild(attachEcho(input, problem));
    }
    getResponse = () => input.value;
    setTimeout(() => input.focus(), 30);
  }

  const actions = h('div', { class: 'actions' });
  const checkBtn = h('button', { class: 'btn', type: 'submit' }, 'Check');
  actions.appendChild(checkBtn);

  const guidance = p.settings.guidance;
  const hintBtn = (problem.hints && problem.hints.length && mode === 'practice' && guidance !== 'answer')
    ? h('button', { class: 'btn ghost', type: 'button' }, 'Hint')
    : null;
  if (hintBtn) actions.appendChild(hintBtn);

  /* Checking where you are without committing to it. Nothing is recorded,
     which is the point: being told you are close should not cost you the
     question. */
  const trackBtn = (['expression', 'antiderivative', 'factored', 'expanded'].includes(problem.kind)
    && mode === 'practice')
    ? h('button', { class: 'btn ghost', type: 'button' }, 'Am I on track?')
    : null;
  if (trackBtn) actions.appendChild(trackBtn);

  const skipBtn = h('button', { class: 'btn ghost', type: 'button' }, 'Skip');
  actions.appendChild(skipBtn);
  form.appendChild(actions);

  const hintBox = h('div', { class: 'hints', hidden: true });
  const feedback = h('div', { class: 'feedback', hidden: true });
  const solution = h('div', { class: 'solution', hidden: true });

  card.append(form, hintBox, feedback, solution);
  stage.appendChild(card);

  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      if (hintsShown >= problem.hints.length) return;
      hintBox.hidden = false;
      hintBox.appendChild(h('p', { class: 'hint', html: `<b>Hint ${hintsShown + 1}.</b> ${problem.hints[hintsShown]}` }));
      hintsShown++;
      if (hintsShown >= problem.hints.length) {
        hintBtn.disabled = true;
        hintBtn.textContent = 'No more hints';
      }
    });
  }

  if (trackBtn) {
    trackBtn.addEventListener('click', () => {
      if (settled) return;
      const where = onTrack(problem, getResponse(), { hintsShown });
      hintBox.hidden = false;
      hintBox.innerHTML = '';
      hintBox.appendChild(h('p', { class: `hint track ${where.state}` }, [
        h('strong', { text: `${trackLabel(where.state)} ` }),
        where.message,
      ]));
    });
  }

  skipBtn.addEventListener('click', () => settle('', true));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (settled) { advance(); return; }
    settle(getResponse(), false);
  });

  function settle(response, skipped) {
    if (settled) return;
    const res = skipped ? { correct: false, detail: 'Skipped.' } : grade(problem, response);
    settled = true;
    checkBtn.textContent = 'Next';
    if (hintBtn) hintBtn.disabled = true;
    skipBtn.hidden = true;
    for (const inp of $$('input', form)) inp.disabled = true;

    feedback.hidden = false;
    feedback.className = `feedback ${res.correct ? 'right' : 'wrong'}`;
    feedback.innerHTML = '';
    feedback.appendChild(h('p', { class: 'verdict', text: res.correct ? 'Correct' : skipped ? 'Skipped' : 'Not quite' }));
    if (!res.correct) {
      feedback.appendChild(h('p', { class: 'answerline', html: `The answer is <b>${problem.answerHtml || ''}</b>` }));
      if (res.detail) feedback.appendChild(h('p', { class: 'muted small', text: res.detail }));
    }
    if (problem.note) feedback.appendChild(h('p', { class: 'pnote', text: problem.note }));

    /* Worked solution: always available, shown automatically on a miss.

       One step at a time rather than the whole thing at once. Handing
       somebody the finished working teaches them that the working exists;
       revealing it a line at a time means they can stop at the point where
       they see it, which is the point they were actually stuck. */
    if (problem.steps && problem.steps.length) {
      solution.hidden = false;
      solution.innerHTML = '';
      const det = h('details', { class: 'steps', open: !res.correct });
      det.appendChild(h('summary', { text: res.correct ? 'See the worked solution' : 'How to get there' }));

      const ol = h('ol');
      let shown = 0;
      const more = h('button', { class: 'btn small ghost', type: 'button' });
      const revealOne = () => {
        if (shown >= problem.steps.length) return;
        const st = problem.steps[shown];
        ol.appendChild(h('li', {}, [
          h('span', { class: 'sttitle', text: st.title }),
          h('span', { class: 'sthtml', html: st.html }),
        ]));
        shown += 1;
        const left = problem.steps.length - shown;
        more.textContent = left ? `Next step (${left} more)` : 'That is all of it';
        more.disabled = left === 0;
      };
      more.addEventListener('click', revealOne);
      revealOne();
      det.appendChild(ol);
      if (problem.steps.length > 1) {
        det.appendChild(h('div', { class: 'cta' }, [
          more,
          h('button', {
            class: 'linkish small', type: 'button',
            onclick: () => { while (shown < problem.steps.length) revealOne(); },
          }, 'Show the rest'),
        ]));
      }
      solution.appendChild(det);
    }

    /* Ask the local model to explain, but only for a verified problem where
       the correct answer is already known - see the note in ollama.js. */
    if (!res.correct && !problem.untrusted && p.settings.ollamaModel) {
      const explainBtn = h('button', { class: 'btn ghost small', type: 'button' }, 'Explain this to me');
      const out = h('div', { class: 'explain', hidden: true });
      explainBtn.addEventListener('click', async () => {
        explainBtn.disabled = true;
        explainBtn.textContent = 'Thinking...';
        out.hidden = false;
        out.innerHTML = '<p class="muted">Asking your local model...</p>';
        try {
          const text = await ollama.explain(p.settings.ollamaUrl, p.settings.ollamaModel, {
            stem: problem.stem,
            answer: problem.answerHtml,
            wrongAnswer: skipped ? '' : response,
            topic: problem.topicName,
          });
          out.innerHTML = '';
          out.append(
            h('p', { class: 'aitag', text: `Explained by ${p.settings.ollamaModel}, running on this machine.` }),
            h('p', { html: text }),
          );
        } catch (err) {
          out.innerHTML = '';
          out.appendChild(h('p', { class: 'muted', text: err.message }));
          if (err.hint) out.appendChild(h('p', { class: 'muted small', text: err.hint }));
        } finally {
          explainBtn.textContent = 'Explain this to me';
          explainBtn.disabled = false;
        }
      });
      solution.append(explainBtn, out);
      solution.hidden = false;
    }

    /* Record it, including skips. Skipping IS the information: not being
       able to start a question is exactly what the weak list should know
       about. Custom items carry their own synthetic topic id, so they can
       never move a curriculum number. */
    store.recordAttempt({
      topicId: problem.topicId,
      correct: res.correct,
      ms: Date.now() - started,
      difficulty: problem.difficulty,
      hintsUsed: hintsShown,
      seed: problem.seed,
      mode: skipped ? 'skip' : mode,
      /* What the grader worked out, kept rather than shown once and lost. */
      diagnosis: skipped ? 'skipped' : (res.diagnosis || ''),
    });
    session.answered++;
    if (res.correct) session.correct++;
    savePractice();
    session.history.push({ topicId: problem.topicId, correct: res.correct });

    const bar = $('.sessionbar strong');
    if (bar && bar.nextSibling) {
      bar.nextSibling.textContent = ` · ${session.correct}/${session.answered} correct`;
    }
    checkBtn.focus();
  }

  function advance() {
    if (!session) return;
    nextProblem(stage);
  }
}

/* ====================================================================== test */

function renderTest(root) {
  if (testRun && testRun.phase === 'running') { paintTestRunning(root); return; }
  if (testRun && testRun.phase === 'done') { paintTestResults(root); return; }

  const p = store.activeProfile();
  root.appendChild(h('header', { class: 'pagehead' }, [
    h('h1', { text: 'Build a mock test' }),
    h('p', { class: 'lead', text: 'Pick what it covers, how long it is, and whether it is timed. Everything is graded at the end, with a breakdown by topic.' }),
  ]));

  const form = h('form', { class: 'card testbuilder' });
  const selected = new Set();

  /* Scope: by course, by unit, or by search. */
  form.appendChild(h('h2', { text: 'What should it cover?' }));
  const search = h('input', { type: 'search', class: 'searchbox', placeholder: 'Search topics, e.g. "quadratic" or "annuity"' });
  const searchOut = h('div', { class: 'chips' });
  search.addEventListener('input', () => {
    searchOut.innerHTML = '';
    const hits = searchTopics(search.value).filter((t) => hasGenerator(t.id)).slice(0, 12);
    for (const t of hits) {
      searchOut.appendChild(topicChip(t, selected, updateCount));
    }
  });
  form.append(search, searchOut);

  for (const c of COURSES) {
    const avail = topicsIn(c.id).filter((t) => hasGenerator(t.id));
    if (!avail.length) continue;
    const det = h('details', { class: 'course' }, [
      h('summary', {}, [
        h('span', { class: 'cname', text: c.name }),
        h('button', {
          class: 'linkish small', type: 'button',
          onclick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            const allOn = avail.every((t) => selected.has(t.id));
            for (const t of avail) { if (allOn) selected.delete(t.id); else selected.add(t.id); }
            for (const b of $$(`[data-topic]`, det)) {
              b.classList.toggle('on', selected.has(b.dataset.topic));
            }
            updateCount();
          },
        }, 'toggle all'),
      ]),
    ]);
    for (const u of unitsIn(c.id)) {
      const ua = u.topics.filter((t) => hasGenerator(t.id));
      if (!ua.length) continue;
      det.appendChild(h('h3', { class: 'unit', text: u.name }));
      const chips = h('div', { class: 'chips' });
      for (const t of ua) chips.appendChild(topicChip(t, selected, updateCount));
      det.appendChild(chips);
    }
    form.appendChild(det);
  }

  /* Options. */
  form.appendChild(h('h2', { text: 'How long?' }));
  const opts = h('div', { class: 'optgrid' });
  const countSel = labelled('Questions', h('select', { name: 'count' },
    [5, 10, 15, 20, 25, 30, 40].map((n) => h('option', { value: String(n), selected: n === 15 }, String(n)))));
  const diffSel = labelled('Difficulty', h('select', { name: 'difficulty' }, [
    h('option', { value: 'adaptive', selected: true }, 'Match my level'),
    h('option', { value: '1' }, 'Introductory'),
    h('option', { value: '2' }, 'Moderate'),
    h('option', { value: '3' }, 'Challenging'),
    h('option', { value: 'mixed' }, 'Mixed'),
  ]));
  const timeSel = labelled('Time limit', h('select', { name: 'minutes' }, [
    h('option', { value: '0', selected: true }, 'No limit'),
    ...[10, 15, 20, 30, 45, 60, 90].map((m) => h('option', { value: String(m) }, `${m} minutes`)),
  ]));
  opts.append(countSel, diffSel, timeSel);
  form.appendChild(opts);

  const countNote = h('p', { class: 'muted', text: 'No topics selected: the test will draw from everything, weighted toward what you get wrong.' });
  form.appendChild(countNote);

  function updateCount() {
    countNote.textContent = selected.size
      ? `${selected.size} topic${selected.size === 1 ? '' : 's'} selected.`
      : 'No topics selected: the test will draw from everything, weighted toward what you get wrong.';
  }

  form.appendChild(h('div', { class: 'cta' }, [
    h('button', { class: 'btn big', type: 'submit' }, 'Start the test'),
  ]));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const count = Number($('[name=count]', form).value);
    const diff = $('[name=difficulty]', form).value;
    const minutes = Number($('[name=minutes]', form).value);
    const pool = selected.size ? [...selected] : ALL_TOPIC_IDS;
    buildTest({ pool, count, diff, minutes, label: describeScope(selected) });
  });

  root.appendChild(form);

  /* Past tests. */
  if (p.tests.length) {
    const past = h('section', { class: 'card' }, [h('h2', { text: 'Past tests' })]);
    const list = h('ul', { class: 'testlist' });
    for (const t of p.tests.slice().reverse().slice(0, 12)) {
      list.appendChild(h('li', {}, [
        h('span', { class: 'tname', text: t.name }),
        /* A quiz and a mock test are different things and are scored
           differently, so the list says which it was rather than leaving
           two unlike numbers side by side. */
        t.kind === 'quiz' ? h('span', { class: 'pill', text: 'quiz' }) : null,
        h('span', { class: 'tscore', text: `${t.score}/${t.total}` }),
        h('span', { class: 'muted small', text: new Date(t.ts).toLocaleDateString() }),
        h('button', { class: 'linkish small', onclick: () => { testRun = reopenTest(t); router(); } }, 'review'),
        h('button', { class: 'linkish small danger', onclick: () => { store.deleteTest(t.id); router(); } }, 'delete'),
      ]));
    }
    past.appendChild(list);
    root.appendChild(past);
  }
}

function topicChip(t, selected, onChange) {
  const b = h('button', {
    class: `chip${selected.has(t.id) ? ' on' : ''}`, type: 'button',
    dataset: { topic: t.id }, title: t.blurb || '',
    'aria-pressed': selected.has(t.id) ? 'true' : 'false',
  }, t.name);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    if (selected.has(t.id)) selected.delete(t.id); else selected.add(t.id);
    b.classList.toggle('on', selected.has(t.id));
    b.setAttribute('aria-pressed', selected.has(t.id) ? 'true' : 'false');
    onChange();
  });
  return b;
}

function labelled(text, control) {
  const id = `f${Math.random().toString(36).slice(2, 8)}`;
  control.id = id;
  return h('div', { class: 'field' }, [h('label', { for: id, text }), control]);
}

function describeScope(selected) {
  if (!selected.size) return 'Everything';
  if (selected.size === 1) return TOPIC_BY_ID[[...selected][0]].name;
  const courses = new Set([...selected].map((id) => TOPIC_BY_ID[id].course));
  if (courses.size === 1) return COURSE_BY_ID[[...courses][0]].name;
  return `${selected.size} topics`;
}

function buildTest({ pool, count, diff, minutes, label }) {
  const p = store.activeProfile();
  const topics = sched.pickTopics(pool, count, p);
  /* pickTopics draws without replacement, so a short pool gives a short test.
     Top it back up by cycling rather than silently handing over 3 questions. */
  while (topics.length < count && pool.length) topics.push(pool[topics.length % pool.length]);

  const items = [];
  for (const tid of topics.slice(0, count)) {
    const level = diff === 'adaptive' ? sched.difficultyFor(tid, p)
      : diff === 'mixed' ? 1 + Math.floor(Math.random() * 3)
        : Number(diff);
    const prob = generate(tid, level);
    if (prob) items.push({ topicId: tid, difficulty: level, seed: prob.seed });
  }

  testRun = {
    phase: 'running',
    id: null,
    name: `${label} · ${items.length} questions`,
    items,
    responses: new Array(items.length).fill(''),
    index: 0,
    startedAt: Date.now(),
    deadline: minutes ? Date.now() + minutes * 60000 : 0,
    minutes,
  };
  router();
}

function reopenTest(saved) {
  return {
    phase: 'done',
    id: saved.id,
    name: saved.name,
    items: saved.items,
    /* A mock test keeps its answers in one list; a quiz keeps each answer
       on the item it belongs to. Either way the review needs them. */
    responses: saved.responses
      || saved.items.map((it) => (it && it.response) || ''),
    index: 0,
    startedAt: saved.ts,
    deadline: 0,
    minutes: 0,
    savedScore: saved.score,
    reopened: true,
  };
}

let tickTimer = null;

function paintTestRunning(root) {
  const t = testRun;
  const problems = t.items.map((it) => rebuildSavedItem(it));

  const head = h('div', { class: 'sessionbar' }, [
    h('div', {}, [
      h('strong', { text: t.name }),
      h('span', { class: 'muted small', id: 'tprog', text: ` · ${t.index + 1} of ${t.items.length}` }),
    ]),
    h('div', { class: 'tbarright' }, [
      t.deadline ? h('span', { class: 'clock', id: 'tclock' }, '--:--') : null,
      h('button', { class: 'btn small', onclick: () => finishTest(problems) }, 'Submit'),
    ]),
  ]);
  root.appendChild(head);

  root.appendChild(h('p', { class: 'muted testhint', text: 'No hints or solutions until you submit. That is the point of a test.' }));

  const stage = h('div', { id: 'tstage' });
  root.appendChild(stage);

  const nav = h('div', { class: 'qnav' });
  root.appendChild(nav);

  function paintNavDots() {
    nav.innerHTML = '';
    t.items.forEach((_, i) => {
      nav.appendChild(h('button', {
        class: `qdot${i === t.index ? ' on' : ''}${t.responses[i] ? ' done' : ''}`,
        title: `Question ${i + 1}${t.responses[i] ? ' (answered)' : ''}`,
        'aria-label': `Go to question ${i + 1}${t.responses[i] ? ', answered' : ', not answered'}`,
        onclick: () => { t.index = i; paint(); },
      }, String(i + 1)));
    });
  }

  function paint() {
    const i = t.index;
    const prob = problems[i];
    stage.innerHTML = '';
    $('#tprog').textContent = ` · ${i + 1} of ${t.items.length}`;
    paintNavDots();
    if (!prob) {
      stage.appendChild(h('p', { class: 'muted', text: 'This question could not be rebuilt and will be skipped in grading.' }));
      return;
    }

    const card = h('section', { class: 'card problem' }, [
      h('div', { class: 'ptop' }, [
        h('span', { class: 'ptopic', text: prob.topicName }),
        h('span', { class: 'plevel', text: `level ${prob.difficulty}` }),
      ]),
      h('div', { class: 'stem', html: prob.stem }),
    ]);

    const form = h('form', { class: 'answerform' });
    if (prob.kind === 'choice') {
      const group = h('div', { class: 'choices', role: 'radiogroup' });
      prob.choices.forEach((c, ci) => {
        const id = `tc${ci}`;
        const input = h('input', {
          type: 'radio', name: 'choice', id, value: String(ci),
          checked: t.responses[i] === String(ci),
        });
        input.addEventListener('change', () => { t.responses[i] = String(ci); paintNavDots(); });
        group.appendChild(h('label', { class: 'choice', for: id }, [input, h('span', { class: 'cbody', html: c.html })]));
      });
      form.appendChild(group);
    } else {
      const input = h('input', {
        type: 'text', class: 'answerinput', autocomplete: 'off', spellcheck: 'false',
        value: t.responses[i] || '', placeholder: inputHint(prob), 'aria-label': 'Your answer',
      });
      input.addEventListener('input', () => { t.responses[i] = input.value; paintNavDots(); });
      form.appendChild(input);
      setTimeout(() => input.focus(), 30);
    }

    form.appendChild(h('div', { class: 'actions' }, [
      h('button', {
        class: 'btn ghost', type: 'button', disabled: i === 0,
        onclick: () => { t.index = Math.max(0, i - 1); paint(); },
      }, 'Back'),
      i < t.items.length - 1
        ? h('button', { class: 'btn', type: 'submit' }, 'Next')
        : h('button', { class: 'btn', type: 'button', onclick: () => finishTest(problems) }, 'Submit test'),
    ]));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (i < t.items.length - 1) { t.index = i + 1; paint(); }
    });
    card.appendChild(form);
    stage.appendChild(card);
  }

  paint();

  if (tickTimer) clearInterval(tickTimer);
  if (t.deadline) {
    const tick = () => {
      const left = t.deadline - Date.now();
      const clock = $('#tclock');
      if (!clock) { clearInterval(tickTimer); return; }
      if (left <= 0) {
        clearInterval(tickTimer);
        clock.textContent = '0:00';
        finishTest(problems, true);
        return;
      }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      clock.textContent = `${m}:${String(s).padStart(2, '0')}`;
      clock.classList.toggle('low', left < 120000);
    };
    tick();
    tickTimer = setInterval(tick, 1000);
  }
}

function finishTest(problems, timedOut = false) {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  const t = testRun;
  if (!t || t.phase !== 'running') return;
  const unanswered = t.responses.filter((r) => !r).length;
  if (!timedOut && unanswered) {
    if (!confirm(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered. Submit anyway?`)) return;
  }

  let score = 0;
  const byTopic = new Map();
  t.graded = problems.map((prob, i) => {
    if (!prob) return null;
    const res = grade(prob, t.responses[i]);
    if (res.correct) score++;
    const row = byTopic.get(prob.topicId) || { name: prob.topicName, correct: 0, total: 0 };
    row.total++;
    if (res.correct) row.correct++;
    byTopic.set(prob.topicId, row);
    store.recordAttempt({
      topicId: prob.topicId,
      correct: res.correct,
      ms: 0,
      difficulty: prob.difficulty,
      hintsUsed: 0,
      seed: prob.seed,
      mode: 'test',
      diagnosis: res.diagnosis || '',
    });
    return { prob, response: t.responses[i], result: res };
  });

  t.phase = 'done';
  t.score = score;
  t.total = problems.filter(Boolean).length;
  t.timedOut = timedOut;
  t.breakdown = [...byTopic.entries()].map(([topicId, r]) => ({ topicId, ...r }))
    .sort((a, b) => (a.correct / a.total) - (b.correct / b.total));

  t.id = store.saveTest({
    id: t.id,
    name: t.name,
    ts: Date.now(),
    items: t.items,
    responses: t.responses,
    score,
    total: t.total,
    breakdown: t.breakdown,
  });
  router();
}

function paintTestResults(root) {
  const t = testRun;
  const pct = t.total ? Math.round((t.score / t.total) * 100) : 0;

  root.appendChild(h('header', { class: 'pagehead' }, [
    h('h1', { text: t.reopened ? 'Test review' : 'Test finished' }),
    t.timedOut ? h('p', { class: 'lead warn', text: 'Time ran out. Unanswered questions were marked wrong.' }) : null,
  ]));

  root.appendChild(h('section', { class: 'card result' }, [
    h('p', { class: 'bignum', text: `${t.score} / ${t.total}` }),
    h('p', { class: 'lead', text: `${pct}% correct.` }),
    t.total < 20
      ? h('p', { class: 'muted', text: `Over ${t.total} questions, the margin of error on that percentage is large. One lucky guess moves it by ${Math.round(100 / t.total)} points.` })
      : null,
  ]));

  if (t.breakdown && t.breakdown.length > 1) {
    const bd = h('section', { class: 'card' }, [
      h('h2', { text: 'By topic' }),
      h('p', { class: 'muted', text: 'Weakest first.' }),
    ]);
    bd.appendChild(charts.breakdownChart(t.breakdown));
    const weak = t.breakdown.filter((b) => b.correct < b.total);
    if (weak.length) {
      bd.appendChild(h('button', {
        class: 'btn', onclick: () => {
          const pool = weak.map((w) => w.topicId).filter((id) => !String(id).startsWith('custom:'));
          testRun = null;
          startSession({ pool, label: 'What you missed' });
        },
      }, `Practice the ${weak.length} topic${weak.length === 1 ? '' : 's'} you missed`));
    }
    root.appendChild(bd);
  }

  if (t.graded) {
    const rev = h('section', { class: 'card' }, [h('h2', { text: 'Every question' })]);
    t.graded.forEach((g, i) => {
      if (!g) return;
      const det = h('details', { class: `qreview ${g.result.correct ? 'right' : 'wrong'}` });
      det.appendChild(h('summary', {}, [
        h('span', { class: 'qnum', text: `${i + 1}` }),
        h('span', { class: 'qmark', text: g.result.correct ? 'correct' : 'wrong' }),
        h('span', { class: 'qtopic', text: g.prob.topicName }),
      ]));
      det.appendChild(h('div', { class: 'stem', html: g.prob.stem }));
      det.appendChild(h('p', { class: 'answerline', html: `Your answer: <b>${esc(responseLabel(g))}</b>` }));
      if (!g.result.correct) {
        det.appendChild(h('p', { class: 'answerline', html: `Correct answer: <b>${g.prob.answerHtml || ''}</b>` }));
      }
      if (g.prob.steps && g.prob.steps.length) {
        const ol = h('ol', { class: 'steplist' });
        for (const st of g.prob.steps) {
          ol.appendChild(h('li', {}, [
            h('span', { class: 'sttitle', text: st.title }),
            h('span', { class: 'sthtml', html: st.html }),
          ]));
        }
        det.appendChild(ol);
      }
      rev.appendChild(det);
    });
    root.appendChild(rev);
  }

  root.appendChild(h('div', { class: 'cta' }, [
    h('button', { class: 'btn', onclick: () => { testRun = null; router(); } }, 'Build another'),
    h('a', { class: 'btn ghost', href: '#/dashboard' }, 'Dashboard'),
  ]));
}

function responseLabel(g) {
  if (!g.response) return '(blank)';
  if (g.prob.kind === 'choice') {
    const c = g.prob.choices[Number(g.response)];
    return c ? String(c.html).replace(/<[^>]+>/g, '') : '(blank)';
  }
  return g.response;
}

/* ====================================================================== sets */

function renderSets(root) {
  const p = store.activeProfile();

  root.appendChild(h('header', { class: 'pagehead' }, [
    h('h1', { text: 'Study sets' }),
    h('p', { class: 'lead', text: 'Saved selections of topics, and question sets written by your local model for anything the built-in curriculum does not cover.' }),
  ]));

  /* Build a set from topics. */
  const mk = h('section', { class: 'card' }, [h('h2', { text: 'New set from topics' })]);
  const selected = new Set();
  const nameInput = h('input', { type: 'text', class: 'textinput', placeholder: 'Set name, e.g. "Calc exam 2"' });
  const search = h('input', { type: 'search', class: 'searchbox', placeholder: 'Search topics to add' });
  const hits = h('div', { class: 'chips' });
  const chosen = h('div', { class: 'chips chosen' });

  function repaintChosen() {
    chosen.innerHTML = '';
    for (const id of selected) {
      chosen.appendChild(h('button', {
        class: 'chip on', type: 'button',
        onclick: () => { selected.delete(id); repaintChosen(); },
      }, [TOPIC_BY_ID[id].name, h('span', { class: 'x', text: '×' })]));
    }
  }
  search.addEventListener('input', () => {
    hits.innerHTML = '';
    for (const t of searchTopics(search.value).filter((x) => hasGenerator(x.id)).slice(0, 10)) {
      hits.appendChild(h('button', {
        class: 'chip', type: 'button',
        onclick: () => { selected.add(t.id); repaintChosen(); },
      }, t.name));
    }
  });
  mk.append(nameInput, search, hits, chosen, h('button', {
    class: 'btn', onclick: () => {
      if (!selected.size) { alert('Add at least one topic.'); return; }
      store.saveSet({
        name: nameInput.value.trim() || `Set of ${selected.size}`,
        topicIds: [...selected], items: [], source: 'topics',
      });
      router();
    },
  }, 'Save set'));
  root.appendChild(mk);

  /* Generate with the local model. */
  root.appendChild(aiCard(p));

  /* Existing sets. */
  if (p.sets.length) {
    const list = h('section', { class: 'card' }, [h('h2', { text: 'Your sets' })]);
    for (const s of p.sets.slice().reverse()) {
      const count = s.items && s.items.length ? s.items.length : (s.topicIds || []).length;
      const row = h('div', { class: 'setrow' }, [
        h('div', {}, [
          h('strong', { text: s.name }),
          h('span', { class: 'muted small', text: ` · ${count} ${s.items && s.items.length ? 'questions' : 'topics'}` }),
          s.source === 'ollama' ? h('span', { class: 'pill ai', text: 'AI-written' }) : null,
        ]),
        h('div', { class: 'setactions' }, [
          h('button', {
            class: 'btn small', onclick: () => {
              if (s.items && s.items.length) startSession({ pool: [], label: s.name, items: s.items, setId: s.id });
              else startSession({ pool: s.topicIds, label: s.name });
            },
          }, 'Study'),
          h('button', { class: 'linkish small danger', onclick: () => { if (confirm(`Delete "${s.name}"?`)) { store.deleteSet(s.id); router(); } } }, 'delete'),
        ]),
      ]);
      if (s.source === 'ollama') {
        row.appendChild(h('p', { class: 'muted small', text: `Written by ${s.model || 'a local model'} on ${new Date(s.created).toLocaleDateString()}. Not checked by the app: treat the answers as a second opinion, not as an answer key.` }));
      }
      list.appendChild(row);
    }
    root.appendChild(list);
  }
}

function aiCard(p) {
  const card = h('section', { class: 'card' }, [
    h('h2', { text: 'Generate questions with your local model' }),
    h('p', { class: 'muted', text: 'Runs on your own machine through Ollama. Nothing is sent anywhere, and it works offline. Use this for anything the built-in topics do not cover.' }),
  ]);

  if (!p.settings.ollamaModel) {
    card.appendChild(h('p', {}, [
      'No local model selected yet. ',
      h('a', { href: '#/settings' }, 'Set one up in Settings'),
      ', then come back.',
    ]));
    return card;
  }

  const concept = h('input', { type: 'text', class: 'textinput', placeholder: 'A concept, or a class: "Krebs cycle regulation", "Spanish preterite vs imperfect", "AP Psych unit 4"' });
  const context = h('textarea', { class: 'textinput', rows: '2', placeholder: 'Optional: anything specific, e.g. "focus on the exceptions" or paste your notes' });
  const countSel = h('select', {}, [3, 5, 8, 10, 15].map((n) => h('option', { value: String(n), selected: n === 5 }, `${n} questions`)));
  const diffSel = h('select', {}, [
    h('option', { value: '1' }, 'Introductory'),
    h('option', { value: '2', selected: true }, 'Moderate'),
    h('option', { value: '3' }, 'Challenging'),
  ]);
  const out = h('div', { class: 'genout' });
  const btn = h('button', { class: 'btn' }, 'Generate');

  btn.addEventListener('click', async () => {
    const topic = concept.value.trim();
    if (!topic) { concept.focus(); return; }
    btn.disabled = true;
    btn.textContent = 'Generating...';
    out.innerHTML = '';
    out.appendChild(h('p', { class: 'muted', text: `Asking ${p.settings.ollamaModel} on this machine. A few seconds to a minute, depending on the model.` }));
    try {
      const res = await ollama.generateQuestions(p.settings.ollamaUrl, p.settings.ollamaModel, {
        concept: topic,
        context: context.value.trim(),
        count: Number(countSel.value),
        difficulty: Number(diffSel.value),
      });
      out.innerHTML = '';
      out.appendChild(h('p', { class: 'aitag', text: `${res.items.length} question${res.items.length === 1 ? '' : 's'} written by ${res.model}. Read them before you trust them.` }));
      if (res.warnings.length) {
        out.appendChild(h('details', { class: 'warnings' }, [
          h('summary', { text: `${res.warnings.length} item(s) were dropped as unusable` }),
          h('ul', {}, res.warnings.map((w) => h('li', { text: w }))),
        ]));
      }
      const preview = h('ol', { class: 'preview' });
      for (const it of res.items) {
        preview.appendChild(h('li', {}, [
          h('div', { class: 'stem', html: it.stem }),
          h('p', { class: 'muted small', html: `Answer: ${it.kind === 'choice' ? (it.choices.find((c) => c.correct) || {}).html : it.answerHtml}` }),
        ]));
      }
      out.appendChild(preview);
      out.appendChild(h('button', {
        class: 'btn', onclick: () => {
          store.saveSet({
            name: topic.slice(0, 60), items: res.items, topicIds: [],
            source: 'ollama', model: res.model,
          });
          router();
        },
      }, 'Save as a study set'));
    } catch (err) {
      out.innerHTML = '';
      out.appendChild(h('p', { class: 'errline', text: err.message }));
      if (err.hint) out.appendChild(h('p', { class: 'muted small', text: err.hint }));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate';
    }
  });

  card.append(concept, context, h('div', { class: 'optgrid' }, [
    labelled('How many', countSel), labelled('Difficulty', diffSel),
  ]), btn, out);
  return card;
}

/* ================================================================== settings */

function renderSettings(root) {
  const s = store.getState();
  const p = store.activeProfile();

  root.appendChild(h('header', { class: 'pagehead' }, [h('h1', { text: 'Settings' })]));

  /* Profiles. */
  const prof = h('section', { class: 'card' }, [
    h('h2', { text: 'Profiles' }),
    h('p', { class: 'muted', text: 'Each profile has its own history, sets and settings. Switch between them on a shared laptop.' }),
  ]);
  for (const q of store.allProfiles()) {
    prof.appendChild(h('div', { class: `profrow${q.id === s.activeId ? ' on' : ''}` }, [
      h('span', { class: 'swatch', style: `background:${q.color}`, 'aria-hidden': 'true' }),
      h('strong', { text: q.name }),
      h('span', { class: 'muted small', text: `${q.attempts.length} attempts` }),
      q.id === s.activeId ? h('span', { class: 'pill', text: 'active' })
        : h('button', { class: 'btn small ghost', onclick: () => { store.switchProfile(q.id); router(); } }, 'switch to'),
      h('button', {
        class: 'linkish small', onclick: () => {
          const n = prompt('Profile name', q.name);
          if (n && n.trim()) { store.renameProfile(q.id, n.trim()); router(); }
        },
      }, 'rename'),
      store.allProfiles().length > 1
        ? h('button', {
          class: 'linkish small danger', onclick: () => {
            if (confirm(`Delete "${q.name}" and all of its history? This cannot be undone.`)) {
              store.removeProfile(q.id); router();
            }
          },
        }, 'delete') : null,
    ]));
  }
  prof.appendChild(h('button', {
    class: 'btn small', onclick: () => {
      const n = prompt('Name for the new profile');
      if (n && n.trim()) { store.addProfile(n.trim()); router(); }
    },
  }, 'Add a profile'));
  root.appendChild(prof);

  /* Practice preferences. */
  const prefs = h('section', { class: 'card' }, [h('h2', { text: 'How much help' })]);
  const guid = h('div', { class: 'radioset' });
  for (const [val, label, desc] of [
    ['hints', 'Guide me', 'Hints on request, escalating. The worked solution appears after you answer.'],
    ['steps', 'Show the working', 'Same, but the worked solution is open by default after every question.'],
    ['answer', 'No help', 'No hint button. Closest to exam conditions.'],
  ]) {
    const id = `g_${val}`;
    const input = h('input', { type: 'radio', name: 'guidance', id, value: val, checked: p.settings.guidance === val });
    input.addEventListener('change', () => store.setSetting('guidance', val));
    guid.appendChild(h('label', { class: 'radio', for: id }, [
      input, h('span', {}, [h('strong', { text: label }), h('span', { class: 'muted small', text: desc })]),
    ]));
  }
  prefs.appendChild(guid);

  const goal = h('input', { type: 'number', min: '5', max: '200', step: '5', value: String(p.settings.dailyGoal), class: 'textinput short' });
  goal.addEventListener('change', () => store.setSetting('dailyGoal', Math.max(1, Number(goal.value) || 20)));
  prefs.appendChild(labelled('Daily goal (questions)', goal));
  root.appendChild(prefs);

  /* Ollama. */
  root.appendChild(storageCard());

  root.appendChild(graphCard(p));

  root.appendChild(ollamaCard(p));

  /* Sync. */
  root.appendChild(syncCard(s));

  /* Data. */
  const data = h('section', { class: 'card' }, [
    h('h2', { text: 'Your data' }),
    h('p', { class: 'muted', text: 'Everything lives in this browser, plus the sync service if you turned it on. Nothing else sees it.' }),
  ]);
  data.appendChild(h('div', { class: 'cta' }, [
    h('button', {
      class: 'btn small ghost', onclick: () => {
        const blob = new Blob([store.exportJson()], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `study-backup-${new Date().toISOString().slice(0, 10)}.json` });
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
    }, 'Export a backup'),
    h('label', { class: 'btn small ghost filebtn' }, [
      'Import a backup',
      h('input', {
        type: 'file', accept: 'application/json', hidden: true,
        onchange: async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          const res = store.importJson(await f.text());
          alert(res.message);
          if (res.ok) router();
        },
      }),
    ]),
  ]));
  root.appendChild(data);
}

/* Where the Desmos key lives. Without one the graph panel uses the built-in
   plotter, which is why this is a convenience rather than a requirement. */
/* What the workspace is keeping, and a way to be rid of it. Storage that
   cannot be inspected or emptied is storage people are right not to trust. */
function storageCard() {
  const line = h('p', { class: 'small muted', text: 'Checking what is stored...' });
  const card = h('section', { class: 'card' }, [
    h('h2', { text: 'Saved work' }),
    h('p', { class: 'muted', text: 'Whiteboard strokes and photos stay on this device so '
      + 'that closing the tab does not lose them. They are never uploaded.' }),
    line,
  ]);
  const paint = () => {
    const strokeKb = Math.round(persist.strokeBytes() / 1024);
    persist.photoUsage().then((usage) => {
      line.textContent = `${usage.count} photo${usage.count === 1 ? '' : 's'} `
        + `(${Math.round(usage.bytes / 1024)}KB) and about ${strokeKb}KB of whiteboard work.`;
    });
  };
  paint();
  card.appendChild(h('div', { class: 'cta' }, [
    h('button', {
      class: 'btn small ghost', type: 'button',
      onclick: () => {
        if (!confirm('Delete saved whiteboards and photos on this device?')) return;
        persist.clearEverything().then(() => {
          persist.clearSession(store.activeProfile().id, 'workspace');
          persist.clearSession(store.activeProfile().id, 'practice');
          paint();
        });
      },
    }, 'Delete saved work'),
  ]));
  return card;
}

function graphCard(p) {
  const key = h('input', {
    class: 'textinput', type: 'text', value: p.settings.desmosKey || '',
    placeholder: 'paste your Desmos API key', 'aria-label': 'Desmos API key',
    autocomplete: 'off', spellcheck: 'false',
  });
  const status = h('p', { class: 'small muted', role: 'status' });
  const save = () => {
    store.setSetting('desmosKey', key.value.trim());
    status.textContent = key.value.trim()
      ? 'Saved. The graph panel will use Desmos from now on.'
      : 'Cleared. The graph panel uses the built-in plotter.';
  };
  return h('section', { class: 'card' }, [
    h('h2', { text: 'Graphing' }),
    h('p', { class: 'muted' }, [
      'The graph panel draws your answer against the real derivative. It works '
      + 'out of the box with a built-in plotter that needs no network. Desmos is '
      + 'better, and free for non-commercial use: get a key at ',
      h('a', { href: 'https://www.desmos.com/my-api', target: '_blank', rel: 'noreferrer' }, 'desmos.com/my-api'),
      ' and paste it here.',
    ]),
    h('div', { class: 'field' }, [h('label', { text: 'Desmos API key' }), key]),
    h('div', { class: 'cta' }, [
      h('button', { class: 'btn small', type: 'button', onclick: save }, 'Save key'),
    ]),
    status,
  ]);
}

function ollamaCard(p) {
  const card = h('section', { class: 'card' }, [
    h('h2', { text: 'Local model (Ollama)' }),
    h('p', { class: 'muted', text: 'Optional. Lets you generate questions on any topic and ask for an explanation when you miss one. It runs entirely on this machine, costs nothing and works offline.' }),
  ]);

  const urlInput = h('input', { type: 'text', class: 'textinput', value: p.settings.ollamaUrl || 'http://localhost:11434' });
  urlInput.addEventListener('change', () => store.setSetting('ollamaUrl', urlInput.value.trim()));
  card.appendChild(labelled('Ollama address', urlInput));

  const status = h('div', { class: 'ostatus' });
  const modelWrap = h('div', {});
  const testBtn = h('button', { class: 'btn small' }, 'Test the connection');

  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    status.innerHTML = '';
    status.appendChild(h('p', { class: 'muted', text: 'Looking for Ollama...' }));
    const res = await ollama.ping(urlInput.value.trim());
    status.innerHTML = '';
    modelWrap.innerHTML = '';
    if (!res.ok) {
      status.appendChild(h('p', { class: 'errline', text: res.error.message }));
      if (res.error.hint) status.appendChild(h('p', { class: 'muted small', text: res.error.hint }));
      testBtn.disabled = false;
      return;
    }
    if (!res.models.length) {
      status.appendChild(h('p', { class: 'muted', text: 'Ollama is running but has no models. Pull one first, for example: ollama pull qwen2.5:7b' }));
      testBtn.disabled = false;
      return;
    }
    status.appendChild(h('p', { class: 'okline', text: `Connected. ${res.models.length} model${res.models.length === 1 ? '' : 's'} available.` }));
    const sel = h('select', { class: 'textinput' }, [
      h('option', { value: '' }, 'None (turn the model features off)'),
      ...res.models.map((m) => h('option', { value: m.name, selected: m.name === p.settings.ollamaModel },
        `${m.name}${m.params ? ` (${m.params})` : ''}`)),
    ]);
    const advice = h('p', { class: 'muted small' });
    const updateAdvice = () => { advice.textContent = sel.value ? ollama.adviceFor(sel.value) : ''; };
    sel.addEventListener('change', () => { store.setSetting('ollamaModel', sel.value); updateAdvice(); });
    updateAdvice();
    modelWrap.append(labelled('Model to use', sel), advice);
    testBtn.disabled = false;
  });

  card.append(testBtn, status, modelWrap);

  if (p.settings.ollamaModel) {
    card.appendChild(h('p', { class: 'okline', text: `Currently using ${p.settings.ollamaModel}.` }));
  }

  card.appendChild(h('details', { class: 'help' }, [
    h('summary', { text: 'Setting this up' }),
    h('ol', {}, [
      h('li', { html: 'Install Ollama from <code>ollama.com</code> and pull a model: <code>ollama pull qwen2.5:7b</code>' }),
      h('li', {
        html: 'Let this page talk to it. Ollama blocks requests from other origins by default, so set '
          + `<code>OLLAMA_ORIGINS=${esc(location.origin)}</code> and restart it. `
          + 'On Windows that is an environment variable in System Properties; on Mac or Linux, '
          + `<code>launchctl setenv OLLAMA_ORIGINS "${esc(location.origin)}"</code> or an <code>Environment=</code> line in the systemd unit.`,
      }),
      h('li', { text: 'Click "Test the connection" above and pick a model.' }),
    ]),
    h('p', { class: 'muted small', text: 'With 16GB of VRAM, a 7B or 14B model at 4-bit is the sweet spot. Larger than about 32B will spill into system memory and crawl.' }),
  ]));

  return card;
}

function syncCard(s) {
  const card = h('section', { class: 'card' }, [
    h('h2', { text: 'Sync across devices' }),
    h('p', { class: 'muted', text: 'Optional. Puts your profiles on a small service so your laptop and phone stay in step. Use the same sync key on both.' }),
  ]);

  const keyInput = h('input', {
    type: 'text', class: 'textinput mono', value: s.sync.key || '',
    placeholder: 'Paste the key from your other device, or generate one',
    spellcheck: 'false', autocapitalize: 'characters',
  });
  keyInput.addEventListener('change', () => store.setSyncKey(keyInput.value));
  card.appendChild(labelled('Sync key', keyInput));

  const status = h('p', { class: 'muted small' });
  function paintStatus() {
    const sy = store.syncState();
    if (sy.lastError) { status.className = 'errline small'; status.textContent = sy.lastError; return; }
    status.className = 'muted small';
    if (!sy.key) { status.textContent = 'Sync is off. Everything stays in this browser.'; return; }
    const when = sy.lastPush ? new Date(sy.lastPush).toLocaleString() : 'never';
    status.textContent = `Last synced: ${when}`;
  }
  paintStatus();

  card.appendChild(h('div', { class: 'cta' }, [
    h('button', {
      class: 'btn small ghost', onclick: () => {
        if (s.sync.key && !confirm('Replace the existing key? The other device will stop syncing with this one until you give it the new key.')) return;
        const k = store.generateSyncKey();
        store.setSyncKey(k);
        keyInput.value = k;
        paintStatus();
      },
    }, 'Generate a key'),
    h('button', {
      class: 'btn small', onclick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Syncing...';
        const res = await store.syncNow();
        btn.disabled = false;
        btn.textContent = 'Sync now';
        paintStatus();
        if (res.ok) {
          status.className = 'okline small';
          status.textContent = res.added || res.updated
            ? `Synced. Pulled ${res.added} new profile(s) and updated ${res.updated}.`
            : 'Synced. Nothing new from the other device.';
          router();
        }
      },
    }, 'Sync now'),
  ]));
  card.appendChild(status);

  if (s.sync.key) {
    card.appendChild(h('details', { class: 'help' }, [
      h('summary', { text: 'Set up the other device' }),
      h('p', { text: 'Open this page there, go to Settings, and paste this key:' }),
      h('p', { class: 'keyshow mono', text: s.sync.key }),
      h('p', { class: 'muted small', text: 'Anyone with this key can read and write your study data, so treat it like a password. The service only ever stores a hash of it, never the key itself.' }),
    ]));
  }

  const auto = h('input', { type: 'checkbox', id: 'autosync', checked: s.sync.autoSync });
  auto.addEventListener('change', () => store.setAutoSync(auto.checked));
  card.appendChild(h('label', { class: 'radio', for: 'autosync' }, [
    auto, h('span', {}, [h('strong', { text: 'Sync automatically' }),
      h('span', { class: 'muted small', text: 'On load, and a few seconds after you stop answering questions.' })]),
  ]));

  return card;
}

/* ===================================================================== boot */

function mountProfileSwitcher() {
  const host = $('#profswitch');
  if (!host) return;
  const paint = () => {
    const s = store.getState();
    const p = store.activeProfile();
    host.innerHTML = '';
    const sel = h('select', { 'aria-label': 'Active profile' }, [
      ...store.allProfiles().map((q) => h('option', { value: q.id, selected: q.id === s.activeId }, q.name)),
    ]);
    sel.addEventListener('change', () => { store.switchProfile(sel.value); router(); });
    host.append(h('span', { class: 'swatch', style: `background:${p.color}`, 'aria-hidden': 'true' }), sel);
  };
  paint();
  store.subscribe(() => {
    /* Only the switcher needs repainting on every change; views repaint on
       navigation. */
    const sel = $('#profswitch select');
    const s = store.getState();
    if (sel && sel.value !== s.activeId) paint();
  });
}

let autoSyncTimer = null;

/* Push a few seconds after the last change, so a practice session results in
   one sync rather than one per question.

   The isSyncing() guard is load-bearing: syncNow writes state several times
   of its own (merged data, lastPull, lastPush) and each write notifies this
   subscriber. Without the guard, every sync would arm the next one and the
   app would sync forever on a timer. */
function scheduleAutoSync() {
  const s = store.getState();
  if (!s.sync.autoSync || !s.sync.key) return;
  if (store.isSyncing()) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    if (store.isSyncing()) return;
    store.syncNow().catch(() => { /* the status line in Settings reports it */ });
  }, 8000);
}

export function boot() {
  store.load();
  mountProfileSwitcher();
  window.addEventListener('hashchange', router);
  router();

  store.subscribe(scheduleAutoSync);
  const s = store.getState();
  if (s.sync.autoSync && s.sync.key) {
    store.syncNow().then((res) => { if (res.ok && (res.added || res.updated)) router(); }).catch(() => {});
  }

  /* Enter advances in practice even when focus has drifted off the form. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.matches('input, textarea, select, button, a')) return;
    const btn = $('#stage .answerform button[type=submit]');
    if (btn) { e.preventDefault(); btn.click(); }
  });
}

/* ===================================================================== start */

/* The landing flow. One question per screen, answers kept here so Back works
   without a route for every step, and the whole thing driven by flow.js so
   the paths can be tested without a browser. */

let flowAnswers = {};

function flowPeople() {
  return store.allProfiles().map((p) => ({ id: p.id, name: p.name, color: p.color }));
}

function renderStart(root) {
  if (needsProfileSetup()) {
    root.appendChild(profileSetupCard(() => router()));
    return;
  }
  const profiles = flowPeople();
  const names = profiles.map((p) => p.name);
  const step = flow.currentStep(flowAnswers, names);

  if (!step) {
    launch(flow.plan(flowAnswers, names), root);
    return;
  }

  const path = flow.pathFor(flowAnswers, names);
  const position = path.indexOf(step.id) + 1;

  const panel = h('section', { class: 'flowstep' });

  /* Where you are, and a way back to any earlier answer. */
  const trail = h('nav', { class: 'flowtrail', 'aria-label': 'Your answers so far' });
  for (const id of path) {
    if (id === step.id) break;
    const answered = flowAnswers[id];
    trail.appendChild(h('button', {
      class: 'linkish small',
      type: 'button',
      onclick: () => {
        flowAnswers = flow.rewind(flowAnswers, id, names);
        router();
      },
    }, answerLabel(id, answered)));
    trail.appendChild(h('span', { class: 'sep', text: '/' }));
  }
  if (path.length > 1) panel.appendChild(trail);

  /* Just the number. How many are left depends on answers not given yet, so
     a total would be a guess dressed up as a fact. */
  panel.appendChild(h('p', { class: 'flowcount', text: `Question ${position}` }));
  panel.appendChild(h('h1', { class: 'flowq', text: step.title }));

  if (step.kind === 'choice') panel.appendChild(choiceList(step, names));
  else if (step.kind === 'who') panel.appendChild(whoList(profiles));
  else if (step.kind === 'ask') panel.appendChild(askPanel(names));
  else if (step.kind === 'form') panel.appendChild(formPanel(step, names));

  const back = flow.previousStep(flowAnswers, names);
  if (back) {
    panel.appendChild(h('div', { class: 'flowback' }, [
      h('button', {
        class: 'linkish small', type: 'button',
        onclick: () => { flowAnswers = flow.rewind(flowAnswers, back, names); router(); },
      }, 'Back'),
    ]));
  }

  root.appendChild(panel);
}

/* What an answered step reads as in the trail. */
function answerLabel(id, value) {
  const step = flow.STEPS[id];
  if (!step) return id;
  if (step.options) {
    const hit = step.options.find((o) => o.value === value);
    if (hit) return hit.label;
  }
  if (id === 'who') return String(value || '');
  if (id === 'topic') return (value && value.text) ? value.text.slice(0, 28) : 'Topic';
  if (id === 'quizOptions') return `${value && value.count ? value.count : 10} questions`;
  return String(value || id);
}

/* Lettered options, the way a question on paper offers them. */
function choiceList(step, names) {
  const list = h('div', { class: 'picklist' });
  step.options.forEach((opt, i) => {
    list.appendChild(h('button', {
      class: 'pick', type: 'button',
      onclick: () => { flowAnswers = { ...flowAnswers, [step.id]: opt.value }; router(); },
    }, [
      h('span', { class: 'pickmark', text: String.fromCharCode(65 + i) }),
      h('span', { class: 'pickbody' }, [
        h('strong', { text: opt.label }),
        h('span', { class: 'pickblurb', text: opt.blurb }),
      ]),
    ]));
  });
  return list;
}

function whoList(profiles) {
  const list = h('div', { class: 'picklist' });
  profiles.forEach((p, i) => {
    list.appendChild(h('button', {
      class: 'pick', type: 'button',
      onclick: () => {
        /* Choosing here also switches the active profile, because every
           attempt from now on belongs to that person. */
        store.switchProfile(p.id);
        flowAnswers = { ...flowAnswers, who: p.name };
        router();
      },
    }, [
      h('span', { class: 'pickmark', text: String.fromCharCode(65 + i) }),
      h('span', { class: 'pickbody' }, [
        h('strong', { text: p.name }),
        h('span', { class: 'pickblurb', text: 'Your own history and schedule.' }),
      ]),
    ]));
  });
  return list;
}

/* The ask box. Type a sentence, or take a skill from the list underneath. */
function askPanel(names) {
  const wrap = h('div', { class: 'askwrap' });
  const box = h('textarea', {
    class: 'textinput asktext', rows: 3, autofocus: true,
    placeholder: 'trig derivatives, plain ones, and hint me if I am close',
    'aria-label': 'What do you want to work on',
  });
  const reading = h('p', { class: 'askreading muted small' });
  const go = h('button', { class: 'btn', type: 'button' }, 'Start');

  const accept = (text) => {
    const plan = ask.interpret(text);
    if (!plan.recognised) {
      reading.textContent = 'I did not recognise a topic in that. Pick one below, '
        + 'or name a rule like chain rule, implicit or trig.';
      return;
    }
    flowAnswers = { ...flowAnswers, topic: { text, plan } };
    router();
  };

  box.addEventListener('input', () => {
    const plan = ask.interpret(box.value);
    reading.textContent = plan.recognised
      ? `Reading that as: ${ask.describe(plan)}${plan.hints === true ? ', with hints' : ''}`
      : '';
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); accept(box.value); }
  });
  go.addEventListener('click', () => accept(box.value));

  wrap.appendChild(box);
  wrap.appendChild(reading);
  wrap.appendChild(h('div', { class: 'cta' }, [go]));

  wrap.appendChild(h('h3', { class: 'unit', text: 'Or pick one' }));
  const chips = h('div', { class: 'chips' });
  for (const s of ask.skillMenu()) {
    chips.appendChild(h('button', {
      class: 'chip', type: 'button', title: s.ask,
      onclick: () => {
        flowAnswers = {
          ...flowAnswers,
          topic: { text: s.name, plan: ask.interpret(s.name) },
        };
        router();
      },
    }, s.name));
  }
  wrap.appendChild(chips);
  return wrap;
}

/* The quiz settings: how many, how long, and whether part marks count. */
function formPanel(step, names) {
  const wrap = h('div', { class: 'formpanel' });
  const values = {};
  for (const f of step.fields) {
    values[f.name] = f.value;
    if (f.type === 'toggle') {
      const id = `f_${f.name}`;
      const input = h('input', { type: 'checkbox', id, checked: f.value });
      input.addEventListener('change', () => {
        values[f.name] = input.checked;
        note.textContent = input.checked ? f.on : f.off;
      });
      const note = h('span', { class: 'pickblurb', text: f.value ? f.on : f.off });
      wrap.appendChild(h('label', { class: 'radio', for: id }, [
        input,
        h('span', {}, [h('strong', { text: f.label }), note]),
      ]));
    } else {
      const input = h('input', {
        class: 'textinput short', type: 'number', min: f.min, max: f.max,
        step: f.step, value: f.value,
      });
      input.addEventListener('input', () => { values[f.name] = Number(input.value); });
      wrap.appendChild(h('div', { class: 'field' }, [
        h('label', { text: f.label }),
        input,
        f.hint ? h('span', { class: 'pickblurb', text: f.hint }) : null,
      ]));
    }
  }
  wrap.appendChild(h('div', { class: 'cta' }, [
    h('button', {
      class: 'btn', type: 'button',
      onclick: () => {
        flowAnswers = { ...flowAnswers, [step.id]: values };
        router();
      },
    }, 'Start the quiz'),
  ]));
  return wrap;
}

/* The flow is finished: open the screen it asked for. */
function launch(plan, root) {
  if (!plan) { root.appendChild(h('p', { text: 'Nothing to start.' })); return; }

  /* Anything with two people in it belongs in the workspace, whatever they
     picked afterwards. On the same problem, that is where the shared board
     and the shared question live. Side by side, it is where your own board
     gets published so the other person can look in when you ask for help -
     which was the entire point of choosing to sit together. Sending either
     to the solo practice view was a dead end: two people who chose to work
     together got two unconnected screens. */
  if (plan.shared || plan.sideBySide) { startWorkspace(plan); return; }

  if (plan.mode === 'practice') {
    startSession({
      label: plan.label || 'Practice',
      sandbox: plan.skills.length
        ? { skills: plan.skills, level: plan.level, hints: plan.hints }
        : null,
      pool: plan.topicIds && plan.topicIds.length ? plan.topicIds : null,
    });
    return;
  }

  if (plan.mode === 'quiz') { startQuiz(plan); return; }

  /* Homework, and anything with two people in it, opens the workspace: the
     problem, a board, a graph and the photos you are working from. */
  startWorkspace(plan);
}

/* ============================================================== mistakes */

/* What keeps going wrong. The grader already works this out for every wrong
   answer; this is the first place it is remembered rather than shown once
   and forgotten. */
function mistakesCard(p) {
  const rows = mistakes.summarize(p.attempts).filter((r) => r.count >= mistakes.PATTERN_FLOOR);
  const teachable = rows.filter((r) => r.teachable);
  if (!teachable.length) {
    /* Nothing to say yet, and saying it anyway would be noise. A notation
       problem is worth raising on its own though, because the fix is
       different: it is how you are typing, not what you know. */
    const notation = rows.find((r) => r.kind === 'unreadable');
    if (!notation) return h('div', { hidden: true });
    return h('section', { class: 'card' }, [
      h('p', { class: 'eyebrow', text: 'Worth knowing' }),
      h('h2', { text: 'Some answers could not be read' }),
      h('p', { text: `${notation.count} of your recent answers could not be parsed, which is a `
        + 'notation problem rather than a maths one. Check brackets, and write a product as 2*x or 2x.' }),
    ]);
  }

  /* The heading used to repeat the first row word for word. The list says
     it better, with the count attached. */
  const card = h('section', { class: 'card' }, [
    h('h2', { text: 'What keeps going wrong' }),
    h('p', { class: 'muted', text: teachable.length > 1
      ? 'The same slips, most often first. Each one has a drill aimed at it.'
      : 'One thing is going wrong more than once. There is a drill for it.' }),
  ]);

  const list = h('ul', { class: 'mistakelist' });
  for (const row of teachable.slice(0, 4)) {
    const drill = mistakes.drillFor(row);
    list.appendChild(h('li', {}, [
      h('span', { class: 'mistakecount', text: String(row.count) }),
      h('span', { class: 'mistakebody' }, [
        h('strong', { text: row.label }),
        h('span', { class: 'pickblurb', text: row.detail }),
      ]),
      drill
        ? h('button', {
          class: 'btn small ghost', type: 'button',
          onclick: () => startSession({
            label: drill.label,
            sandbox: { skills: drill.skills, level: drill.level, hints: drill.hints },
          }),
        }, 'Drill it')
        : null,
    ]));
  }
  card.appendChild(list);
  card.appendChild(h('p', { class: 'small muted', text:
    `Counted over your last ${Math.min(p.attempts.length, 120)} answers. `
    + `Anything under ${mistakes.PATTERN_FLOOR} is left out, because it is not a pattern yet.` }));
  return card;
}

/* ================================================================= profiles */

/* A fresh install has one profile called "Me", which is a fine default for
   one person and the wrong thing for two. Offer the setup once, and never
   nag: if it is dismissed, or either name is filled in, it does not come
   back. */
function needsProfileSetup() {
  const all = store.allProfiles();
  if (all.length > 1) return false;
  if (store.getState().settings && store.getState().settings.setupDone) return false;
  const only = all[0];
  return !!only && only.name === 'Me' && only.attempts.length === 0;
}

function profileSetupCard(onDone) {
  const first = h('input', { class: 'textinput', type: 'text', placeholder: 'Carter', 'aria-label': 'First name' });
  const second = h('input', { class: 'textinput', type: 'text', placeholder: 'Lilly', 'aria-label': 'Second name' });

  const save = () => {
    const a = first.value.trim();
    const b = second.value.trim();
    const all = store.allProfiles();
    if (a) store.renameProfile(all[0].id, a);
    if (b) store.addProfile(b);
    /* Switch back to the first person, since whoever is setting this up is
       almost certainly the first name they typed. */
    if (a) store.switchProfile(store.allProfiles()[0].id);
    store.markSetupDone();
    onDone();
  };

  return h('section', { class: 'flowstep' }, [
    h('p', { class: 'flowcount', text: 'First time here' }),
    h('h1', { class: 'flowq', text: 'Who studies here?' }),
    h('p', { class: 'pickblurb', text: 'Each person gets their own history, schedule and mastery. '
      + 'You can add or rename people later in Settings.' }),
    h('div', { class: 'setupgrid' }, [
      h('div', { class: 'field' }, [h('label', { text: 'Person one' }), first]),
      h('div', { class: 'field' }, [h('label', { text: 'Person two (optional)' }), second]),
    ]),
    h('div', { class: 'cta' }, [
      h('button', { class: 'btn', type: 'button', onclick: save }, 'Save'),
      h('button', {
        class: 'linkish small', type: 'button',
        onclick: () => { store.markSetupDone(); onDone(); },
      }, 'Skip for now'),
    ]),
  ]);
}

/* ========================================================= the math keys */

/* A row of the characters a phone keyboard buries.

   Typing 6*x*cos(3*x^2) on a touch keyboard means switching layers for the
   star, the caret and the brackets, four times each. On a laptop this would
   be clutter, so it only appears for a coarse pointer, which is also what
   catches a tablet with a pen.

   Keys insert at the cursor rather than appending, because people do go back
   and fix a bracket. */
const MATH_KEYS = [
  { label: 'x', insert: 'x' },
  { label: '( )', insert: '()', back: 1 },
  { label: 'x²', insert: '^2' },
  { label: '^', insert: '^' },
  { label: '×', insert: '*' },
  { label: '÷', insert: '/' },
  { label: '√', insert: 'sqrt()', back: 1 },
  { label: 'π', insert: 'pi' },
  { label: 'sin', insert: 'sin()', back: 1 },
  { label: 'cos', insert: 'cos()', back: 1 },
  { label: 'tan', insert: 'tan()', back: 1 },
  { label: 'ln', insert: 'ln()', back: 1 },
  { label: 'eˣ', insert: 'e^' },
];

function touchDevice() {
  return typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(pointer: coarse)').matches;
}

function mathKeys(input) {
  if (!touchDevice()) return null;
  const row = h('div', { class: 'mathkeys', role: 'group', 'aria-label': 'Maths keys' });
  for (const key of MATH_KEYS) {
    row.appendChild(h('button', {
      class: 'mathkey', type: 'button', tabindex: '-1',
      /* Keeping focus in the field means the caret does not jump to the end
         and the on-screen keyboard does not flap shut between taps. */
      onmousedown: (e) => e.preventDefault(),
      onclick: () => {
        const start = input.selectionStart == null ? input.value.length : input.selectionStart;
        const end = input.selectionEnd == null ? start : input.selectionEnd;
        const before = input.value.slice(0, start);
        const after = input.value.slice(end);
        input.value = before + key.insert + after;
        const caret = start + key.insert.length - (key.back || 0);
        input.setSelectionRange(caret, caret);
        input.focus();
        /* So the parse echo updates as though it had been typed. */
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
    }, key.label));
  }
  return row;
}

/* What a progress check calls each state, in words rather than a colour. */
function trackLabel(state) {
  return {
    right: 'That is it.',
    partway: 'Part of it is right.',
    close: 'Close.',
    off: 'Not yet.',
    unreadable: 'I cannot read that.',
    empty: 'Where to start.',
  }[state] || '';
}

/* ======================================================== the parse echo */

/* Show what the grader READ, under the box, as it is typed.

   The worst thing a grader can do is not mark you wrong; it is mark you
   wrong because it misread you. The engine already refuses to guess at
   ambiguous input, but until now you only found that out by submitting. The
   echo makes the reading visible while there is still time to fix it: type
   1/2x and see one half times x, which is the reading, and add brackets if
   you meant something else.

   It also quietly teaches the notation. After a few problems you know that
   3x and 3*x are the same and that sin 2x needs brackets, without anyone
   having written a help page about it. */
function attachEcho(input, problem) {
  const echo = h('p', { class: 'echo', 'aria-live': 'polite' });
  const variable = problem && problem.variable ? problem.variable : 'x';
  const allowed = problem && problem.kind === 'expression' && problem.implicit
    ? [variable, 'y'] : null;

  const paint = () => {
    const raw = input.value;
    /* An integral answer may legitimately end in + C, which is not part of
       the expression and must not be read as a stray variable. */
    const text = problem && problem.kind === 'antiderivative'
      ? Expr.stripPlusC(raw) : raw;
    if (!String(text).trim()) {
      echo.className = 'echo';
      echo.innerHTML = '';
      return;
    }
    const node = Expr.tryParse(text, allowed ? { vars: allowed } : null);
    if (!node) {
      echo.className = 'echo bad';
      /* The parser's own words, which name the actual problem - an unclosed
         bracket, a function without brackets - rather than a generic moan. */
      echo.textContent = Expr.parseMessage(text, allowed ? { vars: allowed } : null)
        || 'I cannot read that yet.';
      return;
    }
    echo.className = 'echo ok';
    echo.innerHTML = `<span class="echolabel">reads as</span> ${Expr.html(node)}`
      + (problem && problem.kind === 'antiderivative' && /\+\s*c\s*$/i.test(raw)
        ? ' <span class="echolabel">+ C</span>' : '');
  };

  input.addEventListener('input', paint);
  paint();
  return echo;
}

/* A saved test item, which may be either shape.

   Mock tests have always stored {topicId, difficulty, seed}. A finished quiz
   stores the newer description, which can also name a sandbox skill. Reading
   both here means an old saved test keeps working and a quiz can be reopened
   at all, rather than rebuilding as a row of nulls. */
function rebuildSavedItem(it) {
  if (!it) return null;
  if (it.source) return rebuildProblem(it);
  return generate(it.topicId, it.difficulty, it.seed);
}

/* Rebuild a problem from the few fields that describe it. Seeds make this
   exact rather than approximate: you come back to the same question, not a
   similar one. */
function rebuildProblem(d) {
  if (!d) return null;
  try {
    if (d.source === 'typed') return problemFromText(d.text);
    if (d.source === 'sandbox') {
      return buildProblem({ skills: [d.skill], level: d.level }, d.seed);
    }
    return generate(d.topicId, d.level, d.seed);
  } catch (err) {
    return null;
  }
}

/* ================================================================ workspace */

/* The room where the work happens: the problem, a board to work it out on, a
   graph to check it against, and the photos you are working from. Used by
   homework help and by a session with two people in it.

   The panels are built lazily. A canvas that is never looked at should not
   cost anything, and Desmos should not be fetched until a graph is asked
   for. */

let workspace = null;

function saveWorkspace() {
  if (!workspace) return;
  /* Both people should be looking at the same question. Sent as a seed, so
     the other device rebuilds it rather than being handed a rendered one. */
  if (liveRoom && workspace.problem) {
    liveRoom.problem(persist.describeProblem(workspace.problem));
  }
  persist.saveSession(store.activeProfile().id, 'workspace', {
    plan: workspace.plan,
    panel: workspace.panel,
    problem: persist.describeProblem(workspace.problem),
    lastAnswer: workspace.lastAnswer || '',
  });
}

function startWorkspace(plan) {
  /* A session that named a topic should open with a question on it rather
     than an empty board and a shrug. */
  let opening = null;
  if (plan.skills && plan.skills.length) {
    for (let i = 0; i < 12 && !opening; i++) {
      opening = buildProblem({ skills: plan.skills, level: plan.level || 2 }, freshSeed());
    }
  }
  workspace = {
    plan,
    problem: opening,
    panel: plan.mode === 'practice' || plan.mode === 'quiz' ? 'board' : 'photos',
    board: null,
    graph: null,
    shelf: null,
    lastAnswer: '',
  };
  saveWorkspace();
  const before = location.hash;
  go('workspace');
  if (location.hash === before) router();
}

function darkNow() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/* The shared session, when there is one. Held outside the workspace object
   so a re-render does not drop the connection and start another. */
let liveRoom = null;
let roomStatus = { state: 'offline', detail: '' };

function leaveRoom() {
  if (liveRoom) liveRoom.leave();
  liveRoom = null;
  roomStatus = { state: 'offline', detail: '' };
}

function ensureRoom() {
  if (!workspace || liveRoom) return;
  /* Shared means one board between two people. Side by side means each has
     their own, published so the other can look in when asked for help -
     which is the whole point of sitting next to somebody. */
  const name = workspace.plan.shared ? workspace.plan.room : workspace.plan.ownRoom;
  if (!name) return;
  const endpoint = store.syncEndpoint();
  if (!endpoint) return;
  liveRoom = room.joinRoom(endpoint, name, workspace.plan.who, {
    onStatus: (state, detail) => {
      roomStatus = { state, detail: detail || '' };
      const line = $('#roomline');
      if (line) paintRoomLine(line);
    },
    onHello: (msg) => {
      /* Only a SHARED room hands you its board and question. Your own room
         in side-by-side mode is something you publish, not something that
         reaches back and rearranges your screen. */
      if (!workspace.plan.shared) return;
      if (workspace.board && msg.strokes && msg.strokes.length) {
        for (const s of msg.strokes) workspace.board.apply(s);
      }
      if (msg.problem && !workspace.problem) {
        const rebuilt = rebuildProblem(msg.problem);
        if (rebuilt) { workspace.problem = rebuilt; router(); }
      }
    },
    onStroke: (s) => { if (workspace.plan.shared && workspace.board) workspace.board.apply(s); },
    onErase: (id) => { if (workspace.plan.shared && workspace.board) workspace.board.apply({ id, dead: true, points: [] }); },
    onClear: () => { if (workspace.plan.shared && workspace.board) workspace.board.clear(); },
    onProblem: (description) => {
      if (!workspace.plan.shared) return;
      const rebuilt = rebuildProblem(description);
      if (!rebuilt) return;
      workspace.problem = rebuilt;
      workspace.lastAnswer = '';
      saveWorkspace();
      router();
    },
  });
}

function paintRoomLine(line) {
  line.innerHTML = '';
  const { state, detail } = roomStatus;
  const sideBySide = workspace && workspace.plan.sideBySide;
  line.appendChild(h('span', {
    class: `pill ${state === 'connected' ? 'ai' : 'warn'}`,
    text: state === 'connected' ? (sideBySide ? 'shared' : 'together')
      : state === 'connecting' ? 'connecting' : 'offline',
  }));
  /* Side by side is your OWN board, published. "Nobody else here yet" would
     be describing a room that is not supposed to have anybody else in it. */
  const names = workspace && workspace.plan.others
    ? workspace.plan.others.map((o) => o.name).join(' and ') : '';
  line.appendChild(h('span', {
    class: 'small muted',
    text: sideBySide
      ? (state === 'connected'
        ? ` Your board is visible to ${names || 'the other device'} if they look in.`
        : ' Working on this device only.')
      : ` ${detail || ''}`,
  }));
  if (liveRoom && liveRoom.pending) {
    line.appendChild(h('span', { class: 'small muted', text: ` ${liveRoom.pending} waiting to send.` }));
  }
}

function renderWorkspace(root) {
  if (!workspace) {
    /* A reload empties the page but not the record of what you were doing.
       Rebuilding from the description is what makes closing the tab by
       accident survivable. */
    const saved = persist.loadSession(store.activeProfile().id, 'workspace');
    if (saved && saved.plan) {
      workspace = {
        plan: saved.plan,
        problem: rebuildProblem(saved.problem),
        panel: saved.panel || 'board',
        board: null,
        graph: null,
        shelf: null,
        lastAnswer: saved.lastAnswer || '',
        restored: true,
      };
    }
  }
  if (!workspace) {
    root.appendChild(h('section', { class: 'card' }, [
      h('h1', { text: 'Nothing open' }),
      h('p', { text: 'Start from the front page and it will bring you back here.' }),
      h('div', { class: 'cta' }, [h('a', { class: 'btn', href: '#/start' }, 'Start')]),
    ]));
    return;
  }
  const plan = workspace.plan;

  root.appendChild(h('div', { class: 'sessionbar' }, [
    h('div', {}, [
      h('strong', { text: workspaceTitle(plan) }),
      h('span', { class: 'muted', text: ` · ${plan.who}` }),
    ]),
    h('div', { class: 'tbarright' }, [
      h('button', {
        class: 'btn small ghost', type: 'button',
        onclick: () => {
          persist.clearSession(store.activeProfile().id, 'workspace');
          closePeek();
          leaveRoom();
          workspace = null;
          flowAnswers = {};
          go('start');
        },
      }, 'Finish'),
    ]),
  ]));

  if (plan.shared || plan.sideBySide) {
    const endpoint = store.syncEndpoint();
    if (endpoint) {
      ensureRoom();
      const line = h('div', { class: 'roomline', id: 'roomline' });
      paintRoomLine(line);
      root.appendChild(line);
    } else {
      root.appendChild(h('div', { class: 'caveat' }, [
        h('strong', { text: 'One device for now. ' }),
        'The board works here, but the other device cannot join until the sync '
        + 'service is deployed from study_api/ and its address is set in Settings.',
      ]));
    }
  }

  /* Looking in on the other person, when you are working side by side. */
  if (plan.sideBySide && plan.others && plan.others.length && store.syncEndpoint()) {
    const row = h('div', { class: 'cta peekrow' });
    for (const person of plan.others) {
      row.appendChild(h('button', {
        class: 'btn small ghost', type: 'button',
        onclick: () => {
          const panel = openPeek(person);
          if (panel) root.appendChild(panel);
        },
      }, `Look in on ${person.name}`));
    }
    root.appendChild(row);
  }

  /* The problem, when there is one. */
  const problemSlot = h('div', { class: 'wsproblem' });
  root.appendChild(problemSlot);
  paintWorkspaceProblem(problemSlot);

  /* The panels. */
  const tabs = h('div', { class: 'tabstrip', role: 'tablist' });
  const body = h('div', { class: 'tabbody' });
  const PANELS = [
    { id: 'board', label: 'Whiteboard' },
    { id: 'graph', label: 'Graph' },
    { id: 'photos', label: 'Photos' },
  ];
  for (const panel of PANELS) {
    tabs.appendChild(h('button', {
      class: `tab${workspace.panel === panel.id ? ' on' : ''}`,
      type: 'button', role: 'tab',
      'aria-selected': workspace.panel === panel.id ? 'true' : 'false',
      onclick: () => { workspace.panel = panel.id; saveWorkspace(); router(); },
    }, panel.label));
  }
  root.appendChild(h('section', { class: 'card wspanels' }, [tabs, body]));

  if (workspace.panel === 'board') mountBoard(body);
  else if (workspace.panel === 'graph') mountGraph(body);
  else mountPhotos(body);
}

function workspaceTitle(plan) {
  if (plan.mode === 'homework-walkthrough') return 'Homework help';
  if (plan.mode === 'homework-extra') return 'More like your homework';
  if (plan.shared) return 'Working together';
  if (plan.sideBySide) return 'Side by side';
  return plan.label || 'Workspace';
}

/* ------------------------------------------------------------ the problem */

function paintWorkspaceProblem(slot) {
  slot.innerHTML = '';
  const problem = workspace.problem;
  if (!problem) {
    slot.appendChild(h('section', { class: 'card' }, [
      h('p', { class: 'eyebrow', text: 'No problem loaded' }),
      h('p', { text: workspace.plan.mode === 'homework-walkthrough'
        ? 'Add a photo of the page, type what it says underneath it, and press Use this.'
        : 'Type a function in the Photos panel, or pick a topic to generate one.' }),
      h('div', { class: 'cta' }, [
        h('button', {
          class: 'btn small ghost', type: 'button',
          onclick: () => { workspace.panel = 'photos'; router(); },
        }, 'Open photos'),
        h('button', {
          class: 'btn small ghost', type: 'button',
          onclick: () => {
            const made = buildProblem({ skills: ['chain', 'trig', 'product'], level: 2 }, freshSeed());
            if (made) { workspace.problem = made; saveWorkspace(); router(); }
          },
        }, 'Give me one'),
      ]),
    ]));
    return;
  }

  const card = h('section', { class: 'card problem' });
  card.appendChild(h('div', { class: 'ptop' }, [
    h('span', { class: 'ptopic', text: problem.topicName || 'Your problem' }),
    problem.fromPhoto ? h('span', { class: 'pill', text: 'from your page' }) : null,
  ]));
  card.appendChild(h('div', { class: 'stem', html: problem.stem }));

  const input = h('input', {
    type: 'text', class: 'answerinput', autocomplete: 'off', spellcheck: 'false',
    placeholder: inputHint(problem), value: workspace.lastAnswer || '',
    'aria-label': 'Your answer',
  });
  const expressionish = ['expression', 'antiderivative', 'factored', 'expanded']
    .includes(problem.kind);
  const keys = expressionish ? mathKeys(input) : null;
  const echo = expressionish ? attachEcho(input, problem) : null;
  const feedback = h('div', { class: 'wsfeedback' });

  const check = () => {
    workspace.lastAnswer = input.value;
    saveWorkspace();
    const res = grade(problem, input.value);
    feedback.innerHTML = '';
    feedback.appendChild(h('div', {
      class: `feedback ${res.correct ? 'good' : res.decided === false ? 'warn' : 'bad'}`,
    }, [
      h('strong', { text: res.correct ? 'That works' : res.decided === false ? 'Cannot check that one' : 'Not quite' }),
      res.detail ? h('p', { class: 'small', text: res.detail }) : null,
      !res.correct && problem.answerHtml
        ? h('p', { html: `The answer is <strong>${problem.answerHtml}</strong>` })
        : null,
    ]));
    /* A wrong answer is exactly when the picture helps most. */
    if (!res.correct && workspace.panel === 'graph') mountGraph($('.tabbody'));
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });

  card.appendChild(h('div', { class: 'answerform' }, [
    input,
    keys,
    echo,
    h('div', { class: 'cta' }, [
      h('button', { class: 'btn', type: 'button', onclick: check }, 'Check'),
      ['expression', 'antiderivative', 'factored', 'expanded'].includes(problem.kind)
        ? h('button', {
          class: 'btn ghost', type: 'button',
          onclick: () => {
            const where = onTrack(problem, input.value);
            feedback.innerHTML = '';
            feedback.appendChild(h('div', { class: `feedback track ${where.state}` }, [
              h('strong', { text: trackLabel(where.state) }),
              h('p', { text: where.message }),
            ]));
          },
        }, 'Am I on track?')
        : null,
      h('button', {
        class: 'btn ghost', type: 'button',
        onclick: () => {
          workspace.panel = 'graph';
          workspace.lastAnswer = input.value;
          router();
        },
      }, 'See it graphed'),
      problem.steps && problem.steps.length
        ? h('button', {
          class: 'btn ghost', type: 'button',
          onclick: () => {
            feedback.innerHTML = '';
            feedback.appendChild(stepsBlock(problem));
          },
        }, 'Walk me through it')
        : null,
      /* Two people working something out on a board need to be able to
         agree to just look, without one of them having to guess wrong
         first to see it. */
      h('button', {
        class: 'btn ghost', type: 'button',
        onclick: () => {
          feedback.innerHTML = '';
          feedback.appendChild(h('div', { class: 'feedback' }, [
            h('strong', { text: 'The answer' }),
            h('p', { html: problem.answerHtml || '' }),
            h('p', { class: 'small muted', text: 'Nothing is recorded when you '
              + 'reveal it, so this does not count against anybody.' }),
          ]));
        },
      }, 'Reveal the answer'),
      workspace.plan.mode !== 'homework-walkthrough'
        ? h('button', {
          class: 'btn ghost', type: 'button',
          onclick: () => {
            const next = similarProblem(problem);
            if (next) {
              workspace.problem = next;
              workspace.lastAnswer = '';
              saveWorkspace();
              router();
            }
          },
        }, 'Another like it')
        : null,
    ]),
    feedback,
  ]));

  slot.appendChild(card);
}

function stepsBlock(problem) {
  const list = h('ol', { class: 'steps' });
  for (const step of problem.steps || []) {
    list.appendChild(h('li', {}, [
      h('span', { class: 'steptitle', text: step.title }),
      h('div', { class: 'stepbody', html: step.html }),
    ]));
  }
  return h('div', { class: 'explain' }, [
    h('p', { class: 'eyebrow', text: 'How to get there' }),
    list,
  ]);
}

/* Another problem of the same shape, which is the "more like these" ask. */
function similarProblem(problem) {
  const skill = problem.skill || 'chain';
  for (let i = 0; i < 12; i++) {
    const made = buildProblem({ skills: [skill], level: problem.difficulty || 2 }, freshSeed());
    if (made && made.stem !== problem.stem) return made;
  }
  return null;
}

/* --------------------------------------------------------------- the board */

function mountBoard(body) {
  body.innerHTML = '';
  const canvas = h('canvas', { class: 'boardcanvas', 'aria-label': 'Whiteboard' });
  const tools = h('div', { class: 'boardtools' });
  body.appendChild(tools);
  body.appendChild(canvas);
  const penGroup = h('div', { class: 'toolgroup' });
  const inkGroup = h('div', { class: 'toolgroup' });
  const actGroup = h('div', { class: 'toolgroup' });

  /* Scoped to the person and the problem, so the working out you did for
     THIS question comes back with it rather than one board smeared across
     everything. */
  const key = persist.workspaceKey(
    store.activeProfile().id,
    workspace.problem ? workspace.problem.key : 'scratch',
  );
  const api = board.createBoard(canvas, {
    author: workspace.plan.who || 'me',
    dark: darkNow(),
    /* Saving on every stroke is affordable because strokes are small and
       localStorage is synchronous. No debounce, no lost work. */
    onChange: (stroke, kind) => {
      persist.saveStrokes(key, api.strokes);
      /* The board is the source of truth locally; the room is a copy, so a
         dropped connection never stops anybody drawing. */
      if (!liveRoom) return;
      if (kind === 'stroke' && stroke) liveRoom.stroke(stroke);
      else if (kind === 'erase' && stroke) liveRoom.erase(stroke.id);
      else if (kind === 'clear') liveRoom.clear();
    },
  });
  workspace.board = api;
  const saved = persist.loadStrokes(key);
  if (saved.length) {
    api.load(saved);
    body.appendChild(h('p', { class: 'small muted restored' },
      `${saved.length} stroke${saved.length === 1 ? '' : 's'} restored from last time.`));
  }

  const toolButton = (id, label) => {
    const btn = h('button', {
      class: `chip${api.tool() === id ? ' on' : ''}`, type: 'button',
      onclick: () => {
        api.setTool(id);
        for (const other of tools.querySelectorAll('.chip[data-tool]')) {
          other.classList.toggle('on', other.dataset.tool === id);
        }
      },
      dataset: { tool: id },
    }, label);
    return btn;
  };
  penGroup.appendChild(toolButton('pen', 'Pen'));
  penGroup.appendChild(toolButton('marker', 'Highlighter'));
  penGroup.appendChild(toolButton('eraser', 'Eraser'));
  tools.appendChild(penGroup);

  for (const colour of board.BOARD_COLORS) {
    const swatch = h('button', {
      class: `inkdot${api.color() === colour.id ? ' on' : ''}`, type: 'button',
      title: colour.label, 'aria-label': colour.label,
      dataset: { ink: colour.id },
      onclick: () => {
        api.setColor(colour.id);
        for (const other of tools.querySelectorAll('.inkdot')) {
          other.classList.toggle('on', other.dataset.ink === colour.id);
        }
      },
    });
    swatch.style.background = darkNow() ? colour.dark : colour.light;
    inkGroup.appendChild(swatch);
  }
  tools.appendChild(inkGroup);

  actGroup.appendChild(h('button', {
    class: 'linkish small', type: 'button', onclick: () => api.undo(),
  }, 'Undo'));
  actGroup.appendChild(h('button', {
    class: 'linkish small danger', type: 'button',
    onclick: () => { api.clear(); persist.clearStrokes(key); },
  }, 'Clear'));
  /* On a phone the board is otherwise a letterbox. Full screen makes it the
     whole screen, which is the only size worth writing on. The Fullscreen
     API is not used because on iOS Safari it does not apply to arbitrary
     elements. */
  actGroup.appendChild(h('button', {
    class: 'linkish small', type: 'button',
    onclick: (e) => {
      const panels = e.target.closest('.wspanels');
      if (!panels) return;
      const full = panels.classList.toggle('full');
      e.target.textContent = full ? 'Exit full screen' : 'Full screen';
      /* The canvas just changed size, so its backing store has to follow or
         the next stroke lands in the wrong place. */
      requestAnimationFrame(() => api.resize());
    },
  }, 'Full screen'));
  tools.appendChild(actGroup);
}

/* --------------------------------------------------------------- the graph */

function mountGraph(body) {
  body.innerHTML = '';
  const note = h('p', { class: 'small muted', text: 'Loading the graph...' });
  const host = h('div', { class: 'graphhost' });
  body.appendChild(host);
  body.appendChild(note);

  const problem = workspace.problem;
  graph.createGraph(host, { dark: darkNow(), key: store.activeProfile().settings.desmosKey })
    .then((api) => {
      workspace.graph = api;
      const series = problem
        ? graph.derivativeSeries(problem, workspace.lastAnswer)
        : [];
      if (!series.length) {
        note.textContent = 'Load a problem and your answer appears here against the real derivative.';
        return;
      }
      api.setFunctions(series);
      const names = series.map((s) => s.label).join(', ');
      note.innerHTML = '';
      note.appendChild(h('span', { text: `Showing ${names}. ` }));
      if (series.some((s) => s.role === 'yours')) {
        note.appendChild(h('span', {
          text: 'If your answer is right, the dashed line sits exactly on the solid one.',
        }));
      } else {
        note.appendChild(h('span', { text: 'Type an answer and it joins the picture, dashed.' }));
      }
      note.appendChild(h('span', {
        class: 'pill', style: 'margin-left:8px',
        text: api.kind === 'desmos' ? 'Desmos' : 'built-in plotter',
      }));
      if (api.kind !== 'desmos') {
        note.appendChild(h('p', { class: 'small muted' }, [
          'This is the built-in plotter, which needs no network. For the full '
          + 'Desmos calculator, put a free key from ',
          h('a', { href: 'https://www.desmos.com/my-api', target: '_blank', rel: 'noreferrer' }, 'desmos.com/my-api'),
          ' into Settings.',
        ]));
      }
    });
}

/* -------------------------------------------------------------- the photos */

function mountPhotos(body) {
  body.innerHTML = '';
  /* Look for a vision model in the background. The panel works without one;
     finding one just adds the Read it button on the next repaint. */
  if (!visionState.checked) {
    refreshVision().then((state) => {
      if ((state.model || state.relay) && workspace && workspace.panel === 'photos') router();
    });
  } else if (visionState.relay && !visionState.model) {
    body.appendChild(h('p', { class: 'small muted' },
      'Reading a photo here uses the model on the other computer, through the '
      + 'relay. It only works while that machine is awake.'));
  }
  const mount = h('div', {});
  body.appendChild(mount);

  const photoKey = persist.workspaceKey(store.activeProfile().id, 'shelf');
  workspace.shelf = photo.createShelf({
    h,
    mount,
    /* A photo is too big for localStorage - one downscaled phone picture is
       about 300KB and the whole origin gets around 5MB - so the shelf is
       kept in IndexedDB and handed back when the panel reopens. */
    restore: () => persist.loadPhotos(photoKey),
    /* Only offered when a model that can actually see is installed. A button
       that always fails is worse than no button. */
    onRead: ollamaVisionReady() ? (item) => readPhoto(item) : null,
    onAdd: (item) => persist.savePhoto(photoKey, item),
    onRemove: (item) => persist.deletePhoto(item.id),
    onUse: (item, text) => {
      const made = problemFromText(text);
      if (!made) {
        alert('I could not read that as a function. Try something like sin(3x^2) or x^2*e^(5x).');
        return;
      }
      made.fromPhoto = true;
      workspace.problem = made;
      workspace.lastAnswer = '';
      saveWorkspace();
      router();
    },
  });

  mount.appendChild(h('div', { class: 'typedrow' }, [
    h('p', { class: 'eyebrow', text: 'Or just type it' }),
    (() => {
      const box = h('input', {
        class: 'textinput math', type: 'text',
        placeholder: 'sin(3x^2)', 'aria-label': 'Type the function',
      });
      const go2 = h('button', { class: 'btn small', type: 'button' }, 'Use this');
      go2.addEventListener('click', () => {
        const made = problemFromText(box.value);
        if (!made) { alert('I could not read that as a function.'); return; }
        workspace.problem = made;
        workspace.lastAnswer = '';
        saveWorkspace();
        router();
      });
      return h('div', { class: 'shelfrow' }, [box, go2]);
    })(),
  ]));
}

/* ---------------------------------------------------------- reading a page */

/* Whether this browser has a local model that can look at a picture. Checked
   once per load and remembered, because asking Ollama on every render would
   be a request per keystroke-ish repaint. */
let visionState = { checked: false, model: '', relay: false };

function ollamaVisionReady() {
  /* Either this machine can read a picture, or the other one can and is
     awake. A phone will never have a model of its own. */
  return !!visionState.model || visionState.relay;
}

async function refreshVision() {
  if (visionState.checked) return visionState;
  visionState.checked = true;
  const p = store.activeProfile();
  try {
    const models = await ollama.visionModels(p.settings.ollamaUrl);
    visionState.model = models.length ? models[0].name : '';
  } catch (err) {
    visionState.model = '';
  }
  if (!visionState.model) {
    /* No model here. Is one listening on the other side of the relay? */
    const status = await room.relayStatus(store.syncEndpoint());
    visionState.relay = !!(status && status.bridge);
  }
  return visionState;
}

async function readPhoto(item) {
  const p = store.activeProfile();
  if (visionState.model) {
    const text = await ollama.readImage(p.settings.ollamaUrl, visionState.model, item.dataUrl);
    return ollama.splitProblems(text);
  }
  if (visionState.relay) {
    /* Out to the Worker, picked up by the bridge on the other machine, read
       by the model there, and back. Nothing inbound, nothing stored. */
    const text = await room.relayRead(store.syncEndpoint(), item.dataUrl);
    return ollama.splitProblems(text);
  }
  throw new Error('Nothing available to read it: no model here, and nothing listening elsewhere.');
}

/* Turn a typed function into a problem the engine can mark. The answer comes
   from differentiating it, so there is no answer key to be wrong. */
function problemFromText(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  /* "f(x) = sin(3x)" and "y = sin(3x)" both mean the right hand side.

     The dollar signs matter here: a transcription comes back as
     "$ f(x) = \sin(3x^2) $", and testing the left side for a function name
     without stripping them first fails, which sent the whole line to the
     parser and failed on the equals sign. */
  const cleaned = text.replace(/\$/g, ' ').trim();
  const sides = cleaned.split('=');
  const named = sides.length === 2
    && /^(?:[a-z]\s*(?:\(\s*[a-z]\s*\))?|y|dy\s*\/\s*dx)$/i.test(sides[0].trim());
  const body = named ? sides[1] : cleaned;
  const f = Expr.tryParse(body, { vars: ['x'] });
  if (!f) return null;
  let reference;
  try {
    reference = Expr.derivative(f);
  } catch {
    return null;
  }
  if (Expr.isIdenticallyZero(reference)) return null;
  return {
    source: 'typed',
    kind: 'expression',
    skill: 'chain',
    topicName: 'Your problem',
    topicId: 'calc.chain',
    difficulty: 2,
    seed: 0,
    key: `typed:${text}`,
    variable: 'x',
    stem: `Differentiate <span class="eq">f(x) = ${Expr.html(f)}</span>`,
    instruction: 'Any correct form counts.',
    functionText: Expr.text(f),
    answerNode: reference,
    answerText: Expr.text(reference),
    answerHtml: Expr.html(reference),
    distractors: sandboxDistractors(f, reference),
    original: f,
    hints: [`The answer is ${Expr.html(reference)}, in one of its forms.`],
    steps: [{ title: 'Differentiate', html: Expr.html(reference) }],
  };
}

/* ================================================================== peeking */

/* Looking in on what the other person is doing.

   The point of sitting next to somebody while you both work is that you can
   glance over when they get stuck. Two people on two laptops lose that, so
   this puts it back: their board, their question, read only, in a panel you
   can close again.

   Read only is the whole design. Drawing on someone else's board uninvited
   is not helping, it is taking over, and the shared mode is right there for
   when that is what you both want. */

let peek = null;

function closePeek() {
  if (peek && peek.link) peek.link.leave();
  if (peek && peek.node) peek.node.remove();
  peek = null;
}

function openPeek(person) {
  closePeek();
  const endpoint = store.syncEndpoint();
  if (!endpoint || !person || !person.room) return;

  const canvas = h('canvas', { class: 'boardcanvas peekboard', 'aria-label': `${person.name}'s board` });
  const status = h('p', { class: 'small muted', text: `Looking for ${person.name}...` });
  const problemSlot = h('div', { class: 'peekproblem' });

  const node = h('section', { class: 'card peek' }, [
    h('div', { class: 'peekhead' }, [
      h('div', {}, [
        h('p', { class: 'eyebrow', text: 'Looking in' }),
        h('h2', { text: `${person.name}'s work` }),
      ]),
      h('button', { class: 'btn small ghost', type: 'button', onclick: () => { closePeek(); router(); } }, 'Close'),
    ]),
    status,
    problemSlot,
    canvas,
    h('p', { class: 'small muted', text: 'Read only. They cannot see you looking, '
      + 'and nothing you do here reaches their board.' }),
  ]);

  const view = board.createBoard(canvas, { dark: darkNow(), readOnly: true });

  const link = room.joinRoom(endpoint, person.room, `${workspace.plan.who} (looking)`, {
    onStatus: (state) => {
      if (state === 'connected') return;
      status.textContent = state === 'connecting'
        ? `Looking for ${person.name}...`
        : `Cannot reach ${person.name} right now.`;
    },
    onHello: (msg) => {
      view.load(msg.strokes || []);
      /* Phrased without a pronoun: the app does not know anybody's, and
         guessing from a name would be a strange thing to get wrong. */
      status.textContent = (msg.strokes && msg.strokes.length)
        ? `${msg.strokes.length} stroke${msg.strokes.length === 1 ? '' : 's'} on `
          + `${person.name}'s board.`
        : `Nothing on ${person.name}'s board yet.`;
      paintPeekProblem(problemSlot, msg.problem, person);
    },
    onStroke: (stroke) => {
      view.apply(stroke);
      status.textContent = `${person.name} is working.`;
    },
    onErase: (id) => view.apply({ id, dead: true, points: [] }),
    onClear: () => view.load([]),
    onProblem: (description) => paintPeekProblem(problemSlot, description, person),
  });

  peek = { link, node, view, person };
  return node;
}

function paintPeekProblem(slot, description, person) {
  slot.innerHTML = '';
  if (!description) {
    slot.appendChild(h('p', { class: 'small muted', text: `${person.name} has no problem open.` }));
    return;
  }
  const rebuilt = rebuildProblem(description);
  if (!rebuilt) return;
  slot.appendChild(h('div', { class: 'stem', html: rebuilt.stem }));
  /* Their question, not their answer. Whether they have got it yet is
     theirs to say. */
  slot.appendChild(h('details', { class: 'steps' }, [
    h('summary', { text: 'The answer to this one' }),
    h('p', { html: rebuilt.answerHtml || '' }),
  ]));
}

/* ===================================================================== quiz */

let quizRun = null;

function saveQuiz() {
  if (!quizRun || quizRun.phase !== 'running') return;
  persist.saveSession(store.activeProfile().id, 'quiz', {
    plan: quizRun.plan,
    problems: quizRun.problems.map((p) => persist.describeProblem(p)),
    responses: quizRun.responses,
    index: quizRun.index,
    startedAt: quizRun.startedAt,
    endsAt: quizRun.endsAt,
  });
}

function startQuiz(plan) {
  const count = Math.max(1, Math.min(60, Number(plan.count) || 10));
  const problems = [];
  let guard = 0;
  while (problems.length < count && guard++ < count * 20) {
    const made = plan.skills && plan.skills.length
      ? buildProblem({ skills: plan.skills, level: plan.level }, freshSeed())
      : generate(plan.topicIds && plan.topicIds.length
        ? plan.topicIds[Math.floor(Math.random() * plan.topicIds.length)]
        : ALL_TOPIC_IDS[Math.floor(Math.random() * ALL_TOPIC_IDS.length)], plan.level);
    if (!made) continue;
    if (problems.some((p) => p.stem === made.stem)) continue;
    problems.push(made);
  }
  quizRun = {
    plan,
    problems,
    index: 0,
    responses: new Array(problems.length).fill(''),
    startedAt: Date.now(),
    endsAt: plan.minutes ? Date.now() + plan.minutes * 60000 : 0,
    phase: problems.length ? 'running' : 'empty',
  };
  saveQuiz();
  const before = location.hash;
  go('quiz');
  if (location.hash === before) router();
}

function renderQuiz(root) {
  if (!quizRun) {
    /* Losing a graded run to a stray refresh would be the worst of the
       three, so it rebuilds the same way: the problems were described by
       seed, the answers typed so far were kept, and the clock is an
       absolute time rather than a countdown, so it has carried on without
       anybody minding it. */
    const saved = persist.loadSession(store.activeProfile().id, 'quiz');
    if (saved && saved.problems && saved.problems.length) {
      const problems = saved.problems.map((d) => rebuildProblem(d)).filter(Boolean);
      if (problems.length === saved.problems.length) {
        quizRun = {
          plan: saved.plan,
          problems,
          index: Math.min(saved.index || 0, problems.length - 1),
          responses: saved.responses || new Array(problems.length).fill(''),
          startedAt: saved.startedAt || Date.now(),
          endsAt: saved.endsAt || 0,
          phase: 'running',
        };
      }
    }
  }
  if (!quizRun) {
    root.appendChild(h('section', { class: 'card' }, [
      h('h1', { text: 'No quiz running' }),
      h('div', { class: 'cta' }, [h('a', { class: 'btn', href: '#/start' }, 'Start one')]),
    ]));
    return;
  }
  if (quizRun.phase === 'empty') {
    root.appendChild(h('section', { class: 'card error' }, [
      h('h1', { text: 'Could not build that quiz' }),
      h('p', { text: 'No problems came out of that selection. Try different topics.' }),
      h('div', { class: 'cta' }, [h('a', { class: 'btn', href: '#/start' }, 'Back')]),
    ]));
    return;
  }
  if (quizRun.phase === 'done') { paintQuizResults(root); return; }

  const q = quizRun.problems[quizRun.index];
  const bar = h('div', { class: 'sessionbar' }, [
    h('div', {}, [
      h('strong', { text: `Question ${quizRun.index + 1} of ${quizRun.problems.length}` }),
      h('span', { class: 'muted', text: ` · ${quizRun.plan.label || 'Quiz'}` }),
    ]),
    h('div', { class: 'tbarright' }, [
      quizRun.endsAt ? h('span', { class: 'clock', id: 'qclock', text: '--:--' }) : null,
      h('button', {
        class: 'btn small ghost', type: 'button',
        onclick: () => { if (confirm('End the quiz and mark what you have?')) finishQuiz(); },
      }, 'Finish now'),
    ]),
  ]);
  root.appendChild(bar);

  const card = h('section', { class: 'card problem' });
  card.appendChild(h('div', { class: 'ptop' }, [
    h('span', { class: 'ptopic', text: q.topicName || '' }),
    h('span', { class: 'plevel', text: `level ${q.difficulty}` }),
  ]));
  card.appendChild(h('div', { class: 'stem', html: q.stem }));

  const input = h('input', {
    type: 'text', class: 'answerinput', autocomplete: 'off', spellcheck: 'false',
    placeholder: inputHint(q), value: quizRun.responses[quizRun.index] || '',
    'aria-label': 'Your answer',
  });
  const advance = (delta) => {
    quizRun.responses[quizRun.index] = input.value;
    const next = quizRun.index + delta;
    if (next >= quizRun.problems.length) { finishQuiz(); return; }
    quizRun.index = Math.max(0, next);
    saveQuiz();
    router();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); advance(1); } });

  card.appendChild(h('div', { class: 'answerform' }, [
    input,
    ['expression', 'antiderivative', 'factored', 'expanded'].includes(q.kind)
      ? mathKeys(input) : null,
    ['expression', 'antiderivative', 'factored', 'expanded'].includes(q.kind)
      ? attachEcho(input, q) : null,
    h('div', { class: 'cta' }, [
      quizRun.index > 0
        ? h('button', { class: 'btn ghost', type: 'button', onclick: () => advance(-1) }, 'Back')
        : null,
      h('button', { class: 'btn', type: 'button', onclick: () => advance(1) },
        quizRun.index === quizRun.problems.length - 1 ? 'Finish' : 'Next'),
    ]),
    h('p', { class: 'small muted', text: quizRun.plan.hints
      ? 'Hints are on for this one.'
      : 'No hints and no answers until the end. That is what makes it a quiz.' }),
  ]));
  root.appendChild(card);

  if (quizRun.endsAt) startQuizClock();
}

let quizTimer = null;
function startQuizClock() {
  if (quizTimer) clearInterval(quizTimer);
  const paint = () => {
    const el = $('#qclock');
    if (!el || !quizRun || quizRun.phase !== 'running') { clearInterval(quizTimer); quizTimer = null; return; }
    const left = Math.max(0, quizRun.endsAt - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    el.classList.toggle('low', left < 60000);
    if (left <= 0) { clearInterval(quizTimer); quizTimer = null; finishQuiz(true); }
  };
  paint();
  quizTimer = setInterval(paint, 1000);
}

/* Mark it. Partial credit, when it is on, comes from the term matching in
   expr.js: two of three terms right is two thirds of a mark. Anything else
   is all or nothing, and the results page says which it used, because the
   two numbers are not comparable. */
function markQuiz() {
  const rows = [];
  for (let i = 0; i < quizRun.problems.length; i++) {
    const problem = quizRun.problems[i];
    const response = quizRun.responses[i] || '';
    const res = grade(problem, response);
    let credit = res.correct ? 1 : 0;
    if (!res.correct && quizRun.plan.partial && res.diagnosis === 'partial') {
      const judged = Expr.judge(response, problem.answerNode, {
        distractors: problem.distractors,
        original: problem.original,
        scopes: problem.scopes,
      });
      if (judged.matched && judged.total) credit = judged.matched / judged.total;
    }
    rows.push({ problem, response, res, credit });
  }
  const score = rows.reduce((a, r) => a + r.credit, 0);
  return { rows, score, total: rows.length };
}

function finishQuiz(timedOut = false) {
  if (quizTimer) { clearInterval(quizTimer); quizTimer = null; }
  /* Marked is finished: there is nothing left to resume. */
  persist.clearSession(store.activeProfile().id, 'quiz');
  const marked = markQuiz();
  quizRun.phase = 'done';
  quizRun.marked = marked;
  quizRun.timedOut = timedOut;
  /* Keep the result alongside the mock tests, so a quiz is something you can
     look back at rather than a number that flashed past once. */
  try {
    store.saveTest({
      id: `quiz_${Date.now()}`,
      name: quizRun.plan.label || 'Quiz',
      ts: Date.now(),
      kind: 'quiz',
      items: quizRun.problems.map((p, i) => ({
        ...persist.describeProblem(p),
        response: quizRun.responses[i] || '',
        correct: marked.rows[i] ? marked.rows[i].res.correct : false,
        credit: marked.rows[i] ? marked.rows[i].credit : 0,
      })),
      score: Math.round(marked.score * 100) / 100,
      total: marked.total,
      partial: !!quizRun.plan.partial,
      updated: Date.now(),
    });
  } catch (err) {
    /* A full store must not swallow the result that is on screen. */
  }
  /* Record the attempts, so a quiz moves mastery the same way practice does. */
  for (const row of marked.rows) {
    store.recordAttempt({
      topicId: row.problem.topicId,
      correct: row.res.correct,
      ms: 0,
      difficulty: row.problem.difficulty,
      hintsUsed: 0,
      seed: row.problem.seed,
      mode: 'quiz',
      diagnosis: row.res.diagnosis || '',
    });
  }
  router();
}

function paintQuizResults(root) {
  const { rows, score, total } = quizRun.marked;
  const pct = total ? Math.round((score / total) * 100) : 0;

  root.appendChild(h('div', { class: 'pagehead' }, [
    h('p', { class: 'eyebrow', text: quizRun.timedOut ? 'Time ran out' : 'Quiz finished' }),
    h('h1', { text: `${Math.round(score * 100) / 100} out of ${total}` }),
    h('p', { class: 'lead', text: `${pct}% · ${quizRun.plan.partial
      ? 'partial credit counted on answers that were partly right'
      : 'marked right or wrong, no partial credit'}.` }),
  ]));

  if (total < 30) {
    root.appendChild(h('div', { class: 'caveat' }, [
      h('strong', { text: 'A short quiz is a noisy measurement. ' }),
      `${total} questions tells you roughly where you are, not precisely. `
      + 'Two attempts on the same topic can differ by a lot without anything changing.',
    ]));
  }

  for (const [i, row] of rows.entries()) {
    const card = h('section', { class: `card quizrow ${row.res.correct ? 'ok' : 'no'}` });
    card.appendChild(h('div', { class: 'ptop' }, [
      h('span', { class: 'ptopic', text: `${i + 1}. ${row.problem.topicName || ''}` }),
      h('span', {
        class: `pill ${row.res.correct ? 'ai' : 'warn'}`,
        text: row.credit === 1 ? 'right' : row.credit > 0
          ? `${Math.round(row.credit * 100)}% credit` : 'wrong',
      }),
    ]));
    card.appendChild(h('div', { class: 'stem', html: row.problem.stem }));
    card.appendChild(h('p', { class: 'small' }, [
      h('span', { class: 'muted', text: 'You wrote: ' }),
      h('code', { text: row.response || '(nothing)' }),
    ]));
    if (!row.res.correct) {
      card.appendChild(h('p', { html: `<span class="muted">The answer: </span><strong>${row.problem.answerHtml || ''}</strong>` }));
      if (row.res.detail) card.appendChild(h('p', { class: 'small muted', text: row.res.detail }));
    }
    root.appendChild(card);
  }

  root.appendChild(h('div', { class: 'cta' }, [
    h('button', {
      class: 'btn', type: 'button',
      onclick: () => { startQuiz(quizRun.plan); },
    }, 'Another quiz like this'),
    h('a', { class: 'btn ghost', href: '#/start' }, 'Back to the start'),
  ]));
}
