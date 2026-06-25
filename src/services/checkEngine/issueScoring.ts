import type { CheckIssue } from "../../types/report";

export function deduplicateIssues(issues: CheckIssue[]): CheckIssue[] {
  const map = new Map<string, CheckIssue>();
  for (const issue of issues) {
    const key = [
      issue.code,
      issue.category,
      issue.objectType ?? "",
      issue.objectNumber ?? "",
      issue.location.section ?? "",
      issue.objectNumber ? "" : issue.message
    ].join("|");
    const existing = map.get(key);
    if (!existing) {
      map.set(key, issue);
      continue;
    }
    const occurrences = [...(existing.occurrences ?? []), ...(issue.occurrences ?? [])];
    if (!occurrences.length && issue.location.paragraphIndex !== undefined) {
      occurrences.push({
        paragraphIndex: issue.location.paragraphIndex,
        section: issue.location.section,
        excerpt: issue.excerpt
      });
    }
    map.set(key, {
      ...existing,
      occurrences,
      reason: existing.reason ?? issue.reason
    });
  }
  return Array.from(map.values());
}

function confidenceMultiplier(confidence: CheckIssue["confidence"]): number {
  if (confidence === "high") return 1;
  if (confidence === "medium") return 0.6;
  if (confidence === "low") return 0.25;
  return 0;
}

export function calculateIssueScore(issues: CheckIssue[]): number {
  const uniqueIssues = deduplicateIssues(issues);
  const penalty = uniqueIssues.reduce((sum, issue) => {
    const base = issue.level === "critical" ? 12 : issue.level === "error" ? 6 : issue.level === "warning" ? 2 : 0;
    return sum + base * confidenceMultiplier(issue.confidence);
  }, 0);
  const hasCriticalOrError = uniqueIssues.some((issue) => issue.level === "critical" || issue.level === "error");
  const floor = hasCriticalOrError ? 0 : 70;
  return Math.max(floor, Math.min(100, Math.round(100 - penalty)));
}
