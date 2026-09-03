"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import AnalysisOverlay from "@/components/AnalysisOverlay";
import ConstellationField, { type FieldMode } from "@/components/ConstellationField";
import HistoryDrawer from "@/components/HistoryDrawer";
import InputPanel from "@/components/InputPanel";
import ResultsView from "@/components/ResultsView";
import { clearHistory, deleteRun, loadHistory, saveRun } from "@/lib/history";
import { ALIAS_COUNT, SKILL_COUNT } from "@/lib/ontology";
import { SAMPLE_JOB, SAMPLE_RESUME } from "@/lib/samples";
import type { HistoryEntry, MatchResult } from "@/lib/types";

const MIN_CHARS = 80;

export default function Home() {
  const [resume, setResume] = useState("");
  const [job, setJob] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [llmReady, setLlmReady] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    // Tells the user up front whether a narrative is even possible, rather than
    // letting them wonder why one run has prose and another doesn't.
    fetch("/api/analyze")
      .then((r) => r.json())
      .then((d) => setLlmReady(Boolean(d?.llm)))
      .catch(() => setLlmReady(false));
  }, []);

  const ready = resume.trim().length >= MIN_CHARS && job.trim().length >= MIN_CHARS;

  const fieldMode: FieldMode = busy ? "analyzing" : result ? "result" : "idle";

  const runAnalysis = useCallback(async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, job }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Analysis failed.");
        return;
      }

      setResult(data as MatchResult);
      setHistory(saveRun(resume, job, data as MatchResult));
      // Let the results mount before scrolling, or the target has no height yet.
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch {
      setError("Could not reach the analyser. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [ready, busy, resume, job]);

  const restore = useCallback((entry: HistoryEntry) => {
    setResume(entry.resume);
    setJob(entry.job);
    setResult(entry.result);
    setHistoryOpen(false);
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal-match-${result.score}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      <ConstellationField mode={fieldMode} score={result?.score ?? 0} className="field-layer" />

      <div className="above-field">
        {/* --- nav --------------------------------------------------------- */}
        <nav className="sticky top-0 z-30 border-b border-line/60 bg-void/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
            <div className="flex items-center gap-2.5">
              <span className="relative grid size-7 place-items-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-violet to-cyan opacity-25 blur-[6px]" />
                <span className="relative size-2.5 rounded-full bg-gradient-to-br from-violet-soft to-cyan-soft" />
              </span>
              <span className="display text-lg tracking-tight">Signal</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="mono-label hidden sm:inline">
                {llmReady ? "narrative on" : "deterministic only"}
              </span>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-line-bright hover:text-ink"
              >
                History
                {history.length > 0 && (
                  <span className="mono-label !text-[0.65rem]">{history.length}</span>
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* --- hero -------------------------------------------------------- */}
        <header className="mx-auto max-w-6xl px-5 pt-20 pb-16 sm:px-8 sm:pt-28 sm:pb-24">
          {/* CSS entrance rather than framer-motion — see .rise-in in
              globals.css. The headline must not depend on hydration. */}
          <div className="rise-in max-w-3xl">
            <div className="mono-label mb-6 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-violet" />
              Explainable resume-to-role matching
            </div>

            <h1 className="display text-5xl leading-[0.95] sm:text-7xl lg:text-8xl">
              Most tools hand you
              <br />
              a score.
              <br />
              <span className="text-gradient">This one shows its work.</span>
            </h1>

            <p className="mt-8 max-w-xl text-base leading-relaxed text-ink-dim sm:text-lg">
              Drop in a resume and a job posting. Signal names every skill the role asks for,
              which of them you already have, and exactly how many points each gap is costing
              you — computed, not guessed.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              {[
                { v: SKILL_COUNT, k: "skills recognised" },
                { v: ALIAS_COUNT, k: "surface forms" },
                { v: "0", k: "documents stored" },
              ].map((s) => (
                <div key={s.k}>
                  <div className="font-mono text-2xl text-ink tabular-nums">{s.v}</div>
                  <div className="mono-label">{s.k}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* --- workbench --------------------------------------------------- */}
        <main ref={workbenchRef} className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
          <div className="grid gap-4 lg:grid-cols-2">
            <InputPanel
              accent="violet"
              eyebrow="Side one"
              title="The resume"
              placeholder="Paste the resume here, or drop a file above…"
              value={resume}
              onChange={setResume}
              allowUpload
              onLoadSample={() => setResume(SAMPLE_RESUME)}
              sampleLabel="Use sample"
            />
            <InputPanel
              accent="cyan"
              eyebrow="Side two"
              title="The role"
              placeholder="Paste the full job posting — requirements, nice-to-haves, all of it…"
              value={job}
              onChange={setJob}
              onLoadSample={() => setJob(SAMPLE_JOB)}
              sampleLabel="Use sample"
            />
          </div>

          {/* --- action ---------------------------------------------------- */}
          <div className="mt-8 flex flex-col items-center">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={!ready || busy}
              className="group relative overflow-hidden rounded-2xl px-10 py-4 text-base font-medium transition-all duration-300 disabled:cursor-not-allowed"
              style={{
                background: ready
                  ? "linear-gradient(100deg, var(--color-violet), var(--color-cyan))"
                  : "var(--color-elevated)",
                color: ready ? "var(--color-void)" : "var(--color-ink-faint)",
                boxShadow: ready ? "0 0 40px -8px color-mix(in oklab, var(--color-violet) 55%, transparent)" : "none",
              }}
            >
              <span className="relative z-10">
                {busy ? "Analysing…" : "Analyse the match"}
              </span>
              {ready && !busy && (
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              )}
            </button>

            <p className="mono-label mt-4 text-center">
              {!ready
                ? `Both sides need at least ${MIN_CHARS} characters`
                : llmReady
                  ? "Scored locally, then explained by the model"
                  : "Scored locally — no model key configured"}
            </p>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 max-w-md rounded-xl border border-rose/30 bg-rose/5 px-4 py-3 text-center text-sm leading-relaxed text-rose"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* --- results --------------------------------------------------- */}
          <div ref={resultsRef} className="scroll-mt-20">
            <AnimatePresence mode="wait">
              {result && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="pt-24"
                >
                  <ResultsView result={result} onReset={reset} onExport={exportJson} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* --- footer ------------------------------------------------------ */}
        <footer className="border-t border-line/60">
          <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <div className="display mb-2 text-lg">Signal</div>
                <p className="text-sm leading-relaxed text-ink-faint">
                  The score is computed by a deterministic engine that runs on the server and
                  keeps nothing. Resumes and postings are never written to disk or to a database;
                  history lives in your browser alone.
                </p>
              </div>
              <div className="mono-label">
                Built by Mithin Sagar S · Apache-2.0
              </div>
            </div>
          </div>
        </footer>
      </div>

      <AnalysisOverlay active={busy} withNarrative={llmReady} />

      <HistoryDrawer
        open={historyOpen}
        entries={history}
        onClose={() => setHistoryOpen(false)}
        onRestore={restore}
        onDelete={(id) => setHistory(deleteRun(id))}
        onClear={() => {
          clearHistory();
          setHistory([]);
        }}
      />
    </>
  );
}
