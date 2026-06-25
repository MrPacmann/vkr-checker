import type { ParagraphFormat, RunFormat, StylesModel } from "./styles";
import type { NumberingLevelDefinition } from "../services/documentParser/numberingParser";

export type CaptionKind = "figure" | "table" | "formula" | "listing" | "scheme";
export type ReferenceKind = CaptionKind | "source" | "appendix";

export interface DocumentRun {
  text: string;
  styleId?: string;
  format: RunFormat;
}

export interface ParagraphNumberingInfo {
  numId?: string;
  ilvl?: string;
  level?: number;
  abstractNumId?: string;
  numFmt?: string;
  lvlText?: string;
  start?: number;
  currentNumber?: string;
  renderedPrefix?: string;
}

export type ParagraphNumbering = ParagraphNumberingInfo;

export interface ParsedHeading {
  rawText: string;
  visibleText: string;
  cleanTitle: string;
  explicitNumber?: string;
  reconstructedNumber?: string;
  finalNumber?: string;
  level: 1 | 2 | 3;
  numberingSource: "text" | "word-numbering" | "toc" | "none";
}

export interface HeadingNumberingDiagnostics {
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
}

export type ParagraphRole =
  | "mainText"
  | "heading"
  | "toc"
  | "figureCaption"
  | "tableCaption"
  | "listingCaption"
  | "formula"
  | "bibliographyEntry"
  | "appendixTitle"
  | "listItem"
  | "tableCellText"
  | "imageOnly"
  | "empty"
  | "technical"
  | "unknown";

export interface SectionLayout {
  pageWidthMm?: number;
  pageHeightMm?: number;
  pageSize?: "A4" | "custom" | "unknown";
  orientation?: "portrait" | "landscape" | "unknown";
  margins?: {
    topMm?: number;
    rightMm?: number;
    bottomMm?: number;
    leftMm?: number;
  };
}

export interface DocumentParagraph {
  index: number;
  text: string;
  numberingPrefix?: string;
  renderedText: string;
  styleId?: string;
  styleName?: string;
  resolvedStyle?: {
    isHeading: boolean;
    headingLevel?: number;
  };
  role?: ParagraphRole;
  isHeading: boolean;
  headingLevel?: number;
  parsedHeading?: ParsedHeading;
  numbering?: ParagraphNumbering;
  runs: DocumentRun[];
  format: ParagraphFormat;
  inheritedRunFormat: RunFormat;
  sectionTitle?: string;
  inTable?: boolean;
  hasPageBreakBefore?: boolean;
  hasPageBreakAfter?: boolean;
  hasManualPageBreak?: boolean;
  hasDrawing?: boolean;
  hasPicture?: boolean;
  hasFormula?: boolean;
  hasSectionBreak?: boolean;
  sectionLayout?: SectionLayout;
}

export interface DocumentTableCell {
  text: string;
  paragraphs: number[];
}

export interface DocumentTable {
  index: number;
  paragraphIndex: number;
  endParagraphIndex?: number;
  rows: DocumentTableCell[][];
  text: string;
  caption?: DocumentCaption;
}

export interface DocumentImage {
  id: string;
  relationshipId?: string;
  target?: string;
  paragraphIndex: number;
  altText?: string;
  caption?: DocumentCaption;
}

export interface DocumentCaption {
  id: string;
  kind: CaptionKind;
  number: string;
  title: string;
  paragraphIndex: number;
  text: string;
  validFormat: boolean;
  source?: "plain-text" | "word-numbering" | "office-math" | "heuristic";
  numbering?: ParagraphNumberingInfo;
}

export interface DocumentObject {
  id: string;
  type: CaptionKind;
  number: string;
  title: string;
  paragraphIndex: number;
  section?: string;
  rawText: string;
  continuation?: "continuation" | "ending";
  source?: "plain-text" | "word-numbering" | "office-math" | "heuristic";
  numbering?: ParagraphNumberingInfo;
}

export interface DocumentReference {
  id: string;
  kind: ReferenceKind;
  number: string;
  paragraphIndex: number;
  text: string;
}

export interface SourceReferenceCandidate {
  raw: string;
  paragraphIndex: number;
  contextBefore: string;
  contextAfter: string;
  decision: "accepted" | "ignored" | "uncertain";
  reason: string;
  sourceNumbers?: number[];
  pageRange?: string;
  confidence?: "high" | "medium" | "low";
}

export interface BibliographyEntry {
  number?: number;
  text: string;
  paragraphIndex: number;
}

export interface DocumentMetadata {
  title?: string;
  subject?: string;
  creator?: string;
  created?: string;
  modified?: string;
  pages?: number;
  words?: number;
}

export interface ParsedDocumentStats {
  words: number;
  paragraphs: number;
  sections: number;
  estimatedPages: number;
  detectedPages: number | null;
  figures: number;
  tables: number;
  formulas: number;
  listings: number;
  schemes: number;
  sources: number;
  sourceReferences: number;
  figureReferences: number;
  tableReferences: number;
  formulaReferences: number;
  listingReferences: number;
}

export interface ParsedDocument {
  fileName: string;
  fileSize: number;
  metadata: DocumentMetadata;
  paragraphs: DocumentParagraph[];
  headings: DocumentParagraph[];
  styles: StylesModel;
  tables: DocumentTable[];
  images: DocumentImage[];
  objects?: DocumentObject[];
  captions: DocumentCaption[];
  references: DocumentReference[];
  sourceReferenceCandidates?: SourceReferenceCandidate[];
  bibliography: BibliographyEntry[];
  headerTexts: string[];
  footerTexts: string[];
  footnotes: string[];
  endnotes: string[];
  relationships: Record<string, string>;
  sectionLayouts: SectionLayout[];
  numberingDefinitions?: NumberingLevelDefinition[];
  numberingReconstructionWarnings?: string[];
  headingNumbering?: HeadingNumberingDiagnostics;
  stats: ParsedDocumentStats;
  plainText: string;
  warnings: string[];
}
