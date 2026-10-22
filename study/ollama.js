/* Local model integration, via Ollama running on your own machine.

   Why local: it is free, it works offline, nothing leaves the laptop, and
   there is no API key to leak. The browser talks straight to
   http://localhost:11434. The cost is that it only works on a machine that is
   actually running Ollama - a phone cannot. That is fine and is the intended
   shape: GENERATE on the desktop, and the set syncs down to the phone to be
   STUDIED anywhere.

   =====================================================================
   The honesty rule for anything on this page that a model wrote
   =====================================================================
   The procedural generators are exact: they are built backwards from a known
   answer, and tools/test_generators.mjs proves every one of them grades its
   own answer correctly. A local model has no such guarantee. A 7B or 14B model
   asked for a calculus question will sometimes produce a question whose stated
   answer is simply wrong, and it will state it with complete confidence.

   So model-written questions:
     - are labelled, visibly, everywhere they appear
     - are stored under a `custom:<setId>` topic id, so they can never move a
       curriculum mastery number that is supposed to mean something measured
     - keep the model name and the date, so a bad batch can be traced
     - are editable and deletable by hand

   Treat them as a study aid someone else wrote, not as an answer key. */

const TIMEOUT_MS = 120000;

export class OllamaError extends Error {
  constructor(message, { kind = 'unknown', hint = '' } = {}) {
    super(message);
    this.name = 'OllamaError';
    this.kind = kind;
    this.hint = hint;
  }
}

function baseUrl(url) {
  return String(url || 'http://localhost:11434').replace(/\/+$/, '');
}

