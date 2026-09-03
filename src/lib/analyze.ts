/**
 * The deterministic matching engine.
 *
 * This module owns the score. It has no network calls, no model, and no
 * randomness — the same two documents always produce the same number, which is
 * the only way a score is worth showing to someone making decisions from it.
 * The LLM layer runs afterwards and can only add prose.
 *
 * The pipeline:
 *   1. Find every skill mention in both documents (alias-aware, whole-token).
 *   2. Weight each job requirement by how the posting framed it — "must have"
 *      counts for more than "nice to have".
 *   3. Score = matched requirement weight / total requirement weight.
 *   4. Re-run step 3 with each missing skill injected to get a true delta for
 *      the counterfactuals, rather than estimating them.
 */

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  NICE_TO_HAVE_MARKERS,
  REQUIREMENT_MARKERS,
  SKILLS,
  type SkillDefinition,
} from "./ontology";
import type {
  AtsCheck,
  CategoryScore,
  Counterfactual,
  MatchResult,
  SkillCategory,
  SkillHit,
} from "./types";

/** Weight applied to a requirement depending on how the posting framed it. */
const WEIGHT_REQUIRED = 3;
const WEIGHT_DEFAULT = 2;
const WEIGHT_NICE = 1;

/**
 * Build a whole-token regex for one alias.
 *
 * `\b` is not usable here because half the ontology contains `+`, `#` and `.`,
 * which are non-word characters — `\bc\+\+\b` never matches "c++". The boundary
 * is asserted manually instead, and it is deliberately asymmetric:
 *
 *   - The lookbehind excludes `.` so "js" does not fire inside "node.js".
 *   - The lookahead does NOT exclude `.`, because a skill at the end of a
 *     sentence ("Must have Python.") is the single most common way a
 *     requirement appears in a real posting. Excluding it there silently drops
 *     those requirements from the score.
 *
 * Both sides still exclude `+` and `#`, which is what keeps the bare "c" alias
 * from matching inside "c++" and "c#".
 */
function aliasPattern(alias: string): RegExp {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = /^[a-z0-9]/i.test(alias) ? "(?<![a-z0-9+#.])" : "";
  const suffix = /[a-z0-9]$/i.test(alias) ? "(?![a-z0-9+#])" : "";
  return new RegExp(`${prefix}${escaped}${suffix}`, "i");
}

interface CompiledSkill extends SkillDefinition {
  patterns: { alias: string; re: RegExp }[];
}

/** Compiled once at module load; the regexes are reused across requests. */
const COMPILED: CompiledSkill[] = SKILLS.map((s) => ({
  ...s,
  patterns: s.aliases.map((alias) => ({ alias, re: aliasPattern(alias) })),
}));

function normalize(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•▪◦‣]/g, " ")
    .toLowerCase();
}

function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** First alias that appears in `text`, or null. */
function findEvidence(skill: CompiledSkill, text: string): string | null {
  for (const { alias, re } of skill.patterns) {
    if (re.test(text)) return alias;
  }
  return null;
}

/** Every skill mentioned anywhere in a document. */
function extractSkills(text: string): Map<string, SkillHit> {
  const normalized = normalize(text);
  const found = new Map<string, SkillHit>();

  for (const skill of COMPILED) {
    const evidence = findEvidence(skill, normalized);
    if (evidence) {
      found.set(skill.skill, {
        skill: skill.skill,
        category: skill.category,
        weight: WEIGHT_DEFAULT,
        evidence,
      });
    }
  }
  return found;
}

/**
 * Skills required by a job posting, weighted by framing.
 *
 * Weighting is line-scoped with section memory: a "Requirements:" heading sets
 * the mode for the lines beneath it, but a line carrying its own marker
 * ("familiarity with Kafka is a plus") overrides that mode for itself. This is
 * how postings are actually written, and it stops a single "nice to have"
 * heading from discounting an entire list of genuine requirements.
 */
