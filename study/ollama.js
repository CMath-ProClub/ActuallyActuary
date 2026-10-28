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
    /* Kept, because choosing a model for somebody means knowing what it
       can do: whether it can see, and how big it is. Dropping these was
       why the picker could only ever be a list of names. */
    capabilities: m.capabilities || [],
    details: m.details || {},
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
/* ------------------------------------------------------------ reading a photo */

/* Transcribe a photographed worksheet.

   This is the one job in the tool where a model genuinely beats code: a
   photograph of handwriting is not something a parser can do anything with.
   Everything AFTER the transcription is still done by expr.js, which is
   tested and mechanical, so the model never decides whether an answer is
   right - it only proposes what the page says, and you confirm it.

   The prompt matters more than it looks. Measured against glm-ocr on the
   same rendered worksheet, "Transcribe every line exactly." returned a
   perfect read, while "Text Recognition:" mangled x^2 e^(5x) into
   x^{2} e^{^{2}}(5x). Short and literal wins; anything that invites the
   model to interpret gets interpretation. */
const OCR_PROMPT = 'Transcribe every line exactly. Return only what is written, '
  + 'one problem per line, with no commentary.';

/* Models that can see. Ollama reports vision support inconsistently across
   versions, so a name match is the reliable test, with the families field as
   a fallback. */
const VISION_HINTS = ['ocr', 'vl', 'vision', 'llava', 'moondream', 'omni', 'clef', 'bonsai'];

export function looksVisionCapable(model) {
  const name = String(model && model.name ? model.name : model || '').toLowerCase();
  if (VISION_HINTS.some((h) => name.includes(h))) return true;
  const families = (model && model.details && model.details.families) || [];
  return families.some((f) => /clip|vision|mllama|siglip/i.test(String(f)));
}

export async function visionModels(url) {
  const all = await listModels(url);
  return all.filter((m) => looksVisionCapable(m));
}

/* `dataUrl` is what the photo shelf holds. Ollama wants the base64 payload
   on its own, without the data: prefix. */
export async function readImage(url, model, dataUrl, { signal } = {}) {
  const comma = String(dataUrl || '').indexOf(',');
  if (comma < 0) throw new OllamaError('That image could not be read.', { kind: 'input' });
  const base64 = String(dataUrl).slice(comma + 1);

  const res = await call(url, '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: OCR_PROMPT,
      images: [base64],
      stream: false,
      /* Zero temperature: a transcription has one right answer and this is
         not the place for the model to be creative. */
      options: { temperature: 0 },
    }),
    signal,
  }, 120000);

  const data = await res.json();
  const text = String(data && data.response ? data.response : '').trim();
  if (!text) {
    throw new OllamaError('The model returned nothing for that image.', {
      kind: 'empty',
      hint: 'A clearer photo, or more of the page in frame, usually fixes it.',
    });
  }
  return text;
}

/* Split a transcription into candidate problems, and strip the scaffolding
   the model wraps around maths: LaTeX dollars, list numbers, and the
   instruction words that are not part of the expression.

   Deliberately conservative. Anything it is unsure of is left in the line
   for a human to trim, because quietly deleting half of someone's homework
   is worse than showing them an untidy line. */
export function splitProblems(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line
      /* "1.", "(2)", "3)" - the numbering, not the problem. */
      .replace(/^\s*\(?\s*\d+\s*[.)\]]\s*/, '')
      .replace(/^\s*[-*•]\s*/, '')
      /* The instruction, which the tool supplies itself. */
      .replace(/^(?:differentiate|find|compute|evaluate|simplify|factor|expand|solve|determine)\b[:\s]*/i, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((line) => /[0-9a-z]/i.test(line));

  /* Put the most mathematical line first.

     A photographed worksheet has a title, a name, a date and a page number
     on it as well as the problems, and the model transcribes all of it
     faithfully. Dropping those outright would be wrong - on an odd page one
     of them IS the question - but offering "Calculus I - Worksheet 4" as the
     thing to differentiate is worse than useless. So they are ranked and
     everything stays available. */
  return lines
    .map((line, index) => ({ line, index, score: mathiness(line) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.line);
}

function mathiness(line) {
  let score = 0;
  if (/=/.test(line)) score += 2;
  if (/[+−*/^]/.test(line)) score += 1;
  if (/\b(?:sin|cos|tan|sec|csc|cot|ln|log|exp|sqrt)\b/i.test(line)) score += 2;
  if (/\bd[yx]\s*\/\s*d[yx]\b/i.test(line)) score += 2;
  if (/[a-z]\s*\^\s*\d/i.test(line)) score += 1;
  if (/\d/.test(line)) score += 0.5;
  /* The furniture of a worksheet, which is never the question. */
  if (/\b(?:worksheet|name|date|period|chapter|section|page|class|homework|due)\b/i.test(line)) {
    score -= 4;
  }
  /* Mostly words is prose, not maths. */
  const letters = (line.match(/[a-z]/gi) || []).length;
  const symbols = (line.match(/[0-9+−*/^()=]/g) || []).length;
  if (letters > 12 && symbols < 3) score -= 2;
  return score;
}

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

/* Read a line-by-line answer and say what went wrong in the WORKING.

   This is the one place a local model earns its keep. The engine already
   knows whether each line is right - it compares expressions numerically
   and is not guessing - but it cannot say "you expanded (x+h)^3 and dropped
   the 3xh term", which is the sentence that actually helps.

   So the marking is handed to the model as FACT and it is told not to
   dispute it. It gets the lines, the verdicts, and the right answers, and
   its only job is to explain the algebra. Nothing it says is recorded,
   nothing it says can change a mark, and what it writes is escaped and
   labelled on the way out - the procedural grader is proven correct and a
   7B model is not. */
export async function reviewWork(url, model, { stem, lines, verdicts, topic }) {
  if (!model) throw new OllamaError('No model selected.', { kind: 'config' });
  const written = (lines || []).map((line, i) => {
    const v = (verdicts || [])[i] || {};
    const mark = v.correct ? 'CORRECT' : 'WRONG';
    return `Line ${i + 1} - ${line.label}\n`
      + `  wanted: ${stripTags(line.wanted)}\n`
      + `  student wrote: ${String(line.got || '').trim() || '(nothing)'}\n`
      + `  the grader says: ${mark}${v.hint ? ` - ${stripTags(v.hint)}` : ''}`;
  }).join('\n');

  const res = await call(url, '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0.2, num_predict: 500 },
      messages: [
        {
          role: 'system',
          content: 'You are a patient calculus tutor looking at a student’s working, '
            + 'line by line. The marking you are given was done by a symbolic engine and is '
            + 'CORRECT - never dispute it, never re-mark a line, never say a wrong line is '
            + 'right. Your job is only to explain WHY the first wrong line went wrong: name '
            + 'the algebra step that was missed or mangled, and say what to do instead. If '
            + 'every line is right, say in one sentence what the student did well. At most '
            + '130 words, plain text with Unicode math, no markdown headings, no lists.',
        },
        {
          role: 'user',
          content: `Topic: ${topic || 'the limit definition of the derivative'}\n`
            + `Question: ${stripTags(stem)}\n\n${written}`,
        },
      ],
    }),
  }, 90000);
  const data = await res.json();
  return escapeHtml(clean(data?.message?.content || '')).replace(/\n/g, '<br>');
}

