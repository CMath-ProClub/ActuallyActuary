/* What to practice next.

   Two ideas do most of the work here:

   1. WEIGHT BY WEAKNESS, not by "not done yet". A topic you get wrong keeps
      coming back; a topic you have answered right five times in a row mostly
      stops appearing until it is due for review. This is the behaviour Carter
      asked for - focus on the things you are getting wrong.

   2. CHECK THE PREREQUISITE BEFORE DRILLING THE SYMPTOM. Repeatedly missing
      related rates is usually not a related-rates problem; it is the chain
      rule, or implicit differentiation, or solving for a variable. Before
      serving a sixth related-rates question, the scheduler looks up the
      `needs` chain and, if something upstream is untested or weak, sends you
      there instead and says why.

   An honesty note that matters: mastery here is a measurement of THIS app's
   generated problems, nothing more. It is a useful signal for what to study
   next, and it is not a grade, not a predicted exam score, and not evidence
   that a topic is learned. The dashboard says so in as many words. */

import { TOPIC_BY_ID, prereqChain } from './topics.js';
import { hasGenerator } from './generators.js';
import { masteryOf, recentAccuracy } from './store.js';

const DAY = 86400000;

/* A topic needs this many attempts before its accuracy means anything. Below
   it, the number is noise and the UI says "not enough data" rather than
   printing 0% after one unlucky question. */
export const MIN_ATTEMPTS = 4;

/* How badly this topic needs attention, as a positive weight. Never returns 0
   for an available topic, so nothing is permanently unreachable. */
export function weightFor(topicId, profile) {
  if (!hasGenerator(topicId)) return 0;
  const m = masteryOf(topicId, profile);
  const now = Date.now();

  /* Never attempted: worth showing, but a known weakness outranks it. */
  if (!m || m.seen === 0) return 3.0;

  const acc = recentAccuracy(topicId, 10, profile);
  const accuracy = acc == null ? 0.5 : acc;

  /* The core term: 0% accuracy weighs 6x, 100% weighs ~0.4x. */
  let w = 0.4 + 5.6 * Math.pow(1 - accuracy, 1.5);

  /* Overdue for review pushes it up, capped so a topic left for a year does
     not crowd out everything else forever. */
  if (m.due && now > m.due) {
    const daysOver = (now - m.due) / DAY;
    w *= 1 + Math.min(1.5, daysOver / 7);
  } else if (m.due && now < m.due) {
    /* Not due yet: damp it, but never to zero. */
    const daysEarly = (m.due - now) / DAY;
    w *= Math.max(0.15, 1 - daysEarly / 30);
  }

  /* Seen only once or twice: nudge up so the estimate firms up quickly. */
  if (m.seen < MIN_ATTEMPTS) w *= 1.4;

  /* A long correct streak means it is genuinely solid. Back off hard. */
  if (m.streak >= 5) w *= 0.3;

  return Math.max(0.05, w);
}

/* Difficulty 1-3, from the recent streak. Rises only on sustained success and
   drops immediately on a miss, because grinding level 3 while getting them
   wrong teaches nothing. */
export function difficultyFor(topicId, profile) {
  const m = masteryOf(topicId, profile);
  if (!m || m.seen < 2) return 1;
  if (m.streak >= 6) return 3;
  if (m.streak >= 3) return 2;
  if (m.streak === 0 && m.seen >= 3) return 1;
  const acc = recentAccuracy(topicId, 8, profile);
  if (acc != null && acc >= 0.85) return 3;
  if (acc != null && acc >= 0.6) return 2;
  return 1;
}

/* Is this topic shaky enough to be worth a remediation detour? */
function isWeak(topicId, profile) {
  const m = masteryOf(topicId, profile);
  if (!m || m.seen < MIN_ATTEMPTS) return false;
  const acc = recentAccuracy(topicId, 10, profile);
  return acc != null && acc < 0.6;
}

