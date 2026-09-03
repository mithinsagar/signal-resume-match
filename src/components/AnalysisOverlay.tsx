"use client";

/**
 * The waiting state.
 *
 * The phases below are the real stages of the request in the real order, and
 * the last one only appears when a narrative was actually asked for. The
 * timings are estimates rather than progress events — but they describe work
 * that is genuinely happening, so the overlay never claims a step the server
 * isn't taking. When the response lands early the overlay resolves immediately
 * rather than stalling to finish its own animation.
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

interface Props {
  active: boolean;
  withNarrative: boolean;
}

const BASE_PHASES = [
  { label: "Reading both documents", detail: "Normalising layout and whitespace" },
  { label: "Resolving skill aliases", detail: "Matching surface forms to canonical skills" },
  { label: "Weighting requirements", detail: "Separating must-haves from nice-to-haves" },
  { label: "Scoring alignment", detail: "Computing weighted coverage" },
  { label: "Testing counterfactuals", detail: "Re-scoring with each gap filled" },
];

const NARRATIVE_PHASE = {
  label: "Drafting the read",
  detail: "Asking the model to explain the result",
};

export default function AnalysisOverlay({ active, withNarrative }: Props) {
  const phases = withNarrative ? [...BASE_PHASES, NARRATIVE_PHASE] : BASE_PHASES;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const timer = setInterval(() => {
      // Hold on the final phase rather than looping — a spinner that restarts
      // reads as "stuck", which is exactly the wrong signal while waiting.
      setIndex((i) => (i < phases.length - 1 ? i + 1 : i));
    }, 620);
    return () => clearInterval(timer);
  }, [active, phases.length]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-50 grid place-items-center bg-void/88 backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm px-6">
            {/* Concentric pulse — the field "focusing" on an answer. */}
            <div className="relative mx-auto mb-10 size-28">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="absolute inset-0 rounded-full border border-violet/40"
                  style={{ animation: `pulse-ring 2.4s ${i * 0.8}s cubic-bezier(0.16,1,0.3,1) infinite` }}
                />
              ))}
              <span className="absolute inset-[30%] rounded-full bg-gradient-to-br from-violet to-cyan blur-md opacity-70" />
              <span className="absolute inset-[38%] rounded-full bg-gradient-to-br from-violet-soft to-cyan-soft" />
            </div>

            <ol className="space-y-3">
              {phases.map((phase, i) => {
                const state = i < index ? "done" : i === index ? "active" : "pending";
                return (
                  <li key={phase.label} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
                      {state === "done" ? (
                        <motion.svg
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          viewBox="0 0 24 24"
                          className="size-4 text-spring"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                        </motion.svg>
                      ) : state === "active" ? (
                        <span className="size-3.5 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-line-bright" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm transition-colors duration-300 ${
                          state === "pending" ? "text-ink-faint" : "text-ink"
                        }`}
                      >
                        {phase.label}
                      </div>
                      <AnimatePresence>
                        {state === "active" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden text-xs text-ink-faint"
                          >
                            {phase.detail}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