async function call(url, path, options = {}, timeout = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${baseUrl(url)}${path}`, { ...options, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new OllamaError(`Ollama returned ${res.status}. ${body.slice(0, 200)}`, { kind: 'http' });
    }
    return res;
  } catch (err) {
    if (err instanceof OllamaError) throw err;
    if (err.name === 'AbortError') {
      throw new OllamaError('The model took too long to answer.', {
        kind: 'timeout',
        hint: 'A smaller model (llama3.2, qwen2.5:7b) will answer much faster than a 70B one.',
      });
    }
    /* A browser CORS failure surfaces as an opaque TypeError with no detail,
       so the only useful thing to do is explain the usual cause. This is the
       error people actually hit, and a bare "Failed to fetch" tells them
       nothing. */
    throw new OllamaError('Could not reach Ollama.', {
      kind: 'connect',
      hint: `Check that Ollama is running (try "ollama list" in a terminal). `
        + `If it is running and this still fails, the browser is being blocked by CORS: `
        + `Ollama has to be told to accept requests from this page. Set the environment variable `
        + `OLLAMA_ORIGINS=${location.origin} and restart Ollama.`,
    });
  } finally {
    clearTimeout(timer);
  }
}

/* Is Ollama there, and which models does it have? */
export async function listModels(url) {
  const res = await call(url, '/api/tags', { method: 'GET' }, 8000);
  const data = await res.json();
  const models = (data.models || []).map((m) => ({
    name: m.name,
    size: m.size,
    family: m.details?.family || '',
    params: m.details?.parameter_size || '',
  }));
  models.sort((a, b) => a.name.localeCompare(b.name));
  return models;
}

export async function ping(url) {
  try {
    const models = await listModels(url);
    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/* ------------------------------------------------------------- generation */

const SYSTEM = `You write practice questions for a student. You are precise and you never guess.

Rules:
- Return ONLY JSON matching the requested schema. No prose, no markdown fences.
- Every question must have exactly one unambiguous correct answer.
- Work the problem out before you state the answer. If you are not certain the
  answer is correct, write an easier question you ARE certain about.
- "steps" must be the actual worked solution, in order, each step one small move.
- "hints" must escalate: the first nudges, the last nearly gives it away. Never
  state the final answer in a hint.
- For kind "choice", give 4 options and set answerIndex (0-based). Wrong options
  must be plausible mistakes a student would actually make, not nonsense.
- For kind "numeric", "answer" is a plain number as a string, no units, no commas.
- For kind "text", "answer" is the exact expected string, kept short.
- Use plain text with Unicode for math (x², √, π, ≤, ·). No LaTeX, no $ delimiters.`;

function buildPrompt({ concept, count, difficulty, kinds, context }) {
  const levelWord = difficulty === 3 ? 'challenging' : difficulty === 2 ? 'moderate' : 'introductory';
  return `Write ${count} ${levelWord} practice question(s) about: ${concept}
${context ? `\nAdditional context from the student: ${context}\n` : ''}
Allowed question kinds: ${kinds.join(', ')}.

Return JSON of exactly this shape:
{"questions":[{"stem":"...","kind":"choice","choices":["...","...","...","..."],"answerIndex":0,"hints":["...","..."],"steps":[{"title":"...","html":"..."}],"note":""}]}

For kind "numeric" or "text", omit "choices" and "answerIndex" and include "answer" instead.`;
}

/* Ask the model for questions. Returns { items, raw, model, warnings }. */
export async function generateQuestions(url, model, opts) {
  const { concept, count = 5, difficulty = 2, kinds = ['choice', 'numeric'], context = '' } = opts;
  if (!model) throw new OllamaError('No model selected.', { kind: 'config', hint: 'Pick a model in Settings first.' });
  if (!concept || !concept.trim()) throw new OllamaError('Describe what you want questions about.', { kind: 'config' });

  const res = await call(url, '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      /* Ollama's structured-output mode. Much more reliable than asking for
         JSON in the prompt and hoping. */
      format: 'json',
      options: { temperature: 0.4, num_predict: 2400 },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildPrompt({ concept, count, difficulty, kinds, context }) },
      ],
    }),
  });

  const data = await res.json();
  const text = data?.message?.content || '';
  const parsed = parseLoose(text);
  if (!parsed) {
    throw new OllamaError('The model did not return usable JSON.', {
      kind: 'parse',
      hint: 'Try again, or switch to a model that follows instructions more closely (llama3.1:8b and qwen2.5:7b both do well).',
    });
  }

  const { items, warnings } = normalize(parsed, { concept, difficulty, model });
  if (!items.length) {
    throw new OllamaError('The model replied, but none of the questions were usable.', {
      kind: 'empty',
      hint: warnings.length ? warnings[0] : 'Try rewording the concept, or asking for fewer questions.',
    });
  }
  return { items, raw: text, model, warnings };
}

/* Models sometimes wrap JSON in prose or a code fence even when told not to.
   Pull the first balanced object out rather than failing the whole batch. */
function parseLoose(text) {
  const direct = tryParse(text);
  if (direct) return direct;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const v = tryParse(fenced[1]);
    if (v) return v;
  }
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        const v = tryParse(text.slice(start, i + 1));
        if (v) return v;
      }
    }
  }
  return null;
}

function tryParse(s) {
  try {
    const v = JSON.parse(String(s).trim());
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

/* Validate hard. A malformed item is dropped with a reason rather than being
   patched into something that looks fine and is wrong. */
function normalize(parsed, { concept, difficulty, model }) {
  const raw = Array.isArray(parsed) ? parsed
    : Array.isArray(parsed.questions) ? parsed.questions
      : parsed.stem ? [parsed] : [];
  const items = [];
  const warnings = [];

  raw.forEach((q, idx) => {
    const where = `question ${idx + 1}`;
    if (!q || typeof q !== 'object') { warnings.push(`${where}: not an object`); return; }
    const stem = clean(q.stem || q.question || q.prompt);
    if (!stem) { warnings.push(`${where}: no question text`); return; }

    let kind = String(q.kind || '').toLowerCase();
    if (!['choice', 'numeric', 'text'].includes(kind)) {
      kind = Array.isArray(q.choices) && q.choices.length ? 'choice' : 'text';
    }

    const item = {
      id: `q${Math.random().toString(36).slice(2, 10)}`,
      stem,
      kind,
      hints: toStringArray(q.hints).slice(0, 4),
      steps: toSteps(q.steps),
      note: clean(q.note) || '',
      source: 'ollama',
      model,
      concept,
      difficulty,
      created: Date.now(),
    };

    if (kind === 'choice') {
      const choices = toStringArray(q.choices);
      if (choices.length < 2) { warnings.push(`${where}: needs at least two options`); return; }
      let ai = Number(q.answerIndex);
      if (!Number.isInteger(ai) || ai < 0 || ai >= choices.length) {
        /* Some models give the answer text instead of the index. */
        const byText = choices.findIndex((c) => c === clean(q.answer));
        if (byText >= 0) ai = byText;
        else { warnings.push(`${where}: answerIndex is missing or out of range`); return; }
      }
      if (new Set(choices).size !== choices.length) {
        warnings.push(`${where}: duplicate options, skipped`);
        return;
      }
      item.choices = choices.map((c, i) => ({ html: escapeHtml(c), correct: i === ai }));
    } else {
      const answer = clean(q.answer != null ? q.answer : q.solution);
      if (!answer) { warnings.push(`${where}: no answer given`); return; }
      if (kind === 'numeric' && !Number.isFinite(Number(String(answer).replace(/,/g, '')))) {
        /* It said numeric but the answer is not a number. Grade it as text
           rather than throwing it away or mis-grading every response. */
        item.kind = 'text';
      }
      item.answer = answer;
      item.answerHtml = escapeHtml(answer);
    }

    if (!item.answerHtml && item.kind === 'choice') {
      const c = item.choices.find((x) => x.correct);
      item.answerHtml = c ? c.html : '';
    }
    items.push(item);
  });

  return { items, warnings };
}

function clean(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function toStringArray(v) {
  if (!Array.isArray(v)) return typeof v === 'string' && v.trim() ? [clean(v)] : [];
  return v.map((x) => clean(typeof x === 'object' ? (x.text || x.hint || '') : x)).filter(Boolean);
}

function toSteps(v) {
  if (!Array.isArray(v)) return [];
  return v.map((s, i) => {
    if (typeof s === 'string') return { title: `Step ${i + 1}`, html: escapeHtml(clean(s)) };
    return {
      title: escapeHtml(clean(s.title || s.name || `Step ${i + 1}`)),
      html: escapeHtml(clean(s.html || s.text || s.body || '')),
    };
  }).filter((s) => s.html);
}

/* Model output is untrusted text going into innerHTML, so it is escaped here
   and never anywhere else. The procedural generators build their own trusted
   markup; this path must not. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ------------------------------------------------------- explain on demand */

/* "I got this wrong, talk me through it." Used on a procedural problem, where
   the correct answer is already known and exact - so the model is being asked
   to EXPLAIN a known-good answer rather than to produce one. That is a much
   safer job for a small model, and the answer shown to the student still comes
   from the generator, not from the model. */
export async function explain(url, model, { stem, answer, wrongAnswer, topic }) {
  if (!model) throw new OllamaError('No model selected.', { kind: 'config' });
  const res = await call(url, '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0.3, num_predict: 600 },
      messages: [
        {
          role: 'system',
          content: 'You are a patient tutor. The correct answer is given to you and is CORRECT - '
            + 'do not dispute it or re-derive a different one. Explain in at most 150 words why it '
            + 'is right, and if a wrong answer is given, name the specific mistake that produces it. '
            + 'Plain text with Unicode math. No markdown headings.',
        },
        {
          role: 'user',
          content: `Topic: ${topic}\nQuestion: ${stripTags(stem)}\nCorrect answer: ${stripTags(answer)}`
            + (wrongAnswer ? `\nThe student answered: ${wrongAnswer}` : ''),
        },
      ],
    }),
  });
  const data = await res.json();
  return escapeHtml(clean(data?.message?.content || '')).replace(/\n/g, '<br>');
}

function stripTags(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Rough guidance shown in Settings, so a 16GB card is not pointed at a 70B
   model that will swap and time out. */
export const MODEL_ADVICE = [
  { match: /llama3\.2|qwen2\.5:3b|phi3|gemma2:2b/i, note: 'Fast. Fine for vocabulary and recall, weaker on multi-step math.' },
  { match: /:7b|:8b|llama3\.1|qwen2\.5:7b|mistral/i, note: 'A good default on a 16GB card: quick and reasonably reliable.' },
  { match: /:13b|:14b|qwen2\.5:14b/i, note: 'Noticeably better at math. Still comfortable in 16GB at 4-bit.' },
  { match: /:32b|:34b/i, note: 'Near the limit of 16GB at 4-bit. Expect it to be slow.' },
  { match: /:70b|:72b/i, note: 'Too large for 16GB. It will offload to system RAM and crawl.' },
];

export function adviceFor(modelName) {
  for (const a of MODEL_ADVICE) if (a.match.test(modelName)) return a.note;
  return '';
}