function isUntested(topicId, profile) {
  const m = masteryOf(topicId, profile);
  return !m || m.seen < 2;
}

/* If `topicId` is being missed repeatedly, find the first prerequisite that is
   itself weak or untested. Returns null when the prerequisites are all solid,
   which means the topic really is the thing to practice. */
export function remediationFor(topicId, profile) {
  if (!isWeak(topicId, profile)) return null;
  const chain = prereqChain(topicId, 3);
  for (const need of chain) {
    if (!hasGenerator(need)) continue;
    if (isWeak(need, profile)) {
      return { topicId: need, reason: 'weak', of: topicId };
    }
    if (isUntested(need, profile)) {
      return { topicId: need, reason: 'untested', of: topicId };
    }
  }
  return null;
}

/* Human sentence for why the app just changed the subject. Shown verbatim, so
   it has to be true: only called with a real remediation. */
export function remediationMessage(rem) {
  const weak = TOPIC_BY_ID[rem.of];
  const need = TOPIC_BY_ID[rem.topicId];
  if (!weak || !need) return '';
  if (rem.reason === 'weak') {
    return `${weak.name} keeps going wrong, and ${need.name} underneath it is also shaky. `
      + `Fixing that first usually fixes both.`;
  }
  return `${weak.name} keeps going wrong. ${need.name} is a prerequisite you have barely practiced, `
    + `so this checks whether that is the real gap.`;
}

/* Weighted draw without replacement from a pool of topic ids. */
export function pickTopics(pool, count, profile, { avoid = [] } = {}) {
  const avoidSet = new Set(avoid);
  const entries = pool
    .filter((id) => hasGenerator(id))
    .map((id) => ({ id, w: weightFor(id, profile) * (avoidSet.has(id) ? 0.25 : 1) }))
    .filter((e) => e.w > 0);
  const out = [];
  for (let k = 0; k < count && entries.length; k++) {
    const total = entries.reduce((a, e) => a + e.w, 0);
    let r = Math.random() * total;
    let idx = entries.length - 1;
    for (let i = 0; i < entries.length; i++) {
      r -= entries[i].w;
      if (r <= 0) { idx = i; break; }
    }
    out.push(entries[idx].id);
    entries.splice(idx, 1);
  }
  return out;
}

/* The next single topic for a practice session, with remediation applied.
   Returns { topicId, difficulty, remediation|null }. */
export function nextProblemSpec(pool, profile, { lastTopicId = null } = {}) {
  const picked = pickTopics(pool, 1, profile, { avoid: lastTopicId ? [lastTopicId] : [] });
  if (!picked.length) return null;
  let topicId = picked[0];

  const rem = remediationFor(topicId, profile);
  /* Only detour part of the time: always detouring would mean never actually
     practicing the thing you came here for. */
  if (rem && Math.random() < 0.6) {
    return { topicId: rem.topicId, difficulty: difficultyFor(rem.topicId, profile), remediation: rem };
  }
  return { topicId, difficulty: difficultyFor(topicId, profile), remediation: null };
}

/* ------------------------------------------------------- dashboard summaries */

/* Per-topic rows for the dashboard, already sorted worst-first. Topics with
   too little data are returned with accuracy null so the UI can say so
   instead of printing a meaningless percentage. */
export function topicStats(topicIds, profile) {
  return topicIds
    .filter((id) => hasGenerator(id))
    .map((id) => {
      const m = masteryOf(id, profile);
      const seen = m ? m.seen : 0;
      const acc = seen >= MIN_ATTEMPTS ? recentAccuracy(id, 20, profile) : null;
      return {
        topicId: id,
        name: TOPIC_BY_ID[id]?.name || id,
        course: TOPIC_BY_ID[id]?.course,
        unit: TOPIC_BY_ID[id]?.unit,
        seen,
        correct: m ? m.correct : 0,
        streak: m ? m.streak : 0,
        accuracy: acc,
        due: m ? m.due : 0,
        enough: seen >= MIN_ATTEMPTS,
      };
    })
    .sort((a, b) => {
      /* Worst first, then least-practiced, then alphabetical so the order is
         stable between renders. */
      const aa = a.accuracy == null ? 2 : a.accuracy;
      const bb = b.accuracy == null ? 2 : b.accuracy;
      if (aa !== bb) return aa - bb;
      if (a.seen !== b.seen) return a.seen - b.seen;
      return a.name.localeCompare(b.name);
    });
}