function extractRequirements(text: string): Map<string, SkillHit> {
  const lines = normalize(text).split("\n");
  const found = new Map<string, SkillHit>();
  let sectionWeight = WEIGHT_DEFAULT;

  for (const line of lines) {
    if (!line.trim()) continue;

    const hasRequired = REQUIREMENT_MARKERS.some((m) => line.includes(m));
    const hasNice = NICE_TO_HAVE_MARKERS.some((m) => line.includes(m));

    // A line that is mostly a heading re-arms the section mode for what follows.
    const isHeading = line.trim().length < 60 && (hasRequired || hasNice);
    if (isHeading) {
      sectionWeight = hasRequired ? WEIGHT_REQUIRED : WEIGHT_NICE;
    }

    let lineWeight = sectionWeight;
    if (hasNice) lineWeight = WEIGHT_NICE;
    else if (hasRequired) lineWeight = WEIGHT_REQUIRED;

    for (const skill of COMPILED) {
      const evidence = findEvidence(skill, line);
      if (!evidence) continue;

      const existing = found.get(skill.skill);
      // A skill named twice keeps its strongest framing.
      if (!existing || lineWeight > existing.weight) {
        found.set(skill.skill, {
          skill: skill.skill,
          category: skill.category,
          weight: lineWeight,
          evidence,
        });
      }
    }
  }
  return found;
}

/** Score a set of requirements against a set of held skills. */
function scoreAgainst(
  requirements: Map<string, SkillHit>,
  held: Set<string>,
): { score: number; matchedWeight: number; totalWeight: number } {
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const [name, hit] of requirements) {
    totalWeight += hit.weight;
    if (held.has(name)) matchedWeight += hit.weight;
  }

  const score = totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100);
  return { score, matchedWeight, totalWeight };
}

function bandFor(score: number): MatchResult["band"] {
  if (score >= 80) return "strong";
  if (score >= 60) return "promising";
  if (score >= 40) return "partial";
  return "weak";
}

function buildCategories(
  requirements: Map<string, SkillHit>,
  held: Set<string>,
): CategoryScore[] {
  const buckets = new Map<SkillCategory, { matched: number; required: number }>();

  for (const [name, hit] of requirements) {
    const bucket = buckets.get(hit.category) ?? { matched: 0, required: 0 };
    bucket.required += 1;
    if (held.has(name)) bucket.matched += 1;
    buckets.set(hit.category, bucket);
  }

  return CATEGORY_ORDER.filter((c) => buckets.has(c)).map((category) => {
    const b = buckets.get(category)!;
    return {
      category,
      label: CATEGORY_LABELS[category],
      matched: b.matched,
      required: b.required,
      score: b.required === 0 ? 0 : Math.round((b.matched / b.required) * 100),
    };
  });
}

/**
 * What would actually move the score.
 *
 * Each candidate is scored by re-running the real scorer with that skill added
 * to the held set, so the delta shown to the user is the delta they would get.
 * Heavier requirements naturally rise to the top without a hand-tuned ranking.
 */
function buildCounterfactuals(
  requirements: Map<string, SkillHit>,
  held: Set<string>,
  baseScore: number,
): Counterfactual[] {
  const out: Counterfactual[] = [];

  for (const [name, hit] of requirements) {
    if (held.has(name)) continue;

    const hypothetical = new Set(held);
    hypothetical.add(name);
    const { score } = scoreAgainst(requirements, hypothetical);
    const delta = score - baseScore;
    if (delta <= 0) continue;

    const framing =
      hit.weight === WEIGHT_REQUIRED
        ? "listed as a hard requirement"
        : hit.weight === WEIGHT_NICE
          ? "listed as a nice-to-have"
          : "named in the posting";

    out.push({
      skill: name,
      category: hit.category,
      delta,
      reason: `${name} is ${framing} and is absent from the resume.`,
    });
  }

  return out.sort((a, b) => b.delta - a.delta).slice(0, 6);
}

/**
 * Format and completeness checks.
 *
 * These are about whether a resume survives automated screening at all, which
 * is a separate question from whether it matches the role — a perfect match
 * that a parser chokes on still never reaches a human.
 */
