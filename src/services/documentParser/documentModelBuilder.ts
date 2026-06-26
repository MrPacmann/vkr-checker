import type {
  BibliographyEntry,
  DocumentCaption,
  DocumentImage,
  DocumentObject,
  DocumentParagraph,
  HeadingNumberingDiagnostics,
  ParagraphRole,
  ParsedHeading,
  DocumentReference,
  DocumentRun,
  SourceReferenceCandidate,
  DocumentTable,
  ParsedDocument,
  SectionLayout
} from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import type { StylesModel } from "../../types/styles";
import type { NumberingModel } from "./numberingParser";
import { regexPresets } from "../../config/regexPresets";
import { createId } from "../../utils/id";
import { estimatePageFromParagraph, estimatePagesByText } from "../../utils/pageEstimator";
import { collectMatches, parseCaption, safeRegExp } from "../../utils/regex";
import { classifySourceReference } from "../../utils/sourceReferences";
import { countWords, normalizeObjectNumber, normalizeSectionTitle, normalizeSpaces } from "../../utils/text";
import { childrenDeep, directChild, directChildren, getAttr, getTextFromXmlNode, localName, twipsToMm, type XmlNode } from "../../utils/xml";
import { resolveParagraphFormat, resolveRunFormat, parseParagraphFormat, parseRunFormat, resolveStyleInheritance, resolveStyleNumbering } from "./stylesParser";

export interface DocumentBuildInput {
  fileName: string;
  fileSize: number;
  documentXml: XmlNode;
  styles: StylesModel;
  relationships: Record<string, string>;
  numbering?: NumberingModel;
  metadata: ParsedDocument["metadata"];
  headerTexts: string[];
  footerTexts: string[];
  footnotes: string[];
  endnotes: string[];
  warnings: string[];
}

function readDirectParagraphNumbering(pPr: XmlNode | null): { numId?: string; level?: number; ilvl?: string } | undefined {
  const numPr = pPr ? directChild(pPr, "numPr") : null;
  if (!numPr) return undefined;
  const ilvl = getAttr(directChild(numPr, "ilvl"), "val");
  return {
    numId: getAttr(directChild(numPr, "numId"), "val"),
    ilvl,
    level: ilvl ? Number(ilvl) : undefined
  };
}

function formatNumber(value: number, format?: string): string {
  if (format === "upperLetter") return String.fromCharCode(1040 + Math.max(0, value - 1));
  if (format === "lowerLetter") return String.fromCharCode(1072 + Math.max(0, value - 1));
  return String(value);
}

interface NumberingCounterState {
  levels: Record<number, number>;
}

type NumberingCounters = Record<string, NumberingCounterState>;

function renderNumberingText(
  lvlText: string | undefined,
  levels: Record<number, number>,
  numberingModel: NumberingModel | undefined,
  abstractNumId: string | undefined
): string | undefined {
  if (!lvlText) return undefined;
  return normalizeSpaces(
    lvlText.replace(/%(\d+)/gu, (_, rawLevel: string) => {
      const levelIndex = Number(rawLevel) - 1;
      const definition = abstractNumId ? numberingModel?.levels[abstractNumId]?.[String(levelIndex)] : undefined;
      const value = levels[levelIndex] ?? definition?.start ?? 0;
      return formatNumber(value, definition?.numFmt);
    })
  );
}

function resolveParagraphNumbering(
  pPr: XmlNode | null,
  styleId: string | undefined,
  numberingModel: NumberingModel | undefined,
  styles: StylesModel,
  counters: NumberingCounters
): DocumentParagraph["numbering"] | undefined {
  const direct = readDirectParagraphNumbering(pPr);
  const styleNumbering = resolveStyleNumbering(styleId, styles);
  const numId = direct?.numId ?? styleNumbering?.numId;
  if (!numId) return direct;
  const ilvl = String(direct?.ilvl ?? direct?.level ?? styleNumbering?.level ?? 0);
  const abstractNumId = numberingModel?.nums[numId];
  const level = abstractNumId ? numberingModel?.levels[abstractNumId]?.[ilvl] : undefined;
  const ilvlNumber = Number(ilvl);
  const counterKey = numId;
  const start = level?.start ?? 1;
  const state = (counters[counterKey] ??= { levels: {} });
  const next = (state.levels[ilvlNumber] ?? start - 1) + 1;
  state.levels[ilvlNumber] = next;
  for (const rawLevel of Object.keys(state.levels)) {
    const levelNumber = Number(rawLevel);
    if (levelNumber > ilvlNumber) state.levels[levelNumber] = 0;
  }
  const currentNumber = formatNumber(next, level?.numFmt);
  const renderedPrefix = renderNumberingText(level?.lvlText, state.levels, numberingModel, abstractNumId);
  return {
    numId,
    ilvl,
    level: ilvlNumber,
    abstractNumId,
    numFmt: level?.numFmt,
    lvlText: level?.lvlText,
    start,
    currentNumber,
    renderedPrefix
  };
}

function readSectionLayout(sectPr: XmlNode | null): SectionLayout | undefined {
  if (!sectPr) return undefined;
  const pgSz = directChild(sectPr, "pgSz");
  const pgMar = directChild(sectPr, "pgMar");
  const widthMm = twipsToMm(getAttr(pgSz, "w"));
  const heightMm = twipsToMm(getAttr(pgSz, "h"));
  const orientationAttr = getAttr(pgSz, "orient");
  const orientation = orientationAttr === "landscape" ? "landscape" : widthMm && heightMm && widthMm > heightMm ? "landscape" : "portrait";
  const isA4 = widthMm && heightMm && Math.abs(Math.min(widthMm, heightMm) - 210) <= 3 && Math.abs(Math.max(widthMm, heightMm) - 297) <= 3;
  return {
    pageWidthMm: widthMm,
    pageHeightMm: heightMm,
    pageSize: isA4 ? "A4" : widthMm || heightMm ? "custom" : "unknown",
    orientation,
    margins: {
      topMm: twipsToMm(getAttr(pgMar, "top")),
      rightMm: twipsToMm(getAttr(pgMar, "right")),
      bottomMm: twipsToMm(getAttr(pgMar, "bottom")),
      leftMm: twipsToMm(getAttr(pgMar, "left"))
    }
  };
}

