import { describe, expect, it } from "vitest";
import { __internals, analyzeMatch } from "../src/lib/analyze";
import { SAMPLE_JOB, SAMPLE_RESUME } from "../src/lib/samples";

const { aliasPattern, extractRequirements, extractSkills, scoreAgainst, bandFor } = __internals;

/**
 * The scorer is the only thing in this app a user is asked to trust, so the
 * tests concentrate on the two places it could quietly be wrong: token
 * boundaries (a matcher that fires inside other words inflates every score)
 * and requirement weighting (the thing that makes a must-have gap cost more
 * than a nice-to-have one).
 */

describe("aliasPattern boundaries", () => {
  it("matches a standalone token", () => {
    expect(aliasPattern("python").test("experience with python and sql")).toBe(true);
  });

  it("does not fire inside a longer word", () => {
    // The classic false positive: "r" matching inside every other word.
    expect(aliasPattern("r").test("strong communicator")).toBe(false);
    expect(aliasPattern("go").test("google cloud platform")).toBe(false);
    expect(aliasPattern("java").test("javascript developer")).toBe(false);
  });

  it("handles aliases containing regex-special characters", () => {
    expect(aliasPattern("c++").test("proficient in c++ and rust")).toBe(true);
    expect(aliasPattern("c#").test("built in c# on .net")).toBe(true);
    expect(aliasPattern("node.js").test("node.js backend")).toBe(true);
  });

  it("does not let bare c match c++ or c#", () => {
    expect(aliasPattern("c").test("c++")).toBe(false);
    expect(aliasPattern("c").test("c#")).toBe(false);
    expect(aliasPattern("c").test("wrote c and assembly")).toBe(true);
  });

  it("matches a dot-leading alias inside a compound", () => {
    expect(aliasPattern(".net").test("asp.net core")).toBe(true);
  });

  it("matches a skill that ends a sentence", () => {
    // Regression: the trailing boundary originally excluded ".", so every
    // requirement written as "Must have Python." was silently dropped from
    // the score — the most common shape a requirement takes in a real posting.
    expect(aliasPattern("python").test("must have python.")).toBe(true);
    expect(aliasPattern("docker").test("comfortable with docker.")).toBe(true);
  });

  it("still refuses to match across a dot on the leading side", () => {
    // "js" must not fire inside "node.js" and double-count the same fact.
    expect(aliasPattern("js").test("node.js backend")).toBe(false);
  });
});

describe("skill extraction", () => {
  it("resolves different surface forms to one canonical skill", () => {
    const a = extractSkills("Worked with PostgreSQL daily");
    const b = extractSkills("worked with postgres daily");
    expect(a.has("PostgreSQL")).toBe(true);
    expect(b.has("PostgreSQL")).toBe(true);
  });

  it("records which alias actually appeared, for evidence", () => {
    const found = extractSkills("deep experience with psql");
    expect(found.get("PostgreSQL")?.evidence).toBe("psql");
  });

  it("finds nothing in text with no skills", () => {
    expect(extractSkills("I enjoy long walks and good coffee.").size).toBe(0);
  });
});

describe("requirement weighting", () => {
  it("weights a must-have above a nice-to-have", () => {
    const reqs = extractRequirements(
      ["Must have strong Python experience.", "Familiarity with Kafka is a plus."].join("\n"),
    );
    expect(reqs.get("Python")!.weight).toBeGreaterThan(reqs.get("Kafka")!.weight);
  });

  it("carries a section heading down to the lines beneath it", () => {
    const reqs = extractRequirements(
      ["Requirements:", "- Docker in production", "", "Nice to have:", "- Terraform"].join("\n"),
    );
    expect(reqs.get("Docker")!.weight).toBe(__internals.WEIGHT_REQUIRED);
    expect(reqs.get("Terraform")!.weight).toBe(__internals.WEIGHT_NICE);
  });

  it("lets a line's own marker override the section it sits in", () => {
    const reqs = extractRequirements(
      ["Requirements:", "- Kubernetes", "- Exposure to Rust is a bonus"].join("\n"),
    );
    expect(reqs.get("Kubernetes")!.weight).toBe(__internals.WEIGHT_REQUIRED);
    expect(reqs.get("Rust")!.weight).toBe(__internals.WEIGHT_NICE);
  });

  it("keeps the strongest framing when a skill appears twice", () => {
    const reqs = extractRequirements(
      ["Familiarity with AWS is a plus.", "Must have deep AWS knowledge."].join("\n"),
    );
    expect(reqs.get("AWS")!.weight).toBe(__internals.WEIGHT_REQUIRED);
  });
});

