import type { Confidence } from "../types/rules";

export function confidenceLabel(confidence: Confidence): string {
  switch (confidence) {
    case "high":
      return "высокая";
    case "medium":
      return "средняя";
    case "low":
      return "низкая";
    case "unknown":
      return "требует ручной проверки";
  }
}

export function confidenceWeight(confidence: Confidence): number {
  switch (confidence) {
    case "high":
      return 1;
    case "medium":
      return 0.75;
    case "low":
      return 0.35;
    case "unknown":
      return 0;
  }
}