function runText(run: XmlNode): string {
  let result = "";
  for (const child of run.children) {
    const name = localName(child);
    if (name === "t") result += getTextFromXmlNode(child);
    if (name === "tab") result += "\t";
    if (name === "br") result += "\n";
    if (name === "drawing" || name === "object") result += "";
  }
  return result;
}

function parseRuns(paragraph: XmlNode, inheritedStyleId: string | undefined, styles: StylesModel): DocumentRun[] {
  return childrenDeep(paragraph, "r")
    .map((run) => {
      const rPr = directChild(run, "rPr");
      const styleId = getAttr(directChild(rPr ?? run, "rStyle"), "val");
      const directFormat = parseRunFormat(rPr);
      return {
        text: runText(run),
        styleId,
        format: resolveRunFormat(styleId ?? inheritedStyleId, styles, directFormat)
      };
    })
    .filter((run) => run.text.length > 0);
}

function hasManualPageBreak(paragraph: XmlNode): boolean {
  return childrenDeep(paragraph, "br").some((element) => getAttr(element, "type") === "page") || childrenDeep(paragraph, "lastRenderedPageBreak").length > 0;
}

function hasLeadingHeadingNumber(text: string): boolean {
  return /^\s*\d+(?:\.\d+)*\s+/u.test(text);
}

function extractLeadingHeadingNumber(text: string): string | undefined {
  return /^\s*(\d+(?:\.\d+)*)\s+/u.exec(text)?.[1];
}

function extractLeadingNumberFromPrefix(prefix: string | undefined): string | undefined {
  if (!prefix) return undefined;
  return /(\d+(?:\.\d+)*)/u.exec(prefix)?.[1];
}

function cleanHeadingTitle(text: string): string {
  return normalizeSpaces(text.replace(/^\s*\d+(?:\.\d+)*\.?\s+/u, ""));
}

function clampHeadingLevel(level: number | undefined): 1 | 2 | 3 {
  if (level === 2) return 2;
  if (level && level >= 3) return 3;
  return 1;
}

function buildParsedHeading(text: string, renderedText: string, headingLevel: number | undefined, numbering: DocumentParagraph["numbering"] | undefined): ParsedHeading {
  const explicitNumber = extractLeadingHeadingNumber(text);
  const reconstructedNumber = extractLeadingNumberFromPrefix(numbering?.renderedPrefix);
  const finalNumber = explicitNumber ?? reconstructedNumber;
  return {
    rawText: text,
    visibleText: renderedText,
    cleanTitle: cleanHeadingTitle(renderedText),
    explicitNumber,
    reconstructedNumber,
    finalNumber,
    level: clampHeadingLevel(headingLevel ?? (finalNumber ? finalNumber.split(".").length : undefined)),
    numberingSource: explicitNumber ? "text" : reconstructedNumber ? "word-numbering" : "none"
  };
}

function parseParagraph(
  paragraph: XmlNode,
  index: number,
  styles: StylesModel,
  numberingModel: NumberingModel | undefined,
  numberingCounters: NumberingCounters,
  knownSectionNames: string[],
  inheritedSection?: string,
  inTable = false
): DocumentParagraph {
  const pPr = directChild(paragraph, "pPr");
  const styleId = getAttr(directChild(pPr ?? paragraph, "pStyle"), "val");
  const style = styleId ? styles.styles[styleId] : undefined;
  const styleName = style?.name;
  const text = normalizeSpaces(getTextFromXmlNode(paragraph));
  const numbering = resolveParagraphNumbering(pPr, styleId, numberingModel, styles, numberingCounters);
  const numberingPrefix = numbering?.renderedPrefix;
  const renderedText = numberingPrefix && !hasLeadingHeadingNumber(text) && !normalizeSectionTitle(text).startsWith(normalizeSectionTitle(numberingPrefix))
    ? normalizeSpaces(`${numberingPrefix} ${text}`)
    : text;
  const directParagraphFormat = parseParagraphFormat(pPr);
  const runs = parseRuns(paragraph, styleId, styles);
  const directRunFormat = Object.assign({}, ...runs.map((run) => run.format));
  const paragraphFormat = resolveParagraphFormat(styleId, styles, directParagraphFormat);
  const sectionCandidate = normalizeSectionTitle(renderedText);
  const looksLikeTocLine =
    /\.{2,}|…/u.test(renderedText) ||
    /^\s*\d+(?:\.\d+)*\s+.+\s+\d+\s*$/u.test(renderedText) ||
    (knownSectionNames.some((section) => normalizeSectionTitle(section) === sectionCandidate) && /^[\p{L}\s.-]+\s+\d+\s*$/u.test(renderedText));
  const looksLikeMandatorySection = !looksLikeTocLine && knownSectionNames.some((section) => normalizeSectionTitle(section) === sectionCandidate);
  const resolvedStyle = resolveStyleInheritance(styleId, styles);
  const styleLooksHeading = Boolean(resolvedStyle.isHeading || style?.isHeading || /heading|заголовок|title|название/iu.test(styleName ?? ""));
  const caption = parseCaption(renderedText);
  const numberedHeading = !numbering?.numId && !caption && !looksLikeTocLine && /^\d+(?:\.\d+){0,2}\s+\S+/u.test(renderedText) && renderedText.length < 140;
  const uppercaseStandalone = !looksLikeTocLine && renderedText.length < 120 && /^[А-ЯЁA-Z0-9 .-]+$/u.test(renderedText) && /[А-ЯЁA-Z]/u.test(renderedText);
  const hasDrawing = childrenDeep(paragraph, "drawing").length > 0 || childrenDeep(paragraph, "object").length > 0;
  const hasFormula = childrenDeep(paragraph, "oMath").length > 0 || childrenDeep(paragraph, "oMathPara").length > 0;
  const isHeading = Boolean(renderedText && !inTable && (styleLooksHeading || looksLikeMandatorySection || numberedHeading || uppercaseStandalone));
  const headingConfidence = !isHeading ? "none" : styleLooksHeading || looksLikeMandatorySection ? "high" : numberedHeading ? "medium" : "low";
  const headingLevel = resolvedStyle.headingLevel ?? style?.headingLevel ?? (numberedHeading ? renderedText.split(" ")[0].split(".").length : looksLikeMandatorySection ? 1 : undefined);
  const parsedHeading = isHeading ? buildParsedHeading(text, renderedText, headingLevel, numbering) : undefined;
  const sectPr = directChild(pPr ?? paragraph, "sectPr");
  const isListItem = Boolean(numbering?.numId || numberingPrefix);
  const listNumberText = numbering?.renderedPrefix ?? numbering?.currentNumber ?? numberingPrefix;

  return {
    index,
    text,
    numberingPrefix,
    renderedText,
    styleId,
    styleName,
    resolvedStyle,
    isHeading,
    isListItem,
    listNumberText,
    isTocParagraph: false,
    isBibliographyEntry: false,
    isBibliographyHeading: false,
    headingConfidence,
    headingLevel,
    parsedHeading,
    numbering,
    runs,
    format: paragraphFormat,
    inheritedRunFormat: resolveRunFormat(styleId, styles, directRunFormat),
    sectionTitle: inheritedSection,
    inTable,
    hasPageBreakBefore: Boolean(paragraphFormat.pageBreakBefore),
    hasManualPageBreak: hasManualPageBreak(paragraph),
    hasDrawing,
    hasPicture: hasDrawing || childrenDeep(paragraph, "blip").length > 0,
    hasFormula,
    hasSectionBreak: Boolean(sectPr),
    sectionLayout: readSectionLayout(sectPr)
  };
}

