/**
 * The optional narrative layer.
 *
 * Everything here is additive. `analyzeMatch` has already produced the score,
 * the matched and missing skills and the counterfactuals before this module is
 * called; the model is asked only to explain that result in prose. If no key is
 * configured, if the provider is down, or if it returns something unparseable,
 * the caller drops the narrative and the app renders the full analysis without
 * it. The model is never in the path of a number.
 *
 * All four supported providers expose an OpenAI-compatible chat completions
 * endpoint, so a single client covers them — the only difference is the base
 * URL, the key and the default model.
 */

import OpenAI from "openai";
import type { MatchResult, MatchNarrative } from "./types";

interface ProviderConfig {
  id: string;
  label: string;
  envVar: string;
  baseURL: string;
  defaultModel: string;
}

/**
 * Resolution order. Groq is first because its free tier is the fastest and
 * needs no card; Gemini second for its much larger daily allowance.
 */
const PROVIDERS: ProviderConfig[] = [
  {
    id: "groq",
    label: "Groq",
    envVar: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-120b",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    envVar: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.0-flash",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    envVar: "CEREBRAS_API_KEY",
    baseURL: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
  },
];

function resolveProvider(): { config: ProviderConfig; apiKey: string } | null {
  for (const config of PROVIDERS) {
    const apiKey = process.env[config.envVar]?.trim();
    if (apiKey) return { config, apiKey };
  }
  return null;
}

/** Whether any provider is configured — used to tell the UI what to expect. */
export function llmAvailable(): boolean {
  return resolveProvider() !== null;
}

export function activeProviderLabel(): string | null {
  return resolveProvider()?.config.label ?? null;
}

const SYSTEM_PROMPT = `You are a blunt, experienced technical recruiter reviewing a candidate against a specific role.

You will be given a pre-computed match analysis. The score and the skill lists are already final and were produced by a deterministic engine — do not recompute, dispute, or restate them numerically. Your job is to explain what they mean in practice.

Respond with strict JSON only, no markdown fence, matching:
{
  "summary": "2-3 sentences on how this candidate actually stacks up for this specific role. Concrete and honest. If it's a weak match, say so plainly.",
  "strengths": ["3-4 short phrases naming what genuinely helps them here"],
  "gaps": ["2-4 short phrases naming what would actually block them, most serious first"]
}

Rules:
- Reference real skills from the data, never invented ones.
- No flattery, no hedging, no "as an AI".
- Each strength and gap is a phrase, not a sentence. Under 12 words.
- If the resume is strong but the role is a stretch, say which direction the mismatch runs.`;

function buildUserPrompt(result: MatchResult, resume: string, job: string): string {
  const top = (xs: { skill: string }[], n = 12) =>
    xs.slice(0, n).map((x) => x.skill).join(", ") || "none";

  return [
    `ROLE REQUIREMENTS DETECTED: ${result.stats.requirementsDetected}`,
    `OVERALL MATCH: ${result.score}/100 (${result.band})`,
    ``,
    `MATCHED SKILLS: ${top(result.matched)}`,
    `MISSING SKILLS: ${top(result.missing)}`,
    `CANDIDATE EXTRAS NOT ASKED FOR: ${top(result.extra, 8)}`,
    ``,
    `CATEGORY BREAKDOWN:`,
    ...result.categories.map((c) => `  ${c.label}: ${c.matched}/${c.required} (${c.score}%)`),
    ``,
    `HIGHEST-LEVERAGE GAPS:`,
    ...result.counterfactuals.slice(0, 4).map((c) => `  ${c.skill}: +${c.delta} points`),
    ``,
    `--- JOB DESCRIPTION (truncated) ---`,
    job.slice(0, 2500),
    ``,
    `--- RESUME (truncated) ---`,
    resume.slice(0, 3500),
  ].join("\n");
}

/** Pull a JSON object out of a response that may still be fenced or prefixed. */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, limit);
}

/**
 * Ask the configured provider to narrate a finished analysis.
 *
 * Returns null rather than throwing on every failure path — a missing key, a
 * rate limit, a timeout and a malformed response are all the same thing from
 * the caller's point of view: no narrative this time, render the rest.
 */
export async function generateNarrative(
  result: MatchResult,
  resume: string,
  job: string,
): Promise<MatchNarrative | null> {
  const resolved = resolveProvider();
  if (!resolved) return null;

  const { config, apiKey } = resolved;
  const model = process.env.LLM_MODEL?.trim() || config.defaultModel;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: config.baseURL,
      // The whole request is discretionary; never let it hold a response open.
      timeout: 20_000,
      maxRetries: 1,
    });

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      // Generous because several current defaults are reasoning models: they
      // spend tokens thinking before emitting any content, and a budget sized
      // only for the JSON comes back with an empty `content` field.
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(result, resume, job) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = extractJson(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed.summary !== "string") return null;

    return {
      summary: parsed.summary.trim(),
      strengths: asStringArray(parsed.strengths, 5),
      gaps: asStringArray(parsed.gaps, 5),
      provider: config.label,
      model,
    };
  } catch (error) {
    // Logged for the operator, invisible to the user — they still get the score.
    console.error(`[llm] ${config.id} narrative failed:`, error);
    return null;
  }
}
