export function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

export function hasVisibleText(value: { renderedText?: string; text?: string } | string): boolean {
  const text = typeof value === "string" ? value : (value.renderedText ?? value.text ?? "");
  return text.replace(/\u00a0/g, " ").replace(/[ \t\r\n]/g, "").trim().length > 0;
}

export function normalizeForCompare(value: string): string {
  return normalizeSectionTitle(value)
    .replace(/[.,:;]+$/g, "")
    .trim();
}

export function normalizeSectionTitle(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[.·•…]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .trim()
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/u, "")
    .replace(/\s+\d+$/u, "")
    .replace(/[.。]+$/u, "")
    .toUpperCase()
    .replace(/[.,:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHeadingText(value: string): string {
  return normalizeSectionTitle(value);
}

export function normalizeObjectNumber(value: string): string {
  return normalizeSpaces(value)
    .replace(/^[№#]\s*/u, "")
    .replace(/[.。]+$/u, "")
    .toUpperCase()
    .replace(/[Ё]/g, "Е");
}

export function countWords(value: string): number {
  const matches = normalizeSpaces(value).match(/[A-Za-zА-Яа-яЁё0-9]+(?:[-'][A-Za-zА-Яа-яЁё0-9]+)?/g);
  return matches?.length ?? 0;
}

export function excerpt(value: string, maxLength = 160): string {
  const normalized = normalizeSpaces(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function getSectionTitleBefore(paragraphs: { index: number; text: string; isHeading: boolean }[], index: number): string | undefined {
  for (let i = Math.min(index, paragraphs.length - 1); i >= 0; i -= 1) {
    const paragraph = paragraphs[i];
    if (paragraph?.isHeading && paragraph.text.trim()) return normalizeSpaces(paragraph.text);
  }
  return undefined;
}
