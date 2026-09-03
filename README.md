# Signal

**Explainable resume-to-role matching.** Most tools hand you a score. This one shows its work.

Drop in a resume and a job posting. Signal names every skill the role asks for, which of them the
resume already evidences, and exactly how many points each remaining gap is costing — computed by
re-running the scorer, not estimated.

`Next.js 15` `TypeScript` `Tailwind CSS v4` `Motion` `unpdf` `Vitest`

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

**Alias-aware skill matching.** 99 canonical skills across 10 categories, 312 surface forms.
"postgres", "PostgreSQL" and "psql" resolve to one skill, so the tool doesn't report a gap that
isn't there — the most common way naive keyword matching produces a wrong answer.

**Requirement weighting.** A posting frames its asks differently, and the score reflects that. A
skill under "Must have" is weighted 3×; one under "Nice to have" 1×. Section headings set the mode
for the lines beneath them, and a line carrying its own marker overrides the section it sits in —
because that is how postings are really written.

**Measured counterfactuals.** For every missing skill, the scorer is re-run with that skill present.
The "+7 points" shown to the user is the delta they would actually get, not a heuristic. A test
asserts this: every reported delta is reproduced independently from the raw scorer.

**Screening readiness.** Six format checks — contact parseability, length, standard sections,
quantified impact, action verbs, keyword coverage. A perfect match that a parser chokes on never
reaches a human, which is a separate question from whether the match is good.

**Document parsing.** PDF, DOCX, TXT and Markdown, extracted server-side and shown as editable
text. The extracted text is deliberately visible rather than hidden behind a filename chip: PDF
extraction is lossy often enough that you need to be able to notice when it mangles something.

**History.** Stored in `localStorage` and nowhere else.

---

## Privacy

A resume and a job description are two of the most personal documents in a job search, so:

- Nothing is written to disk or to a database. The uploaded buffer lives for the duration of the
  parse request and is discarded.
- There is no database, no account, and no telemetry.
- History lives in your browser's `localStorage`.
- The only outbound call is the optional narrative request, and only if you configured a key.

---

## Running it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. There's a sample resume and posting built in — click **Use sample**
on both sides to see the whole flow without pasting anything of your own.

```bash
npm test        # 29 unit tests over the scoring engine
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
│   ├── ontology.ts     99 skills, 312 aliases, requirement markers
│   ├── llm.ts          optional narrative, 4 providers, fails to null
│   ├── history.ts      localStorage persistence
│   ├── samples.ts      built-in demo pair
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

- **No understanding of "or" alternatives.** A posting asking for "PyTorch **or** TensorFlow"
  registers both as requirements, so a resume with only PyTorch shows TensorFlow as a gap. This is
  visible in the built-in sample. Handling it properly means parsing requirement clauses rather
  than lines, which is a real piece of work rather than a tweak.
- **Presence, not proficiency.** The engine detects that a skill is *mentioned*. "Familiar with
  Kubernetes" and "ran Kubernetes in production for four years" score identically.
- **Ontology-bounded.** A skill outside the 99 in `ontology.ts` is invisible to the scorer. The
  ontology is deliberately readable and easy to extend for exactly this reason.
- **Scanned PDFs won't work.** If the text is an image, there is no text to extract — the parser
  says so rather than returning an empty document.

---

## License

Apache-2.0. See [LICENSE](LICENSE).

Built by **Mithin Sagar S** — [github.com/mithinsagar](https://github.com/mithinsagar)
