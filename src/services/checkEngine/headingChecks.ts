import type { ParsedDocument } from "../../types/document";
import type { InputMode } from "../../types/report";
import type { RuleProfile } from "../../types/settings";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";

function headingText(heading: ParsedDocument["headings"][number]): string {
  return heading.renderedText || heading.text;
}

function headingNumber(heading: ParsedDocument["headings"][number]): string | undefined {
  return heading.parsedHeading?.finalNumber ?? /^\s*(\d+(?:\.\d+)*)\s+/u.exec(headingText(heading))?.[1];
}

function startsOnNewPage(heading: ParsedDocument["headings"][number], document: ParsedDocument): boolean {
  const previous = document.paragraphs[heading.index - 1];
  return Boolean(heading.hasPageBreakBefore || heading.hasManualPageBreak || previous?.hasManualPageBreak || previous?.hasSectionBreak);
}

function isTocTitle(heading: ParsedDocument["headings"][number]): boolean {
  return /^(СОДЕРЖАНИЕ|ОГЛАВЛЕНИЕ)$/iu.test(headingText(heading));
}

function isReliableHeading(heading: ParsedDocument["headings"][number]): boolean {
  if (heading.isBibliographyEntry) return false;
  if (heading.isTocParagraph && !isTocTitle(heading)) return false;
  if (heading.role && ["toc", "bibliographyEntry", "figureCaption", "tableCaption", "listingCaption", "formula", "tableCellText", "technical"].includes(heading.role)) return false;
  return heading.headingConfidence !== "none";
}

interface HeadingCheckOptions {
  inputMode?: InputMode;
}

