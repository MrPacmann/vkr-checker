export type IssueLevel = "critical" | "error" | "warning" | "info";
export type Confidence = "high" | "medium" | "low" | "unknown";

export type IssueCategory =
  | "structure"
  | "formatting"
  | "headings"
  | "figures"
  | "tables"
  | "formulas"
  | "listings"
  | "bibliography"
  | "references"
  | "typography"
  | "pageLayout"
  | "visual"
  | "ocr";

export type CheckStatus = "passed" | "failed" | "partial" | "notAvailable";

export interface RuleDefinition {
  code: string;
  title: string;
  description: string;
  category: IssueCategory;
  enabledKey: keyof EnabledChecks;
}

export interface EnabledChecks {
  requiredSections: boolean;
  sectionOrder: boolean;
  headingNumbering: boolean;
  headingDuplicates: boolean;
  emptyHeadings: boolean;
  pageLayout: boolean;
  typography: boolean;
  paragraphFormatting: boolean;
  figureCaptions: boolean;
  tableCaptions: boolean;
  listingCaptions: boolean;
  formulaCaptions: boolean;
  figureReferences: boolean;
  tableReferences: boolean;
  listingReferences: boolean;
  formulaReferences: boolean;
  sourceReferences: boolean;
  brokenReferences: boolean;
  unusedObjects: boolean;
  bibliographyPresence: boolean;
  bibliographyNumbering: boolean;
  bibliographyMinCount: boolean;
  ocrAssist: boolean;
}
