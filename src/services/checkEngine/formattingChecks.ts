import type { ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";

export function runFormattingChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  const issues = [];
  const textParagraphs = document.paragraphs.filter((paragraph) => (paragraph.role ? paragraph.role === "mainText" : !paragraph.isHeading && !paragraph.inTable));

  if (profile.enabledChecks.paragraphFormatting) {
    const multipleSpaces = textParagraphs.filter((paragraph) => / {2,}/u.test(paragraph.renderedText)).slice(0, 8);
    issues.push(
      ...multipleSpaces.map((paragraph) =>
        createIssue(
          {
            level: "warning",
            confidence: "high",
            code: "MULTIPLE_SPACES",
            category: "formatting",
            message: "В абзаце найдены множественные пробелы.",
            paragraphIndex: paragraph.index,
            recommendation: "Замените повторяющиеся пробелы одним пробелом или используйте штатные параметры отступа."
          },
          document,
          profile
        )
      )
    );

    const manualAlignment = textParagraphs.filter((paragraph) => /^\s{4,}\S/u.test(paragraph.renderedText) || /\S\s{6,}\S/u.test(paragraph.renderedText)).slice(0, 8);
    issues.push(
      ...manualAlignment.map((paragraph) =>
        createIssue(
          {
            level: "warning",
            confidence: "medium",
            code: "MANUAL_ALIGNMENT_SPACES",
            category: "formatting",
            message: "Похоже, в абзаце используется ручное выравнивание пробелами.",
            paragraphIndex: paragraph.index,
            recommendation: "Используйте стили, табуляцию или параметры абзаца вместо набора пробелов."
          },
          document,
          profile
        )
      )
    );

    const emptyRuns = document.paragraphs
      .filter((paragraph, index, paragraphs) => !paragraph.text && !paragraph.inTable && !paragraph.isHeading && !paragraph.hasManualPageBreak && !paragraph.hasPageBreakBefore && !paragraphs[index - 1]?.hasManualPageBreak)
      .filter((paragraph) => paragraph.role === "empty" || (!paragraph.role && !paragraph.hasDrawing && !paragraph.hasFormula && !paragraph.hasSectionBreak))
      .slice(0, 10);
    if (emptyRuns.length >= 3) {
      issues.push(
        createIssue(
          {
            level: "info",
            confidence: "medium",
            code: "EXCESSIVE_EMPTY_PARAGRAPHS",
            category: "formatting",
            message: `Найдено несколько пустых абзацев (${emptyRuns.length} в выборке).`,
            paragraphIndex: emptyRuns[0].index,
            recommendation: "Удалите лишние пустые абзацы и используйте интервалы до/после абзаца или разрывы страниц."
          },
          document,
          profile
        )
      );
    }
  }

  return [{ execution: makeExecution("PARAGRAPH_FORMATTING", "Локальное форматирование абзацев", "formatting", issues), issues }];
}
