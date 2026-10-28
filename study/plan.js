/* What to do today.

   The tool has known for a while what somebody gets wrong - every attempt
   is recorded with the skill and the specific diagnosis - and it has never
   once said "so do this". Knowing and advising are different things, and
   the gap between them is where revision time disappears: you open the
   site, you are asked what you want to practise, and you pick whatever you
   thought of last, which is rarely the thing you are worst at.

   So this answers the question instead. It is deliberately small - three
   or four things, with a reason attached to each - because a plan with
   fifteen items on it is a list, and a list gets ignored.

   Everything here is derived from recorded attempts. Nothing is a
   prediction and nothing is a score: "you missed four of the last five
   implicit questions" is a fact, and "you are 62% ready" would not be. */

const RECENT = 40;

/* An attempt counts as recent if it is in the last `RECENT` of them, which
   is a better measure than a date: somebody who studies in two long
   sessions a week should not be told their Tuesday is stale on Thursday. */
function recentAttempts(profile) {
  const all = (profile && profile.attempts) || [];
  return all.slice(-RECENT);
}

/* Group what happened by the skill it happened in. The sandbox records a
   `seed` and a topic; the skill is on the key when there is one. */
function byTopic(rows) {
  const out = new Map();
  for (const row of rows) {
    const key = row.topicId || 'unknown';
    const seen = out.get(key) || { topicId: key, right: 0, wrong: 0, diagnoses: new Map() };
    if (row.correct) seen.right++; else seen.wrong++;
    if (!row.correct && row.diagnosis) {
      seen.diagnoses.set(row.diagnosis, (seen.diagnoses.get(row.diagnosis) || 0) + 1);
    }
    out.set(key, seen);
  }
  return [...out.values()];
}

