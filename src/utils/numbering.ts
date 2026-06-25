export function extractNumberParts(value: string): number[] {
  return value
    .replace(/[А-ЯA-Z]\.?/giu, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

export function compareDocNumbers(a: string, b: string): number {
  const left = extractNumberParts(a);
  const right = extractNumberParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function findDuplicateNumbers(numbers: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const number of numbers) {
    if (seen.has(number)) duplicates.add(number);
    seen.add(number);
  }
  return Array.from(duplicates);
}

export function findMissingContinuousNumbers(numbers: string[]): number[] {
  const numeric = numbers
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (numeric.length < 2) return [];
  const missing: number[] = [];
  for (let value = numeric[0]; value <= numeric[numeric.length - 1]; value += 1) {
    if (!numeric.includes(value)) missing.push(value);
  }
  return missing;
}
