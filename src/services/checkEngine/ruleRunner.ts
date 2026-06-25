import type { ParsedDocument } from "../../types/document";
import type { CheckExecution, CheckIssue } from "../../types/report";
import type { Confidence, IssueCategory, IssueLevel } from "../../types/rules";
import type { RuleProfile } from "../../types/settings";
import { createId } from "../../utils/id";
import { excerpt } from "../../utils/text";
import { estimatedPageForIssue } from "../documentParser/documentModelBuilder";

export interface RuleCheckResult {
  execution: CheckExecution;
  issues: CheckIssue[];
}

export interface IssueInput {
  level: IssueLevel;
  confidence: Confidence;
  code: string;
  category: IssueCategory;
  message: string;
  paragraphIndex?: number;
  section?: string;
  excerpt?: string;
  recommendation: string;
  source?: CheckIssue["source"];
  reason?: string;
  expected?: string;
  actual?: string;
  parserEvidence?: string;
  whyDetected?: string;
  canBeFalsePositive?: boolean;
  objectType?: string;
  objectNumber?: string;
  occurrences?: CheckIssue["occurrences"];
}

export function createIssue(input: IssueInput, document: ParsedDocument, profile: RuleProfile): CheckIssue {
  const paragraph = input.paragraphIndex !== undefined ? document.paragraphs[input.paragraphIndex] : undefined;
  const level = profile.severityOverrides?.[input.code] ?? input.level;
  return {
    id: createId("issue"),
    level,
    confidence: input.confidence,
    code: input.code,
    category: input.category,
    message: input.message,
    location: {
      section: input.section ?? paragraph?.sectionTitle,
      paragraphIndex: input.paragraphIndex,
      estimatedPage: estimatedPageForIssue(input.paragraphIndex, document),
      page: null
    },
    excerpt: input.excerpt ?? (paragraph ? excerpt(paragraph.renderedText || paragraph.text) : undefined),
    recommendation: input.recommendation,
    source: input.source ?? "docx",
    ruleProfile: profile.name,
    reason: input.reason,
    expected: input.expected,
    actual: input.actual,
    parserEvidence: input.parserEvidence,
    whyDetected: input.whyDetected,
    canBeFalsePositive: input.canBeFalsePositive,
    objectType: input.objectType,
    objectNumber: input.objectNumber,
    occurrences: input.occurrences
  };
}

export function makeExecution(
  code: string,
  title: string,
  category: IssueCategory,
  issues: CheckIssue[],
  fallbackStatus?: CheckExecution["status"],
  message?: string
): CheckExecution {
  const status = fallbackStatus ?? (issues.length > 0 ? "failed" : "passed");
  return {
    code,
    title,
    category,
    status,
    issueCount: issues.length,
    message
  };
}
