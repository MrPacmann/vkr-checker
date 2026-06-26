import type { ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { normalizeSectionTitle, normalizeSpaces } from "../../utils/text";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";

function acceptedNames(section: string, profile: RuleProfile): string[] {
  return [section, ...(profile.alternativeSectionNames[section] ?? [])].map(normalizeSectionTitle);
}

function looksLikeTocLine(text: string): boolean {
  return /\.{2,}|…|\s+\d+\s*$/u.test(text) && text.length < 180;
}

function repeatedTitleMatches(normalized: string, name: string): boolean {
  if (normalized === name) return true;
  const repeated = `${name} ${name}`;
  return normalized === repeated || normalized.startsWith(`${repeated} `);
}

function sectionNameMatches(normalized: string, names: string[]): boolean {
  return names.some((name) => repeatedTitleMatches(normalized, name));
}

function allAcceptedSectionNames(profile: RuleProfile): string[] {
  return Array.from(
    new Set(
      [
        "РЕФЕРАТ",
        "АННОТАЦИЯ",
        "СОДЕРЖАНИЕ",
        "ОГЛАВЛЕНИЕ",
        "ВВЕДЕНИЕ",
        "ЗАКЛЮЧЕНИЕ",
        "СПИСОК ИСТОЧНИКОВ",
        "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ",
        ...profile.requiredSections,
        ...Object.values(profile.alternativeSectionNames).flat()
      ].map(normalizeSectionTitle)
    )
  );
}

function tocParagraphIndexes(document: ParsedDocument, profile: RuleProfile): Set<number> {
  const indexes = new Set<number>();
  const knownSections = allAcceptedSectionNames(profile);
  let inToc = false;
  for (const paragraph of document.paragraphs) {
    const text = paragraph.renderedText || paragraph.text;
    const normalized = normalizeSectionTitle(text);
    if (paragraph.isTocParagraph) {
      indexes.add(paragraph.index);
      if (normalized === "СОДЕРЖАНИЕ" || normalized === "ОГЛАВЛЕНИЕ") inToc = true;
      continue;
    }
    if (normalized === "СОДЕРЖАНИЕ" || normalized === "ОГЛАВЛЕНИЕ" || /toc|оглавлен|содержан/iu.test(paragraph.styleName ?? "")) {
      inToc = true;
      indexes.add(paragraph.index);
      continue;
    }
    if (inToc && sectionNameMatches(normalized, knownSections) && !looksLikeTocLine(text)) {
      inToc = false;
    }
    if (inToc || paragraph.role === "toc" || looksLikeTocLine(text)) indexes.add(paragraph.index);
  }
  return indexes;
}

function findSectionParagraph(document: ParsedDocument, names: string[], profile: RuleProfile): ParsedDocument["paragraphs"][number] | undefined {
  const toc = tocParagraphIndexes(document, profile);
  return document.paragraphs.find((paragraph) => {
    const normalized = normalizeSectionTitle(paragraph.renderedText || paragraph.text);
    if (paragraph.isBibliographyEntry) return false;
    if (toc.has(paragraph.index) && normalized !== "СОДЕРЖАНИЕ" && normalized !== "ОГЛАВЛЕНИЕ") return false;
    return sectionNameMatches(normalized, names);
  });
}

function findSectionIndex(document: ParsedDocument, names: string[], profile: RuleProfile): number {
  const paragraph = findSectionParagraph(document, names, profile);
  if (!paragraph) return -1;
  return document.headings.findIndex((heading) => heading.index === paragraph.index);
}

function isPmProfile(profile: RuleProfile): boolean {
  return profile.id === "pm-department-normcontrol" || profile.originalProfileId === "pm-department-normcontrol";
}

function pmRequiredSectionCode(section: string): string {
  const normalized = normalizeSectionTitle(section);
  if (normalized === "СОДЕРЖАНИЕ") return "PM_STRUCTURE_CONTENTS_MISSING";
  if (normalized === "ВВЕДЕНИЕ") return "PM_STRUCTURE_INTRODUCTION_MISSING";
  if (normalized === "ЗАКЛЮЧЕНИЕ") return "PM_STRUCTURE_CONCLUSION_MISSING";
  if (normalized.includes("СПИСОК")) return "PM_STRUCTURE_BIBLIOGRAPHY_MISSING";
  return "REQUIRED_SECTION_MISSING";
}

function headingText(heading: ParsedDocument["headings"][number]): string {
  return heading.renderedText || heading.text;
}

function shouldSkipLengthCheck(heading: ParsedDocument["headings"][number], profile: RuleProfile): boolean {
  const normalized = normalizeSectionTitle(headingText(heading));
  const bibliographyNames = acceptedNames("СПИСОК ИСТОЧНИКОВ", profile).concat(acceptedNames("СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ", profile));
  return (
    normalized === "СОДЕРЖАНИЕ" ||
    normalized === "ОГЛАВЛЕНИЕ" ||
    bibliographyNames.includes(normalized) ||
    /^ПРИЛОЖЕНИ[ЕЯ](?:\s+[А-ЯA-Z0-9])?/iu.test(normalized)
  );
}

function countSectionWords(paragraphs: ParsedDocument["paragraphs"]): number {
  return paragraphs
    .filter((paragraph) => {
      if (paragraph.isHeading) return false;
      if (!paragraph.role) return true;
      return paragraph.role === "mainText" || paragraph.role === "listItem" || paragraph.role === "formula";
    })
    .reduce((sum, paragraph) => sum + (paragraph.renderedText || paragraph.text).split(/\s+/u).filter(Boolean).length, 0);
}

export function runStructureChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  const results: RuleCheckResult[] = [];

  if (profile.enabledChecks.requiredSections) {
    const issues = profile.requiredSections.flatMap((section) => {
      const index = findSectionIndex(document, acceptedNames(section, profile), profile);
      const paragraph = findSectionParagraph(document, acceptedNames(section, profile), profile);
      return index >= 0
        ? []
        : paragraph
          ? []
          : [
              createIssue(
                {
                  level: section.includes("СПИСОК") ? "critical" : "error",
                  confidence: "high",
                  code: isPmProfile(profile) ? pmRequiredSectionCode(section) : "REQUIRED_SECTION_MISSING",
                  category: "structure",
                  message: `Не найден обязательный раздел «${section}».`,
                  recommendation: `Добавьте раздел «${section}» или допустимое альтернативное название, указанное в профиле проверки.`,
                  reason: "Раздел не найден среди заголовков и строк, похожих на заголовки."
                },
                document,
                profile
              )
            ];
    });
    results.push({ execution: makeExecution("REQUIRED_SECTIONS", "Наличие обязательных разделов", "structure", issues), issues });
  }

  if (profile.enabledChecks.sectionOrder) {
    const found = profile.requiredSections
      .map((section) => ({
        section,
        index: findSectionParagraph(document, acceptedNames(section, profile), profile)?.index ?? -1
      }))
      .filter((item) => item.index >= 0);
    const issues = [];
    for (let i = 1; i < found.length; i += 1) {
      if (found[i].index < found[i - 1].index) {
        issues.push(
          createIssue(
            {
              level: "warning",
              confidence: "high",
              code: isPmProfile(profile) ? "PM_STRUCTURE_WRONG_ORDER" : "SECTION_ORDER_INVALID",
              category: "structure",
              message: `Раздел «${found[i].section}» расположен раньше, чем ожидается по профилю.`,
              paragraphIndex: found[i].index,
              recommendation: "Проверьте порядок обязательных разделов: реферат, содержание, введение, основная часть, заключение, список источников."
            },
            document,
            profile
          )
        );
      }
    }
    results.push({ execution: makeExecution("SECTION_ORDER", "Порядок обязательных разделов", "structure", issues), issues });
  }

  if (profile.enabledChecks.emptyHeadings || profile.enabledChecks.headingDuplicates) {
    const issues = [];
    if (profile.enabledChecks.emptyHeadings) {
      issues.push(
        ...document.headings
          .filter((heading) => normalizeSpaces(headingText(heading)).length === 0)
          .map((heading) =>
            createIssue(
              {
                level: "error",
                confidence: "high",
                code: "EMPTY_HEADING",
                category: "headings",
                message: "Найден пустой заголовок.",
                paragraphIndex: heading.index,
                recommendation: "Заполните текст заголовка или удалите пустой абзац со стилем заголовка."
              },
              document,
              profile
            )
          )
      );
    }
    if (profile.enabledChecks.headingDuplicates) {
      const seen = new Map<string, number>();
      for (const heading of document.headings) {
        const key = normalizeSectionTitle(headingText(heading));
        if (!key) continue;
        const previous = seen.get(key);
        if (previous !== undefined) {
          issues.push(
            createIssue(
              {
                level: "warning",
                confidence: "high",
                code: "DUPLICATE_HEADING",
                category: "headings",
                message: `Повторяющийся заголовок «${headingText(heading)}».`,
                paragraphIndex: heading.index,
                recommendation: "Проверьте структуру разделов и уточните название повторяющегося заголовка.",
                reason: `Первое вхождение найдено в абзаце ${previous + 1}.`
              },
              document,
              profile
            )
          );
        }
        seen.set(key, heading.index);
      }
    }
    results.push({ execution: makeExecution("HEADING_BASIC", "Пустые и повторяющиеся заголовки", "headings", issues), issues });
  }

  const shortSectionIssues = [];
  if (profile.minSectionWords > 0) {
    for (let i = 0; i < document.headings.length; i += 1) {
      const heading = document.headings[i];
      if (heading.headingLevel !== 1 || shouldSkipLengthCheck(heading, profile)) continue;
      const currentLevel = heading.headingLevel ?? 1;
      const nextHeading = document.headings.slice(i + 1).find((candidate) => (candidate.headingLevel ?? 1) <= currentLevel);
      const sectionParagraphs = document.paragraphs.filter(
        (paragraph) => paragraph.index > heading.index && (!nextHeading || paragraph.index < nextHeading.index) && !paragraph.isHeading
      );
      const nestedHeadings = document.headings.filter((candidate) => candidate.index > heading.index && (!nextHeading || candidate.index < nextHeading.index));
      const words = countSectionWords(sectionParagraphs);
      if (words > 0 && words < profile.minSectionWords) {
        shortSectionIssues.push(
          createIssue(
            {
              level: "info",
              confidence: nestedHeadings.length > 0 ? "low" : "medium",
              code: "SECTION_TOO_SHORT",
              category: "structure",
              message: `Раздел «${headingText(heading)}» выглядит слишком коротким (${words} слов).`,
              paragraphIndex: heading.index,
              recommendation: "Проверьте полноту раздела. Порог можно изменить в настройках профиля.",
              reason: nestedHeadings.length > 0 ? "Для раздела учтён текст вложенных подразделов; оценка оставлена диагностической." : undefined,
              canBeFalsePositive: nestedHeadings.length > 0
            },
            document,
            profile
          )
        );
      }
    }
  }
  results.push({ execution: makeExecution("SECTION_LENGTH", "Минимальная длина разделов", "structure", shortSectionIssues), issues: shortSectionIssues });

  return results;
}
