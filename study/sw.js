/* Offline, without the risk of a stale half-app.

   The rule here is NETWORK FIRST, for everything. A cache-first worker is
   faster on a second visit and is also how a site ends up serving last
   week's app.js beside this week's index.html - which does not start, and
   says nothing about why. Correctness first: the network is asked every
   time, and the cache answers only when the network cannot.

   The cache is named after a hash of everything that shipped, so a deploy
   makes a new one and the old one is deleted whole. A mixed set cannot
   exist.

   THREE THINGS LEARNED SINCE:

   1. A SLOW network is as bad as no network. "Network first" with no
      deadline means every file waits out the full connection timeout
      before the cache is consulted, and a page that would have loaded
      instantly from the cache sits on "Loading..." for half a minute.
      The network now gets a few seconds and then the cache answers,
      while the real response is still allowed to finish and refresh the
      cache for next time.

   2. NEVER answer a module with the page. The old fallback was
      caches.match('./') for anything that missed, so a .js file that was
      not cached got index.html - which is an HTML document being parsed
      as an ES module. That fails silently, the module graph never
      resolves, and all anybody sees is "Loading..." forever. Exactly the
      failure this worker's own comment warns about, arriving by a
      different door. Only a NAVIGATION falls back to the page now.

   3. THE MODEL IS NOT A FILE. Served by tools/study_local.py the model
      sits at /ollama/ on this very origin, so it would be cached like
      anything else - and a cached /api/tags makes a model that has been
      deleted look installed, while a cached answer makes the same reply
      come back to a different question. Never touched. */
const CACHE = 'study-1cce39cfa41f';
const FILES = ["./math.js", "./expr.js", "./topics.js", "./gen-sandbox.js", "./ask.js", "./flow.js", "./mistakes.js", "./persist.js", "./room.js", "./board.js", "./graph.js", "./photo.js", "./gen-algebra.js", "./gen-calculus.js", "./gen-actuarial.js", "./gen-cs.js", "./generators.js", "./store.js", "./scheduler.js", "./charts.js", "./ollama.js", "./compose.js", "./classify.js", "./drill.js", "./exam.js", "./help.js", "./app.js"];
/* Long enough for a working connection on a phone, short enough that a
   dead one does not look like a broken app. */
const NETWORK_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.concat(['./', './app.css'])))
      /* A file that will not precache must not stop the worker installing;
         it will simply be fetched when it is needed. */
      .catch(() => null)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

/* The network, but not for longer than NETWORK_MS.

   The request is NOT aborted on timeout - it is left running so that it
   can still refresh the cache. What times out is only our willingness to
   keep the page waiting for it. */
function fromNetwork(request) {
  const live = fetch(request).then((response) => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => null);
    }
    return response;
  });
  const slow = new Promise((resolve) => {
    setTimeout(() => resolve(null), NETWORK_MS);
  });
  return { live, raced: Promise.race([live.catch(() => null), slow]) };
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  /* The local model, proxied onto this origin by the launcher. Caching an
     answer to one question and replaying it for another is worse than no
     model at all. */
  if (url.pathname.indexOf('/ollama/') !== -1) return;

  const navigating = request.mode === 'navigate'
    || (request.headers.get('accept') || '').indexOf('text/html') !== -1;

  event.respondWith((async () => {
    const { live, raced } = fromNetwork(request);
    const first = await raced;
    if (first) return first;

    /* Either the network failed or it is being slow. The cache is better
       than both, and it is exactly right: the cache is named after this
       build, so nothing stale can be in it. */
    const hit = await caches.match(request);
    if (hit) return hit;

    /* Nothing cached. Wait out the real request rather than giving up on
       a first visit over a slow connection. */
    try {
      const late = await live;
      if (late) return late;
    } catch (err) { /* offline */ }

    /* A page can fall back to the app shell, which will route itself. A
       SCRIPT cannot: handing it index.html breaks the module graph with
       no error anybody can see. Say so properly instead. */
    if (navigating) {
      const shell = await caches.match('./');
      if (shell) return shell;
    }
    return new Response('', {
      status: 504,
      statusText: 'Offline, and this was never cached',
    });
  })());
});
