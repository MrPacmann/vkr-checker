import { normalizeSpaces } from "./text";

export interface ParsedSourceReference {
  raw: string;
  sourceNumbers: number[];
  pageRange?: string;
  confidence: "high" | "medium" | "low";
}

export interface SourceReferenceDecision {
  raw: string;
  parsed: ParsedSourceReference | null;
  decision: "accepted" | "ignored" | "uncertain";
  reason: string;
}

const rangeContext = /(?:диапазон|диапазона|интервал|интервала|значение|значения|минимум|максимум|min|max|от|до|период)/iu;
const pageReference = /^(\d+)\s*,\s*(?:с\.?|стр\.?)\s*([0-9]+(?:\s*[–-]\s*[0-9]+)?)$/iu;
const integerToken = /^\d+$/u;

function bracketContent(raw: string): string {
  return normalizeSpaces(raw.replace(/^\[/u, "").replace(/\]$/u, ""));
}

function hasRangeContext(contextBefore: string, contextAfter: string): boolean {
  return rangeContext.test(`${contextBefore} ${contextAfter}`);
}

function isSignificantlyAboveBibliography(number: number, bibliographyCount: number): boolean {
  if (bibliographyCount <= 0) return number > 100;
  return number > Math.max(100, bibliographyCount * 3);
}

function expandDashRange(start: number, end: number): number[] {
  if (end < start || end - start > 50) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function hasDecimalNumber(content: string): boolean {
  return /(?:^|[^\d])\d+\.\d+(?:$|[^\d])/u.test(content) || (content.includes(";") && /(?:^|[^\d])\d+,\d+(?:$|[^\d])/u.test(content));
}

function hasNegativeNumber(content: string): boolean {
  return /(?:^|[^\d])-+\d/u.test(content);
}

function hasSymbolicInterval(content: string): boolean {
  return /(?:^|[;\s])(?:min|max|[a-zа-я])(?:[;\s]|$)/iu.test(content);
}

function rejectReasonForNumericInterval(content: string, numbers: number[], bibliographyCount: number, contextBefore: string, contextAfter: string): string | null {
  if (hasRangeContext(contextBefore, contextAfter)) return "numeric_range_context";
  if (numbers.some((number) => number <= 0)) return "numeric_range_not_source_reference";
  if (numbers.some((number) => isSignificantlyAboveBibliography(number, bibliographyCount))) return "numeric_range_not_source_reference";
  if (numbers.length === 2 && Math.abs(numbers[1] - numbers[0]) > 5) return "numeric_range_not_source_reference";
  return null;
}

export function classifySourceReference(raw: string, bibliographyCount: number, contextBefore = "", contextAfter = ""): SourceReferenceDecision {
  const content = bracketContent(raw);
  if (!content) return { raw, parsed: null, decision: "ignored", reason: "empty_brackets" };
  if (hasDecimalNumber(content)) return { raw, parsed: null, decision: "ignored", reason: "decimal_numeric_interval" };
  if (hasNegativeNumber(content)) return { raw, parsed: null, decision: "ignored", reason: "negative_numeric_interval" };
  if (hasSymbolicInterval(content)) return { raw, parsed: null, decision: "ignored", reason: "symbolic_interval_not_source_reference" };

  const page = pageReference.exec(content);
  if (page) {
    const sourceNumber = Number(page[1]);
    if (sourceNumber <= 0 || isSignificantlyAboveBibliography(sourceNumber, bibliographyCount)) {
      return { raw, parsed: null, decision: "ignored", reason: "source_number_too_large_for_bibliography" };
    }
    return {
      raw,
      parsed: {
        raw,
        sourceNumbers: [sourceNumber],
        pageRange: normalizeSpaces(page[2].replace(/\s+/gu, "")),
        confidence: sourceNumber <= bibliographyCount || bibliographyCount === 0 ? "high" : "medium"
      },
      decision: "accepted",
      reason: "source_reference_with_page"
    };
  }

  const dashRange = /^(\d+)\s*[–-]\s*(\d+)$/u.exec(content);
  if (dashRange) {
    const start = Number(dashRange[1]);
    const end = Number(dashRange[2]);
    if (start <= 0 || end <= 0 || isSignificantlyAboveBibliography(Math.max(start, end), bibliographyCount)) {
      return { raw, parsed: null, decision: "ignored", reason: "numeric_range_not_source_reference" };
    }
    const sourceNumbers = expandDashRange(start, end);
    if (sourceNumbers.length === 0) return { raw, parsed: null, decision: "ignored", reason: "range_too_wide" };
    return {
      raw,
      parsed: {
        raw,
        sourceNumbers,
        confidence: end <= bibliographyCount || bibliographyCount === 0 ? "high" : "medium"
      },
      decision: "accepted",
      reason: "source_reference_range"
    };
  }

  const separator = content.includes(";") ? ";" : content.includes(",") ? "," : null;
  if (separator) {
    const parts = content.split(separator).map((part) => normalizeSpaces(part)).filter(Boolean);
    if (parts.length === 0 || parts.some((part) => !integerToken.test(part))) {
      return { raw, parsed: null, decision: "ignored", reason: "not_integer_source_list" };
    }
    const numbers = parts.map(Number);
    if (separator === ";") {
      const intervalReason = rejectReasonForNumericInterval(content, numbers, bibliographyCount, contextBefore, contextAfter);
      if (intervalReason) return { raw, parsed: null, decision: "ignored", reason: intervalReason };
    }
    if (numbers.some((number) => number <= 0 || isSignificantlyAboveBibliography(number, bibliographyCount))) {
      return { raw, parsed: null, decision: "ignored", reason: "source_number_too_large_for_bibliography" };
    }
    return {
      raw,
      parsed: {
        raw,
        sourceNumbers: numbers,
        confidence: numbers.every((number) => number <= bibliographyCount) || bibliographyCount === 0 ? "high" : "medium"
      },
      decision: "accepted",
      reason: "source_reference_list"
    };
  }

  if (integerToken.test(content)) {
    const sourceNumber = Number(content);
    if (sourceNumber <= 0 || isSignificantlyAboveBibliography(sourceNumber, bibliographyCount)) {
      return { raw, parsed: null, decision: "ignored", reason: "source_number_too_large_for_bibliography" };
    }
    return {
      raw,
      parsed: {
        raw,
        sourceNumbers: [sourceNumber],
        confidence: sourceNumber <= bibliographyCount || bibliographyCount === 0 ? "high" : "medium"
      },
      decision: "accepted",
      reason: "single_source_reference"
    };
  }

  return { raw, parsed: null, decision: "ignored", reason: "not_source_reference" };
}

export function parseSourceReference(raw: string, bibliographyCount: number, contextBefore = "", contextAfter = ""): ParsedSourceReference | null {
  return classifySourceReference(raw, bibliographyCount, contextBefore, contextAfter).parsed;
}
