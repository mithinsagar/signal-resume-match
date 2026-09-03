"use client";

/**
 * Matched / missing / extra, as three views of one list.
 *
 * "Extra" is shown as a neutral third category rather than folded into the
 * score, because skills a posting didn't ask for are not a penalty — they're
 * often the reason someone gets hired for the role next to the one they
 * applied for. Weighting each chip by how the posting framed it keeps a
 * must-have gap visually distinct from a nice-to-have gap.
 */

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { CATEGORY_LABELS } from "@/lib/ontology";
import type { MatchResult, SkillHit } from "@/lib/types";

type Tab = "matched" | "missing" | "extra";

const TABS: { id: Tab; label: string; tone: string }[] = [
  { id: "matched", label: "Matched", tone: "var(--color-spring)" },
  { id: "missing", label: "Gaps", tone: "var(--color-rose)" },
  { id: "extra", label: "Beyond the ask", tone: "var(--color-ink-dim)" },
];

function weightLabel(weight: number): string | null {
  if (weight >= 3) return "must-have";
  if (weight <= 1) return "nice-to-have";
  return null;
}

function Chip({ hit, tone, index }: { hit: SkillHit; tone: string; index: number }) {
  const badge = weightLabel(hit.weight);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        // Cap the stagger so a 40-skill list doesn't take four seconds to land.
        delay: Math.min(index * 0.022, 0.5),
        duration: 0.32,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors"
      style={{
        borderColor: `color-mix(in oklab, ${tone} 26%, transparent)`,
        background: `color-mix(in oklab, ${tone} 6%, transparent)`,
      }}
      title={`${CATEGORY_LABELS[hit.category]}${hit.evidence ? ` · found as "${hit.evidence}"` : ""}`}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: tone }} />
      <span className="text-sm text-ink">{hit.skill}</span>
      {badge && <span className="mono-label !text-[0.6rem]">{badge}</span>}
    </motion.div>
  );
}

export default function SkillLedger({ result }: { result: MatchResult }) {
  const [tab, setTab] = useState<Tab>("matched");

  const lists: Record<Tab, SkillHit[]> = {
    matched: result.matched,
    missing: result.missing,
    extra: result.extra,
  };

  const active = TABS.find((t) => t.id === tab)!;
  const items = lists[tab];

  return (
    <div className="panel bevel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="relative rounded-lg px-3 py-1.5 text-sm transition-colors"
              style={{ color: selected ? "var(--color-ink)" : "var(--color-ink-faint)" }}
            >
              {selected && (
                <motion.span
                  layoutId="ledger-tab"
                  className="absolute inset-0 rounded-lg border"
                  style={{
                    borderColor: `color-mix(in oklab, ${t.tone} 34%, transparent)`,
                    background: `color-mix(in oklab, ${t.tone} 9%, transparent)`,
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {t.label}
                <span className="mono-label !text-[0.65rem]">{lists[t.id].length}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="flex flex-wrap gap-2"
        >
          {items.length === 0 ? (
            <p className="py-4 text-sm text-ink-faint">
              {tab === "missing"
                ? "Nothing the posting named is missing. That is rare."
                : tab === "matched"
                  ? "No overlap was found between the two documents."
                  : "Every skill on the resume was something the posting asked for."}
            </p>
          ) : (
            items.map((hit, i) => (
              <Chip key={hit.skill} hit={hit} tone={active.tone} index={i} />
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
