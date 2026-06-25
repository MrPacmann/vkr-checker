import type { DocumentParagraph, ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";

function isBodyParagraph(paragraph: DocumentParagraph): boolean {
  if (paragraph.role) return paragraph.role === "mainText" && paragraph.renderedText.length > 40;
  return !paragraph.isHeading && !paragraph.inTable && paragraph.renderedText.length > 40;
}

function approx(actual: number | undefined, expected: number, tolerance: number): boolean {
  return actual !== undefined && Math.abs(actual - expected) <= tolerance;
}

function sampleBodyParagraphs(document: ParsedDocument): DocumentParagraph[] {
  return document.paragraphs.filter(isBodyParagraph).slice(0, 80);
}

export function runTypographyChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  if (!profile.enabledChecks.typography && !profile.enabledChecks.paragraphFormatting) return [];
  const issues = [];
  const samples = sampleBodyParagraphs(document);
  if (samples.length === 0) {
    issues.push(
      createIssue(
        {
          level: "info",
          confidence: "unknown",
          code: "TYPOGRAPHY_UNAVAILABLE",
          category: "typography",
          message: "Не удалось выделить основной текст для проверки типографики.",
          recommendation: "Проверьте шрифт, размер, межстрочный интервал, абзацный отступ и выравнивание вручную.",
          source: "system"
        },
        document,
        profile
      )
    );
    return [{ execution: makeExecution("TYPOGRAPHY", "Типографика основного текста", "typography", issues, "partial"), issues }];
  }

  const fontMismatches = samples.filter((paragraph) => {
    const font = paragraph.inheritedRunFormat.fontFamily;
    return font && !font.toLowerCase().includes(profile.typography.mainFont.toLowerCase());
  });
  if (fontMismatches.length > 0) {
    const paragraph = fontMismatches[0];
    issues.push(
      createIssue(
        {
          level: "error",
          confidence: "high",
          code: "MAIN_FONT_MISMATCH",
          category: "typography",
          message: `Основной текст, вероятно, использует шрифт «${paragraph.inheritedRunFormat.fontFamily}» вместо «${profile.typography.mainFont}».`,
          paragraphIndex: paragraph.index,
          recommendation: `Установите для основного текста шрифт ${profile.typography.mainFont}.`,
          reason: `Найдено ${fontMismatches.length} несовпадений в первых ${samples.length} абзацах основного текста.`
        },
        document,
        profile
      )
    );
  }

  const sizeMismatches = samples.filter((paragraph) => {
    const size = paragraph.inheritedRunFormat.fontSizePt;
    return size !== undefined && !approx(size, profile.typography.mainFontSizePt, 0.5);
  });
  if (sizeMismatches.length > 0) {
    const paragraph = sizeMismatches[0];
    issues.push(
      createIssue(
        {
          level: "error",
          confidence: "high",
          code: "MAIN_FONT_SIZE_MISMATCH",
          category: "typography",
          message: `Размер основного текста отличается от ${profile.typography.mainFontSizePt} пт.`,
          paragraphIndex: paragraph.index,
          recommendation: `Установите размер основного текста ${profile.typography.mainFontSizePt} пт.`,
          reason: `Первое обнаруженное значение: ${paragraph.inheritedRunFormat.fontSizePt ?? "неизвестно"} пт.`
        },
        document,
        profile
      )
    );
  }

  const lineSpacingMismatch = samples.find(
    (paragraph) => paragraph.format.lineSpacing !== undefined && !approx(paragraph.format.lineSpacing, profile.typography.lineSpacing, 0.08)
  );
  if (lineSpacingMismatch) {
    issues.push(
      createIssue(
        {
          level: "warning",
          confidence: "high",
          code: "LINE_SPACING_MISMATCH",
          category: "typography",
          message: `Межстрочный интервал отличается от ${profile.typography.lineSpacing}.`,
          paragraphIndex: lineSpacingMismatch.index,
          recommendation: `Установите межстрочный интервал ${profile.typography.lineSpacing}.`,
          reason: `Найденное значение: ${lineSpacingMismatch.format.lineSpacing}.`
        },
        document,
        profile
      )
    );
  }

  const indentMismatch = samples.find(
    (paragraph) => paragraph.format.firstLineIndentCm !== undefined && !approx(paragraph.format.firstLineIndentCm, profile.typography.firstLineIndentCm, 0.12)
  );
  if (indentMismatch) {
    issues.push(
      createIssue(
        {
          level: "warning",
          confidence: "high",
          code: "FIRST_LINE_INDENT_MISMATCH",
          category: "typography",
          message: `Абзацный отступ отличается от ${profile.typography.firstLineIndentCm} см.`,
          paragraphIndex: indentMismatch.index,
          recommendation: `Установите отступ первой строки ${profile.typography.firstLineIndentCm} см через параметры абзаца, а не пробелами.`,
          reason: `Найденное значение: ${indentMismatch.format.firstLineIndentCm} см.`
        },
        document,
        profile
      )
    );
  }

  const alignmentMismatch = samples.find((paragraph) => paragraph.format.alignment !== undefined && paragraph.format.alignment !== profile.typography.alignment);
  if (alignmentMismatch) {
    issues.push(
      createIssue(
        {
          level: "warning",
          confidence: "high",
          code: "TEXT_ALIGNMENT_MISMATCH",
          category: "typography",
          message: "Выравнивание основного текста отличается от профиля.",
          paragraphIndex: alignmentMismatch.index,
          recommendation: "Для основного текста обычно используется выравнивание по ширине.",
          reason: `Найденное значение: ${alignmentMismatch.format.alignment}.`
        },
        document,
        profile
      )
    );
  }

  const unknownParameters =
    samples.filter((paragraph) => !paragraph.inheritedRunFormat.fontFamily || !paragraph.inheritedRunFormat.fontSizePt || !paragraph.format.lineSpacing).length > samples.length / 2;
  if (unknownParameters) {
    issues.push(
      createIssue(
        {
          level: "info",
          confidence: "unknown",
          code: "TYPOGRAPHY_PARTIAL_DATA",
          category: "typography",
          message: "Часть параметров оформления не удалось определить по структуре DOCX.",
          recommendation: "Проверьте спорные параметры вручную или используйте стили Word с явно заданными значениями.",
          source: "system"
        },
        document,
        profile
      )
    );
  }

  return [{ execution: makeExecution("TYPOGRAPHY", "Типографика основного текста", "typography", issues, issues.some((issue) => issue.confidence === "unknown") ? "partial" : undefined), issues }];
}
