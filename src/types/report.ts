import type { Confidence, IssueCategory, IssueLevel } from "./rules";
import type { ParsedDocumentStats } from "./document";
import type { WorkType } from "./settings";
import type { VisualLayerMode } from "./visualLayer";

export type IssueSource = "docx" | "pdf" | "htmlPreview" | "ocr" | "system";
export type InputMode = "docxOnly" | "docxWithPdf" | "pdfOnly";

export interface IssueLocation {
  section?: string;
  paragraphIndex?: number;
  estimatedPage?: number | null;
  page?: number | null;
}

export interface CheckIssue {
  id: string;
  level: IssueLevel;
  confidence: Confidence;
  code: string;
  category: IssueCategory;
  message: string;
  location: IssueLocation;
  excerpt?: string;
  recommendation: string;
  source: IssueSource;
  ruleProfile: string;
  reason?: string;
  expected?: string;
  actual?: string;
  parserEvidence?: string;
  whyDetected?: string;
  canBeFalsePositive?: boolean;
  objectType?: string;
  objectNumber?: string;
  occurrences?: Array<{
    paragraphIndex?: number;
    section?: string;
    excerpt?: string;
    objectNumber?: string;
    caption?: string;
  }>;
}

export interface CheckExecution {
  code: string;
  title: string;
  category: IssueCategory;
  status: "passed" | "failed" | "partial" | "notAvailable";
  issueCount: number;
  message?: string;
}

export interface ReportStats extends ParsedDocumentStats {
  critical: number;
  errors: number;
  warnings: number;
  info: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  unknownConfidence: number;
  manualReview: number;
}

export interface ChecksSummary {
  total: number;
  passed: number;
  failed: number;
  partial: number;
  notAvailable: number;
}

export interface NotAvailableCheck {
  code: string;
  title: string;
  reason: string;
}

export interface ReportDebug {
  activeProfileId?: string;
  activeWorkType?: WorkType;
  detectedSections: Array<{
    rawText: string;
    normalizedText: string;
    paragraphIndex: number;
    styleId?: string;
    styleName?: string;
  }>;
  detectedCaptions: Array<{
    type: "figure" | "table" | "listing" | "formula" | "scheme";
    number: string;
    title: string;
    paragraphIndex: number;
    rawText: string;
    source?: string;
    numbering?: unknown;
  }>;
  detectedHeadings?: ReportDebug["detectedSections"];
  detectedTables?: Array<{ number?: string; paragraphIndex: number; caption?: string; rawText: string }>;
  detectedFigures?: Array<{ number?: string; paragraphIndex: number; rawText: string }>;
  detectedFormulas?: Array<{ number?: string; paragraphIndex: number; rawText: string }>;
  detectedListings?: Array<{ number: string; title: string; paragraphIndex: number; rawText: string }>;
  detectedBibliography?: Array<{ number?: number; paragraphIndex: number; rawText: string }>;
  detectedAppendices?: Array<{ label: string; paragraphIndex: number; rawText: string }>;
  sourceReferenceCandidates?: Array<{
    raw: string;
    paragraphIndex: number;
    contextBefore: string;
    contextAfter: string;
    decision: "accepted" | "ignored" | "uncertain";
    reason: string;
  }>;
  detectedNumberingDefinitions?: unknown[];
  numberingReconstructionWarnings?: string[];
  headingNumbering?: {
    reliability: "high" | "medium" | "low" | "failed";
    source: "text" | "word-numbering" | "toc" | "mixed";
    suspiciousPatterns: string[];
    tocComparison: Array<{
      tocNumber?: string;
      tocText?: string;
      headingNumber?: string;
      headingText?: string;
      status: "match" | "mismatch" | "missing-heading" | "missing-toc";
    }>;
  };
  paragraphRoles?: Array<{ paragraphIndex: number; role: string; rawText: string; renderedText?: string }>;
  unavailableChecks?: Array<{ code: string; reason: string }>;
}

export interface CheckReport {
  id: string;
  fileName: string;
  optionalPdfFileName: string | null;
  inputMode: InputMode;
  profileName: string;
  generatedAt: string;
  visualLayerMode: VisualLayerMode;
  score: number;
  scoreReliability?: "reliable" | "limited" | "unreliable";
  scoreExplanation: string;
  stats: ReportStats;
  checks: ChecksSummary;
  checkExecutions: CheckExecution[];
  notAvailableChecks: NotAvailableCheck[];
  issues: CheckIssue[];
  documentWarnings: string[];
  privacyNote: string;
  debug?: ReportDebug;
}
