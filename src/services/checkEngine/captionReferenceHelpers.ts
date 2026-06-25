import type { CaptionKind, ParsedDocument } from "../../types/document";
import type { CheckIssue } from "../../types/report";
import type { IssueCategory, IssueLevel } from "../../types/rules";
import type { RuleProfile } from "../../types/settings";
import { findDuplicateNumbers, findMissingContinuousNumbers } from "../../utils/numbering";
import { createIssue } from "./ruleRunner";

interface CaptionReferenceOptions {
  kind: CaptionKind;
  label: string;
  category: IssueCategory;
  captionEnabled: boolean;
  referenceEnabled: boolean;
  objectCount?: number;
}

function isPmProfile(profile: RuleProfile): boolean {
  return profile.id === "pm-department-normcontrol" || profile.originalProfileId === "pm-department-normcontrol";
}

function pmCode(kind: CaptionKind, genericSuffix: string): string {
  const prefix = kind === "figure" || kind === "scheme" ? "PM_FIGURE" : kind === "table" ? "PM_TABLE" : kind === "listing" ? "PM_LISTING" : "PM_FORMULA";
  if (genericSuffix === "CAPTION_FORMAT_INVALID" || genericSuffix === "CAPTION_WITHOUT_TITLE") return `${prefix}_CAPTION_FORMAT_ERROR`;
  if (genericSuffix === "REFERENCE_NOT_FOUND") return `${prefix}_BROKEN_REFERENCE`;
  if (genericSuffix === "WITHOUT_TEXT_REF") return `${prefix}_REFERENCE_MISSING`;
  if (genericSuffix === "OBJECT_WITHOUT_CAPTION" || genericSuffix === "CAPTIONS_MISSING") return `${prefix}_CAPTION_MISSING`;
  return `${prefix}_${genericSuffix}`;
}

function issueCode(profile: RuleProfile, kind: CaptionKind, upper: string, suffix: string): string {
  return isPmProfile(profile) ? pmCode(kind, suffix) : `${upper}_${suffix}`;
}

function numberingModeKey(kind: CaptionKind): keyof RuleProfile["numbering"] {
  if (kind === "figure" || kind === "scheme") return "figures";
  if (kind === "table") return "tables";
  if (kind === "formula") return "formulas";
  if (kind === "listing") return "listings";
  return "figures";
}

function pmBySectionCode(kind: CaptionKind): string {
  if (kind === "table") return "PM_TABLE_NUMBERING_SHOULD_BE_BY_SECTION";
  if (kind === "figure" || kind === "scheme") return "PM_FIGURE_NUMBERING_SHOULD_BE_BY_SECTION";
  if (kind === "listing") return "PM_LISTING_NUMBERING_SHOULD_BE_BY_SECTION";
  return "PM_FORMULA_NUMBER_FORMAT_ERROR";
}

function hasPlainContinuousNumbers(captions: Array<{ number: string }>): boolean {
  return captions.some((caption) => /^\d+$/u.test(caption.number));
}

function headingNumberingReliable(document: ParsedDocument): boolean {
  return !document.headingNumbering || document.headingNumbering.reliability === "high";
}

function hasMatchingNumberingDefinition(document: ParsedDocument, label: string): boolean {
  return (document.numberingDefinitions ?? []).some((definition) => new RegExp(label, "iu").test(definition.lvlText ?? ""));
}

function missingReferenceRecommendation(kind: CaptionKind, label: string, number: string): string {
  if (kind === "table") return `Добавьте ссылку в тексте перед таблицей, например: «... представлены в таблице ${number}».`;
  if (kind === "formula") return `Добавьте ссылку в тексте перед формулой, например: «... вычисляется по формуле (${number})».`;
  if (kind === "figure" || kind === "scheme") return `Добавьте ссылку в тексте перед объектом, например: «... показано на рисунке ${number}».`;
  return `Добавьте ссылку в тексте перед объектом, например: «... приведено в ${label.toLowerCase()} ${number}».`;
}

