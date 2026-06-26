import type { DocumentCaption, DocumentReference, ParsedDocument } from "../../types/document";
import type { ParsedPdfDocument, ParsedPdfLine } from "../../types/pdf";
import type { CheckIssue, CheckReport, NotAvailableCheck, ReportStats } from "../../types/report";
import type { RuleProfile } from "../../types/settings";
import type { VisualLayerResult, VisualPage } from "../../types/visualLayer";
import { regexPresets } from "../../config/regexPresets";
import { createId } from "../../utils/id";
import { findDuplicateNumbers, findMissingContinuousNumbers } from "../../utils/numbering";
import { safeRegExp } from "../../utils/regex";
import { countWords, normalizeForCompare, normalizeSpaces } from "../../utils/text";
import { loadPdf } from "../visualLayer/pdfParser";
import { renderFirstPdfPages, renderPdfPageToImage } from "../visualLayer/pdfPageRenderer";
import { extractPdfTextPages } from "../visualLayer/pdfTextExtractor";
import { recognizeImageText } from "../visualLayer/ocrService";
import { calculateIssueScore, deduplicateIssues } from "../checkEngine/issueScoring";

export interface PdfOnlyProgress {
  message: string;
  stage: number;
}

export interface PdfOnlyResult {
  report: CheckReport;
  document: ParsedDocument;
  visualLayer: VisualLayerResult;
  parsedPdf: ParsedPdfDocument;
}

export interface PdfOnlyOptions {
  pdfFile: File;
  profile: RuleProfile;
  onProgress?: (progress: PdfOnlyProgress) => void;
}

const PDF_ONLY_LIMITATION =
  "Проверка выполнена только по PDF. Система может анализировать текст, страницы, подписи, ссылки, список источников и визуальное представление документа. Проверки, требующие внутренней структуры DOCX, недоступны. Для максимально точной проверки оформления загрузите DOCX.";

const notAvailableChecks: NotAvailableCheck[] = [
  {
    code: "DOCX_STYLE_INHERITANCE",
    title: "Проверка наследования стилей Word",
    reason: "Недоступно в режиме PDF-only. Для этой проверки загрузите DOCX."
  },
  {
    code: "DOCX_PARAGRAPH_FORMATTING",
    title: "Проверка точных параметров абзацев",
    reason: "PDF не содержит полной структуры абзацных стилей Word. Для точной проверки загрузите DOCX."
  },
  {
    code: "DOCX_STYLES_XML",
    title: "Проверка word/styles.xml",
    reason: "В PDF нет внутреннего файла word/styles.xml. Для этой проверки загрузите DOCX."
  },
  {
    code: "DOCX_NUMBERING_XML",
    title: "Проверка word/numbering.xml",
    reason: "В PDF нет внутреннего файла word/numbering.xml. Для этой проверки загрузите DOCX."
  },
  {
    code: "DOCX_SETTINGS_XML",
    title: "Проверка word/settings.xml",
    reason: "В PDF нет внутреннего файла word/settings.xml. Для этой проверки загрузите DOCX."
  },
  {
    code: "DOCX_EXACT_FORMATTING",
    title: "Проверка точного форматирования Word",
    reason: "PDF не хранит полную модель прямого форматирования DOCX. В PDF-only доступны только текстовые и визуальные проверки."
  }
];

function acceptedSectionNames(section: string, profile: RuleProfile): string[] {
  return [section, ...(profile.alternativeSectionNames[section] ?? [])].map(normalizeForCompare);
}

function makeIssue(input: {
  level: CheckIssue["level"];
  confidence: CheckIssue["confidence"];
  code: string;
  category: CheckIssue["category"];
  message: string;
  line?: ParsedPdfLine;
  excerpt?: string;
  recommendation: string;
  reason?: string;
  source?: CheckIssue["source"];
}, profile: RuleProfile): CheckIssue {
  return {
    id: createId("issue"),
    level: input.level,
    confidence: input.confidence,
    code: input.code,
    category: input.category,
    message: input.message,
    location: {
      section: input.line?.sectionTitle,
      paragraphIndex: input.line?.index,
      estimatedPage: input.line?.page ?? null,
      page: input.line?.page ?? null
    },
    excerpt: input.excerpt ?? input.line?.text,
    recommendation: input.recommendation,
    source: input.source ?? "pdf",
    ruleProfile: profile.name,
    reason: input.reason
  };
}