function parseTable(table: XmlNode, tableIndex: number, state: BuildState, knownSectionNames: string[]): DocumentTable {
  const firstParagraphIndex = state.paragraphs.length;
  const rows = directChildren(table, "tr").map((row) =>
    directChildren(row, "tc").map((cell) => {
      const paragraphIndexes: number[] = [];
      for (const p of directChildren(cell, "p")) {
        const paragraph = parseParagraph(p, state.paragraphs.length, state.styles, state.numberingModel, state.numberingCounters, knownSectionNames, state.currentSection, true);
        if (paragraph.isHeading) state.currentSection = paragraph.renderedText;
        state.paragraphs.push({ ...paragraph, sectionTitle: state.currentSection });
        paragraphIndexes.push(paragraph.index);
      }
      return {
        text: normalizeSpaces(getTextFromXmlNode(cell)),
        paragraphs: paragraphIndexes
      };
    })
  );
  const endParagraphIndex = Math.max(firstParagraphIndex, state.paragraphs.length - 1);
  return {
    index: tableIndex,
    paragraphIndex: firstParagraphIndex,
    endParagraphIndex,
    rows,
    text: normalizeSpaces(getTextFromXmlNode(table))
  };
}

function extractImages(document: XmlNode, paragraphs: DocumentParagraph[], relationships: Record<string, string>): DocumentImage[] {
  const images: DocumentImage[] = [];
  const paragraphElements = childrenDeep(document, "p");
  paragraphElements.forEach((paragraph, paragraphPosition) => {
    const paragraphIndex = paragraphs[Math.min(paragraphPosition, paragraphs.length - 1)]?.index ?? paragraphPosition;
    for (const blip of childrenDeep(paragraph, "blip")) {
      const relationshipId = getAttr(blip, "embed") ?? getAttr(blip, "link");
      images.push({
        id: createId("image"),
        relationshipId,
        target: relationshipId ? relationships[relationshipId] : undefined,
        paragraphIndex
      });
    }
  });
  return images;
}

function findCaptions(paragraphs: DocumentParagraph[], profile?: RuleProfile): DocumentCaption[] {
  const captions: DocumentCaption[] = [];
  for (const paragraph of paragraphs) {
    const caption = parseCaption(paragraph.renderedText);
    if (caption && !caption.continuation) {
      captions.push({
        id: createId(`${caption.kind}-caption`),
        kind: caption.kind,
        number: caption.number,
        title: caption.title || (paragraph.numberingPrefix ? paragraph.text : ""),
        paragraphIndex: paragraph.index,
        text: caption.rawText,
        validFormat: true,
        source: paragraph.numberingPrefix ? "word-numbering" : "plain-text",
        numbering: paragraph.numbering
      });
      continue;
    }
    if (paragraph.hasFormula) {
      const formulaNumber = /\(([А-ЯA-Z]?\d+(?:\.\d+)*)\)/u.exec(paragraph.renderedText);
      if (formulaNumber) {
        captions.push({
          id: createId("formula-caption"),
          kind: "formula",
          number: normalizeObjectNumber(formulaNumber[1]),
          title: "",
          paragraphIndex: paragraph.index,
          text: paragraph.renderedText,
          validFormat: true,
          source: "office-math",
          numbering: paragraph.numbering
        });
      }
    }
  }
  return captions;
}

