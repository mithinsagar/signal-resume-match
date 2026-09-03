"use client";

/**
 * The score, as the single largest object on the results screen.
 *
 * The arc sweeps and the number counts up over the same duration so the two
 * read as one motion. Both are driven by a manual rAF rather than a CSS
 * transition because the number has to be interpolated in JS anyway, and
 * running them off two different clocks makes them visibly disagree.
 */

import { useEffect, useRef, useState } from "react";
import type { MatchResult } from "@/lib/types";

const BAND_COPY: Record<MatchResult["band"], { label: string; hint: string }> = {
  strong: { label: "Strong match", hint: "Most of what this role asks for is already here." },
  promising: { label: "Promising", hint: "The core is there; a few named gaps stand between." },
  partial: { label: "Partial", hint: "Real overlap, but the posting asks for more than this shows." },
  weak: { label: "Weak", hint: "Little of what this role names appears in the resume." },
};

const BAND_COLOR: Record<MatchResult["band"], string> = {
  strong: "var(--color-spring)",
  promising: "var(--color-cyan)",
  partial: "var(--color-amber)",
  weak: "var(--color-rose)",
};

const SIZE = 260;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const DURATION = 1400;

export default function ScoreRing({ score, band }: { score: number; band: MatchResult["band"] }) {
  const [shown, setShown] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(score);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / DURATION, 1);
      // Expo-out: almost all the travel happens early, so the number lands
      // with a decisive settle rather than creeping to its final digit.
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setShown(score * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score]);

  const offset = CIRC - (shown / 100) * CIRC;
  const color = BAND_COLOR[band];
  const copy = BAND_COPY[band];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <defs>
            <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-violet)" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
            <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="url(#ring-grad)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            filter="url(#ring-glow)"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-start">
            <span
              className="display text-[5.5rem] leading-none tabular-nums"
              style={{ color }}
            >
              {Math.round(shown)}
            </span>
            <span className="mono-label mt-4 ml-1">/100</span>
          </div>
          <span className="mono-label mt-1">alignment</span>
        </div>
      </div>

      <div className="mt-6 text-center max-w-xs">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5"
          style={{ borderColor: `color-mix(in oklab, ${color} 40%, transparent)` }}
        >
          <span className="size-1.5 rounded-full" style={{ background: color }} />
          <span className="text-sm font-medium" style={{ color }}>
            {copy.label}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-dim">{copy.hint}</p>
      </div>
    </div>
  );
}