function continuousNumberingLevel(document: ParsedDocument, profile: RuleProfile, kind: CaptionKind, captions: Array<{ number: string }>): IssueLevel {
  if (kind === "table") {
    const policy = profile.numberingPolicy?.tables;
    if (policy?.allowContinuousWhenFew && captions.length <= (policy.continuousAllowedMaxCount ?? 0)) {
      return policy.continuousNumberingSeverityWhenAllowed ?? policy.continuousNumberingSeverity ?? "info";
    }
    return policy?.continuousNumberingSeverityWhenMany ?? policy?.continuousNumberingSeverity ?? "warning";
  }
  if (kind === "figure" || kind === "scheme") {
    const policy = profile.numberingPolicy?.figures;
    if (policy?.allowContinuousWhenFew && captions.length <= (policy.continuousAllowedMaxCount ?? 0)) {
      return policy.continuousNumberingSeverityWhenAllowed ?? policy.continuousNumberingSeverity ?? "info";
    }
    return policy?.continuousNumberingSeverityWhenMany ?? policy?.continuousNumberingSeverity ?? "warning";
  }
  return document.stats.tables > 0 ? "warning" : "info";
}

function appendixLetter(sectionTitle: string | undefined): string | undefined {
  return /^ПРИЛОЖЕНИЕ\s+([А-ЯA-Z0-9])(?:\s|$)/iu.exec(sectionTitle ?? "")?.[1]?.toUpperCase();
}

function missingReferenceLevel(profile: RuleProfile, kind: CaptionKind): IssueLevel {
  if ((kind === "figure" || kind === "scheme") && profile.figures?.missingReferenceSeverity) return profile.figures.missingReferenceSeverity;
  return "warning";
}

function aggregateMissingReferencesThreshold(profile: RuleProfile, kind: CaptionKind): number | null {
  if (kind === "figure" || kind === "scheme") return profile.figures?.aggregateMissingReferencesThreshold ?? 5;
  return null;
}

function groupedMissingReferenceCode(profile: RuleProfile, kind: CaptionKind, upper: string): string {
  if (isPmProfile(profile) && (kind === "figure" || kind === "scheme")) return "PM_FIGURE_REFERENCE_MISSING_GROUPED";
  return `${upper}_REFERENCE_MISSING_GROUPED`;
}

