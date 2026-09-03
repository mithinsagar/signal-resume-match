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
 *      counts for more than "nice to have" — and collapse "X or Y" alternatives
 *      into one requirement unit that either side can satisfy.
 *   3. Score = matched unit weight / total unit weight.
 *   4. Re-run step 3 with each missing skill injected to get a true delta for
 *      the counterfactuals, rather than estimating them.
 */

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  NICE_TO_HAVE_MARKERS,
  PROFICIENCY_STRONG_MARKERS,
  PROFICIENCY_WEAK_MARKERS,
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

/** How far either side of a resume skill mention to look for a proficiency
 * signal. Wide enough to catch "5 years of X" or "led the X migration"
 * without the window sprawling into an unrelated adjacent bullet. */
const PROFICIENCY_WINDOW = 70;

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

interface Match {
  alias: string;
  start: number;
  end: number;
}

/** First alias occurrence of `skill` in `text`, with its position. */
function findFirstMatch(skill: CompiledSkill, text: string): Match | null {
  for (const { alias, re } of skill.patterns) {
    const m = re.exec(text);
    if (m) return { alias, start: m.index, end: m.index + m[0].length };
  }
  return null;
}

/**
 * Heuristic read on how a resume talks about a skill it mentions.
 *
 * This is proximity text-matching, not language understanding — it cannot
 * distinguish "5 years of Python" from a resume that happens to have "5 years"
 * two bullets away. It is deliberately never used in the score for that exact
 * reason; it only ever surfaces as an auxiliary label so a real signal isn't
 * dressed up as more certain than it is.
 */
function classifyProficiency(window: string): NonNullable<SkillHit["proficiency"]> {
  if (PROFICIENCY_STRONG_MARKERS.some((m) => window.includes(m))) return "demonstrated";
  if (PROFICIENCY_WEAK_MARKERS.some((m) => window.includes(m))) return "learning";
  return "mentioned";
}

/** Every skill mentioned anywhere in the resume, with a proficiency guess. */
function extractSkills(text: string): Map<string, SkillHit> {
  const normalized = normalize(text);
  const found = new Map<string, SkillHit>();

  for (const skill of COMPILED) {
    const match = findFirstMatch(skill, normalized);
    if (!match) continue;

    const windowStart = Math.max(0, match.start - PROFICIENCY_WINDOW);
    const windowEnd = Math.min(normalized.length, match.end + PROFICIENCY_WINDOW);

    found.set(skill.skill, {
      skill: skill.skill,
      category: skill.category,
      weight: WEIGHT_DEFAULT,
      evidence: match.alias,
      proficiency: classifyProficiency(normalized.slice(windowStart, windowEnd)),
    });
  }
  return found;
}

/**
 * One line's skill occurrences, in reading order, with the raw text between
 * consecutive pairs — everything `groupAlternatives` needs to decide whether
 * they form an "X or Y" clause.
 */
function occurrencesInLine(line: string): { skill: string; start: number; end: number }[] {
  const occurrences: { skill: string; start: number; end: number }[] = [];
  for (const skill of COMPILED) {
    const match = findFirstMatch(skill, line);
    if (match) occurrences.push({ skill: skill.skill, start: match.start, end: match.end });
  }
  return occurrences.sort((a, b) => a.start - b.start);
}

/**
 * A connector between two adjacent skill mentions that keeps them in the same
 * alternatives clause: commas, "/", and the word "or", in any combination —
 * "PyTorch or TensorFlow", "AWS/GCP/Azure", "React, Vue, or Angular" all need
 * to link every step. A bare run of commas alone still matches (that's what
 * lets a 3-item chain hold together up to its final "or"), so a chain's
 * members are only actually joined as alternatives once at least one hop in
 * it names an explicit "or" or "/" — see `groupAlternatives`. Anything else in
 * the gap — "and", a period, an unrelated word — breaks the chain, which is
 * what keeps a plain requirements list ("Python, SQL and Docker") from being
 * misread as three interchangeable options.
 */
const CHAIN_CONNECTOR = /^[\s,]*(?:\/|\bor\b)?[\s,]*$/i;
const STRONG_CONNECTOR = /\/|\bor\b/i;

/**
 * Group same-line skill mentions that form an "X or Y" alternatives clause.
 *
 * Returns arrays of 2+ canonical skill names that satisfy one requirement
 * between them — the caller only needs one of a group present to count it.
 * Chains with no explicit "or" or "/" between any of their members are left
 * ungrouped, because a plain comma list in a posting almost always means "all
 * of these", not "any of these".
 */
