import type { DocumentParagraph } from "../types/document";
import { countWords } from "./text";

const WORDS_PER_PAGE = 280;

export function estimatePageFromParagraph(paragraphIndex: number, paragraphs: DocumentParagraph[]): number {
  const wordsBefore = paragraphs
    .slice(0, Math.max(0, paragraphIndex))
    .reduce((sum, paragraph) => sum + countWords(paragraph.text), 0);
  const manualBreaks = paragraphs
    .slice(0, Math.max(0, paragraphIndex))
    .filter((paragraph) => paragraph.hasManualPageBreak || paragraph.hasPageBreakBefore).length;
  return Math.max(1, Math.floor(wordsBefore / WORDS_PER_PAGE) + manualBreaks + 1);
}

export function estimatePagesByText(text: string): number {
  return Math.max(1, Math.ceil(countWords(text) / WORDS_PER_PAGE));
}
