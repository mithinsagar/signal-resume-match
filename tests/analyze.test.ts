import { describe, expect, it } from "vitest";
import { __internals, analyzeMatch } from "../src/lib/analyze";
import { SAMPLE_JOB, SAMPLE_RESUME } from "../src/lib/samples";

const {
  aliasPattern,
  extractRequirements,
  extractSkills,
  buildUnits,
  groupAlternatives,
  scoreAgainst,
  bandFor,
  classifyProficiency,
} = __internals;

/**
 * The scorer is the only thing in this app a user is asked to trust, so the
 * tests concentrate on the places it could quietly be wrong: token boundaries
 * (a matcher that fires inside other words inflates every score), requirement
 * weighting (must-have vs nice-to-have), "X or Y" alternatives (double-
 * counting a gap that's actually satisfied), and the proficiency heuristic
 * staying strictly out of the score it's never supposed to touch.
 */

describe("aliasPattern boundaries", () => {
  it("matches a standalone token", () => {
    expect(aliasPattern("python").test("experience with python and sql")).toBe(true);
  });

  it("does not fire inside a longer word", () => {
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

describe("proficiency heuristic", () => {
  it("reads years of experience as demonstrated", () => {
    expect(classifyProficiency("5 years of hands-on python development")).toBe("demonstrated");
  });

  it("reads ownership language as demonstrated", () => {
    expect(classifyProficiency("led the migration to kubernetes in production")).toBe(
      "demonstrated",
    );
  });

  it("reads hedged language as learning", () => {
    expect(classifyProficiency("familiar with rust from a personal project")).toBe("learning");
  });

  it("defaults to a plain mention when neither signal is present", () => {
    expect(classifyProficiency("skills: python, sql, docker")).toBe("mentioned");
  });

  it("prefers demonstrated over learning when both appear in the window", () => {
    // Order matters: a strong signal should win even if a weaker phrase is
    // also nearby, rather than the heuristic flip-flopping on phrase order.
    expect(classifyProficiency("5 years building production systems, familiar with the basics")).toBe(
      "demonstrated",
    );
  });

  it("is wired into extractSkills for a matched resume skill", () => {
    const found = extractSkills("Built and shipped production Kubernetes clusters for 4 years.");
    expect(found.get("Kubernetes")?.proficiency).toBe("demonstrated");
  });

  it("never appears on a job posting's requirements — only resume-side hits", () => {
    const { hits } = extractRequirements("Must have 5 years of production Python experience.");
    expect(hits.get("Python")?.proficiency).toBeUndefined();
  });
});

describe("requirement weighting", () => {
  it("weights a must-have above a nice-to-have", () => {
    const { hits } = extractRequirements(
      ["Must have strong Python experience.", "Familiarity with Kafka is a plus."].join("\n"),
    );
    expect(hits.get("Python")!.weight).toBeGreaterThan(hits.get("Kafka")!.weight);
  });

  it("carries a section heading down to the lines beneath it", () => {
    const { hits } = extractRequirements(
      ["Requirements:", "- Docker in production", "", "Nice to have:", "- Ansible"].join("\n"),
    );
    expect(hits.get("Docker")!.weight).toBe(__internals.WEIGHT_REQUIRED);
    expect(hits.get("Ansible")!.weight).toBe(__internals.WEIGHT_NICE);
  });

  it("lets a line's own marker override the section it sits in", () => {
    const { hits } = extractRequirements(
      ["Requirements:", "- Kubernetes", "- Exposure to Rust is a bonus"].join("\n"),
    );
    expect(hits.get("Kubernetes")!.weight).toBe(__internals.WEIGHT_REQUIRED);
    expect(hits.get("Rust")!.weight).toBe(__internals.WEIGHT_NICE);
  });

  it("keeps the strongest framing when a skill appears twice", () => {
    const { hits } = extractRequirements(
      ["Familiarity with AWS is a plus.", "Must have deep AWS knowledge."].join("\n"),
    );
    expect(hits.get("AWS")!.weight).toBe(__internals.WEIGHT_REQUIRED);
  });
});

describe("alternatives grouping — 'X or Y' clauses", () => {
  it("groups a simple two-way 'or'", () => {
    const groups = groupAlternatives("must have pytorch or tensorflow experience");
    expect(groups).toEqual([["PyTorch", "TensorFlow"]]);
  });

  it("groups a slash-separated list with no 'or' at all", () => {
    const groups = groupAlternatives("experience with aws/gcp/azure required");
    expect(groups.length).toBe(1);
    expect(new Set(groups[0])).toEqual(new Set(["AWS", "GCP", "Azure"]));
  });

  it("groups a comma chain that ends in 'or'", () => {
    const groups = groupAlternatives("experience with react, vue, or angular");
    expect(groups.length).toBe(1);
    expect(new Set(groups[0])).toEqual(new Set(["React", "Vue", "Angular"]));
  });

  it("does NOT group a plain comma list with no 'or' or '/'", () => {
    // "Python, SQL and Docker" means all three, not any one of them — the most
    // common shape a real requirements bullet takes, and the case the grouping
    // logic must not touch.
    const groups = groupAlternatives("experience with python, sql and docker");
    expect(groups).toEqual([]);
  });

  it("does not group skills separated by an unrelated clause", () => {
    const groups = groupAlternatives("python required, and separately docker is a plus");
    expect(groups).toEqual([]);
  });

  it("returns nothing for a line with fewer than two skills", () => {
    expect(groupAlternatives("must have python")).toEqual([]);
    expect(groupAlternatives("no skills named here")).toEqual([]);
  });
});

describe("buildUnits", () => {
  it("collapses a group into one unit satisfied by any member", () => {
    const { hits, groups } = extractRequirements("Must have PyTorch or TensorFlow.");
    const units = buildUnits(hits, groups);
    expect(units).toHaveLength(1);
    expect(new Set(units[0].names)).toEqual(new Set(["PyTorch", "TensorFlow"]));
  });

  it("a satisfied group's weight matches the stronger framing on the line", () => {
    const { hits, groups } = extractRequirements("Must have PyTorch or TensorFlow.");
    const units = buildUnits(hits, groups);
    expect(units[0].weight).toBe(__internals.WEIGHT_REQUIRED);
  });

  it("leaves ungrouped skills as their own single-member units", () => {
    const { hits, groups } = extractRequirements("Must have Python and SQL.");
    const units = buildUnits(hits, groups);
    expect(units.map((u) => u.names)).toEqual(
      expect.arrayContaining([["Python"], ["SQL"]]),
    );
  });

  it("does not let a skill be claimed by two overlapping groups", () => {
    // Constructed rather than natural language: two groups both naming "Python"
    // must not double-count its weight in totalWeight.
    const hits = new Map([
      ["Python", { skill: "Python", category: "languages" as const, weight: 3 }],
      ["Go", { skill: "Go", category: "languages" as const, weight: 3 }],
      ["Rust", { skill: "Rust", category: "languages" as const, weight: 1 }],
    ]);
    const units = buildUnits(hits, [
      ["Python", "Go"],
      ["Python", "Rust"],
    ]);
    const pythonUnits = units.filter((u) => u.names.includes("Python"));
    expect(pythonUnits).toHaveLength(1);
  });
});

describe("scoring", () => {
  it("is 100 when every unit is held", () => {
    const { hits, groups } = extractRequirements("Required: Python, Docker, AWS");
    const units = buildUnits(hits, groups);
    expect(scoreAgainst(units, new Set(["Python", "Docker", "AWS"])).score).toBe(100);
  });

  it("is 0 when none are held", () => {
    const { hits, groups } = extractRequirements("Required: Python, Docker, AWS");
    const units = buildUnits(hits, groups);
    expect(scoreAgainst(units, new Set()).score).toBe(0);
  });

  it("does not divide by zero on a posting with no recognisable skills", () => {
    const { hits, groups } = extractRequirements("We are looking for a wonderful human being.");
    const units = buildUnits(hits, groups);
    expect(scoreAgainst(units, new Set()).score).toBe(0);
  });

  it("penalises a missing must-have more than a missing nice-to-have", () => {
    const job = ["Must have Python.", "Familiarity with Kafka is a plus."].join("\n");
    const { hits, groups } = extractRequirements(job);
    const units = buildUnits(hits, groups);

    const missingMustHave = scoreAgainst(units, new Set(["Kafka"])).score;
    const missingNiceToHave = scoreAgainst(units, new Set(["Python"])).score;

    expect(missingNiceToHave).toBeGreaterThan(missingMustHave);
  });

  it("an 'or' group is fully satisfied by just one of its members", () => {
    const { hits, groups } = extractRequirements("Must have PyTorch or TensorFlow.");
    const units = buildUnits(hits, groups);
    expect(scoreAgainst(units, new Set(["PyTorch"])).score).toBe(100);
    expect(scoreAgainst(units, new Set(["TensorFlow"])).score).toBe(100);
    expect(scoreAgainst(units, new Set(["PyTorch", "TensorFlow"])).score).toBe(100);
    expect(scoreAgainst(units, new Set()).score).toBe(0);
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

  it("resolves the sample's PyTorch-or-TensorFlow clause instead of double-penalising it", () => {
    // The sample job asks for "PyTorch or TensorFlow"; the sample resume only
    // has PyTorch. TensorFlow must not show up as a separate gap now that its
    // alternative is satisfied — this is the exact bug the grouping fixes.
    expect(result.matched.some((m) => m.skill === "PyTorch")).toBe(true);
    expect(result.missing.some((m) => m.skill === "TensorFlow")).toBe(false);

    const pytorch = result.matched.find((m) => m.skill === "PyTorch")!;
    expect(pytorch.alternatives).toContain("TensorFlow");
  });

  it("every hit is accounted for: matched, missing, or an unselected member of a satisfied group", () => {
    const { hits, groups } = extractRequirements(SAMPLE_JOB);
    const units = buildUnits(hits, groups);
    const explained = new Set([
      ...result.matched.map((m) => m.skill),
      ...result.missing.map((m) => m.skill),
    ]);

    for (const unit of units) {
      const satisfied = unit.names.some((n) => explained.has(n) && result.matched.some((m) => m.skill === n));
      if (satisfied) {
        // At least the held member must be explained; unheld siblings are
        // intentionally dropped rather than reported as false gaps.
        continue;
      }
      for (const name of unit.names) expect(explained.has(name)).toBe(true);
    }
  });

  it("never lists the same skill in both matched and missing", () => {
    const overlap = result.matched.filter((m) =>
      result.missing.some((x) => x.skill === m.skill),
    );
    expect(overlap).toHaveLength(0);
  });

  it("finds the sample's real overlap and its real gaps", () => {
    const matched = result.matched.map((m) => m.skill);
    const missing = result.missing.map((m) => m.skill);

    expect(matched).toContain("Python");
    expect(matched).toContain("PyTorch");

    expect(missing).toContain("Kubernetes");
    expect(missing).toContain("Terraform");
  });

  it("never suggests a counterfactual for a skill already held", () => {
    const held = new Set(result.matched.map((m) => m.skill));
    for (const cf of result.counterfactuals) {
      for (const name of cf.skill.split(" or ")) {
        expect(held.has(name)).toBe(false);
      }
    }
  });

  it("reports counterfactual deltas that the scorer actually reproduces", () => {
    const { hits, groups } = extractRequirements(SAMPLE_JOB);
    const units = buildUnits(hits, groups);
    const held = new Set(extractSkills(SAMPLE_RESUME).keys());

    for (const cf of result.counterfactuals) {
      const firstName = cf.skill.split(" or ")[0];
      const hypothetical = new Set(held);
      hypothetical.add(firstName);
      const actual = scoreAgainst(units, hypothetical).score - result.score;
      expect(cf.delta).toBe(actual);
    }
  });

  it("orders counterfactuals by descending impact", () => {
    const deltas = result.counterfactuals.map((c) => c.delta);
    expect([...deltas].sort((a, b) => b - a)).toEqual(deltas);
  });

  it("classifies extras as skills the posting never asked for", () => {
    const { hits } = extractRequirements(SAMPLE_JOB);
    for (const extra of result.extra) {
      expect(hits.has(extra.skill)).toBe(false);
    }
  });

  it("gives every matched skill a proficiency reading", () => {
    for (const m of result.matched) {
      expect(["demonstrated", "mentioned", "learning"]).toContain(m.proficiency);
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