function findObjects(paragraphs: DocumentParagraph[]): DocumentObject[] {
  const objects: DocumentObject[] = [];
  for (const paragraph of paragraphs) {
    const caption = parseCaption(paragraph.renderedText);
    if (caption) {
      objects.push({
        id: createId(`${caption.kind}-object`),
        type: caption.kind,
        number: caption.number,
        title: caption.title || (paragraph.numberingPrefix ? paragraph.text : ""),
        paragraphIndex: paragraph.index,
        section: paragraph.sectionTitle,
        rawText: caption.rawText,
        continuation: caption.continuation,
        source: paragraph.numberingPrefix ? "word-numbering" : "plain-text",
        numbering: paragraph.numbering
      });
      continue;
    }
    if (paragraph.hasFormula) {
      const formulaNumber = /\(([А-ЯA-Z]?\d+(?:\.\d+)*)\)/u.exec(paragraph.renderedText);
      if (formulaNumber) {
        objects.push({
          id: createId("formula-object"),
          type: "formula",
          number: normalizeObjectNumber(formulaNumber[1]),
          title: "",
          paragraphIndex: paragraph.index,
          section: paragraph.sectionTitle,
          rawText: paragraph.renderedText,
          source: "office-math",
          numbering: paragraph.numbering
        });
      }
    }
  }
  return objects;
}

interface ReferenceDetectionResult {
  references: DocumentReference[];
  sourceReferenceCandidates: SourceReferenceCandidate[];
}

function sourceReferenceContext(text: string, index: number, rawLength: number): { before: string; after: string } {
  return {
    before: normalizeSpaces(text.slice(Math.max(0, index - 48), index)),
    after: normalizeSpaces(text.slice(index + rawLength, index + rawLength + 48))
  };
}

function findReferences(paragraphs: DocumentParagraph[], bibliographyCount: number, profile?: RuleProfile): ReferenceDetectionResult {
  const patterns = profile?.referencePatterns ?? regexPresets.referencePatterns;
  const entries = Object.entries(patterns) as Array<[DocumentReference["kind"], string]>;
  const references: DocumentReference[] = [];
  const sourceReferenceCandidates: SourceReferenceCandidate[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.isTocParagraph || paragraph.isBibliographyEntry || paragraph.isBibliographyHeading) continue;
    const paragraphCaption = parseCaption(paragraph.renderedText);
    for (const [kind, pattern] of entries) {
      if (paragraphCaption && paragraphCaption.kind === kind) continue;
      if (kind === "source") {
        for (const match of paragraph.renderedText.matchAll(/\[[^\]\n]{1,80}\]/gu)) {
          const raw = normalizeSpaces(match[0]);
          const context = sourceReferenceContext(paragraph.renderedText, match.index ?? 0, match[0].length);
          const decision = classifySourceReference(raw, bibliographyCount, context.before, context.after);
          sourceReferenceCandidates.push({
            raw,
            paragraphIndex: paragraph.index,
            contextBefore: context.before,
            contextAfter: context.after,
            decision: decision.decision,
            reason: decision.reason,
            sourceNumbers: decision.parsed?.sourceNumbers,
            pageRange: decision.parsed?.pageRange,
            confidence: decision.parsed?.confidence
          });
          for (const number of decision.parsed?.sourceNumbers ?? []) {
            references.push({
              id: createId("ref"),
              kind,
              number: String(number),
              paragraphIndex: paragraph.index,
              text: raw
            });
          }
        }
        continue;
      }
      const flags = kind === "appendix" ? "gu" : "giu";
      const fallbackPattern = regexPresets.referencePatterns[kind as keyof typeof regexPresets.referencePatterns] ?? pattern;
      const activePattern = safeRegExp(pattern, flags) ? pattern : fallbackPattern;
      for (const match of collectMatches(activePattern, paragraph.renderedText, flags)) {
        if (match[1]) {
          if (kind === "appendix") {
            const previous = match.index && match.index > 0 ? paragraph.renderedText[match.index - 1] : "";
            if (/[-A-Za-zА-Яа-яЁё]/u.test(previous)) continue;
          }
          references.push({
            id: createId("ref"),
            kind,
            number: normalizeObjectNumber(match[1]),
            paragraphIndex: paragraph.index,
            text: normalizeSpaces(match[0])
          });
        }
      }
    }
  }
  return { references, sourceReferenceCandidates };
}

function bibliographyHeadingNames(profile?: RuleProfile): string[] {
  const defaults = [
    "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ",
    "СПИСОК ИСТОЧНИКОВ",
    "СПИСОК ЛИТЕРАТУРЫ",
    "БИБЛИОГРАФИЧЕСКИЙ СПИСОК",
    "БИБЛИОГРАФИЧЕСКИЙ СПИСОК ИСТОЧНИКОВ"
  ];
  const profileNames = [
    ...(profile?.requiredSections ?? []),
    ...Object.values(profile?.alternativeSectionNames ?? {}).flat(),
    ...(profile?.alternativeSectionNames["СПИСОК ИСТОЧНИКОВ"] ?? []),
    ...(profile?.alternativeSectionNames["СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ"] ?? [])
  ].filter((name) => /СПИСОК|ИСТОЧНИК|ЛИТЕРАТУР|БИБЛИОГРАФ/iu.test(name));
  return Array.from(new Set([...defaults, ...profileNames].map(normalizeSectionTitle)));
}

function repeatedTitleMatches(normalized: string, name: string): boolean {
  if (normalized === name) return true;
  const repeated = `${name} ${name}`;
  return normalized === repeated || normalized.startsWith(`${repeated} `);
}

function matchesBibliographyTitle(normalized: string, names: string[]): boolean {
  return names.some((name) => repeatedTitleMatches(normalized, name));
}

function isBibliographySubheading(text: string): boolean {
  return /^(Учебная и научная литература|Научные статьи|Официальная техническая документация|Источники данных|Электронные ресурсы|Интернет-ресурсы|Нормативные правовые акты|Нормативные документы)$/iu.test(
    normalizeSpaces(text)
  );
}