function groupAlternatives(line: string): string[][] {
  const occurrences = occurrencesInLine(line);
  if (occurrences.length < 2) return [];

  const groups: string[][] = [];
  let chain = [occurrences[0]];
  let chainHasStrongConnector = false;

  const flush = () => {
    if (chain.length >= 2 && chainHasStrongConnector) {
      groups.push([...new Set(chain.map((o) => o.skill))]);
    }
    chainHasStrongConnector = false;
  };

  for (let i = 1; i < occurrences.length; i++) {
    const between = line.slice(chain[chain.length - 1].end, occurrences[i].start);
    if (CHAIN_CONNECTOR.test(between)) {
      chainHasStrongConnector ||= STRONG_CONNECTOR.test(between);
      chain.push(occurrences[i]);
    } else {
      flush();
      chain = [occurrences[i]];
    }
  }
  flush();

  return groups.filter((g) => g.length >= 2);
}

/**
 * Skills required by a job posting, weighted by framing, plus any "X or Y"
 * alternative clauses found along the way.
 *
 * Weighting is line-scoped with section memory: a "Requirements:" heading sets
 * the mode for the lines beneath it, but a line carrying its own marker
 * ("familiarity with Kafka is a plus") overrides that mode for itself. This is
 * how postings are actually written, and it stops a single "nice to have"
 * heading from discounting an entire list of genuine requirements.
 */
function extractRequirements(text: string): { hits: Map<string, SkillHit>; groups: string[][] } {
  const lines = normalize(text).split("\n");
  const hits = new Map<string, SkillHit>();
  const groups: string[][] = [];
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
      const match = findFirstMatch(skill, line);
      if (!match) continue;

      const existing = hits.get(skill.skill);
      // A skill named twice keeps its strongest framing.
      if (!existing || lineWeight > existing.weight) {
        hits.set(skill.skill, {
          skill: skill.skill,
          category: skill.category,
          weight: lineWeight,
          evidence: match.alias,
        });
      }
    }

    groups.push(...groupAlternatives(line));
  }
  return { hits, groups };
}

/**
 * One scoreable requirement: either a single skill, or an alternatives clause
 * that any one member satisfies. Built from `hits` + `groups` by
 * `buildUnits` — this is the shape every downstream calculation (score,
 * categories, counterfactuals) actually operates on, so "PyTorch or
 * TensorFlow" is counted once everywhere, not twice.
 */
interface RequirementUnit {
  names: string[];
  weight: number;
}

/**
 * Collapse raw per-skill hits into requirement units, folding in whichever
 * alternative groups were found.
 *
 * A group only survives if at least two of its members are skills the
 * ontology actually recognised on that line (a group can reference a name
 * that didn't separately register as a hit only in pathological input, but
 * the filter is cheap insurance) and if none of its members already belongs
 * to an earlier group — the first group to claim a skill wins, which avoids
 * double-counting a skill mentioned in two different alternative clauses.
 */
function buildUnits(hits: Map<string, SkillHit>, groups: string[][]): RequirementUnit[] {
  const claimed = new Set<string>();
  const units: RequirementUnit[] = [];

  for (const group of groups) {
    const members = [...new Set(group)].filter((n) => hits.has(n) && !claimed.has(n));
    if (members.length < 2) continue;

    const weight = Math.max(...members.map((n) => hits.get(n)!.weight));
    units.push({ names: members, weight });
    members.forEach((n) => claimed.add(n));
  }

  for (const name of hits.keys()) {
    if (claimed.has(name)) continue;
    units.push({ names: [name], weight: hits.get(name)!.weight });
  }

  return units;
}