export function runHeadingChecks(document: ParsedDocument, profile: RuleProfile, options: HeadingCheckOptions = {}): RuleCheckResult[] {
  const issues = [];
  const reliableHeadings = document.headings.filter(isReliableHeading);

  if (profile.enabledChecks.headingNumbering) {
    if (document.headingNumbering && document.headingNumbering.reliability !== "high") {
      issues.push(
        createIssue(
          {
            level: "info",
            confidence: "unknown",
            code: "HEADING_NUMBERING_RECONSTRUCTION_UNRELIABLE",
            category: "headings",
            message: "Нумерация заголовков восстановлена неуверенно.",
            recommendation: "Проверьте структуру заголовков вручную или переоформите заголовки штатной многоуровневой нумерацией Word.",
            source: "system",
            reason: document.headingNumbering.suspiciousPatterns.join(" ") || "Диагностика TOC/заголовков не дала высокой уверенности.",
            parserEvidence: `reliability=${document.headingNumbering.reliability}; source=${document.headingNumbering.source}; tocMismatches=${document.headingNumbering.tocComparison.filter((item) => item.status === "mismatch").length}`,
            canBeFalsePositive: true
          },
          document,
          profile
        )
      );
    }
    const numbered = reliableHeadings.filter((heading) => /^\d+(?:\.\d+)*\.?\s+/u.test(headingText(heading)));
    const numberTrailingDotHeadings = numbered.filter((heading) => /^\d+(?:\.\d+)*\.\s+/u.test(headingText(heading)));
    if (numberTrailingDotHeadings.length > 0) {
      const first = numberTrailingDotHeadings[0];
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "high",
            code: "HEADING_NUMBER_TRAILING_DOT",
            category: "headings",
            message:
              numberTrailingDotHeadings.length > 1
                ? `У ${numberTrailingDotHeadings.length} заголовков номер заканчивается точкой.`
                : "Номер заголовка заканчивается точкой.",
            paragraphIndex: first.index,
            recommendation: "Обычно номер раздела оформляют без завершающей точки: «1 Название раздела».",
            occurrences: numberTrailingDotHeadings.map((heading) => ({
              paragraphIndex: heading.index,
              section: heading.sectionTitle,
              excerpt: headingText(heading)
            }))
          },
          document,
          profile
        )
      );
    }
    for (let i = 1; i < numbered.length; i += 1) {
      const current = numbered[i];
      const previous = numbered[i - 1];
      const currentParts = headingText(current).split(/\s+/u)[0].replace(/\.$/u, "").split(".").map(Number);
      const previousParts = headingText(previous).split(/\s+/u)[0].replace(/\.$/u, "").split(".").map(Number);
      if (currentParts.length > previousParts.length + 1) {
        issues.push(
          createIssue(
            {
              level: "error",
              confidence: "high",
              code: "HEADING_LEVEL_SKIP",
              category: "headings",
              message: `Заголовок «${headingText(current)}» пропускает уровень подраздела.`,
              paragraphIndex: current.index,
              recommendation: "Добавьте родительский раздел или исправьте уровень нумерации заголовка."
            },
            document,
            profile
          )
        );
      }
    }
  }

  if (profile.forbidHeadingTrailingDot) {
    const trailingPunctuation = reliableHeadings.filter((heading) => /[.:;]\s*$/u.test(headingText(heading)));
    if (trailingPunctuation.length > 0) {
      const first = trailingPunctuation[0];
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "high",
            code: "HEADING_TRAILING_PUNCTUATION",
            category: "headings",
            message:
              trailingPunctuation.length > 1
                ? `У ${trailingPunctuation.length} заголовков есть завершающая точка или другой знак.`
                : "Заголовок заканчивается точкой или другим завершающим знаком.",
            paragraphIndex: first.index,
            recommendation: "Удалите точку в конце заголовка, если это требуется профилем оформления.",
            occurrences: trailingPunctuation.map((heading) => ({
              paragraphIndex: heading.index,
              section: heading.sectionTitle,
              excerpt: headingText(heading)
            }))
          },
          document,
          profile
        )
      );
    }
  }

  if (profile.headingTopLevelStartsPage) {
    const canVerifyPageStart = options.inputMode !== "docxOnly";
    const topHeadings = reliableHeadings.filter(
      (item) =>
        item.headingLevel === 1 &&
        item.headingConfidence === "high" &&
        !(item.isListItem && !item.resolvedStyle?.isHeading) &&
        !/^(РЕФЕРАТ|АННОТАЦИЯ|СОДЕРЖАНИЕ|ОГЛАВЛЕНИЕ)$/iu.test(headingText(item))
    );
    for (const heading of topHeadings) {
      if (!canVerifyPageStart) continue;
      if (!startsOnNewPage(heading, document)) {
        issues.push(
          createIssue(
            {
              level: "warning",
              confidence: "medium",
              code: "TOP_HEADING_NOT_NEW_PAGE",
              category: "headings",
              message: `Заголовок верхнего уровня «${headingText(heading)}» может начинаться не с новой страницы.`,
              paragraphIndex: heading.index,
              recommendation: "Включите разрыв страницы перед заголовком или настройте стиль заголовка.",
              reason: "Проверка основана на pageBreakBefore, ручном разрыве страницы или разрыве секции перед заголовком."
            },
            document,
            profile
          )
        );
      }
    }
  }

  if (profile.forbidSingleSubsection && (!document.headingNumbering || document.headingNumbering.reliability === "high")) {
    const childrenByParent = new Map<string, number>();
    for (const heading of reliableHeadings) {
      const number = headingNumber(heading);
      const match = /^(\d+)\.(\d+)$/u.exec(number ?? "");
      if (match) childrenByParent.set(match[1], (childrenByParent.get(match[1]) ?? 0) + 1);
    }
    for (const [parent, count] of childrenByParent) {
      if (count === 1) {
        const child = reliableHeadings.find((heading) => headingNumber(heading)?.startsWith(`${parent}.`));
        if (child) {
          issues.push(
            createIssue(
              {
                level: "info",
                confidence: "medium",
                code: "SINGLE_SUBSECTION",
                category: "headings",
                message: `У раздела ${parent} найден только один подраздел.`,
                paragraphIndex: child.index,
                recommendation: "Проверьте структуру: если есть подраздел 1.1, обычно должен быть и 1.2 либо подразделение не требуется."
              },
              document,
              profile
            )
          );
        }
      }
    }
  }

  const reliableHeadingIndexes = new Set(reliableHeadings.map((heading) => heading.index));
  const headingsWithoutText = reliableHeadings
    .filter((heading) => {
      const next = document.paragraphs[heading.index + 1];
      return next?.isHeading && reliableHeadingIndexes.has(next.index);
    });
  const noTextAfterHeading =
    headingsWithoutText.length > 1
      ? [
          createIssue(
            {
              level: "info",
              confidence: "low",
              code: "HEADING_WITHOUT_TEXT_GROUPED",
              category: "headings",
              message: `${headingsWithoutText.length} заголовков начинаются сразу со следующего подраздела.`,
              paragraphIndex: headingsWithoutText[0]?.index,
              recommendation: "Для курсовой работы это обычно допустимо. При необходимости добавьте короткий вводный абзац после заголовка главы.",
              reason: "Информационная агрегированная проверка, не снижает итоговый score.",
              occurrences: headingsWithoutText.map((heading) => ({
                paragraphIndex: heading.index,
                section: heading.sectionTitle,
                excerpt: headingText(heading)
              }))
            },
            document,
            profile
          )
        ]
      : headingsWithoutText.map((heading) => {
          const strict = profile.id === "strict";
          return createIssue(
            {
              level: strict ? "warning" : "info",
              confidence: strict ? "medium" : "low",
              code: "HEADING_WITHOUT_TEXT",
              category: "headings",
              message: `После заголовка «${headingText(heading)}» сразу идет следующий заголовок.`,
              paragraphIndex: heading.index,
              recommendation: "Проверьте структуру вложенности. Для раздела верхнего уровня с подразделами это может быть допустимо.",
              reason: strict ? "Строгий профиль ожидает вводный текст после заголовка." : "В обычном профиле это диагностическое замечание и не снижает итоговый score."
            },
            document,
            profile
          );
        });

  const allIssues = [...issues, ...noTextAfterHeading];
  return [{ execution: makeExecution("HEADING_RULES", "Оформление и структура заголовков", "headings", allIssues), issues: allIssues }];
}