function findCaptions(lines: ParsedPdfLine[], profile: RuleProfile): DocumentCaption[] {
  const captions: DocumentCaption[] = [];
  const entries = [
    ["figure", profile.captionPatterns.figure],
    ["table", profile.captionPatterns.table],
    ["listing", profile.captionPatterns.listing],
    ["scheme", profile.captionPatterns.scheme],
    ["formula", profile.captionPatterns.formula]
  ] as const;

  for (const line of lines) {
    for (const [kind, pattern] of entries) {
      const fallbackPattern = regexPresets.captionPatterns[kind] ?? pattern;
      const activePattern = safeRegExp(`^\\s*${pattern}\\s*$`, "iu") ? pattern : fallbackPattern;
      const regex = safeRegExp(`^\\s*${activePattern}\\s*$`, "iu");
      const match = regex?.exec(line.text);
      const weakFormulaMatch = kind === "formula" ? /\([А-ЯA-Z]?\d+(?:\.\d+)*\)\s*$/iu.exec(line.text) : null;
      if (match || weakFormulaMatch) {
        if (kind === "table" && match?.[1]) continue;
        const numberIndex = kind === "table" ? 2 : 1;
        const titleIndex = kind === "table" ? 3 : 2;
        captions.push({
          id: createId("pdf-caption"),
          kind,
          number: match?.[numberIndex] ?? weakFormulaMatch?.[0].replace(/[()]/g, "") ?? "?",
          title: normalizeSpaces(match?.[titleIndex] ?? ""),
          paragraphIndex: line.index,
          text: line.text,
          validFormat: Boolean(match)
        });
      }
    }
  }
  return captions;
}

function findReferences(lines: ParsedPdfLine[], profile: RuleProfile): DocumentReference[] {
  const references: DocumentReference[] = [];
  const entries = Object.entries(profile.referencePatterns) as Array<[DocumentReference["kind"], string]>;
  for (const line of lines) {
    for (const [kind, pattern] of entries) {
      const fallbackPattern = regexPresets.referencePatterns[kind as keyof typeof regexPresets.referencePatterns] ?? pattern;
      const regex = safeRegExp(pattern, "giu") ?? safeRegExp(fallbackPattern, "giu");
      if (!regex) continue;
      for (const match of line.text.matchAll(regex)) {
        if (!match[1]) continue;
        if (kind === "source") {
          for (const number of match[1].split(/[,;]/u).map((item) => normalizeSpaces(item)).filter(Boolean)) {
            references.push({ id: createId("pdf-ref"), kind, number, paragraphIndex: line.index, text: normalizeSpaces(match[0]) });
          }
        } else {
          references.push({ id: createId("pdf-ref"), kind, number: normalizeSpaces(match[1]), paragraphIndex: line.index, text: normalizeSpaces(match[0]) });
        }
      }
    }
  }
  return references;
}

function findBibliography(lines: ParsedPdfLine[], profile: RuleProfile): ParsedPdfDocument["bibliography"] {
  const sourceAlternatives = profile.alternativeSectionNames["СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ"] ?? [];
  const names = new Set(
    ["СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ", "СПИСОК ИСТОЧНИКОВ", "СПИСОК ЛИТЕРАТУРЫ", "БИБЛИОГРАФИЧЕСКИЙ СПИСОК", "БИБЛИОГРАФИЧЕСКИЙ СПИСОК ИСТОЧНИКОВ", ...sourceAlternatives].map(
      normalizeForCompare
    )
  );
  const start = lines.findIndex((line) => names.has(normalizeForCompare(line.text)));
  if (start < 0) return [];
  const entries: ParsedPdfDocument["bibliography"] = [];
  for (const line of lines.slice(start + 1)) {
    if (entries.length > 0 && /^[А-ЯЁA-Z0-9 .-]{4,}$/u.test(line.text) && line.text.length < 90 && !/^\d+[.)]/u.test(line.text)) break;
    const match = /^\s*(\d+)[.)]\s+(.+)/u.exec(line.text);
    if (match) {
      entries.push({ number: Number(match[1]), text: line.text, lineIndex: line.index, page: line.page });
    } else if (entries.length > 0 && line.text.length > 30) {
      entries.push({ text: line.text, lineIndex: line.index, page: line.page });
    }
  }
  return entries;
}