export function runCaptionReferenceIssues(document: ParsedDocument, profile: RuleProfile, options: CaptionReferenceOptions): CheckIssue[] {
  const captions = document.captions.filter((caption) => caption.kind === options.kind);
  const objectNumbers = new Set(
    (document.objects ?? [])
      .filter((object) => object.type === options.kind && !object.continuation)
      .map((object) => object.number)
  );
  const references = document.references.filter((reference) => reference.kind === options.kind);
  const issues: CheckIssue[] = [];
  const upper = options.label.toUpperCase();

  if (options.captionEnabled) {
    for (const caption of captions.filter((item) => !item.validFormat)) {
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "high",
            code: issueCode(profile, options.kind, upper, "CAPTION_FORMAT_INVALID"),
            category: options.category,
            message: `Подпись ${options.label.toLowerCase()} оформлена не по шаблону профиля.`,
            paragraphIndex: caption.paragraphIndex,
            excerpt: caption.text,
            recommendation: `Проверьте формат подписи. Обычно используется «${options.label} N — Название».`
          },
          document,
          profile
        )
      );
    }

    if (options.kind !== "formula") {
      for (const caption of captions.filter((item) => !item.title.trim())) {
        issues.push(
          createIssue(
            {
              level: "warning",
              confidence: "high",
              code: issueCode(profile, options.kind, upper, "CAPTION_WITHOUT_TITLE"),
              category: options.category,
              message: `Подпись ${options.label.toLowerCase()} не содержит названия.`,
              paragraphIndex: caption.paragraphIndex,
              excerpt: caption.text,
              recommendation: "Добавьте содержательное название после тире."
            },
            document,
            profile
          )
        );
      }
    }

    const duplicateCandidates =
      profile.numbering[numberingModeKey(options.kind)] === "bySection" ? captions.filter((caption) => !/^\d+$/u.test(caption.number)) : captions;
    for (const duplicate of findDuplicateNumbers(duplicateCandidates.map((caption) => caption.number))) {
      const caption = duplicateCandidates.find((item) => item.number === duplicate);
      issues.push(
        createIssue(
          {
            level: "error",
            confidence: "high",
            code: issueCode(profile, options.kind, upper, "DUPLICATE_NUMBER"),
            category: options.category,
            message: `Дублируется номер ${options.label.toLowerCase()} ${duplicate}.`,
            paragraphIndex: caption?.paragraphIndex,
            excerpt: caption?.text,
            recommendation: "Исправьте нумерацию, чтобы номера объектов не повторялись."
          },
          document,
          profile
        )
      );
    }

    const missing = findMissingContinuousNumbers(captions.map((caption) => caption.number));
    if (missing.length > 0 && profile.numbering[`${options.kind}s` as keyof RuleProfile["numbering"]] === "continuous") {
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "medium",
            code: issueCode(profile, options.kind, upper, "NUMBERING_GAP"),
            category: options.category,
            message: `В нумерации ${options.label.toLowerCase()} есть пропуски: ${missing.join(", ")}.`,
            paragraphIndex: captions[0]?.paragraphIndex,
            recommendation: "Проверьте последовательность нумерации объектов."
          },
          document,
          profile
        )
      );
    }

    if (
      isPmProfile(profile) &&
      (options.kind === "figure" || options.kind === "scheme" || options.kind === "table") &&
      profile.numbering[numberingModeKey(options.kind)] === "bySection" &&
      headingNumberingReliable(document) &&
      hasPlainContinuousNumbers(captions)
    ) {
      const first = captions.find((caption) => /^\d+$/u.test(caption.number));
      issues.push(
        createIssue(
          {
            level: continuousNumberingLevel(document, profile, options.kind, captions),
            confidence: "high",
            code: pmBySectionCode(options.kind),
            category: options.category,
            message: `${options.label} имеет сквозной номер без номера раздела, хотя профиль кафедры ПМ ожидает нумерацию по разделам.`,
            paragraphIndex: first?.paragraphIndex,
            excerpt: first?.text,
            recommendation: `Используйте номер вида «${options.label} 1.1 — Название» внутри раздела 1.`,
            expected: "номер по разделу, например 1.1",
            actual: first?.number
          },
          document,
          profile
        )
      );
    }

    if (isPmProfile(profile) && (options.kind === "figure" || options.kind === "scheme")) {
      const appendixCaptions = captions.filter((caption) => {
        const paragraph = document.paragraphs[caption.paragraphIndex];
        return appendixLetter(paragraph?.sectionTitle) && /^\d+$/u.test(caption.number);
      });
      if (appendixCaptions.length > 0) {
        const first = appendixCaptions[0];
        const paragraph = document.paragraphs[first.paragraphIndex];
        const letter = appendixLetter(paragraph?.sectionTitle) ?? "А";
        issues.push(
          createIssue(
            {
              level: "warning",
              confidence: "high",
              code: "PM_APPENDIX_OBJECT_NUMBERING_ERROR",
              category: options.category,
              message: `В приложении ${letter} ${options.label.toLowerCase()} должен иметь номер вида «${options.label} ${letter}.1», а не «${options.label} ${first.number}».`,
              paragraphIndex: first.paragraphIndex,
              excerpt: first.text,
              recommendation: `Для объектов в приложениях используйте номер с буквой приложения, например «${options.label} ${letter}.1 — Название».`,
              expected: `${letter}.1`,
              actual: first.number,
              occurrences: appendixCaptions.map((caption) => {
                const itemParagraph = document.paragraphs[caption.paragraphIndex];
                const itemLetter = appendixLetter(itemParagraph?.sectionTitle) ?? letter;
                return {
                  paragraphIndex: caption.paragraphIndex,
                  section: itemParagraph?.sectionTitle,
                  excerpt: `${options.label} ${itemLetter}.1 expected, actual ${options.label} ${caption.number}`
                };
              })
            },
            document,
            profile
          )
        );
      }
    }

    if (options.objectCount !== undefined && options.objectCount > 0 && captions.length === 0) {
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "medium",
            code: issueCode(profile, options.kind, upper, "OBJECT_WITHOUT_CAPTION"),
            category: options.category,
            message: `Обнаружено объектов больше, чем подписей (${options.objectCount} против ${captions.length}).`,
            recommendation: `Проверьте, что каждый объект типа «${options.label.toLowerCase()}» имеет подпись.`,
            reason: "Количество объектов определено по структуре DOCX, близость подписи к объекту может требовать ручной проверки."
          },
          document,
          profile
        )
      );
    }
  }

  if (options.referenceEnabled) {
    const captionNumbers = objectNumbers.size > 0 ? objectNumbers : new Set(captions.map((caption) => caption.number));
    const brokenReferences = new Map<string, typeof references>();
    for (const reference of references.filter((item) => !captionNumbers.has(item.number))) {
      brokenReferences.set(reference.number, [...(brokenReferences.get(reference.number) ?? []), reference]);
    }
    const aggregateParserFailure =
      captions.length === 0 &&
      references.length >= 5 &&
      ((options.objectCount ?? 0) >= 3 || hasMatchingNumberingDefinition(document, options.label));
    if (aggregateParserFailure && brokenReferences.size > 0) {
      const occurrences = references.slice(0, 10);
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "low",
            code: issueCode(profile, options.kind, upper, "CAPTIONS_MISSING"),
            category: options.category,
            message: `Найдены многочисленные ссылки на ${options.label.toLowerCase()}, но подписи не восстановились из DOCX.`,
            paragraphIndex: occurrences[0]?.paragraphIndex,
            excerpt: occurrences[0]?.text,
            recommendation: "Проверьте, что подписи объектов оформлены штатными средствами Word. Если подписи авто-нумерованные, это может быть ограничением парсера.",
            reason: `Ссылок: ${references.length}, найденных подписей: ${captions.length}, объектов: ${options.objectCount ?? 0}.`,
            parserEvidence: `numberingDefinitions=${document.numberingDefinitions?.length ?? 0}; references=${references.length}; captions=${captions.length}`,
            canBeFalsePositive: true,
            occurrences: occurrences.map((reference) => ({
              paragraphIndex: reference.paragraphIndex,
              section: document.paragraphs[reference.paragraphIndex]?.sectionTitle,
              excerpt: reference.text
            }))
          },
          document,
          profile
        )
      );
    }
    for (const [number, occurrences] of aggregateParserFailure ? [] : brokenReferences) {
      const first = occurrences[0];
      issues.push(
        createIssue(
          {
            level: "error",
            confidence: "high",
            code: issueCode(profile, options.kind, upper, "REFERENCE_NOT_FOUND"),
            category: options.category,
            message:
              occurrences.length > 1
                ? `В тексте есть ${occurrences.length} ссылки на ${options.label.toLowerCase()} ${number}, но соответствующая подпись не найдена.`
                : `В тексте есть ссылка на ${options.label.toLowerCase()} ${number}, но соответствующая подпись не найдена.`,
            paragraphIndex: first?.paragraphIndex,
            excerpt: first?.text,
            recommendation: "Проверьте номер ссылки или добавьте корректную подпись объекта.",
            objectType: options.kind,
            objectNumber: number,
            occurrences: occurrences.map((reference) => {
              const paragraph = document.paragraphs[reference.paragraphIndex];
              return {
                paragraphIndex: reference.paragraphIndex,
                section: paragraph?.sectionTitle,
                excerpt: reference.text
              };
            })
          },
          document,
          profile
        )
      );
    }

    if (profile.enabledChecks.unusedObjects) {
      const referenceNumbers = new Set(references.map((reference) => reference.number));
      const captionsWithoutReferences = captions.filter((item) => !referenceNumbers.has(item.number));
      const aggregateThreshold = aggregateMissingReferencesThreshold(profile, options.kind);
      if (aggregateThreshold !== null && captionsWithoutReferences.length > aggregateThreshold) {
        const first = captionsWithoutReferences[0];
        issues.push(
          createIssue(
            {
              level: missingReferenceLevel(profile, options.kind),
              confidence: "high",
              code: groupedMissingReferenceCode(profile, options.kind, upper),
              category: options.category,
              message: `Найдено ${captionsWithoutReferences.length} рисунков без ссылок в тексте.`,
              paragraphIndex: first?.paragraphIndex,
              excerpt: first?.text,
              recommendation: `Добавьте ссылки в тексте перед рисунками, например: «... показано на рисунке ${first?.number ?? "N"}».`,
              reason: `Сгруппировано ${captionsWithoutReferences.length} замечаний, чтобы не перегружать отчет отдельными карточками.`,
              occurrences: captionsWithoutReferences.map((caption) => ({
                paragraphIndex: caption.paragraphIndex,
                section: document.paragraphs[caption.paragraphIndex]?.sectionTitle,
                excerpt: caption.text,
                objectNumber: caption.number,
                caption: caption.text
              }))
            },
            document,
            profile
          )
        );
      } else {
        for (const caption of captionsWithoutReferences) {
          issues.push(
            createIssue(
              {
                level: missingReferenceLevel(profile, options.kind),
                confidence: "high",
                code: issueCode(profile, options.kind, upper, "WITHOUT_TEXT_REF"),
                category: options.category,
                message: `${options.label} ${caption.number} не имеет ссылки в тексте.`,
                paragraphIndex: caption.paragraphIndex,
                excerpt: caption.text,
                recommendation: missingReferenceRecommendation(options.kind, options.label, caption.number)
              },
              document,
              profile
            )
          );
        }
      }
    }
  }

  return issues;
}
