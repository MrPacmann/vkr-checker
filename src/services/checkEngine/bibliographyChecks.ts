import type { ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { findDuplicateNumbers, findMissingContinuousNumbers } from "../../utils/numbering";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";

function isPmProfile(profile: RuleProfile): boolean {
  return profile.id === "pm-department-normcontrol" || profile.originalProfileId === "pm-department-normcontrol";
}

export function runBibliographyChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  const issues = [];
  const entries = document.bibliography;

  if (profile.enabledChecks.bibliographyPresence && entries.length === 0) {
    issues.push(
      createIssue(
        {
          level: "critical",
          confidence: "high",
          code: isPmProfile(profile) ? "PM_STRUCTURE_BIBLIOGRAPHY_MISSING" : "BIBLIOGRAPHY_MISSING",
          category: "bibliography",
          message: "Список использованных источников не найден.",
          recommendation: "Добавьте раздел «СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ» или допустимое альтернативное название."
        },
        document,
        profile
      )
    );
  }

  if (profile.enabledChecks.bibliographyMinCount && entries.length > 0 && entries.length < profile.minSources) {
    issues.push(
      createIssue(
        {
          level: "warning",
          confidence: "high",
          code: isPmProfile(profile) ? "PM_BIBLIOGRAPHY_COUNT_ERROR" : "BIBLIOGRAPHY_TOO_FEW_SOURCES",
          category: "bibliography",
          message: `В списке источников найдено ${entries.length}, минимум по профилю: ${profile.minSources}.`,
          paragraphIndex: entries[0].paragraphIndex,
          recommendation: "Проверьте требования кафедры к минимальному количеству источников или измените порог в профиле."
        },
        document,
        profile
      )
    );
  }

  const workType = profile.activeWorkType ?? profile.defaultWorkType ?? "generic";
  const maxSources = profile.maxSourcesByWorkType?.[workType];
  if (profile.enabledChecks.bibliographyMinCount && maxSources && entries.length > maxSources) {
    issues.push(
      createIssue(
        {
          level: "warning",
          confidence: "high",
          code: isPmProfile(profile) ? "PM_BIBLIOGRAPHY_COUNT_ERROR" : "BIBLIOGRAPHY_TOO_MANY_SOURCES",
          category: "bibliography",
          message: `В списке источников найдено ${entries.length}, максимум по профилю: ${maxSources}.`,
          paragraphIndex: entries[0]?.paragraphIndex,
          recommendation: "Проверьте требования кафедры к количеству источников или измените лимит в профиле.",
          expected: `до ${maxSources}`,
          actual: String(entries.length)
        },
        document,
        profile
      )
    );
  }

  if (profile.enabledChecks.bibliographyNumbering && entries.length > 0) {
    const numbers = entries.map((entry) => entry.number).filter((number): number is number => number !== undefined).map(String);
    for (const duplicate of findDuplicateNumbers(numbers)) {
      const entry = entries.find((item) => item.number === Number(duplicate));
      issues.push(
        createIssue(
          {
            level: "error",
            confidence: "high",
            code: isPmProfile(profile) ? "PM_BIBLIOGRAPHY_ORDER_ERROR" : "BIBLIOGRAPHY_DUPLICATE_NUMBER",
            category: "bibliography",
            message: `В списке источников повторяется номер ${duplicate}.`,
            paragraphIndex: entry?.paragraphIndex,
            recommendation: "Исправьте нумерацию списка источников."
          },
          document,
          profile
        )
      );
    }
    const missing = findMissingContinuousNumbers(numbers);
    if (missing.length > 0) {
      issues.push(
        createIssue(
          {
            level: "error",
            confidence: "high",
            code: isPmProfile(profile) ? "PM_BIBLIOGRAPHY_ORDER_ERROR" : "BIBLIOGRAPHY_NUMBERING_GAP",
            category: "bibliography",
            message: `В нумерации источников есть пропуски: ${missing.join(", ")}.`,
            paragraphIndex: entries[0].paragraphIndex,
            recommendation: "Проверьте последовательность нумерации источников."
          },
          document,
          profile
        )
      );
    }
  }

  for (const entry of entries.filter((item) => item.text.length < 25)) {
    issues.push(
      createIssue(
        {
          level: "warning",
          confidence: "medium",
          code: "BIBLIOGRAPHY_ENTRY_TOO_SHORT",
          category: "bibliography",
          message: "Библиографическая запись выглядит слишком короткой.",
          paragraphIndex: entry.paragraphIndex,
          excerpt: entry.text,
          recommendation: "Проверьте полноту библиографического описания источника."
        },
        document,
        profile
      )
    );
  }

  return [{ execution: makeExecution("BIBLIOGRAPHY", "Список использованных источников", "bibliography", issues), issues }];
}