function buildLines(pages: VisualPage[]): ParsedPdfLine[] {
  const lines: ParsedPdfLine[] = [];
  for (const page of pages) {
    const pageLines = (page.text ?? "")
      .split(/\n|(?<=\.)\s{2,}/u)
      .map(normalizeSpaces)
      .filter(Boolean);
    for (const text of pageLines) {
      lines.push({ index: lines.length, page: page.pageNumber, text });
    }
  }

  let currentSection: string | undefined;
  return lines.map((line) => {
    const normalized = normalizeForCompare(line.text);
    const looksLikeHeading = line.text.length < 120 && (/^[А-ЯЁA-Z0-9 .-]+$/u.test(line.text) || /^\d+(?:\.\d+)*\s+\S+/u.test(line.text));
    if (looksLikeHeading && normalized.length > 2) currentSection = line.text;
    return { ...line, sectionTitle: currentSection };
  });
}

function reportStats(parsedPdf: ParsedPdfDocument, issues: CheckIssue[]): ReportStats {
  return {
    ...parsedPdf.stats,
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

function runPdfTextChecks(parsedPdf: ParsedPdfDocument, profile: RuleProfile): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const sourcePatch = (issue: CheckIssue): CheckIssue =>
    parsedPdf.ocrUsed && issue.source === "pdf" ? { ...issue, source: "ocr", confidence: issue.confidence === "unknown" ? "unknown" : "low" } : issue;
  const sectionNames = parsedPdf.lines.map((line) => normalizeForCompare(line.text));
  for (const section of profile.requiredSections) {
    const names = acceptedSectionNames(section, profile);
    if (!sectionNames.some((name) => names.includes(name))) {
      issues.push(
        makeIssue(
          {
            level: section.includes("СПИСОК") ? "critical" : "error",
            confidence: "high",
            code: "PDF_REQUIRED_SECTION_MISSING",
            category: "structure",
            message: `Не найден обязательный раздел «${section}» в текстовом слое PDF.`,
            recommendation: `Проверьте наличие раздела «${section}» или загрузите DOCX для более точной структурной проверки.`
          },
          profile
        )
      );
    }
  }

  const captionsByKind = (kind: DocumentCaption["kind"]) => parsedPdf.captions.filter((caption) => caption.kind === kind);
  const referencesByKind = (kind: DocumentReference["kind"]) => parsedPdf.references.filter((reference) => reference.kind === kind);
  const objectLabels: Array<[DocumentCaption["kind"], string, CheckIssue["category"]]> = [
    ["figure", "Рисунок", "figures"],
    ["table", "Таблица", "tables"],
    ["formula", "Формула", "formulas"],
    ["listing", "Листинг", "listings"],
    ["scheme", "Схема", "figures"]
  ];

  for (const [kind, label, category] of objectLabels) {
    const captions = captionsByKind(kind);
    const references = referencesByKind(kind);
    const captionNumbers = new Set(captions.map((caption) => caption.number));
    const referenceNumbers = new Set(references.map((reference) => reference.number));

    for (const reference of references.filter((item) => !captionNumbers.has(item.number))) {
      const line = parsedPdf.lines[reference.paragraphIndex];
      issues.push(
        makeIssue(
          {
            level: "error",
            confidence: "high",
            code: `PDF_${kind.toUpperCase()}_REFERENCE_NOT_FOUND`,
            category,
            message: `В PDF есть ссылка на ${label.toLowerCase()} ${reference.number}, но соответствующая подпись не найдена.`,
            line,
            excerpt: reference.text,
            recommendation: "Проверьте номер ссылки или подпись объекта."
          },
          profile
        )
      );
    }

    for (const caption of captions.filter((item) => !referenceNumbers.has(item.number))) {
      issues.push(
        makeIssue(
          {
            level: "warning",
            confidence: "medium",
            code: `PDF_${kind.toUpperCase()}_WITHOUT_REFERENCE`,
            category,
            message: `${label} ${caption.number} не имеет найденной ссылки в тексте PDF.`,
            line: parsedPdf.lines[caption.paragraphIndex],
            excerpt: caption.text,
            recommendation: `Добавьте ссылку на ${label.toLowerCase()} ${caption.number} в тексте.`
          },
          profile
        )
      );
    }

    for (const duplicate of findDuplicateNumbers(captions.map((caption) => caption.number))) {
      const caption = captions.find((item) => item.number === duplicate);
      issues.push(
        makeIssue(
          {
            level: "error",
            confidence: "high",
            code: `PDF_${kind.toUpperCase()}_DUPLICATE_NUMBER`,
            category,
            message: `Дублируется номер ${label.toLowerCase()} ${duplicate}.`,
            line: caption ? parsedPdf.lines[caption.paragraphIndex] : undefined,
            excerpt: caption?.text,
            recommendation: "Исправьте нумерацию объектов."
          },
          profile
        )
      );
    }
  }

  const sourceNumbers = new Set(parsedPdf.bibliography.map((entry) => entry.number).filter((number): number is number => number !== undefined).map(String));
  for (const reference of parsedPdf.references.filter((item) => item.kind === "source" && sourceNumbers.size > 0 && !sourceNumbers.has(item.number))) {
    issues.push(
      makeIssue(
        {
          level: "error",
          confidence: "high",
          code: "PDF_SOURCE_REFERENCE_NOT_FOUND",
          category: "references",
          message: `В PDF есть ссылка [${reference.number}], но такого номера нет в списке источников.`,
          line: parsedPdf.lines[reference.paragraphIndex],
          excerpt: reference.text,
          recommendation: "Проверьте номер ссылки или нумерацию списка источников."
        },
        profile
      )
    );
  }

  if (parsedPdf.bibliography.length < profile.minSources) {
    issues.push(
      makeIssue(
        {
          level: parsedPdf.bibliography.length === 0 ? "critical" : "warning",
          confidence: "high",
          code: parsedPdf.bibliography.length === 0 ? "PDF_BIBLIOGRAPHY_MISSING" : "PDF_BIBLIOGRAPHY_TOO_FEW_SOURCES",
          category: "bibliography",
          message:
            parsedPdf.bibliography.length === 0
              ? "Список использованных источников не найден в PDF."
              : `В списке источников найдено ${parsedPdf.bibliography.length}, минимум по профилю: ${profile.minSources}.`,
          line: parsedPdf.bibliography[0] ? parsedPdf.lines[parsedPdf.bibliography[0].lineIndex] : undefined,
          recommendation: "Проверьте список источников или загрузите DOCX для более точного анализа структуры."
        },
        profile
      )
    );
  }

  const sourceSequence = parsedPdf.bibliography.map((entry) => entry.number).filter((number): number is number => number !== undefined).map(String);
  const missingSources = findMissingContinuousNumbers(sourceSequence);
  if (missingSources.length > 0) {
    issues.push(
      makeIssue(
        {
          level: "error",
          confidence: "high",
          code: "PDF_BIBLIOGRAPHY_NUMBERING_GAP",
          category: "bibliography",
          message: `В нумерации источников есть пропуски: ${missingSources.join(", ")}.`,
          line: parsedPdf.bibliography[0] ? parsedPdf.lines[parsedPdf.bibliography[0].lineIndex] : undefined,
          recommendation: "Проверьте последовательность списка источников."
        },
        profile
      )
    );
  }

  return issues.map(sourcePatch);
}

function buildSyntheticParsedDocument(parsedPdf: ParsedPdfDocument): ParsedDocument {
  return {
    fileName: parsedPdf.fileName,
    fileSize: parsedPdf.fileSize,
    metadata: { pages: parsedPdf.stats.detectedPages ?? undefined, words: parsedPdf.stats.words },
    paragraphs: [],
    headings: [],
    styles: { styles: {}, defaults: { runFormat: {}, paragraphFormat: {} } },
    tables: [],
    images: [],
    captions: parsedPdf.captions,
    references: parsedPdf.references,
    bibliography: parsedPdf.bibliography.map((entry) => ({ number: entry.number, text: entry.text, paragraphIndex: entry.lineIndex })),
    headerTexts: [],
    footerTexts: [],
    footnotes: [],
    endnotes: [],
    relationships: {},
    sectionLayouts: [],
    stats: parsedPdf.stats,
    plainText: parsedPdf.plainText,
    warnings: parsedPdf.warnings
  };
}

async function applyOcrIfNeeded(pdfFile: File, textPages: VisualPage[], profile: RuleProfile, warnings: string[], onProgress?: PdfOnlyOptions["onProgress"]): Promise<VisualPage[]> {
  const hasTextLayer = textPages.some((page) => (page.text ?? "").trim().length > 20);
  if (hasTextLayer) return textPages;
  if (profile.ocrMode === "disabled") {
    warnings.push("PDF не содержит текстового слоя. OCR отключен в настройках, поэтому часть PDF-only проверок недоступна.");
    return textPages;
  }

  const pdf = await loadPdf(pdfFile);
  const limit = Math.min(pdf.numPages, 3);
  if (pdf.numPages > limit) {
    warnings.push(`PDF не содержит текстового слоя. OCR выполнен только для первых ${limit} страниц из ${pdf.numPages}, чтобы не завис интерфейс.`);
  }

  const pages = [...textPages];
  for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
    onProgress?.({ message: `Распознавание страницы ${pageNumber} из ${limit}`, stage: 7 });
    try {
      const image = await renderPdfPageToImage(pdf, pageNumber, 1.5);
      const ocr = await recognizeImageText(image.canvasUrl ?? "", profile.ocrMode);
      pages[pageNumber - 1] = {
        ...pages[pageNumber - 1],
        pageNumber,
        text: normalizeSpaces(ocr?.text ?? "")
      };
    } catch (error) {
      warnings.push(error instanceof Error ? `OCR страницы ${pageNumber} не выполнен: ${error.message}` : `OCR страницы ${pageNumber} не выполнен.`);
    }
  }
  return pages;
}

