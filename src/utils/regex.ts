import type { CaptionKind } from "../types/document";
import { normalizeObjectNumber, normalizeSpaces } from "./text";

export interface ParsedCaption {
  kind: CaptionKind;
  number: string;
  title: string;
  continuation?: "continuation" | "ending";
  rawText: string;
}

export function safeRegExp(pattern: string, flags = "giu"): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function collectMatches(pattern: string, text: string, flags = "giu"): RegExpMatchArray[] {
  const regex = safeRegExp(pattern, flags);
  if (!regex) return [];
  return Array.from(text.matchAll(regex));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const objectNumber = "([А-ЯA-Z]?\\.?\\d+(?:\\.\\d+)*)";

const tableCaptionRegex = new RegExp(
  `^\\s*(?:(Продолжение|Окончание)\\s+)?(?:таблиц[аы]|таблица)\\s+${objectNumber}\\s*(?:[.．]|[—–-])?\\s*(.*)$`,
  "iu"
);

const figureCaptionRegex = new RegExp(`^\\s*рисунок\\s+${objectNumber}\\s*(?:[.．]|[—–-])?\\s*(.*)$`, "iu");
const listingCaptionRegex = new RegExp(`^\\s*(?:(Продолжение)\\s+)?листинг[а]?\\s+${objectNumber}\\s*(?:[.．]|[—–-])?\\s*(.*)$`, "iu");
const schemeCaptionRegex = new RegExp(`^\\s*схема\\s+${objectNumber}\\s*(?:[.．]|[—–-])?\\s*(.*)$`, "iu");
const formulaCaptionRegex = new RegExp(`^\\s*(?:формула\\s*)?\\(${objectNumber}\\)\\s*$`, "iu");

export function parseCaption(text: string): ParsedCaption | null {
  const rawText = normalizeSpaces(text);
  if (!rawText) return null;

  const table = tableCaptionRegex.exec(rawText);
  if (table) {
    const continuation = table[1]?.toLowerCase() === "продолжение" ? "continuation" : table[1]?.toLowerCase() === "окончание" ? "ending" : undefined;
    return {
      kind: "table",
      number: normalizeObjectNumber(table[2]),
      title: normalizeSpaces(table[3] ?? ""),
      continuation,
      rawText
    };
  }

  const figure = figureCaptionRegex.exec(rawText);
  if (figure) {
    return { kind: "figure", number: normalizeObjectNumber(figure[1]), title: normalizeSpaces(figure[2] ?? ""), rawText };
  }

  const listing = listingCaptionRegex.exec(rawText);
  if (listing) {
    return {
      kind: "listing",
      number: normalizeObjectNumber(listing[2]),
      title: normalizeSpaces(listing[3] ?? ""),
      continuation: listing[1] ? "continuation" : undefined,
      rawText
    };
  }

  const scheme = schemeCaptionRegex.exec(rawText);
  if (scheme) {
    return { kind: "scheme", number: normalizeObjectNumber(scheme[1]), title: normalizeSpaces(scheme[2] ?? ""), rawText };
  }

  const formula = formulaCaptionRegex.exec(rawText);
  if (formula) {
    return { kind: "formula", number: normalizeObjectNumber(formula[1]), title: "", rawText };
  }

  return null;
}
