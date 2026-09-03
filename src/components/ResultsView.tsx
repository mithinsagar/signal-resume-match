"use client";

/**
 * The results screen.
 *
 * Ordered by what someone actually wants to know, in order: the number, then
 * why, then what to do about it, then whether the document will even survive a
 * parser. The narrative block is last of the interpretive sections and clearly
 * attributed to its model — when no key is set it is simply absent, and the
 * screen is still complete without it.
 */

import { motion } from "motion/react";
import { CATEGORY_LABELS } from "@/lib/ontology";
import type { MatchResult } from "@/lib/types";
import ScoreRing from "./ScoreRing";
import SkillLedger from "./SkillLedger";

function barTone(score: number): string {
  if (score >= 80) return "var(--color-spring)";
  if (score >= 55) return "var(--color-cyan)";
  if (score >= 30) return "var(--color-amber)";
  return "var(--color-rose)";
}

function Section({
  eyebrow,
  title,
  children,
  delay = 0,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mono-label mb-2">{eyebrow}</div>
      <h3 className="display mb-4 text-2xl text-ink sm:text-3xl">{title}</h3>
      {children}
    </motion.section>
  );
}

export default function ResultsView({
  result,
  onReset,
  onExport,
}: {
  result: MatchResult;
  onReset: () => void;
  onExport: () => void;
}) {
  const { stats } = result;

  return (
    <div className="space-y-14">
      {/* --- headline ------------------------------------------------------ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="panel-raised bevel grid gap-8 p-6 sm:p-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-12"
      >
        <ScoreRing score={result.score} band={result.band} />

        <div className="min-w-0">
          <div className="mono-label mb-3">What the numbers rest on</div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {[
              { k: "Requirements found", v: stats.requirementsDetected },
              { k: "Skills on resume", v: stats.skillsDetected },
              { k: "Resume length", v: `${stats.resumeWords.toLocaleString()}w` },
              { k: "Posting length", v: `${stats.jobWords.toLocaleString()}w` },
            ].map((s) => (
              <div key={s.k}>
                <dt className="mono-label mb-1">{s.k}</dt>
                <dd className="font-mono text-2xl text-ink tabular-nums">{s.v}</dd>
              </div>
            ))}
          </dl>

          <div className="rule-glow my-6" />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onReset}
              className="rounded-xl border border-line px-4 py-2.5 text-sm text-ink-dim transition-colors hover:border-line-bright hover:text-ink"
            >
              Run another
            </button>
            <button
              type="button"
              onClick={onExport}
              className="rounded-xl border border-line px-4 py-2.5 text-sm text-ink-dim transition-colors hover:border-line-bright hover:text-ink"
            >
              Export as JSON
            </button>
          </div>
        </div>
      </motion.div>

      {/* --- narrative ----------------------------------------------------- */}
      {result.narrative && (
        <Section eyebrow="The read" title="How this actually stacks up">
          <div className="panel bevel p-5 sm:p-6">
            <p className="text-[15px] leading-relaxed text-ink">{result.narrative.summary}</p>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mono-label mb-3 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-spring" />
                  Working for them
                </div>
                <ul className="space-y-2">
                  {result.narrative.strengths.map((s) => (
                    <li key={s} className="flex gap-2.5 text-sm text-ink-dim">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-spring/70" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="mono-label mb-3 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-rose" />
                  Working against them
                </div>
                <ul className="space-y-2">
                  {result.narrative.gaps.map((g) => (
                    <li key={g} className="flex gap-2.5 text-sm text-ink-dim">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose/70" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mono-label mt-6 border-t border-line pt-4">
              Written by {result.narrative.provider} · {result.narrative.model} — the score above
              was not
            </p>
          </div>
        </Section>
      )}

      {/* --- ledger -------------------------------------------------------- */}
      <Section eyebrow="Skill by skill" title="Where the two documents meet">
        <SkillLedger result={result} />
      </Section>

      {/* --- categories ---------------------------------------------------- */}
      <Section eyebrow="Breakdown" title="Coverage by area">
        <div className="panel bevel space-y-4 p-5 sm:p-6">
          {result.categories.map((cat, i) => {
            const tone = barTone(cat.score);
            return (
              <div key={cat.category}>
                <div className="mb-1.5 flex items-baseline justify-between gap-4">
                  <span className="text-sm text-ink">{CATEGORY_LABELS[cat.category]}</span>
                  <span className="font-mono text-xs text-ink-faint tabular-nums">
                    {cat.matched}/{cat.required}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-void">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${cat.score}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${tone} 55%, transparent), ${tone})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* --- counterfactuals ----------------------------------------------- */}
      {result.counterfactuals.length > 0 && (
        <Section eyebrow="Leverage" title="What would move the number">
          <p className="mb-5 -mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">
            Each delta is measured, not estimated — the scorer was re-run with that one skill
            present to get it. Adding the skill for real is what earns the points; adding the word
            is not.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.counterfactuals.map((cf, i) => (
              <motion.div
                key={cf.skill}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="panel flex items-start gap-4 p-4"
              >
                <div className="shrink-0 rounded-lg border border-cyan/30 bg-cyan/5 px-2.5 py-1.5">
                  <span className="font-mono text-sm text-cyan tabular-nums">+{cf.delta}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-ink">{cf.skill}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-faint">{cf.reason}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* --- ats ----------------------------------------------------------- */}
      <Section eyebrow="Before a human sees it" title="Screening readiness">
        <div className="panel bevel divide-y divide-line p-1">
          {result.ats.map((check) => (
            <div key={check.id} className="flex items-start gap-3.5 p-4">
              <span
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border"
                style={{
                  borderColor: check.passed
                    ? "color-mix(in oklab, var(--color-spring) 40%, transparent)"
                    : "color-mix(in oklab, var(--color-amber) 40%, transparent)",
                }}
              >
                {check.passed ? (
                  <svg viewBox="0 0 24 24" className="size-3 text-spring" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="size-1.5 rounded-full bg-amber" />
                )}
              </span>
              <div className="min-w-0">
                <div className="text-sm text-ink">{check.label}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-ink-faint">{check.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