function stripTags(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Rough guidance shown in Settings, so a 16GB card is not pointed at a 70B
   model that will swap and time out. */
/* Which of the installed models to use for what, without being asked.

   The settings page has had a model picker since the beginning and it was
   the wrong shape: it asks somebody to know which of their models is good
   at explaining calculus, which is a question about the models rather than
   about the maths. The machine can answer it.

   The rules are about what a model IS, from what Ollama reports:

     - a model that says it can see is the one for photographs of a
       worksheet, whatever else is installed
     - a coder model explains code, and will explain the chain rule like
       code. Preferred last.
     - otherwise bigger is better, up to what will fit, because the thing
       being asked for is an explanation and small models write worse ones.

   Everything here is a guess that the person can override; it exists so
   that the common case needs no decision at all. */

const CODER = /(coder|code|deepseek-coder|starcoder|codestral|codellama)/i;
const VISION_NAME = /(vision|llava|moondream|bakllava|minicpm-v|qwen2?.?5?-?vl|glm-ocr|ocr)/i;

function paramCount(model) {
  const said = model && model.details && model.details.parameter_size;
  if (!said) return 0;
  const n = parseFloat(String(said));
  if (!Number.isFinite(n)) return 0;
  return /m\b/i.test(said) ? n / 1000 : n;
}

export function canSee(model) {
  const caps = (model && model.capabilities) || [];
  if (caps.includes('vision')) return true;
  const families = (model && model.details && model.details.families) || [];
  if (families.includes('clip') || families.includes('mllama')) return true;
  return VISION_NAME.test((model && model.name) || '');
}

/* The best model for explaining working, and the best for reading a
   photograph. Either may be null, and the caller must cope: a machine with
   only a coder model installed can still explain, just less well, and one
   with no vision model cannot read a photo at all. */
export function chooseModels(models) {
  const list = (models || []).filter((m) => m && m.name);
  if (!list.length) return { explain: null, see: null, why: 'no models installed' };

  const scored = list.map((m) => ({
    model: m,
    params: paramCount(m),
    coder: CODER.test(m.name),
    ocr: /ocr/i.test(m.name || ''),
    sees: canSee(m),
  }));

  /* For explaining: not a coder, not an OCR model, and big enough to
     write a sentence worth reading.

     "Prefer anything that is not a coder" on its own picked a 891M OCR
     model over a 30B one, which is how you get a worse explanation from a
     better machine. An OCR model is for reading images and nothing else,
     and under about 3B the writing is not worth the wait. */
  const usable = scored.filter((m) => !m.ocr && m.params >= 3);
  const explainers = usable.filter((m) => !m.coder);
  const pool = explainers.length ? explainers
    : (usable.length ? usable : scored.filter((m) => !m.ocr));
  const explain = pool.slice().sort((a, b) => b.params - a.params)[0];

  /* For seeing: anything that can, biggest first. */
  const seers = scored.filter((m) => m.sees).sort((a, b) => b.params - a.params);

  return {
    explain: explain ? explain.model.name : null,
    see: seers.length ? seers[0].model.name : null,
    why: explainers.length
      ? 'the largest installed model that is not a coder'
      : usable.length
        ? 'only coder models are installed, so one of those is doing it'
        : 'nothing installed is really suited to explaining',
  };
}

/* Ask the machine what it has, and decide. One call, and it fails quietly:
   no Ollama running is the normal case, not an error. */
export async function detect(url) {
  try {
    const res = await ping(url);
    if (!res || !res.ok) return { running: false };
    const picked = chooseModels(res.models);
    return { running: true, models: res.models || [], ...picked };
  } catch (err) {
    return { running: false, error: err && err.message };
  }
}

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
