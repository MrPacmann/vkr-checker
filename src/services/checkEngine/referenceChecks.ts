import type { ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { normalizeSectionTitle } from "../../utils/text";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";

function isExcludedSourceReferenceSection(section?: string): boolean {
  const normalized = normalizeSectionTitle(section ?? "");
  return (
    normalized === "СОДЕРЖАНИЕ" ||
    normalized === "ОГЛАВЛЕНИЕ" ||
    normalized.includes("СПИСОК ИСТОЧНИКОВ") ||
    normalized.includes("СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ") ||
    normalized.includes("СПИСОК ЛИТЕРАТУРЫ") ||
    normalized.includes("БИБЛИОГРАФИЧЕСКИЙ СПИСОК")
  );
}

function isPmProfile(profile: RuleProfile): boolean {
  return profile.id === "pm-department-normcontrol" || profile.originalProfileId === "pm-department-normcontrol";
}

function paragraphText(item: ParsedDocument["paragraphs"][number]): string {
  return item.renderedText || item.text;
}

export function runReferenceChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  const issues = [];

  if (profile.enabledChecks.sourceReferences) {
    const sourceNumbers = new Set(document.bibliography.map((entry) => entry.number).filter((number): number is number => number !== undefined).map(String));
    const sourceReferences = document.references.filter((reference) => {
      if (reference.kind !== "source") return false;
      const paragraph = document.paragraphs[reference.paragraphIndex];
      return !isExcludedSourceReferenceSection(paragraph?.sectionTitle);
    });
    for (const reference of sourceReferences.filter((item) => sourceNumbers.size > 0 && !sourceNumbers.has(item.number))) {
      issues.push(
        createIssue(
          {
            level: "error",
            confidence: "high",
            code: isPmProfile(profile) ? "PM_SOURCE_REFERENCE_NOT_FOUND" : "SOURCE_REFERENCE_NOT_FOUND",
            category: "references",
            message: `В тексте есть ссылка на источник [${reference.number}], но такого номера нет в списке источников.`,
            paragraphIndex: reference.paragraphIndex,
            excerpt: reference.text,
            recommendation: "Проверьте номер ссылки или исправьте нумерацию списка источников."
          },
          document,
          profile
        )
      );
    }

    if (document.bibliography.length > 0 && sourceReferences.length === 0) {
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "high",
            code: isPmProfile(profile) ? "PM_SOURCE_WITHOUT_REFERENCE" : "SOURCE_REFERENCES_MISSING",
            category: "references",
            message: "В основном тексте не найдены ссылки на источники вида [1].",
            paragraphIndex: document.bibliography[0].paragraphIndex,
            recommendation: "Добавьте ссылки на источники в тексте работы."
          },
          document,
          profile
        )
      );
      return runAppendixChecks(document, profile, issues);
    }

    const referencedNumbers = new Set(sourceReferences.map((reference) => reference.number));
    for (const entry of document.bibliography.filter((item) => item.number !== undefined && !referencedNumbers.has(String(item.number)))) {
      issues.push(
        createIssue(
          {
            level: "info",
            confidence: "high",
            code: isPmProfile(profile) ? "PM_SOURCE_WITHOUT_REFERENCE" : "SOURCE_WITHOUT_TEXT_REFERENCE",
            category: "references",
            message: `Источник ${entry.number} не имеет найденной ссылки в тексте.`,
            paragraphIndex: entry.paragraphIndex,
            excerpt: entry.text,
            recommendation: "Проверьте, должен ли этот источник цитироваться в тексте."
          },
          document,
          profile
        )
      );
    }
  }

  const appendixReferences = document.references.filter((reference) => reference.kind === "appendix");
  if (appendixReferences.length > 0) {
    const hasAppendixSection = document.headings.some((heading) => /^ПРИЛОЖЕНИ[ЕЯ]\s+[А-ЯA-Z]/iu.test(paragraphText(heading)) || /^ПРИЛОЖЕНИЯ$/iu.test(paragraphText(heading)));
    if (!hasAppendixSection) {
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "high",
            code: isPmProfile(profile) ? "PM_APPENDIX_BROKEN_REFERENCE" : "APPENDIX_REFERENCE_WITHOUT_APPENDIX",
            category: "references",
            message: "В тексте есть ссылки на приложения, но раздел приложений не найден.",
            paragraphIndex: appendixReferences[0].paragraphIndex,
            excerpt: appendixReferences[0].text,
            recommendation: "Добавьте приложения или удалите/исправьте ссылки на них."
          },
          document,
          profile
        )
      );
    }
  }

  return runAppendixChecks(document, profile, issues);
}

function runAppendixChecks(document: ParsedDocument, profile: RuleProfile, issues: ReturnType<typeof createIssue>[]): RuleCheckResult[] {
  if (isPmProfile(profile) && (profile.activeWorkType === "bachelorThesis" || profile.activeWorkType === "masterThesis")) {
    const appendixA = document.headings.find((heading) => /^ПРИЛОЖЕНИЕ\s+А\b/iu.test(paragraphText(heading)));
    const titleAfter = appendixA ? paragraphText(document.paragraphs[appendixA.index + 1] ?? appendixA) : "";
    const hasGraphicMaterial = Boolean(appendixA && /ГРАФИЧЕСКИЙ МАТЕРИАЛ/iu.test(`${paragraphText(appendixA)} ${titleAfter}`));
    if (!hasGraphicMaterial) {
      issues.push(
        createIssue(
          {
            level: "error",
            confidence: "high",
            code: "PM_APPENDIX_A_GRAPHIC_MATERIAL_MISSING",
            category: "references",
            message: "Для ВКР требуется приложение А «Графический материал».",
            recommendation: "Добавьте приложение А с заголовком «Графический материал» или измените тип работы/настройку профиля."
          },
          document,
          profile
        )
      );
    }
  }
  return [{ execution: makeExecution("REFERENCE_CHECKS", "Перекрестные ссылки", "references", issues), issues }];
}