export async function runPdfOnlyCheck(options: PdfOnlyOptions): Promise<PdfOnlyResult> {
  options.onProgress?.({ message: "Чтение PDF", stage: 0 });
  const pdf = await loadPdf(options.pdfFile);
  options.onProgress?.({ message: "Извлечение текстового слоя PDF", stage: 1 });
  const warnings: string[] = [];
  const textPagesRaw = await extractPdfTextPages(pdf);
  const textPages = await applyOcrIfNeeded(options.pdfFile, textPagesRaw, options.profile, warnings, options.onProgress);
  const imagePages = await renderFirstPdfPages(pdf, 4);
  const imageMap = new Map(imagePages.map((page) => [page.pageNumber, page]));
  const visualPages = textPages.map((page) => ({ ...page, ...imageMap.get(page.pageNumber) }));
  const visualLayer: VisualLayerResult = {
    mode: "uploadedPdf",
    status: "ready",
    label: "Используется загруженный PDF",
    message: "PDF используется как источник проверки, страниц и визуальной привязки.",
    pageCount: pdf.numPages,
    pages: visualPages,
    warnings
  };

  options.onProgress?.({ message: "Анализ структуры PDF", stage: 3 });
  const lines = buildLines(textPages);
  const plainText = lines.map((line) => line.text).join("\n");
  const captions = findCaptions(lines, options.profile);
  const references = findReferences(lines, options.profile);
  const bibliography = findBibliography(lines, options.profile);
  const parsedPdf: ParsedPdfDocument = {
    fileName: options.pdfFile.name,
    fileSize: options.pdfFile.size,
    pages: textPages.map((page) => ({ pageNumber: page.pageNumber, text: page.text ?? "" })),
    lines,
    plainText,
    captions,
    references,
    bibliography,
    warnings,
    ocrUsed: !textPagesRaw.some((page) => (page.text ?? "").trim().length > 20) && textPages.some((page) => (page.text ?? "").trim().length > 20),
    stats: {
      words: countWords(plainText),
      paragraphs: lines.length,
      sections: lines.filter((line) => line.sectionTitle === line.text).length,
      estimatedPages: pdf.numPages,
      detectedPages: pdf.numPages,
      figures: captions.filter((caption) => caption.kind === "figure").length,
      tables: captions.filter((caption) => caption.kind === "table").length,
      formulas: captions.filter((caption) => caption.kind === "formula").length,
      listings: captions.filter((caption) => caption.kind === "listing").length,
      schemes: captions.filter((caption) => caption.kind === "scheme").length,
      sources: bibliography.length,
      sourceReferences: references.filter((reference) => reference.kind === "source").length,
      figureReferences: references.filter((reference) => reference.kind === "figure").length,
      tableReferences: references.filter((reference) => reference.kind === "table").length,
      formulaReferences: references.filter((reference) => reference.kind === "formula").length,
      listingReferences: references.filter((reference) => reference.kind === "listing").length
    }
  };

  options.onProgress?.({ message: "Проверка ссылок и источников PDF", stage: 6 });
  const issues = runPdfTextChecks(parsedPdf, options.profile);
  if (!plainText.trim()) {
    issues.push(
      makeIssue(
        {
          level: "info",
          confidence: "unknown",
          code: "PDF_TEXT_LAYER_UNAVAILABLE",
          category: "ocr",
          message: "В PDF не найден текстовый слой.",
          recommendation: options.profile.ocrMode === "disabled" ? "Включите OCR в настройках или загрузите DOCX." : "Проверьте качество PDF или загрузите DOCX.",
          source: options.profile.ocrMode === "disabled" ? "system" : "ocr"
        },
        options.profile
      )
    );
  }

  const uniqueIssues = deduplicateIssues(issues);
  const checkExecutions = [
    { code: "PDF_TEXT_EXTRACTION", title: "Извлечение текста PDF", category: "visual" as const, status: plainText ? ("passed" as const) : ("partial" as const), issueCount: plainText ? 0 : 1 },
    {
      code: "PDF_STRUCTURE",
      title: "Структура по тексту PDF",
      category: "structure" as const,
      status: uniqueIssues.some((issue) => issue.category === "structure") ? ("failed" as const) : ("passed" as const),
      issueCount: uniqueIssues.filter((issue) => issue.category === "structure").length
    },
    {
      code: "PDF_REFERENCES",
      title: "Подписи и ссылки PDF",
      category: "references" as const,
      status: uniqueIssues.some((issue) => issue.category === "references" || issue.category === "figures" || issue.category === "tables" || issue.category === "formulas" || issue.category === "listings" || issue.category === "bibliography") ? ("failed" as const) : ("passed" as const),
      issueCount: uniqueIssues.filter((issue) => issue.category === "references" || issue.category === "figures" || issue.category === "tables" || issue.category === "formulas" || issue.category === "listings" || issue.category === "bibliography").length
    },
    ...notAvailableChecks.map((check) => ({
      code: check.code,
      title: check.title,
      category: "formatting" as const,
      status: "notAvailable" as const,
      issueCount: 0,
      message: check.reason
    }))
  ];
  const checks = {
    total: checkExecutions.length,
    passed: checkExecutions.filter((check) => check.status === "passed").length,
    failed: checkExecutions.filter((check) => check.status === "failed").length,
    partial: checkExecutions.filter((check) => check.status === "partial").length,
    notAvailable: checkExecutions.filter((check) => check.status === "notAvailable").length
  };

  options.onProgress?.({ message: "Формирование PDF-only отчета", stage: 9 });
  const report: CheckReport = {
    id: createId("report"),
    fileName: options.pdfFile.name,
    optionalPdfFileName: null,
    inputMode: "pdfOnly",
    profileName: options.profile.name,
    generatedAt: new Date().toISOString(),
    visualLayerMode: "uploadedPdf",
    score: calculateIssueScore(uniqueIssues),
    scoreExplanation: "Процент соответствия является ориентировочным и не заменяет ручную проверку.",
    stats: reportStats(parsedPdf, uniqueIssues),
    checks,
    checkExecutions,
    notAvailableChecks,
    issues: uniqueIssues,
    documentWarnings: [PDF_ONLY_LIMITATION, ...warnings],
    privacyNote: "Документы и результаты проверки обрабатываются локально в браузере и никуда не отправляются."
  };

  return {
    report,
    document: buildSyntheticParsedDocument(parsedPdf),
    visualLayer,
    parsedPdf
  };
}
