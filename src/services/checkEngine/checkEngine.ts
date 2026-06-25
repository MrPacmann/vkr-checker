import type { ParsedDocument } from "../../types/document";
import type { CheckReport, CheckIssue, ReportDebug, ReportStats } from "../../types/report";
import type { InputMode } from "../../types/report";
import type { RuleProfile } from "../../types/settings";
import type { VisualLayerResult } from "../../types/visualLayer";
import { createId } from "../../utils/id";
import { normalizeSectionTitle } from "../../utils/text";
import { attachPagesToIssues } from "../visualLayer/pageMatcher";
import { runBibliographyChecks } from "./bibliographyChecks";
import { runFigureChecks } from "./figureChecks";
import { runFormattingChecks } from "./formattingChecks";
import { runFormulaChecks } from "./formulaChecks";
import { runHeadingChecks } from "./headingChecks";
import { calculateIssueScore, deduplicateIssues } from "./issueScoring";
import { runListingChecks } from "./listingChecks";
import { runPageLayoutChecks } from "./pageLayoutChecks";
import { runReferenceChecks } from "./referenceChecks";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";
import { runStructureChecks } from "./structureChecks";
import { runTableChecks } from "./tableChecks";
import { runTypographyChecks } from "./typographyChecks";

export { calculateIssueScore, deduplicateIssues } from "./issueScoring";

export interface CheckEngineInput {
  document: ParsedDocument;
  profile: RuleProfile;
  visualLayer: VisualLayerResult;
  optionalPdfFileName?: string | null;
  inputMode?: Extract<InputMode, "docxOnly" | "docxWithPdf">;
}

function buildStats(document: ParsedDocument, issues: CheckIssue[]): ReportStats {
  return {
    ...document.stats,
    critical: issues.filter((issue) => issue.level === "critical").length,
    errors: issues.filter((issue) => issue.level === "error").length,
    warnings: issues.filter((issue) => issue.level === "warning").length,
    info: issues.filter((issue) => issue.level === "info").length,
    highConfidence: issues.filter((issue) => issue.confidence === "high").length,
    mediumConfidence: issues.filter((issue) => issue.confidence === "medium").length,
    lowConfidence: issues.filter((issue) => issue.confidence === "low").length,
    unknownConfidence: issues.filter((issue) => issue.confidence === "unknown").length,
    manualReview: issues.filter((issue) => issue.confidence === "unknown").length
  };
}