function bibliographyEntryNumber(paragraph: DocumentParagraph): { number?: number; text: string; listNumberText?: string } | null {
  const renderedText = normalizeSpaces(paragraph.renderedText || paragraph.text);
  const explicit = /^\s*(\d+)[.)]\s+(.+)/u.exec(renderedText) ?? /^\s*\[(\d+)\]\s+(.+)/u.exec(renderedText);
  if (explicit) return { number: Number(explicit[1]), text: normalizeSpaces(explicit[2]), listNumberText: explicit[1] };
  const loose = /^\s*(\d+)\s+(.+)/u.exec(renderedText);
  if (loose && !/^\d+(?:\.\d+)+\s+/u.test(renderedText)) return { number: Number(loose[1]), text: normalizeSpaces(loose[2]), listNumberText: loose[1] };
  const prefixNumber = paragraph.listNumberText ? /(\d+)/u.exec(paragraph.listNumberText)?.[1] : undefined;
  if (prefixNumber) return { number: Number(prefixNumber), text: normalizeSpaces(paragraph.text), listNumberText: paragraph.listNumberText };
  const currentNumber = paragraph.numbering?.currentNumber && /^\d+$/u.test(paragraph.numbering.currentNumber) ? Number(paragraph.numbering.currentNumber) : undefined;
  if (currentNumber !== undefined) return { number: currentNumber, text: normalizeSpaces(paragraph.text), listNumberText: paragraph.listNumberText };
  return null;
}

function looksBibliographic(text: string): boolean {
  return text.length > 25 && /(https?:\/\/|www\.|URL|doi|20\d{2}|19\d{2}|М\.|СПб\.|Москва|Санкт-Петербург|изд|ISBN|Электронный ресурс|дата обращения)/iu.test(text);
}

function markAsNonHeading(paragraph: DocumentParagraph): void {
  paragraph.isHeading = false;
  paragraph.headingLevel = undefined;
  paragraph.parsedHeading = undefined;
  paragraph.headingConfidence = "none";
}

function findBibliography(paragraphs: DocumentParagraph[], profile?: RuleProfile): BibliographyEntry[] {
  const names = bibliographyHeadingNames(profile);
  for (const paragraph of paragraphs) {
    paragraph.isBibliographyEntry = false;
    paragraph.isBibliographyHeading = false;
  }

  const start = paragraphs.findIndex((paragraph) => !paragraph.isTocParagraph && matchesBibliographyTitle(normalizeSectionTitle(paragraph.renderedText || paragraph.text), names));
  if (start < 0) return [];

  let entryStart = start + 1;
  let bibliographyHeadingCount = 0;
  for (let index = start; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const normalized = normalizeSectionTitle(paragraph.renderedText || paragraph.text);
    if (!matchesBibliographyTitle(normalized, names) || paragraph.isTocParagraph) break;
    paragraph.isBibliographyHeading = true;
    if (bibliographyHeadingCount > 0) markAsNonHeading(paragraph);
    bibliographyHeadingCount += 1;
    entryStart = index + 1;
  }

  const entries: BibliographyEntry[] = [];
  for (const paragraph of paragraphs.slice(entryStart)) {
    const candidateText = normalizeSpaces(paragraph.renderedText || paragraph.text);
    if (!candidateText) continue;
    if (paragraph.isTocParagraph) continue;
    if (matchesBibliographyTitle(normalizeSectionTitle(candidateText), names)) {
      paragraph.isBibliographyHeading = true;
      markAsNonHeading(paragraph);
      continue;
    }
    if (isBibliographySubheading(candidateText)) continue;
    if (/^ПРИЛОЖЕНИ[ЕЯ](?:\s+[А-ЯA-Z0-9])?/iu.test(candidateText)) break;

    const numbered = bibliographyEntryNumber(paragraph);
    const listStyleEntry = /нумерован|number|список|list/iu.test(paragraph.styleName ?? "") && looksBibliographic(candidateText);
    const entryLike = Boolean(numbered || paragraph.numbering?.numId || listStyleEntry || (entries.length > 0 && looksBibliographic(candidateText)));

    if (!entryLike) {
      if (entries.length > 0) break;
      if (paragraph.isHeading && paragraph.headingConfidence === "high") break;
      continue;
    }

    paragraph.isBibliographyEntry = true;
    markAsNonHeading(paragraph);
    entries.push({
      number: numbered?.number ?? (paragraph.numbering?.numId ? entries.length + 1 : undefined),
      text: numbered?.text ?? normalizeSpaces(paragraph.text || paragraph.renderedText),
      paragraphIndex: paragraph.index,
      listNumberText: numbered?.listNumberText ?? paragraph.listNumberText
    });
  }

  return entries;
}

function tocHeadingText(normalized: string): boolean {
  return normalized === "СОДЕРЖАНИЕ" || normalized === "ОГЛАВЛЕНИЕ";
}

function allKnownSectionNames(profile?: RuleProfile): string[] {
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
        ...(profile?.requiredSections ?? []),
        ...Object.values(profile?.alternativeSectionNames ?? {}).flat()
      ].map(normalizeSectionTitle)
    )
  );
}

function isTocEntryText(text: string): boolean {
  const normalized = normalizeSpaces(text);
  if (!normalized || normalized.length > 220) return false;
  if (parseCaption(normalized)) return false;
  return /\.{2,}|…/u.test(normalized) || /^\s*\d+(?:\.\d+)*\s+.+\s+\d+\s*$/u.test(normalized) || /^[\p{L}\s().,-]+\s+\d+\s*$/u.test(normalized);
}

