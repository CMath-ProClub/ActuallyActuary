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

/* The plan: a few things to do, each with the reason it is on the list.

   `topicName` turns a topic id into words; the caller has that mapping and
   this module should not. */
export function planFor(profile, { topicName = (id) => id, examDate = '' } = {}) {
  const rows = recentAttempts(profile);
  const days = daysUntil(examDate);
  const items = [];

  if (rows.length < 5) {
    return {
      days,
      items: [{
        kind: 'start',
        what: 'Sit a short paper',
        why: 'There is not enough history yet to know what you are weak at. '
          + 'Twenty questions is enough to find out.',
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
    items.push({
      kind: 'weak',
      what: `Drill ${topicName(topic.topicId)}`,
      why: `${missed} of your last ${topic.right + topic.wrong} went wrong`
        + (worst ? `, mostly the same way: ${worst[0].replace(/-/g, ' ')}.` : '.'),
      where: '#/lockin',
      topicId: topic.topicId,
    });
  }

  /* Something that is going well, to be kept going rather than dropped -
     the commonest way to lose a topic is to stop touching it once it
     starts working. */
  const solid = topics.filter((t) => t.rate >= 0.8).slice(-1)[0];
  if (solid && items.length) {
    items.push({
      kind: 'keep',
      what: `Keep ${topicName(solid.topicId)} warm`,
      why: `${Math.round(solid.rate * 100)}% lately. A handful is enough to `
        + 'keep it there.',
      where: '#/practice',
      topicId: solid.topicId,
    });
  }

  /* And the paper itself, weighted by how close the test is. */
  if (days !== null && days <= 7) {
    items.unshift({
      kind: 'exam',
      what: days <= 1 ? 'Sit a full paper now' : `Sit a full paper (${days} days left)`,
      why: days <= 1
        ? 'One more under exam conditions is worth more than more drilling.'
        : 'Timed, end to end, so the length of it is not a surprise.',
      where: '#/start',
    });
  } else if (!items.length) {
    items.push({
      kind: 'steady',
      what: 'Nothing is obviously weak',
      why: 'Recent accuracy is above 80% everywhere there is enough history. '
        + 'A mixed session keeps it that way.',
      where: '#/lockin',
    });
  }

  return { days, items: items.slice(0, 4), measured: rows.length };
}

export default { planFor, daysUntil };
