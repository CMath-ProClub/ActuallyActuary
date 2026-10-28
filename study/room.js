/* The client half of a shared room.

   A thin thing on purpose: it opens a socket, sends what you did, and hands
   back what the other person did. The merge rule lives in board.js, which
   already had to solve it for the offline case, and the problem is a seed,
   which the rest of the app already knows how to rebuild.

   Three things it does carefully.

   IT RECONNECTS. Phones drop their connection every time the screen locks,
   and a shared board that needs a page refresh after every interruption is
   not one people would use twice. Backoff caps quickly, because the usual
   case is being away for ten seconds rather than an hour.

   IT NEVER BLOCKS THE DRAWING. If the socket is down you carry on drawing
   and the strokes are queued; board.js is the source of truth locally and
   the room is a copy. Work is never lost waiting for a network.

   IT SAYS WHICH STATE IT IS IN, in words. "Connecting", "Lilly is here",
   "Offline, still saving" are all things worth knowing, and a silent dot in
   a corner is not. */

const RECONNECT_START = 800;
const RECONNECT_MAX = 8000;
const QUEUE_LIMIT = 500;

export function joinRoom(endpoint, roomName, who, handlers = {}) {
  const base = String(endpoint || '').replace(/\/+$/, '');
  if (!base || !roomName) return null;

  const url = `${base.replace(/^http/, 'ws')}/v1/room/`
    + `${encodeURIComponent(roomName)}?who=${encodeURIComponent(who || 'someone')}`;

  let socket = null;
  let closed = false;
  let delay = RECONNECT_START;
  const queue = [];
  let people = [];

  const say = (status, detail) => {
    if (typeof handlers.onStatus === 'function') handlers.onStatus(status, detail);
  };

  function flush() {
    while (queue.length && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(queue.shift()));
    }
  }

  function send(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return;
    }
    /* Queue it. Dropping the OLDEST keeps the most recent work when a long
       outage would otherwise run the queue away with us. */
    queue.push(message);
    if (queue.length > QUEUE_LIMIT) queue.shift();
  }

  function open() {
    if (closed) return;
    say('connecting');
    try {
      socket = new WebSocket(url);
    } catch (err) {
      retry();
      return;
    }

    socket.addEventListener('open', () => {
      delay = RECONNECT_START;
      say('connected');
      flush();
    });

    socket.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (err) {
        return;
      }
      if (!msg || !msg.t) return;

      if (msg.t === 'hello') {
        people = msg.people || [];
        if (typeof handlers.onHello === 'function') handlers.onHello(msg);
        say('connected', describePeople(people, who));
        return;
      }
      if (msg.t === 'joined' || msg.t === 'left') {
        people = msg.people || [];
        say('connected', describePeople(people, who));
        if (typeof handlers.onPeople === 'function') handlers.onPeople(people);
        return;
      }
      if (msg.t === 'stroke' && typeof handlers.onStroke === 'function') {
        handlers.onStroke(msg.stroke);
        return;
      }
      if (msg.t === 'erase' && typeof handlers.onErase === 'function') {
        handlers.onErase(msg.id);
        return;
      }
      if (msg.t === 'clear' && typeof handlers.onClear === 'function') {
        handlers.onClear(msg.who);
        return;
      }
      if (msg.t === 'problem' && typeof handlers.onProblem === 'function') {
        handlers.onProblem(msg.problem, msg.who);
      }
    });

    socket.addEventListener('close', () => { if (!closed) retry(); });
    socket.addEventListener('error', () => { /* close follows */ });
  }

  function retry() {
    socket = null;
    say('offline', 'Still saving on this device.');
    setTimeout(open, delay);
    delay = Math.min(RECONNECT_MAX, Math.round(delay * 1.7));
  }

  open();

  return {
    get people() { return people; },
    stroke: (s) => send({ t: 'stroke', stroke: s }),
    erase: (id) => send({ t: 'erase', id }),
    clear: () => send({ t: 'clear' }),
    problem: (description) => send({ t: 'problem', problem: description }),
    /* Pending work, for a status line that can say so. */
    get pending() { return queue.length; },
    leave() {
      closed = true;
      if (socket) try { socket.close(); } catch (err) { /* already gone */ }
      socket = null;
    },
  };
}