/* How many days until the thing being revised for, or null. */
export function daysUntil(dateText) {
  if (!dateText) return null;
  /* CALENDAR days, not a difference of timestamps.

     Subtracting one instant from another and rounding up counts the hours
     left in today as a whole day, and a timezone offset can add another:
     a test two days away was reported as four. Both dates are pinned to
     local midnight, and then the difference is exactly the number of
     sleeps. */
  const when = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(when.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((when.getTime() - today.getTime()) / 86400000);
}

/* How long a thing takes, as a number of questions and a rough time.

   "Drill implicit differentiation" is an instruction with no size on it,
   and a task with no size is one you put off. Two minutes a question is
   measured, not guessed: it is roughly what the attempt log shows for a
   level-2 expression question with working.

   Deliberately a RANGE and deliberately rounded. Saying "11 minutes"
   would be a precision this does not have. */
const MINUTES_EACH = 2;

function sized(count) {
  const mins = Math.round((count * MINUTES_EACH) / 5) * 5;
  return `${count} questions, about ${Math.max(5, mins)} minutes`;
}

/* The plan: a few things to do, each with the reason it is on the list.

   `topicName` turns a topic id into words; the caller has that mapping and
   this module should not. `due` is the spaced-repetition scheduler's list
   of topics that have come round again - passed in rather than imported,
   for the same reason. */
export function planFor(profile, {
  topicName = (id) => id, examDate = '', due = [],
} = {}) {
  const rows = recentAttempts(profile);
  const days = daysUntil(examDate);
  const items = [];

  /* A date in the past is not a deadline, it is a leftover. Treating it
     as one gave "Sit a full paper (-3 days left)", which is both wrong
     and slightly insulting. */
  const gone = days !== null && days < 0;

  if (rows.length < 5) {
    return {
      days,
      gone,
      items: [{
        kind: 'start',
        what: 'Sit a short paper',
        why: 'There is not enough history yet to know what you are weak at. '
          + 'Twenty questions is enough to find out.',
        how: sized(20),
        where: '#/start',
      }],
      measured: rows.length,
    };
  }

  const topics = byTopic(rows)
    .filter((t) => t.right + t.wrong >= 2)
    .map((t) => ({ ...t, rate: t.right / (t.right + t.wrong) }))
    .sort((a, b) => a.rate - b.rate);

  /* The worst two, with the mistake named where there is one. */
  for (const topic of topics.slice(0, 2)) {
    if (topic.rate >= 0.8) break;
    const worst = [...topic.diagnoses.entries()].sort((a, b) => b[1] - a[1])[0];
    const missed = topic.wrong;
    /* Enough to move the number, not so many that it is the whole
       evening. Worse topics get more. */
    const count = topic.rate < 0.4 ? 15 : 10;
    items.push({
      kind: 'weak',
      what: `Drill ${topicName(topic.topicId)}`,
      why: `${missed} of your last ${topic.right + topic.wrong} went wrong`
        + (worst ? `, mostly the same way: ${worst[0].replace(/-/g, ' ')}.` : '.'),
      how: sized(count),
      count,
      where: '#/lockin',
      topicId: topic.topicId,
    });
  }

  /* Something that has come round again.

     The scheduler has tracked when each topic is next worth revisiting
     since the beginning, and the plan never once asked it - so a topic
     learned properly a fortnight ago, now fading, was invisible here
     until it had been got wrong enough times to count as weak. Catching
     it before that is the entire point of spacing it. */
  const named = new Set(items.map((i) => i.topicId));
  const ready = (due || []).filter((row) => row && row.topicId && !named.has(row.topicId));
  if (ready.length) {
    const row = ready[0];
    const also = ready.length - 1;
    items.push({
      kind: 'due',
      what: `${topicName(row.topicId)} has come round again`,
      why: 'Spaced out on purpose: you had this right, and this is the point '
        + 'at which it starts to fade if it is not touched.'
        + (also ? ` ${also} other${also === 1 ? '' : 's'} are due too.` : ''),
      how: sized(8),
      count: 8,
      where: '#/practice',
      topicId: row.topicId,
    });
  }

  /* Something that is going well, to be kept going rather than dropped -
     the commonest way to lose a topic is to stop touching it once it
     starts working. */
  const solid = topics.filter((t) => t.rate >= 0.8).slice(-1)[0];
  if (solid && items.length && !named.has(solid.topicId)) {
    items.push({
      kind: 'keep',
      what: `Keep ${topicName(solid.topicId)} warm`,
      why: `${Math.round(solid.rate * 100)}% lately. A handful is enough to `
        + 'keep it there.',
      how: sized(5),
      count: 5,
      where: '#/practice',
      topicId: solid.topicId,
    });
  }

  /* And the paper itself, weighted by how close the test is. */
  if (gone) {
    items.unshift({
      kind: 'past',
      what: 'That exam date has gone',
      why: `It was ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago. `
        + 'Set the next one in Settings and this goes back to counting down; '
        + 'everything below still stands.',
      where: '#/settings',
    });
  } else if (days !== null && days <= 7) {
    items.unshift({
      kind: 'exam',
      what: days <= 1
        ? (days === 0 ? 'Today. Sit one full paper' : 'Tomorrow. Sit a full paper now')
        : `Sit a full paper (${days} days left)`,
      why: days <= 1
        ? 'One more under exam conditions is worth more than more drilling.'
        : 'Timed, end to end, so the length of it is not a surprise.',
      how: sized(20),
      count: 20,
      where: '#/start',
    });
  } else if (!items.length) {
    items.push({
      kind: 'steady',
      what: 'Nothing is obviously weak',
      why: 'Recent accuracy is above 80% everywhere there is enough history. '
        + 'A mixed session keeps it that way.',
      how: sized(15),
      count: 15,
      where: '#/lockin',
    });
  }

  const shown = items.slice(0, 4);
  return {
    days,
    gone,
    items: shown,
    measured: rows.length,
    /* The whole plan, in one number, so the card can say what the evening
       costs before anything is clicked. */
    minutes: shown.reduce((sum, i) => sum + (i.count || 0) * MINUTES_EACH, 0),
  };
}

export default { planFor, daysUntil };
