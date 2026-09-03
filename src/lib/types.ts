/**
 * Shared types.
 *
 * The analysis pipeline has two layers and this file is the contract between
 * them. `MatchResult` is produced entirely by the deterministic engine in
 * `analyze.ts`; the LLM in `llm.ts` only ever fills in `narrative`. Keeping the
 * split visible in the types is deliberate — the score must never depend on a
 * model that may be rate-limited, swapped, or absent.
 */

export type SkillCategory =
  | "languages"
  | "frameworks"
  | "data"
  | "ml"
  | "cloud"
  | "devops"
  | "databases"
  | "practices"
  | "design"
  | "soft";

/** One skill matched (or missed) between a resume and a role. */
export interface SkillHit {
  /** Canonical skill name, e.g. "PostgreSQL" rather than "postgres". */
  skill: string;
  category: SkillCategory;
  /** How the job description weighted it: required signals score more. */
  weight: number;
  /** The alias that actually appeared in the text, for evidence display. */
  evidence?: string;
}

/** Per-category scoring, used for the breakdown bars. */
export interface CategoryScore {
  category: SkillCategory;
  label: string;
  matched: number;
  required: number;
  /** 0-100. Categories the role never mentions are omitted, not zeroed. */
  score: number;
}

/**
 * A "what would move the needle" suggestion.
 *
 * `delta` is computed by re-running the real scorer with the skill injected,
 * not estimated — so the number a user sees is the number they would actually
 * get if they added it.
 */
export interface Counterfactual {
  skill: string;
  category: SkillCategory;
  /** Percentage points the overall score would gain. */
  delta: number;
  reason: string;
}

export interface AtsCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface MatchNarrative {
  summary: string;
  strengths: string[];
  gaps: string[];
  /** Which provider produced this, surfaced in the UI for honesty. */
  provider: string;
  model: string;
}

export interface MatchResult {
  /** 0-100 overall alignment. */
  score: number;
  /** Coarse band used for colour and copy. */
  band: "strong" | "promising" | "partial" | "weak";
  matched: SkillHit[];
  missing: SkillHit[];
  /** Skills on the resume the role never asked for — not a negative. */
  extra: SkillHit[];
  categories: CategoryScore[];
  counterfactuals: Counterfactual[];
  ats: AtsCheck[];
  stats: {
    resumeWords: number;
    jobWords: number;
    skillsDetected: number;
    requirementsDetected: number;
  };
  /** Absent when no LLM key is configured — the UI degrades gracefully. */
  narrative?: MatchNarrative;
}

export interface AnalyzeRequest {
  resume: string;
  job: string;
  /** Client can opt out of the LLM call even when a key exists. */
  useLlm?: boolean;
}

/** One saved run, persisted to localStorage. */
export interface HistoryEntry {
  id: string;
  createdAt: number;
  title: string;
  score: number;
  band: MatchResult["band"];
  resume: string;
  job: string;
  result: MatchResult;
}

export interface ParsedDocument {
  text: string;
  filename: string;
  /** Rough page/paragraph count, shown as upload feedback. */
  pages?: number;
  chars: number;
}