function markTocParagraphs(paragraphs: DocumentParagraph[], knownSectionNames: string[]): void {
  let inToc = false;
  for (const paragraph of paragraphs) {
    const text = paragraph.renderedText || paragraph.text;
    const normalized = normalizeSectionTitle(text);
    const styleLooksToc = /toc|оглавлен|содержан/iu.test(paragraph.styleName ?? "") || /toc/iu.test(paragraph.styleId ?? "");

    if (tocHeadingText(normalized)) {
      inToc = true;
      paragraph.isTocParagraph = true;
      continue;
    }

    if (inToc) {
      const entryLike = isTocEntryText(text);
      const startsKnownRealSection = knownSectionNames.includes(normalized) && !entryLike;
      if (startsKnownRealSection) {
        inToc = false;
      } else if (entryLike || styleLooksToc) {
        paragraph.isTocParagraph = true;
        markAsNonHeading(paragraph);
        continue;
      }
    }

    if (styleLooksToc || (paragraph.isTocParagraph && !tocHeadingText(normalized))) {
      paragraph.isTocParagraph = true;
      markAsNonHeading(paragraph);
    }
  }
}

function isRealSectionHeading(paragraph: DocumentParagraph): boolean {
  const normalized = normalizeSectionTitle(paragraph.renderedText || paragraph.text);
  if (!paragraph.isHeading || paragraph.isBibliographyEntry) return false;
  if (paragraph.isTocParagraph && !tocHeadingText(normalized)) return false;
  return paragraph.headingConfidence !== "none";
}

function recomputeSectionTitles(paragraphs: DocumentParagraph[]): void {
  let currentSection: string | undefined;
  for (const paragraph of paragraphs) {
    if (isRealSectionHeading(paragraph)) currentSection = paragraph.renderedText || paragraph.text;
    paragraph.sectionTitle = currentSection;
  }
}

function documentObjectToCaption(object: DocumentObject): DocumentCaption {
  return {
    id: object.id,
    kind: object.type,
    number: object.number,
    title: object.title,
    paragraphIndex: object.paragraphIndex,
    text: object.rawText,
    validFormat: true,
    source: object.source,
    numbering: object.numbering
  };
}

function attachTableCaptions(tables: DocumentTable[], captions: DocumentCaption[], objects: DocumentObject[]): DocumentTable[] {
  const tableCaptions = captions
    .filter((caption) => caption.kind === "table")
    .sort((left, right) => left.paragraphIndex - right.paragraphIndex);
  const continuationCaptions = objects
    .filter((object) => object.type === "table" && object.continuation)
    .sort((left, right) => left.paragraphIndex - right.paragraphIndex);
  const usedCaptionIds = new Set<string>();
  const result = tables.map((table) => ({ ...table }));

  result.forEach((table, index) => {
    const end = table.endParagraphIndex ?? table.paragraphIndex;
    const previousEnd = index > 0 ? result[index - 1].endParagraphIndex ?? result[index - 1].paragraphIndex : -1;
    const nextStart = result[index + 1]?.paragraphIndex ?? Number.POSITIVE_INFINITY;
    const nearest = tableCaptions
      .filter((caption) => !usedCaptionIds.has(caption.id))
      .filter((caption) => caption.paragraphIndex > previousEnd && caption.paragraphIndex < nextStart)
      .filter((caption) => caption.paragraphIndex >= table.paragraphIndex - 3 && caption.paragraphIndex <= end + 2)
      .sort((left, right) => Math.abs(left.paragraphIndex - table.paragraphIndex) - Math.abs(right.paragraphIndex - table.paragraphIndex))[0];
    if (nearest) {
      table.caption = nearest;
      usedCaptionIds.add(nearest.id);
      return;
    }
    const continuation = continuationCaptions
      .filter((caption) => caption.paragraphIndex > previousEnd && caption.paragraphIndex < nextStart)
      .filter((caption) => caption.paragraphIndex >= table.paragraphIndex - 3 && caption.paragraphIndex <= end + 2)
      .sort((left, right) => Math.abs(left.paragraphIndex - table.paragraphIndex) - Math.abs(right.paragraphIndex - table.paragraphIndex))[0];
    if (continuation) {
      table.caption = captions.find((caption) => caption.kind === "table" && caption.number === continuation.number) ?? documentObjectToCaption(continuation);
    }
  });

  return result;
}

function roleForCaptionKind(kind: DocumentCaption["kind"]): ParagraphRole {
  if (kind === "figure" || kind === "scheme") return "figureCaption";
  if (kind === "table") return "tableCaption";
  if (kind === "listing") return "listingCaption";
  return "formula";
}

function looksLikeTocParagraph(paragraph: DocumentParagraph): boolean {
  return /\.{2,}|…|\s+\d+\s*$/u.test(paragraph.renderedText) && paragraph.renderedText.length < 180;
}

function applyParagraphRoles(
  paragraphs: DocumentParagraph[],
  captions: DocumentCaption[],
  bibliography: BibliographyEntry[],
  objects: DocumentObject[]
): void {
  const captionByParagraph = new Map(captions.map((caption) => [caption.paragraphIndex, caption]));
  for (const object of objects.filter((item) => item.continuation)) {
    if (!captionByParagraph.has(object.paragraphIndex)) captionByParagraph.set(object.paragraphIndex, documentObjectToCaption(object));
  }
  const bibliographyIndexes = new Set(bibliography.map((entry) => entry.paragraphIndex));
  for (const paragraph of paragraphs) {
    const caption = captionByParagraph.get(paragraph.index);
    if (!paragraph.text && (paragraph.hasDrawing || paragraph.hasFormula || paragraph.hasManualPageBreak || paragraph.hasSectionBreak)) {
      paragraph.role = "technical";
    } else if (!paragraph.text) {
      paragraph.role = "empty";
    } else if (paragraph.isTocParagraph && !tocHeadingText(normalizeSectionTitle(paragraph.renderedText || paragraph.text))) {
      paragraph.role = "toc";
    } else if (bibliographyIndexes.has(paragraph.index) || paragraph.isBibliographyEntry) {
      paragraph.role = "bibliographyEntry";
    } else if (paragraph.isHeading && /^ПРИЛОЖЕНИ[ЕЯ](?:\s+[А-ЯA-Z0-9])?/iu.test(paragraph.renderedText)) {
      paragraph.role = "appendixTitle";
    } else if (paragraph.isHeading) {
      paragraph.role = "heading";
    } else if (paragraph.inTable) {
      paragraph.role = "tableCellText";
    } else if (caption) {
      paragraph.role = roleForCaptionKind(caption.kind);
    } else if (looksLikeTocParagraph(paragraph)) {
      paragraph.role = "toc";
    } else if (paragraph.hasFormula) {
      paragraph.role = "formula";
    } else if (paragraph.hasPicture && !paragraph.text) {
      paragraph.role = "imageOnly";
    } else if (paragraph.isListItem || paragraph.numbering?.numId) {
      paragraph.role = "listItem";
    } else {
      paragraph.role = "mainText";
    }
  }
}