function describePeople(people, me) {
  const others = (people || []).filter((p) => p && p !== me);
  if (!others.length) return 'Nobody else here yet.';
  if (others.length === 1) return `${others[0]} is here.`;
  return `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]} are here.`;
}

/* ------------------------------------------------------------- the relay */

/* Asking a machine that HAS the model to use it.

   Two situations, one mechanism. The obvious one is a phone, which has no
   model and never will. The unobvious one is this very desktop: a page
   served over HTTPS is not permitted to reach 127.0.0.1 at all, so even
   with Ollama running on the same machine the live site cannot call it
   directly. See the note at the top of study_api/src/relay.js. Going out
   to the Worker and back is the way in for both. */
export async function relayStatus(endpoint) {
  const base = String(endpoint || '').replace(/\/+$/, '');
  if (!base) return { bridge: false };
  try {
    const res = await fetch(`${base}/v1/relay/status`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { bridge: false };
    return await res.json();
  } catch (err) {
    return { bridge: false };
  }
}

/* Can the machine on the other end do this kind of work? A bridge in the
   middle of a thirty-second answer is not in the waiting list, so asking
   only "is a bridge there" reads as "gone" at the moment it is busiest.
   `seenAgo` covers that. */
export function relayCan(status, kind) {
  if (!status) return false;
  const kinds = status.can && status.can.length ? status.can : status.lastCan;
  const recently = status.bridge
    || (typeof status.seenAgo === 'number' && status.seenAgo < 90000);
  if (!recently) return false;
  /* The original bridge sent no list and could only read images. */
  if (!kinds || !kinds.length) return kind === 'see';
  return kinds.includes(kind);
}

/* Post one job and wait for its answer. Long polls, so this is a handful
   of requests rather than a spin, and the wait is BOUNDED: if the other
   machine is asleep, say so rather than holding a spinner forever. */
async function relayJob(endpoint, payload, { onWait, waitMs = 150000, what = 'that' } = {}) {
  const base = String(endpoint || '').replace(/\/+$/, '');
  if (!base) throw new Error('No sync service is set, so there is nothing to ask through.');
  const asked = await fetch(`${base}/v1/relay/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!asked.ok) {
    const body = await asked.json().catch(() => ({}));
    throw new Error(body.error || `The relay would not take ${what}.`);
  }
  const { id } = await asked.json();

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (typeof onWait === 'function') onWait();
    const res = await fetch(`${base}/v1/relay/result?id=${encodeURIComponent(id)}`);
    if (res.status === 404) throw new Error('That request expired before anything picked it up.');
    const body = await res.json();
    if (body.done) {
      if (body.error) throw new Error(body.error);
      return body.text || '';
    }
  }
  throw new Error('Nothing picked that up. Is the other computer awake, with the bridge running?');
}

export async function relayRead(endpoint, dataUrl, { onWait } = {}) {
  return relayJob(endpoint, { kind: 'see', image: dataUrl }, {
    onWait, what: 'that image',
  });
}

/* Explaining working, on the machine that has the model.

   Longer patience than reading an image: a 14B model writing three
   sentences about somebody's algebra takes twenty to forty seconds on a
   consumer card, and the honest thing is to wait rather than to give up at
   fifteen and call it broken. */
export async function relayChat(endpoint, messages, { onWait, model = '' } = {}) {
  return relayJob(endpoint, { kind: 'chat', messages, model }, {
    onWait, waitMs: 240000, what: 'that question',
  });
}

export default { joinRoom, relayStatus, relayRead, relayChat, relayCan };