describe("scoring", () => {
  it("is 100 when every requirement is held", () => {
    const reqs = extractRequirements("Required: Python, Docker, AWS");
    const held = new Set(["Python", "Docker", "AWS"]);
    expect(scoreAgainst(reqs, held).score).toBe(100);
  });

  it("is 0 when none are held", () => {
    const reqs = extractRequirements("Required: Python, Docker, AWS");
    expect(scoreAgainst(reqs, new Set()).score).toBe(0);
  });

  it("does not divide by zero on a posting with no recognisable skills", () => {
    const reqs = extractRequirements("We are looking for a wonderful human being.");
    expect(scoreAgainst(reqs, new Set()).score).toBe(0);
  });

  it("penalises a missing must-have more than a missing nice-to-have", () => {
    const job = ["Must have Python.", "Familiarity with Kafka is a plus."].join("\n");
    const reqs = extractRequirements(job);

    const missingMustHave = scoreAgainst(reqs, new Set(["Kafka"])).score;
    const missingNiceToHave = scoreAgainst(reqs, new Set(["Python"])).score;

    expect(missingNiceToHave).toBeGreaterThan(missingMustHave);
  });

  it("bands the full range", () => {
    expect(bandFor(95)).toBe("strong");
    expect(bandFor(80)).toBe("strong");
    expect(bandFor(79)).toBe("promising");
    expect(bandFor(60)).toBe("promising");
    expect(bandFor(59)).toBe("partial");
    expect(bandFor(40)).toBe("partial");
    expect(bandFor(39)).toBe("weak");
    expect(bandFor(0)).toBe("weak");
  });
});

describe("analyzeMatch end to end", () => {
  const result = analyzeMatch(SAMPLE_RESUME, SAMPLE_JOB);

  it("is deterministic — the same inputs give the same score", () => {
    const again = analyzeMatch(SAMPLE_RESUME, SAMPLE_JOB);
    expect(again.score).toBe(result.score);
    expect(again.matched.map((m) => m.skill)).toEqual(result.matched.map((m) => m.skill));
  });

  it("produces a score inside the valid range", () => {
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("puts every requirement in exactly one of matched or missing", () => {
    const total = result.matched.length + result.missing.length;
    expect(total).toBe(result.stats.requirementsDetected);

    const overlap = result.matched.filter((m) =>
      result.missing.some((x) => x.skill === m.skill),
    );
    expect(overlap).toHaveLength(0);
  });

  it("finds the sample's real overlap and its real gaps", () => {
    const matched = result.matched.map((m) => m.skill);
    const missing = result.missing.map((m) => m.skill);

    // The sample resume genuinely has these; the posting genuinely asks for them.
    expect(matched).toContain("Python");
    expect(matched).toContain("PyTorch");

    // And genuinely lacks these, which the posting lists as hard requirements.
    expect(missing).toContain("Kubernetes");
    expect(missing).toContain("Terraform");
  });

  it("never suggests a counterfactual for a skill already held", () => {
    const held = new Set(result.matched.map((m) => m.skill));
    for (const cf of result.counterfactuals) {
      expect(held.has(cf.skill)).toBe(false);
    }
  });

  it("reports counterfactual deltas that the scorer actually reproduces", () => {
    const reqs = extractRequirements(SAMPLE_JOB);
    const held = new Set(extractSkills(SAMPLE_RESUME).keys());

    for (const cf of result.counterfactuals) {
      const hypothetical = new Set(held);
      hypothetical.add(cf.skill);
      const actual = scoreAgainst(reqs, hypothetical).score - result.score;
      expect(cf.delta).toBe(actual);
    }
  });

  it("orders counterfactuals by descending impact", () => {
    const deltas = result.counterfactuals.map((c) => c.delta);
    expect([...deltas].sort((a, b) => b - a)).toEqual(deltas);
  });

  it("classifies extras as skills the posting never asked for", () => {
    const requirements = new Set(extractRequirements(SAMPLE_JOB).keys());
    for (const extra of result.extra) {
      expect(requirements.has(extra.skill)).toBe(false);
    }
  });

  it("runs the ATS checks and returns one entry per check", () => {
    expect(result.ats.length).toBeGreaterThanOrEqual(6);
    for (const check of result.ats) {
      expect(typeof check.passed).toBe("boolean");
      expect(check.detail.length).toBeGreaterThan(0);
    }
  });

  it("flags a resume with no contact details", () => {
    const anonymous = SAMPLE_RESUME.replace(/priya\.narayanan@example\.com/i, "");
    const out = analyzeMatch(anonymous, SAMPLE_JOB);
    expect(out.ats.find((c) => c.id === "contact")!.passed).toBe(false);
  });
});