interface TocEntry {
  number: string;
  title: string;
  paragraphIndex: number;
}

function parseTocEntry(paragraph: DocumentParagraph): TocEntry | null {
  const withoutLeaders = normalizeSpaces((paragraph.text || paragraph.renderedText).replace(/(?:\.{2,}|…)\s*\d+\s*$/u, "").replace(/\s+\d+\s*$/u, ""));
  const match = /^(\d+(?:\.\d+)*)\s+(.+)$/u.exec(withoutLeaders);
  if (!match) return null;
  if (parseCaption(withoutLeaders)) return null;
  return {
    number: match[1],
    title: normalizeSpaces(match[2]),
    paragraphIndex: paragraph.index
  };
}

function extractTocEntries(paragraphs: DocumentParagraph[]): TocEntry[] {
  const entries: TocEntry[] = [];
  let inToc = false;
  for (const paragraph of paragraphs) {
    const normalized = normalizeSectionTitle(paragraph.renderedText || paragraph.text);
    if (normalized === "СОДЕРЖАНИЕ" || normalized === "ОГЛАВЛЕНИЕ") {
      inToc = true;
      continue;
    }
    if (inToc && paragraph.isHeading && /^(ВВЕДЕНИЕ|1\s+|1\s+ГЛАВА)/iu.test(paragraph.renderedText || paragraph.text)) break;
    const entry = parseTocEntry(paragraph);
    if (inToc && entry) entries.push(entry);
  }
  return entries;
}

function compareHeadingsWithToc(headings: DocumentParagraph[], tocEntries: TocEntry[]): HeadingNumberingDiagnostics["tocComparison"] {
  const numberedHeadings = headings.filter((heading) => heading.parsedHeading?.finalNumber);
  if (tocEntries.length === 0) return [];
  const comparisons: HeadingNumberingDiagnostics["tocComparison"] = [];
  const count = Math.max(tocEntries.length, numberedHeadings.length);
  for (let index = 0; index < count; index += 1) {
    const toc = tocEntries[index];
    const heading = numberedHeadings[index]?.parsedHeading;
    if (toc && heading) {
      comparisons.push({
        tocNumber: toc.number,
        tocText: toc.title,
        headingNumber: heading.finalNumber,
        headingText: heading.cleanTitle,
        status: toc.number === heading.finalNumber ? "match" : "mismatch"
      });
    } else if (toc) {
      comparisons.push({ tocNumber: toc.number, tocText: toc.title, status: "missing-heading" });
    } else if (heading) {
      comparisons.push({ headingNumber: heading.finalNumber, headingText: heading.cleanTitle, status: "missing-toc" });
    }
  }
  return comparisons;
}

function detectSuspiciousHeadingNumbering(headings: DocumentParagraph[]): string[] {
  const suspicious: string[] = [];
  const parsed = headings.map((heading) => heading.parsedHeading).filter((heading): heading is ParsedHeading => Boolean(heading?.finalNumber));
  const level2Numbers = parsed.filter((heading) => heading.level === 2).map((heading) => heading.finalNumber ?? "");
  let mirroredRun: string[] = [];
  for (const number of level2Numbers) {
    const match = /^(\d+)\.\1$/u.exec(number);
    if (!match) {
      mirroredRun = [];
      continue;
    }
    const previous = mirroredRun[mirroredRun.length - 1];
    const previousValue = previous ? Number(previous.split(".")[0]) : undefined;
    const currentValue = Number(match[1]);
    mirroredRun = previousValue !== undefined && currentValue === previousValue + 1 ? [...mirroredRun, number] : [number];
    if (mirroredRun.length >= 3) {
      suspicious.push(`Номера подразделов выглядят как глобальный счётчик: ${mirroredRun.slice(0, 4).join(", ")}.`);
      break;
    }
  }

  let currentLevel1: string | undefined;
  let expectedFirstSubsection: string | undefined;
  for (const heading of parsed) {
    const number = heading.finalNumber ?? "";
    const parts = number.split(".");
    if (heading.level === 1 || parts.length === 1) {
      currentLevel1 = parts[0];
      expectedFirstSubsection = `${currentLevel1}.1`;
      continue;
    }
    if (heading.level === 2 && currentLevel1 && parts[0] !== currentLevel1) {
      suspicious.push(`Подраздел ${number} не соответствует текущему разделу ${currentLevel1}.`);
    }
    if (heading.level === 2 && expectedFirstSubsection) {
      if (number !== expectedFirstSubsection && parts[1] === "1") {
        suspicious.push(`Первый подраздел после раздела ${currentLevel1} имеет номер ${number}, ожидался ${expectedFirstSubsection}.`);
      }
      expectedFirstSubsection = undefined;
    }
  }
  return Array.from(new Set(suspicious));
}

