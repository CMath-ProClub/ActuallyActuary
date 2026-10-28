/* Offline, without the risk of a stale half-app.

   The rule here is NETWORK FIRST, for everything. A cache-first worker is
   faster on a second visit and is also how a site ends up serving last
   week's app.js beside this week's index.html - which does not start, and
   says nothing about why. Correctness first: the network is asked every
   time, and the cache answers only when the network cannot.

   The cache is named after a hash of everything that shipped, so a deploy
   makes a new one and the old one is deleted whole. A mixed set cannot
   exist. */
const CACHE = 'study-fd9eeb63b9fa';
const FILES = ["./math.js", "./expr.js", "./topics.js", "./gen-sandbox.js", "./ask.js", "./flow.js", "./mistakes.js", "./persist.js", "./room.js", "./board.js", "./graph.js", "./photo.js", "./gen-algebra.js", "./gen-calculus.js", "./gen-actuarial.js", "./gen-cs.js", "./generators.js", "./store.js", "./scheduler.js", "./charts.js", "./ollama.js", "./compose.js", "./classify.js", "./drill.js", "./exam.js", "./help.js", "./app.js"];

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

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        /* Keep a copy of anything that came back properly. */
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => null);
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./'))),
  );
});
