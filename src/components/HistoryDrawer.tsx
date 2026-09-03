"use client";

/**
 * Past runs, restorable.
 *
 * Slides in from the right rather than living on the page because history is a
 * secondary concern that shouldn't compete with the workbench for attention.
 * Everything shown here came from localStorage — the copy says so explicitly,
 * since a user pasting a resume deserves to know where it went.
 */

import { AnimatePresence, motion } from "motion/react";
import { formatWhen } from "@/lib/history";
import type { HistoryEntry } from "@/lib/types";

const BAND_TONE: Record<HistoryEntry["band"], string> = {
  strong: "var(--color-spring)",
  promising: "var(--color-cyan)",
  partial: "var(--color-amber)",
  weak: "var(--color-rose)",
};

interface Props {
  open: boolean;
  entries: HistoryEntry[];
  onClose: () => void;
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export default function HistoryDrawer({
  open,
  entries,
  onClose,
  onRestore,
  onDelete,
  onClear,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-void/70 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-surface"
            role="dialog"
            aria-label="Run history"
          >
            <header className="flex items-center justify-between border-b border-line p-5">
              <div>
                <div className="mono-label mb-1">Stored in this browser</div>
                <h2 className="display text-2xl">History</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close history"
                className="grid size-9 place-items-center rounded-lg border border-line text-ink-dim transition-colors hover:border-line-bright hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {entries.length === 0 ? (
                <div className="grid h-full place-items-center px-6 text-center">
                  <div>
                    <div className="mx-auto mb-4 size-12 rounded-full border border-line" />
                    <p className="text-sm text-ink-dim">No runs yet.</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                      Analyses you run are kept here on this device only — never uploaded, never
                      shared.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {entries.map((entry) => {
                    const tone = BAND_TONE[entry.band];
                    return (
                      <li key={entry.id}>
                        <div className="panel group flex items-center gap-3 p-3 transition-colors hover:border-line-bright">
                          <button
                            type="button"
                            onClick={() => onRestore(entry)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span
                              className="grid size-11 shrink-0 place-items-center rounded-lg border font-mono text-sm tabular-nums"
                              style={{
                                borderColor: `color-mix(in oklab, ${tone} 34%, transparent)`,
                                background: `color-mix(in oklab, ${tone} 8%, transparent)`,
                                color: tone,
                              }}
                            >
                              {entry.score}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-ink">{entry.title}</span>
                              <span className="mono-label !text-[0.65rem]">
                                {formatWhen(entry.createdAt)} ·{" "}
                                {entry.result.matched.length} matched ·{" "}
                                {entry.result.missing.length} gaps
                              </span>
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDelete(entry.id)}
                            aria-label={`Delete run for ${entry.title}`}
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint opacity-0 transition-all hover:bg-rose/10 hover:text-rose focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {entries.length > 0 && (
              <footer className="border-t border-line p-4">
                <button
                  type="button"
                  onClick={onClear}
                  className="w-full rounded-xl border border-line px-4 py-2.5 text-sm text-ink-faint transition-colors hover:border-rose/40 hover:text-rose"
                >
                  Clear all {entries.length} runs
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