/* The "work on these" list: genuinely weak topics with enough data to say so.
   Returns [] rather than guessing when nothing qualifies. */
export function weakTopics(topicIds, profile, limit = 5) {
  return topicStats(topicIds, profile)
    .filter((r) => r.enough && r.accuracy != null && r.accuracy < 0.7)
    .slice(0, limit);
}

export function dueTopics(topicIds, profile, limit = 8) {
  const now = Date.now();
  return topicStats(topicIds, profile)
    .filter((r) => r.seen > 0 && r.due && r.due <= now)
    .sort((a, b) => a.due - b.due)
    .slice(0, limit);
}

/* Attempts bucketed by local calendar day, oldest first. Used for the activity
   chart and the streak. Days with no activity are present with count 0, so the
   chart has no invisible gaps. */
export function dailyActivity(profile, days = 30) {
  const out = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const byDay = new Map();
  for (const a of (profile?.attempts || [])) {
    const d = new Date(a.ts);
    d.setHours(0, 0, 0, 0);
    const k = d.getTime();
    const row = byDay.get(k) || { total: 0, correct: 0 };
    row.total++;
    if (a.correct) row.correct++;
    byDay.set(k, row);
  }
  for (let i = days - 1; i >= 0; i--) {
    const k = start.getTime() - i * DAY;
    const row = byDay.get(k) || { total: 0, correct: 0 };
    out.push({ day: k, total: row.total, correct: row.correct });
  }
  return out;
}

/* Consecutive days with at least one attempt, counting back from today. Today
   not being started yet does not break a streak until the day is over, so a
   morning visit does not show "streak 0". */
export function currentStreak(profile) {
  const act = dailyActivity(profile, 400);
  let streak = 0;
  for (let i = act.length - 1; i >= 0; i--) {
    if (act[i].total > 0) streak++;
    else if (i === act.length - 1) continue;      /* today, not yet started */
    else break;
  }
  return streak;
}

/* Rolling accuracy over the last N attempts, as points for the trend chart.
   Returns [] when there is not enough history to plot anything honest. */
export function accuracyTrend(profile, window = 20, points = 24) {
  const att = profile?.attempts || [];
  if (att.length < window) return [];
  const step = Math.max(1, Math.floor((att.length - window) / Math.max(1, points - 1)));
  const out = [];
  for (let end = window; end <= att.length; end += step) {
    const slice = att.slice(end - window, end);
    out.push({
      n: end,
      ts: slice[slice.length - 1].ts,
      accuracy: slice.filter((a) => a.correct).length / slice.length,
    });
  }
  /* Always include the most recent point, which the striding may have skipped. */
  const last = att.slice(att.length - window);
  const lastPoint = {
    n: att.length,
    ts: last[last.length - 1].ts,
    accuracy: last.filter((a) => a.correct).length / last.length,
  };
  if (!out.length || out[out.length - 1].n !== lastPoint.n) out.push(lastPoint);
  return out;
}

export function overallStats(profile) {
  const att = profile?.attempts || [];
  const total = att.length;
  const correct = att.filter((a) => a.correct).length;
  const today = dailyActivity(profile, 1)[0];
  return {
    total,
    correct,
    accuracy: total ? correct / total : null,
    today: today ? today.total : 0,
    todayCorrect: today ? today.correct : 0,
    streak: currentStreak(profile),
    topicsTouched: Object.keys(profile?.mastery || {}).length,
  };
}