function buildAtsChecks(resume: string, matchedCount: number): AtsCheck[] {
  const text = resume;
  const lower = normalize(text);
  const words = countWords(text);

  const hasEmail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(text);
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  const hasNumbers = /\b\d+([.,]\d+)?%?\b/.test(text);
  const quantified = (text.match(/\b\d+([.,]\d+)?\s*%|\b\d{2,}\b/g) ?? []).length;

  const sections = ["experience", "education", "skill", "project"];
  const presentSections = sections.filter((s) => lower.includes(s));

  const actionVerbs = [
    "built", "led", "designed", "shipped", "implemented", "developed",
    "improved", "reduced", "increased", "created", "architected", "automated",
    "delivered", "launched", "optimized", "optimised",
  ];
  const verbsUsed = actionVerbs.filter((v) => lower.includes(v));

  return [
    {
      id: "contact",
      label: "Contact details are machine-readable",
      passed: hasEmail,
      detail: hasEmail
        ? `Email found${hasPhone ? " and a phone number" : ""}.`
        : "No email address detected. Most parsers key on this first.",
    },
    {
      id: "length",
      label: "Length is in the screening sweet spot",
      passed: words >= 300 && words <= 1200,
      detail:
        words < 300
          ? `${words} words is thin — parsers and reviewers both read this as underspecified.`
          : words > 1200
            ? `${words} words runs long; the relevant signal gets diluted.`
            : `${words} words sits in the range that reads as complete without padding.`,
    },
    {
      id: "sections",
      label: "Standard sections are present",
      passed: presentSections.length >= 3,
      detail:
        presentSections.length >= 3
          ? `Found ${presentSections.join(", ")}.`
          : `Only found ${presentSections.join(", ") || "none"}. Parsers segment on these headings.`,
    },
    {
      id: "quantified",
      label: "Impact is quantified",
      passed: hasNumbers && quantified >= 3,
      detail:
        quantified >= 3
          ? `${quantified} numeric claims — concrete results, not just responsibilities.`
          : "Few or no numbers. Percentages, scale and counts are what make impact legible.",
    },
    {
      id: "verbs",
      label: "Leads with action verbs",
      passed: verbsUsed.length >= 4,
      detail:
        verbsUsed.length >= 4
          ? `Uses ${verbsUsed.slice(0, 5).join(", ")}…`
          : "Sparse action verbs. Bullets that open with a verb read as ownership.",
    },
    {
      id: "keywords",
      label: "Carries the role's own vocabulary",
      passed: matchedCount >= 5,
      detail:
        matchedCount >= 5
          ? `${matchedCount} of the posting's named skills appear verbatim.`
          : `Only ${matchedCount} of the posting's skills appear. Keyword screens look for exact terms.`,
    },
  ];
}

/**
 * Run the full deterministic analysis.
 *
 * Pure: no I/O, no clock, no randomness. The API route calls this first and
 * only then decides whether to ask a model for prose about the result.
 */
export function analyzeMatch(resume: string, job: string): MatchResult {
  const resumeSkills = extractSkills(resume);
  const requirements = extractRequirements(job);
  const held = new Set(resumeSkills.keys());

  const { score } = scoreAgainst(requirements, held);

  const matched: SkillHit[] = [];
  const missing: SkillHit[] = [];

  for (const [name, hit] of requirements) {
    if (held.has(name)) {
      // Report the resume's own evidence for a match, not the posting's.
      matched.push({ ...hit, evidence: resumeSkills.get(name)?.evidence ?? hit.evidence });
    } else {
      missing.push(hit);
    }
  }

  const byWeightThenName = (a: SkillHit, b: SkillHit) =>
    b.weight - a.weight || a.skill.localeCompare(b.skill);
  matched.sort(byWeightThenName);
  missing.sort(byWeightThenName);

  const extra: SkillHit[] = [...resumeSkills.values()]
    .filter((hit) => !requirements.has(hit.skill))
    .sort((a, b) => a.skill.localeCompare(b.skill));

  return {
    score,
    band: bandFor(score),
    matched,
    missing,
    extra,
    categories: buildCategories(requirements, held),
    counterfactuals: buildCounterfactuals(requirements, held, score),
    ats: buildAtsChecks(resume, matched.length),
    stats: {
      resumeWords: countWords(resume),
      jobWords: countWords(job),
      skillsDetected: resumeSkills.size,
      requirementsDetected: requirements.size,
    },
  };
}

/** Exported for tests — the scoring maths without the presentation layer. */
export const __internals = {
  aliasPattern,
  extractSkills,
  extractRequirements,
  scoreAgainst,
  bandFor,
  WEIGHT_REQUIRED,
  WEIGHT_DEFAULT,
  WEIGHT_NICE,
};
