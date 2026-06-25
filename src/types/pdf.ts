import type { DocumentCaption, DocumentReference, ParsedDocumentStats } from "./document";

export interface ParsedPdfLine {
  index: number;
  page: number;
  text: string;
  sectionTitle?: string;
}

export interface ParsedPdfDocument {
  fileName: string;
  fileSize: number;
  pages: Array<{
    pageNumber: number;
    text: string;
  }>;
  lines: ParsedPdfLine[];
  plainText: string;
  captions: DocumentCaption[];
  references: DocumentReference[];
  bibliography: Array<{
    number?: number;
    text: string;
    lineIndex: number;
    page: number;
  }>;
  stats: ParsedDocumentStats;
  warnings: string[];
  ocrUsed: boolean;
}
