/**
 * Run history, persisted client-side.
 *
 * Deliberately localStorage rather than a database: a resume and a job
 * description are the two most personal documents in a job search, and there is
 * no reason for this app to hold them on a server it doesn't need. Nothing here
 * ever leaves the browser except the one analysis request, which is not stored.
 */

import type { HistoryEntry, MatchResult } from "./types";

const STORAGE_KEY = "signal.history.v1";
const MAX_ENTRIES = 25;

function canUseStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = "__signal_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    // Safari private mode and hardened settings both throw here.
    return false;
  }
}

/**
 * Derive a human label for the run.
 *
 * Job titles are almost always on the first non-trivial line of a posting, so
 * that line is a better handle than a timestamp when scanning past runs.
 */
function deriveTitle(job: string): string {
  const line = job
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 3 && l.length < 90);

  if (!line) return "Untitled role";
  return line.replace(/^(job title|role|position)\s*[:\-–]\s*/i, "").slice(0, 70);
}

export function loadHistory(): HistoryEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveRun(resume: string, job: string, result: MatchResult): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    title: deriveTitle(job),
    score: result.score,
    band: result.band,
    resume,
    job,
    result,
  };

  const next = [entry, ...loadHistory()].slice(0, MAX_ENTRIES);
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota exceeded on a long history: drop the oldest half and retry once
      // rather than losing the run the user just waited for.
      try {
        const trimmed = next.slice(0, Math.floor(MAX_ENTRIES / 2));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        return trimmed;
      } catch {
        return next;
      }
    }
  }
  return next;
}

export function deleteRun(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* nothing useful to do; the in-memory list is still correct */
    }
  }
  return next;
}

export function clearHistory(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function formatWhen(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
