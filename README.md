# Signal

**Explainable resume-to-role matching.** Most tools hand you a score. This one shows its work.

**→ [Try it live](https://signal-resume-match.vercel.app)** — there's a sample resume and posting
built in, so you can see the whole flow without pasting anything of your own.

Drop in a resume and a job posting. Signal names every skill the role asks for, which of them the
resume already evidences, and exactly how many points each remaining gap is costing — computed by
re-running the scorer, not estimated.

[![Live demo](https://img.shields.io/badge/Live%20demo-6366F1?style=flat-square)](https://signal-resume-match.vercel.app)
[![License](https://img.shields.io/badge/license-Apache%202.0-181B22?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-50%20passing-181B22?style=flat-square)](tests/analyze.test.ts)

`Next.js 15` `TypeScript` `Tailwind CSS v4` `Motion` `unpdf` `Tesseract.js` `Vitest`

---

## The idea

A keyword matcher tells you a resume "matches 60%" and stops. That number is useless on its own,
because it answers none of the questions someone actually has: *which* 40% is missing, does any of
it matter, and what would change if I fixed one thing?

Signal is built around a single constraint: **the score must be reproducible and the reasoning must
be inspectable.** That leads to two design decisions that shape the whole codebase.

### 1. The scoring engine is deterministic and owns the number

`src/lib/analyze.ts` is pure — no network, no model, no clock, no randomness. The same two
documents always produce the same score. It runs first, and it always completes.

### 2. The language model can only add prose

`src/lib/llm.ts` runs *after* there is already a complete result, and it can only write a narrative
about it. It cannot alter the score, the matched list, or the gaps. Every failure path — no key, a
rate limit, a timeout, malformed JSON — returns `null`, and the app renders the full analysis
without a narrative.

**With no API key configured at all, Signal still does everything except write the prose.** That is
not a degraded mode; it is the product working as designed.

---

## What it actually does

**Alias-aware skill matching.** 143 canonical skills across 10 categories, 399 surface forms.
"postgres", "PostgreSQL" and "psql" resolve to one skill, so the tool doesn't report a gap that
isn't there — the most common way naive keyword matching produces a wrong answer.

**Requirement weighting.** A posting frames its asks differently, and the score reflects that. A
skill under "Must have" is weighted 3×; one under "Nice to have" 1×. Section headings set the mode
for the lines beneath them, and a line carrying its own marker overrides the section it sits in —
because that is how postings are really written.

**"X or Y" alternatives.** A posting asking for "PyTorch or TensorFlow" is one requirement, not two —
Signal groups same-line alternatives joined by "or" or "/" (including chains like "React, Vue, or
Angular") into a single unit that any one member satisfies. Having only PyTorch no longer shows
TensorFlow as a false gap, and the category breakdown counts the pair as one requirement, not two, so
it never contradicts the headline score.

**Measured counterfactuals.** For every unsatisfied requirement, the scorer is re-run with that skill
present. The "+7 points" shown to the user is the delta they would actually get, not a heuristic. A
test asserts this: every reported delta is reproduced independently from the raw scorer.

**A proficiency signal, held apart from the score.** Matched skills get an auxiliary "proven" or
"early" tag when the surrounding text carries a real signal — years of experience or ownership
language ("led", "shipped", "in production") for "proven"; hedged language ("familiar with",
"personal project") for "early". This is text-proximity matching, not language understanding, and it
never touches the score itself — folding a fuzzy confidence signal into a number this README calls
reproducible would be dishonest. It's a hint, shown as one, nothing more.

**Screening readiness.** Six format checks — contact parseability, length, standard sections,
quantified impact, action verbs, keyword coverage. A perfect match that a parser chokes on never
reaches a human, which is a separate question from whether the match is good.

**Document parsing, with an OCR fallback for scanned PDFs.** PDF, DOCX, TXT and Markdown, extracted
server-side and shown as editable text. When a PDF comes back with almost no text — the page is an
image rather than real text, as any scanned document is — Signal offers to run OCR on it right there.
That step happens entirely in your browser: each page is rasterized to a canvas and read with
[Tesseract.js](https://github.com/naptha/tesseract.js) (a WebAssembly build of the Tesseract OCR
engine), never uploaded anywhere. It's client-side by design, not just by convenience — a scanned
multi-page resume is exactly the kind of job a serverless function's timeout was built to kill, and
running it in the browser instead means no ceiling on how long a scan is allowed to take. The
extracted text is deliberately visible rather than hidden behind a filename chip either way: PDF
extraction is lossy often enough that you need to be able to notice when it mangles something.

**History.** Stored in `localStorage` and nowhere else.

---

## Privacy

A resume and a job description are two of the most personal documents in a job search, so:

- Nothing is written to disk or to a database. The uploaded buffer lives for the duration of the
  parse request and is discarded.
- There is no database, no account, and no telemetry.
- History lives in your browser's `localStorage`.
- OCR for scanned PDFs runs entirely client-side — the file never leaves your machine for that step.
  The only network calls it makes are one-time CDN fetches of the OCR engine itself, not your
  document.
- The only outbound call carrying your content is the optional narrative request, and only if you
  configured a key.

---

## Running it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. There's a sample resume and posting built in — click **Use sample**
on both sides to see the whole flow without pasting anything of your own.

```bash
npm test        # 50 unit tests over the scoring engine
npm run build   # production build
npm run typecheck
```

### Choosing an LLM provider (optional)

Copy `.env.example` to `.env` and set **one** key. The server picks the first it finds.

| Provider | Free tier | Card required | Get a key |
|---|---|---|---|
| **Groq** *(recommended)* | Fast, generous | No | [console.groq.com/keys](https://console.groq.com/keys) |
| **Google Gemini** | Largest daily allowance | No | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **OpenRouter** | Many `:free` models | No | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Cerebras** | Very fast Llama | No | [cloud.cerebras.ai](https://cloud.cerebras.ai) |

All four expose an OpenAI-compatible endpoint, so one client covers them — only the base URL, key
and default model differ. Override the model with `LLM_MODEL` if a default goes stale.

---

## Architecture

```
src/
├── lib/
│   ├── analyze.ts      the deterministic engine — owns the score, pure
│   ├── ontology.ts     143 skills, 399 aliases, requirement + proficiency markers
│   ├── llm.ts          optional narrative, 4 providers, fails to null
│   ├── history.ts      localStorage persistence
│   ├── samples.ts      built-in demo pair
│   ├── ocr.ts          client-side OCR fallback for scanned PDFs
│   └── types.ts        the contract between the two layers
├── app/
│   ├── api/parse/      PDF / DOCX / TXT → text
│   ├── api/analyze/    deterministic first, narrative second
│   └── page.tsx        the workbench
└── components/
    ├── ConstellationField.tsx   canvas background
    ├── ScoreRing.tsx            animated arc + count-up
    ├── SkillLedger.tsx          matched / gaps / beyond-the-ask
    ├── ResultsView.tsx          breakdown, counterfactuals, ATS
    ├── AnalysisOverlay.tsx      staged loading
    ├── HistoryDrawer.tsx        past runs
    └── InputPanel.tsx           upload + paste
```

### On the visual

The background is the product metaphor rather than decoration: violet nodes are the resume side,
cyan the role side, and the links that span the two are the match. When a score lands, the field
settles and those cross-links brighten in proportion to it.

Two details that are load-bearing rather than cosmetic:

- The hero uses a **CSS** entrance animation, not a JS one. A framer-motion entrance ships
  `style="opacity:0"` in the server-rendered HTML, which leaves the headline invisible until
  hydration finishes — and permanently invisible if the bundle fails. The hidden state belongs in
  the keyframes.
- `.field-layer` sets an explicit width and height. `<canvas>` is a replaced element with an
  intrinsic 300×150 size, so `inset: 0` alone leaves it in the corner at that size.

---

## Known limitations

Worth stating plainly, because a matcher that hides its failure modes is the thing this project
exists to argue against.

- **"Or" grouping is same-line only.** "PyTorch or TensorFlow" and "React, Vue, or Angular" are
  correctly read as one requirement each. A posting that spreads an alternative across two lines or
  buries it in a longer sentence than the grouping's connector-chain logic expects will fall back to
  treating each skill independently — the older, more conservative behavior, not a crash.
- **Presence, with a hint at proficiency — not real understanding of it.** Matched skills carry an
  auxiliary "proven" / "early" tag from nearby language (years of experience, "led", "familiar
  with"), but this is proximity text-matching over a fixed window, not comprehension. It can be
  fooled by an unrelated "5 years" two bullets away, and it never influences the score, on purpose —
  see "A proficiency signal, held apart from the score" above.
- **Ontology-bounded.** A skill outside the 143 in `ontology.ts` is invisible to the scorer. The
  ontology is deliberately readable and easy to extend for exactly this reason.
- **Scanned PDFs need a second, slower pass.** OCR runs in your browser, not on the server, which
  avoids a serverless timeout but means it's bounded by your machine instead — a many-page scan can
  take real time, shown as it goes with a page-by-page progress readout rather than a spinner.
  Accuracy also depends on scan quality the way any OCR does: a crisp export reads cleanly, a
  crooked phone photo won't. The first run in a session downloads Tesseract's ~4 MB WebAssembly
  engine and its English language data from a CDN; both are cached by the browser afterward.

---

## License

Apache-2.0. See [LICENSE](LICENSE).

Built by **Mithin Sagar S** — [github.com/mithinsagar](https://github.com/mithinsagar)
