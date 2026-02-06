import { describe, it, expect } from "vitest";
import {
  normalizeClauseName,
  clauseSatisfiesRule,
  calculateComplianceScore,
  getComplianceRules,
  complianceRulesDE,
  complianceRulesIT,
  complianceRulesAT,
  complianceRulesCH,
  type ComplianceRule,
  type ComplianceResult,
} from "../compliance-rules";

// =============================================================================
// normalizeClauseName
// =============================================================================

describe("normalizeClauseName", () => {
  it("converts to lowercase", () => {
    expect(normalizeClauseName("Urlaubsanspruch")).toBe("urlaubsanspruch");
  });

  it("converts umlauts to ASCII equivalents", () => {
    expect(normalizeClauseName("Kündigungsfrist")).toBe("kuendigungsfrist");
    expect(normalizeClauseName("Überstunden")).toBe("ueberstunden");
    expect(normalizeClauseName("Vergütung")).toBe("verguetung");
    expect(normalizeClauseName("Straße")).toBe("strasse");
  });

  it("normalizes separators to underscores", () => {
    expect(normalizeClauseName("ip-rechte")).toBe("ip_rechte");
    expect(normalizeClauseName("ip rechte")).toBe("ip_rechte");
    expect(normalizeClauseName("ip_rechte")).toBe("ip_rechte");
  });

  it("removes special characters", () => {
    expect(normalizeClauseName("§ 622 BGB")).toBe("_622_bgb");
  });

  it("handles multiple consecutive separators", () => {
    expect(normalizeClauseName("a--b__c  d")).toBe("a_b_c_d");
  });

  it("handles empty string", () => {
    expect(normalizeClauseName("")).toBe("");
  });
});

// =============================================================================
// clauseSatisfiesRule
// =============================================================================

describe("clauseSatisfiesRule", () => {
  const rule: ComplianceRule = {
    id: "test-rule",
    name: "Test",
    description: "Test rule",
    severity: "error",
    satisfiedByClauseNames: ["kuendigungsfrist", "kuendigung", "beendigung"],
    satisfiedByClauseIds: [10, 20],
  };

  it("matches by clause ID", () => {
    expect(clauseSatisfiesRule("anything", 10, rule)).toBe(true);
    expect(clauseSatisfiesRule("anything", 20, rule)).toBe(true);
  });

  it("does not match by wrong clause ID", () => {
    expect(clauseSatisfiesRule("nomatch", 99, rule)).toBe(false);
  });

  it("matches by exact normalized name", () => {
    expect(clauseSatisfiesRule("kuendigungsfrist", undefined, rule)).toBe(true);
  });

  it("matches by partial name (clause includes rule name)", () => {
    expect(
      clauseSatisfiesRule("meine_kuendigungsfrist_klausel", undefined, rule)
    ).toBe(true);
  });

  it("matches by partial name (rule name includes clause)", () => {
    expect(clauseSatisfiesRule("kuendigung", undefined, rule)).toBe(true);
  });

  it("handles umlauts in clause names", () => {
    expect(clauseSatisfiesRule("Kündigungsfrist", undefined, rule)).toBe(true);
  });

  it("does not match unrelated names", () => {
    expect(clauseSatisfiesRule("urlaub", undefined, rule)).toBe(false);
  });

  it("handles rule without satisfiedByClauseIds", () => {
    const ruleNoIds: ComplianceRule = {
      ...rule,
      satisfiedByClauseIds: undefined,
    };
    expect(clauseSatisfiesRule("kuendigungsfrist", 10, ruleNoIds)).toBe(true);
  });
});

// =============================================================================
// calculateComplianceScore
// =============================================================================

describe("calculateComplianceScore", () => {
  it("returns 100 for all passed results", () => {
    const results: ComplianceResult[] = [
      { ruleId: "1", ruleName: "A", status: "passed", severity: "error", message: "ok" },
      { ruleId: "2", ruleName: "B", status: "passed", severity: "warning", message: "ok" },
    ];
    expect(calculateComplianceScore(results)).toBe(100);
  });

  it("returns 0 for all failed results", () => {
    const results: ComplianceResult[] = [
      { ruleId: "1", ruleName: "A", status: "failed", severity: "error", message: "fail" },
      { ruleId: "2", ruleName: "B", status: "failed", severity: "warning", message: "fail" },
    ];
    expect(calculateComplianceScore(results)).toBe(0);
  });

  it("weighs errors more heavily than warnings", () => {
    // error = 20 weight, warning = 10 weight
    // If error fails and warning passes: earned = 10, total = 30 => 33%
    const results: ComplianceResult[] = [
      { ruleId: "1", ruleName: "A", status: "failed", severity: "error", message: "fail" },
      { ruleId: "2", ruleName: "B", status: "passed", severity: "warning", message: "ok" },
    ];
    expect(calculateComplianceScore(results)).toBe(33);
  });

  it("returns 100 for empty results", () => {
    expect(calculateComplianceScore([])).toBe(100);
  });

  it("handles info severity", () => {
    // info = 5 weight
    const results: ComplianceResult[] = [
      { ruleId: "1", ruleName: "A", status: "passed", severity: "info", message: "ok" },
      { ruleId: "2", ruleName: "B", status: "failed", severity: "info", message: "fail" },
    ];
    // earned = 5, total = 10 => 50%
    expect(calculateComplianceScore(results)).toBe(50);
  });
});

// =============================================================================
// getComplianceRules
// =============================================================================

describe("getComplianceRules", () => {
  it("returns DE rules for 'DE'", () => {
    expect(getComplianceRules("DE")).toBe(complianceRulesDE);
  });

  it("returns IT rules for 'IT'", () => {
    expect(getComplianceRules("IT")).toBe(complianceRulesIT);
  });

  it("returns AT rules for 'AT'", () => {
    expect(getComplianceRules("AT")).toBe(complianceRulesAT);
  });

  it("returns CH rules for 'CH'", () => {
    expect(getComplianceRules("CH")).toBe(complianceRulesCH);
  });

  it("is case-insensitive", () => {
    expect(getComplianceRules("de")).toBe(complianceRulesDE);
  });

  it("defaults to DE rules for unknown country", () => {
    expect(getComplianceRules("XX")).toBe(complianceRulesDE);
  });
});

// =============================================================================
// Rule data integrity
// =============================================================================

describe("rule data integrity", () => {
  const allRules = [
    ...complianceRulesDE,
    ...complianceRulesIT,
    ...complianceRulesAT,
    ...complianceRulesCH,
  ];

  it("all rules have unique IDs", () => {
    const ids = allRules.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all rules have non-empty satisfiedByClauseNames", () => {
    for (const rule of allRules) {
      expect(rule.satisfiedByClauseNames.length).toBeGreaterThan(0);
    }
  });

  it("all rules have valid severity", () => {
    for (const rule of allRules) {
      expect(["error", "warning", "info"]).toContain(rule.severity);
    }
  });

  it("DE rules include essential NachwG requirements", () => {
    const ruleIds = complianceRulesDE.map((r) => r.id);
    expect(ruleIds).toContain("de-nachwg-kuendigung");
    expect(ruleIds).toContain("de-nachwg-arbeitszeit");
    expect(ruleIds).toContain("de-burlg-urlaub");
    expect(ruleIds).toContain("de-nachwg-verguetung");
    expect(ruleIds).toContain("de-nachwg-taetigkeit");
    expect(ruleIds).toContain("de-dsgvo-datenschutz");
  });
});