function buildDebug(document: ParsedDocument, profile: RuleProfile): ReportDebug {
  const detectedCaptions = document.objects
    ? document.objects.map((object) => ({
        type: object.type,
        number: object.number,
        title: object.title,
        paragraphIndex: object.paragraphIndex,
        rawText: object.rawText,
        source: object.source,
        numbering: object.numbering
      }))
    : document.captions.map((caption) => ({
        type: caption.kind,
        number: caption.number,
        title: caption.title,
        paragraphIndex: caption.paragraphIndex,
        rawText: caption.text,
        source: caption.source,
        numbering: caption.numbering
      }));
  return {
    activeProfileId: profile.id,
    activeWorkType: profile.activeWorkType ?? profile.defaultWorkType ?? "generic",
    detectedSections: document.headings.map((heading) => ({
      rawText: heading.renderedText || heading.text,
      normalizedText: normalizeSectionTitle(heading.renderedText || heading.text),
      paragraphIndex: heading.index,
      styleId: heading.styleId,
      styleName: heading.styleName
    })),
    detectedHeadings: document.headings.map((heading) => ({
      rawText: heading.renderedText || heading.text,
      normalizedText: normalizeSectionTitle(heading.renderedText || heading.text),
      paragraphIndex: heading.index,
      styleId: heading.styleId,
      styleName: heading.styleName
    })),
    detectedCaptions,
    detectedTables: document.tables.map((table) => ({
      number: table.caption?.number,
      paragraphIndex: table.paragraphIndex,
      caption: table.caption?.text,
      rawText: table.text
    })),
    detectedFigures: document.images.map((image) => ({
      number: image.caption?.number,
      paragraphIndex: image.paragraphIndex,
      rawText: image.altText ?? image.target ?? image.id
    })),
    detectedFormulas: document.captions
      .filter((caption) => caption.kind === "formula")
      .map((caption) => ({ number: caption.number, paragraphIndex: caption.paragraphIndex, rawText: caption.text })),
    detectedListings: document.captions
      .filter((caption) => caption.kind === "listing")
      .map((caption) => ({ number: caption.number, title: caption.title, paragraphIndex: caption.paragraphIndex, rawText: caption.text })),
    detectedBibliography: document.bibliography.map((entry) => ({
      number: entry.number,
      paragraphIndex: entry.paragraphIndex,
      rawText: entry.text
    })),
    detectedAppendices: document.headings
      .filter((heading) => /^ПРИЛОЖЕНИ[ЕЯ](?:\s+[А-ЯA-Z0-9])?/iu.test(heading.renderedText || heading.text))
      .map((heading) => ({ label: normalizeSectionTitle(heading.renderedText || heading.text), paragraphIndex: heading.index, rawText: heading.renderedText || heading.text })),
    sourceReferenceCandidates: (document.sourceReferenceCandidates ?? []).map((candidate) => ({
      raw: candidate.raw,
      paragraphIndex: candidate.paragraphIndex,
      contextBefore: candidate.contextBefore,
      contextAfter: candidate.contextAfter,
      decision: candidate.decision,
      reason: candidate.reason
    })),
    detectedNumberingDefinitions: document.numberingDefinitions ?? [],
    numberingReconstructionWarnings: document.numberingReconstructionWarnings ?? [],
    headingNumbering: document.headingNumbering,
    paragraphRoles: document.paragraphs.map((paragraph) => ({
      paragraphIndex: paragraph.index,
      role: paragraph.role ?? "unknown",
      rawText: paragraph.text,
      renderedText: paragraph.renderedText
    })),
    unavailableChecks: []
  };
}

function assessScoreReliability(document: ParsedDocument, issues: CheckIssue[]): CheckReport["scoreReliability"] {
  const hasNumberingWarnings = (document.numberingReconstructionWarnings ?? []).length > 0;
  const hasUncertainSourceReferences = (document.sourceReferenceCandidates ?? []).some((candidate) => candidate.decision === "uncertain");
  const headingNumberingReliable = !document.headingNumbering || document.headingNumbering.reliability === "high";
  const figureRefs = document.references.filter((reference) => reference.kind === "figure").length;
  const tableRefs = document.references.filter((reference) => reference.kind === "table").length;
  const figureCaptions = document.captions.filter((caption) => caption.kind === "figure").length;
  const tableCaptions = document.captions.filter((caption) => caption.kind === "table").length;
  const hasFigureNumbering = (document.numberingDefinitions ?? []).some((definition) => /рисунок/iu.test(definition.lvlText ?? ""));
  const hasTableNumbering = (document.numberingDefinitions ?? []).some((definition) => /таблиц/iu.test(definition.lvlText ?? ""));

  if ((figureRefs >= 5 && document.images.length >= 3 && figureCaptions === 0 && hasFigureNumbering) || (tableRefs >= 5 && document.tables.length >= 3 && tableCaptions === 0 && hasTableNumbering)) {
    return "unreliable";
  }
  if (!headingNumberingReliable || hasNumberingWarnings || hasUncertainSourceReferences || issues.some((issue) => issue.canBeFalsePositive)) return "limited";
  return "reliable";
}

