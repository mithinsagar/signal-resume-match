/**
 * POST /api/analyze — score a resume against a role.
 *
 * The deterministic engine runs first and always. The model is asked for prose
 * only after there is already a complete result to return, so a provider
 * outage costs the narrative and nothing else.
 */

import { NextResponse } from "next/server";
import { analyzeMatch } from "@/lib/analyze";
import { generateNarrative, llmAvailable } from "@/lib/llm";
import type { AnalyzeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45;

const MIN_CHARS = 80;
const MAX_CHARS = 60_000;

export async function POST(request: Request) {
  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const resume = typeof body.resume === "string" ? body.resume.trim() : "";
  const job = typeof body.job === "string" ? body.job.trim() : "";

  if (resume.length < MIN_CHARS) {
    return NextResponse.json(
      { error: `The resume needs at least ${MIN_CHARS} characters to analyse.` },
      { status: 400 },
    );
  }
  if (job.length < MIN_CHARS) {
    return NextResponse.json(
      { error: `The job description needs at least ${MIN_CHARS} characters to analyse.` },
      { status: 400 },
    );
  }
  if (resume.length > MAX_CHARS || job.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "That input is far larger than a resume or posting. Trim it and retry." },
      { status: 413 },
    );
  }

  // Deterministic first — this is the part that must always succeed.
  const result = analyzeMatch(resume, job);

  if (result.stats.requirementsDetected === 0) {
    return NextResponse.json(
      {
        error:
          "No recognisable skills were found in that job description. It may be a summary rather than a full posting.",
      },
      { status: 422 },
    );
  }

  const wantsLlm = body.useLlm !== false;
  if (wantsLlm && llmAvailable()) {
    const narrative = await generateNarrative(result, resume, job);
    if (narrative) result.narrative = narrative;
  }

  return NextResponse.json(result);
}

/** Lets the client show whether a narrative is even possible before running. */
export async function GET() {
  return NextResponse.json({ llm: llmAvailable() });
}