/** Score a set of requirement units against a set of held skills. */
function scoreAgainst(
  units: RequirementUnit[],
  held: Set<string>,
): { score: number; matchedWeight: number; totalWeight: number } {
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const unit of units) {
    totalWeight += unit.weight;
    if (unit.names.some((n) => held.has(n))) matchedWeight += unit.weight;
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

/**
 * Category breakdown, computed at the same unit granularity as the score.
 *
 * This has to walk `units` rather than `hits` directly, or an alternatives
 * clause like "PyTorch or TensorFlow" would count as two required ML skills
 * with one matched — a category bar reading "1/2" for a requirement the
 * headline score already treats as fully satisfied is exactly the kind of
 * quiet inconsistency this project exists to not have.
 */
function buildCategories(
  units: RequirementUnit[],
  hits: Map<string, SkillHit>,
  held: Set<string>,
): CategoryScore[] {
  const buckets = new Map<SkillCategory, { matched: number; required: number }>();

  for (const unit of units) {
    // Alternatives are near-always same-category (PyTorch/TensorFlow are both
    // "ml"); the first member is a reasonable representative on the rare
    // occasion they differ.
    const category = hits.get(unit.names[0])!.category;
    const bucket = buckets.get(category) ?? { matched: 0, required: 0 };
    bucket.required += 1;
    if (unit.names.some((n) => held.has(n))) bucket.matched += 1;
    buckets.set(category, bucket);
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
 * For an unsatisfied alternatives clause, every member unlocks the same unit
 * weight, so the delta is computed once and the suggestion names the whole
 * clause ("AWS or GCP or Azure") rather than listing each alternative
 * separately with an identical number next to it.
 */
function buildCounterfactuals(
  units: RequirementUnit[],
  hits: Map<string, SkillHit>,
  held: Set<string>,
  baseScore: number,
): Counterfactual[] {
  const out: Counterfactual[] = [];

  for (const unit of units) {
    if (unit.names.some((n) => held.has(n))) continue;

    const hypothetical = new Set(held);
    hypothetical.add(unit.names[0]);
    const { score } = scoreAgainst(units, hypothetical);
    const delta = score - baseScore;
    if (delta <= 0) continue;

    const first = hits.get(unit.names[0])!;
    const framing =
      unit.weight === WEIGHT_REQUIRED
        ? "listed as a hard requirement"
        : unit.weight === WEIGHT_NICE
          ? "listed as a nice-to-have"
          : "named in the posting";

    const label = unit.names.join(" or ");
    const reason =
      unit.names.length > 1
        ? `Any one of ${label} is ${framing}, and none of them is on the resume.`
        : `${label} is ${framing} and is absent from the resume.`;

    out.push({ skill: label, category: first.category, delta, reason });
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
  const { hits, groups } = extractRequirements(job);
  const held = new Set(resumeSkills.keys());
  const units = buildUnits(hits, groups);

  const { score } = scoreAgainst(units, held);

  const matched: SkillHit[] = [];
  const missing: SkillHit[] = [];

  for (const unit of units) {
    const heldName = unit.names.find((n) => held.has(n));

    if (heldName) {
      const hit = hits.get(heldName)!;
      const alternatives = unit.names.filter((n) => n !== heldName);
      matched.push({
        ...hit,
        // Report the resume's own evidence and proficiency guess for a match,
        // not the posting's.
        evidence: resumeSkills.get(heldName)?.evidence ?? hit.evidence,
        proficiency: resumeSkills.get(heldName)?.proficiency,
        alternatives: alternatives.length ? alternatives : undefined,
      });
    } else {
      // Nothing in this unit is held — every alternative is a real gap, each
      // aware that satisfying any sibling would close the same gap.
      for (const name of unit.names) {
        const hit = hits.get(name)!;
        const alternatives = unit.names.filter((n) => n !== name);
        missing.push({ ...hit, alternatives: alternatives.length ? alternatives : undefined });
      }
    }
  }

  const byWeightThenName = (a: SkillHit, b: SkillHit) =>
    b.weight - a.weight || a.skill.localeCompare(b.skill);
  matched.sort(byWeightThenName);
  missing.sort(byWeightThenName);

  const extra: SkillHit[] = [...resumeSkills.values()]
    .filter((hit) => !hits.has(hit.skill))
    .sort((a, b) => a.skill.localeCompare(b.skill));

  return {
    score,
    band: bandFor(score),
    matched,
    missing,
    extra,
    categories: buildCategories(units, hits, held),
    counterfactuals: buildCounterfactuals(units, hits, held, score),
    ats: buildAtsChecks(resume, matched.length),
    stats: {
      resumeWords: countWords(resume),
      jobWords: countWords(job),
      skillsDetected: resumeSkills.size,
      requirementsDetected: hits.size,
    },
  };
}

/** Exported for tests — the scoring maths without the presentation layer. */
export const __internals = {
  aliasPattern,
  extractSkills,
  extractRequirements,
  buildUnits,
  groupAlternatives,
  scoreAgainst,
  bandFor,
  classifyProficiency,
  WEIGHT_REQUIRED,
  WEIGHT_DEFAULT,
  WEIGHT_NICE,
};