function visualLayerResultCheck(document: ParsedDocument, profile: RuleProfile, visualLayer: VisualLayerResult): RuleCheckResult {
  const issues: CheckIssue[] = [];
  if (visualLayer.mode === "htmlPreview") {
    issues.push(
      createIssue(
        {
          level: "info",
          confidence: "low",
          code: "VISUAL_LAYER_HTML_PREVIEW",
          category: "visual",
          message: "Используется HTML-превью DOCX. Номера страниц могут отличаться от Microsoft Word.",
          recommendation: "Для более точной постраничной привязки загрузите PDF, экспортированный из того же DOCX.",
          source: "htmlPreview"
        },
        document,
        profile
      )
    );
  }
  if (visualLayer.mode === "textOnly") {
    issues.push(
      createIssue(
        {
          level: "info",
          confidence: "unknown",
          code: "VISUAL_LAYER_TEXT_ONLY",
          category: "visual",
          message: "Визуальный слой построить не удалось.",
          recommendation: "Загрузите PDF для просмотра страниц или проверьте визуальное расположение замечаний вручную.",
          source: "system"
        },
        document,
        profile
      )
    );
  }
  for (const warning of visualLayer.warnings) {
    issues.push(
      createIssue(
        {
          level: "info",
          confidence: "unknown",
          code: "VISUAL_LAYER_WARNING",
          category: "visual",
          message: warning,
          recommendation: "Это ограничение не влияет на структурную проверку DOCX, но может снижать точность привязки к страницам.",
          source: "system"
        },
        document,
        profile
      )
    );
  }
  return {
    execution: makeExecution("VISUAL_LAYER", "Построение визуального слоя", "visual", issues, visualLayer.status === "ready" ? "passed" : "partial"),
    issues
  };
}

export function runChecks(input: CheckEngineInput): CheckReport {
  const { document, profile, visualLayer } = input;
  const results = [
    ...runStructureChecks(document, profile),
    ...runHeadingChecks(document, profile),
    ...runPageLayoutChecks(document, profile),
    ...runTypographyChecks(document, profile),
    ...runFormattingChecks(document, profile),
    ...runFigureChecks(document, profile),
    ...runTableChecks(document, profile),
    ...runFormulaChecks(document, profile),
    ...runListingChecks(document, profile),
    ...runBibliographyChecks(document, profile),
    ...runReferenceChecks(document, profile),
    visualLayerResultCheck(document, profile, visualLayer)
  ];

  const rawIssues = deduplicateIssues(results.flatMap((result) => result.issues));
  const issues = attachPagesToIssues(rawIssues, document, visualLayer);
  const checkExecutions = results.map((result) => result.execution);
  const checks = {
    total: checkExecutions.length,
    passed: checkExecutions.filter((check) => check.status === "passed").length,
    failed: checkExecutions.filter((check) => check.status === "failed").length,
    partial: checkExecutions.filter((check) => check.status === "partial").length,
    notAvailable: checkExecutions.filter((check) => check.status === "notAvailable").length
  };
  const score = calculateIssueScore(issues);
  const scoreReliability = assessScoreReliability(document, issues);
  const reliabilityWarning =
    scoreReliability === "unreliable"
      ? ["Оценка ограничена: DOCX содержит признаки авто-нумерации объектов, но подписи не восстановились достаточно надёжно."]
      : scoreReliability === "limited"
        ? ["Оценка частично ограничена: часть проверок требует ручного подтверждения из-за неполных данных DOCX."]
        : [];
  const headingNumberingWarning =
    document.headingNumbering && document.headingNumbering.reliability !== "high"
      ? ["Нумерация заголовков восстановлена неуверенно. Замечания, зависящие от структуры разделов, могут быть неточными."]
      : [];

  return {
    id: createId("report"),
    fileName: document.fileName,
    optionalPdfFileName: input.optionalPdfFileName ?? null,
    inputMode: input.inputMode ?? (input.optionalPdfFileName ? "docxWithPdf" : "docxOnly"),
    profileName: profile.name,
    generatedAt: new Date().toISOString(),
    visualLayerMode: visualLayer.mode,
    score,
    scoreReliability,
    scoreExplanation: "Процент соответствия является ориентировочным и не заменяет ручную проверку.",
    stats: buildStats(document, issues),
    checks,
    checkExecutions,
    notAvailableChecks: [],
    issues,
    documentWarnings: [...document.warnings, ...visualLayer.warnings, ...reliabilityWarning, ...headingNumberingWarning],
    privacyNote: "Документы и результаты проверки обрабатываются локально в браузере и никуда не отправляются.",
    debug: buildDebug(document, profile)
  };
}