function detectHeadingNumberingSource(headings: DocumentParagraph[]): HeadingNumberingDiagnostics["source"] {
  const sources = new Set(headings.map((heading) => heading.parsedHeading?.numberingSource).filter(Boolean));
  if (sources.has("text") && sources.size === 1) return "text";
  if (sources.has("word-numbering") && sources.size === 1) return "word-numbering";
  if (sources.has("toc") && sources.size === 1) return "toc";
  return "mixed";
}

function buildHeadingNumberingDiagnostics(headings: DocumentParagraph[], paragraphs: DocumentParagraph[]): HeadingNumberingDiagnostics {
  const tocEntries = extractTocEntries(paragraphs);
  const tocComparison = compareHeadingsWithToc(headings, tocEntries);
  const suspiciousPatterns = detectSuspiciousHeadingNumbering(headings);
  const mismatches = tocComparison.filter((item) => item.status === "mismatch").length;
  const numberedHeadings = headings.filter((heading) => heading.parsedHeading?.finalNumber).length;
  const reliability: HeadingNumberingDiagnostics["reliability"] =
    suspiciousPatterns.length > 0 || mismatches >= 3
      ? "failed"
      : numberedHeadings === 0
        ? "medium"
        : mismatches > 0
          ? "medium"
          : "high";
  return {
    reliability,
    source: detectHeadingNumberingSource(headings),
    suspiciousPatterns,
    tocComparison
  };
}

interface BuildState {
  styles: StylesModel;
  numberingModel?: NumberingModel;
  numberingCounters: NumberingCounters;
  paragraphs: DocumentParagraph[];
  currentSection?: string;
}

function blockChildren(container: XmlNode): XmlNode[] {
  const result: XmlNode[] = [];
  for (const child of container.children) {
    if (localName(child) === "sdt") {
      const content = directChild(child, "sdtContent");
      if (content) result.push(...blockChildren(content));
      continue;
    }
    result.push(child);
  }
  return result;
}

export function buildDocumentModel(input: DocumentBuildInput, profile?: RuleProfile): ParsedDocument {
  const body = childrenDeep(input.documentXml, "body")[0] ?? null;
  if (!body) throw new Error("В DOCX не найден word/document.xml body.");

  const state: BuildState = {
    styles: input.styles,
    numberingModel: input.numbering,
    numberingCounters: {},
    paragraphs: []
  };
  const tables: DocumentTable[] = [];
  const knownSectionNames = allKnownSectionNames(profile);
  const sectionLayouts: SectionLayout[] = [];

  for (const child of blockChildren(body)) {
    if (localName(child) === "p") {
      const paragraph = parseParagraph(child, state.paragraphs.length, input.styles, state.numberingModel, state.numberingCounters, knownSectionNames, state.currentSection, false);
      if (paragraph.isHeading) state.currentSection = paragraph.renderedText;
      const withSection = { ...paragraph, sectionTitle: state.currentSection };
      state.paragraphs.push(withSection);
      if (withSection.sectionLayout) sectionLayouts.push(withSection.sectionLayout);
    }
    if (localName(child) === "tbl") {
      tables.push(parseTable(child, tables.length, state, knownSectionNames));
    }
    if (localName(child) === "sectPr") {
      const layout = readSectionLayout(child);
      if (layout) sectionLayouts.push(layout);
    }
  }

  markTocParagraphs(state.paragraphs, knownSectionNames);
  const bibliography = findBibliography(state.paragraphs, profile);
  recomputeSectionTitles(state.paragraphs);
  const plainText = state.paragraphs.map((paragraph) => paragraph.renderedText).filter(Boolean).join("\n");
  const captions = findCaptions(state.paragraphs, profile);
  const objects = findObjects(state.paragraphs);
  const referenceDetection = findReferences(state.paragraphs, bibliography.length, profile);
  const references = referenceDetection.references;
  applyParagraphRoles(state.paragraphs, captions, bibliography, objects);
  const tablesWithCaptions = attachTableCaptions(tables, captions, objects);
  const images = extractImages(input.documentXml, state.paragraphs, input.relationships);
  const headings = state.paragraphs.filter(isRealSectionHeading);
  const headingNumbering = buildHeadingNumberingDiagnostics(headings, state.paragraphs);
  const formulaCount = Math.max(captions.filter((caption) => caption.kind === "formula").length, childrenDeep(input.documentXml, "oMath").length);

  return {
    fileName: input.fileName,
    fileSize: input.fileSize,
    metadata: input.metadata,
    paragraphs: state.paragraphs,
    headings,
    styles: input.styles,
    tables: tablesWithCaptions,
    images,
    objects,
    captions,
    references,
    sourceReferenceCandidates: referenceDetection.sourceReferenceCandidates,
    bibliography,
    headerTexts: input.headerTexts,
    footerTexts: input.footerTexts,
    footnotes: input.footnotes,
    endnotes: input.endnotes,
    relationships: input.relationships,
    sectionLayouts,
    numberingDefinitions: input.numbering?.definitions ?? [],
    numberingReconstructionWarnings: input.numbering ? [] : ["В DOCX не найдено word/numbering.xml, восстановление автоматической нумерации недоступно."],
    headingNumbering,
    plainText,
    warnings: input.warnings,
    stats: {
      words: countWords(plainText),
      paragraphs: state.paragraphs.filter((paragraph) => paragraph.text).length,
      sections: headings.length,
      estimatedPages: estimatePagesByText(plainText),
      detectedPages: input.metadata.pages ?? null,
      figures: captions.filter((caption) => caption.kind === "figure").length,
      tables: tablesWithCaptions.length,
      formulas: formulaCount,
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
}

export function estimatedPageForIssue(paragraphIndex: number | undefined, document: ParsedDocument): number | null {
  if (paragraphIndex === undefined) return null;
  return estimatePageFromParagraph(paragraphIndex, document.paragraphs);
}
