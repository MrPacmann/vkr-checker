import type { EnabledChecks } from "../types/rules";
import type { RuleProfile } from "../types/settings";
import { regexPresets } from "./regexPresets";

const enabledChecks: EnabledChecks = {
  requiredSections: true,
  sectionOrder: true,
  headingNumbering: true,
  headingDuplicates: true,
  emptyHeadings: true,
  pageLayout: true,
  typography: true,
  paragraphFormatting: true,
  figureCaptions: true,
  tableCaptions: true,
  listingCaptions: true,
  formulaCaptions: true,
  figureReferences: true,
  tableReferences: true,
  listingReferences: true,
  formulaReferences: true,
  sourceReferences: true,
  brokenReferences: true,
  unusedObjects: true,
  bibliographyPresence: true,
  bibliographyNumbering: true,
  bibliographyMinCount: true,
  ocrAssist: true
};

const baseProfile: RuleProfile = {
  id: "gost-732-2017",
  name: "ГОСТ 7.32-2017",
  description: "Базовый профиль проверки ВКР по ГОСТ 7.32-2017",
  profileOrigin: "built-in",
  isLocked: true,
  isDefault: false,
  lockedDefault: true,
  requiredSections: ["РЕФЕРАТ", "СОДЕРЖАНИЕ", "ВВЕДЕНИЕ", "ЗАКЛЮЧЕНИЕ", "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ"],
  alternativeSectionNames: {
    РЕФЕРАТ: ["АННОТАЦИЯ"],
    СОДЕРЖАНИЕ: ["ОГЛАВЛЕНИЕ"],
    "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ": [
      "СПИСОК ИСТОЧНИКОВ",
      "СПИСОК ЛИТЕРАТУРЫ",
      "БИБЛИОГРАФИЧЕСКИЙ СПИСОК",
      "БИБЛИОГРАФИЧЕСКИЙ СПИСОК ИСТОЧНИКОВ"
    ]
  },
  pageLayout: {
    pageSize: "A4",
    leftMarginMm: 30,
    rightMarginMm: 15,
    topMarginMm: 20,
    bottomMarginMm: 20,
    marginToleranceMm: 0.5,
    allowedRightMarginMm: [10, 15],
    orientation: "portrait"
  },
  typography: {
    mainFont: "Times New Roman",
    mainFontSizePt: 14,
    lineSpacing: 1.5,
    firstLineIndentCm: 1.25,
    alignment: "justify"
  },
  numbering: {
    figures: "continuous",
    tables: "continuous",
    formulas: "bySection",
    listings: "continuous",
    schemes: "continuous"
  },
  minSources: 10,
  minSectionWords: 80,
  headingTopLevelStartsPage: false,
  forbidHeadingTrailingDot: true,
  forbidSingleSubsection: true,
  captionPatterns: regexPresets.captionPatterns,
  referencePatterns: regexPresets.referencePatterns,
  enabledChecks,
  ocrMode: "auto",
  visualPreference: "auto"
};

const pmRequiredSectionsByWorkType: NonNullable<RuleProfile["requiredSectionsByWorkType"]> = {
  coursework: ["СОДЕРЖАНИЕ", "ВВЕДЕНИЕ", "ЗАКЛЮЧЕНИЕ", "СПИСОК ИСТОЧНИКОВ"],
  practiceReport: ["СОДЕРЖАНИЕ", "ВВЕДЕНИЕ", "ЗАКЛЮЧЕНИЕ"],
  bachelorThesis: ["СОДЕРЖАНИЕ", "ВВЕДЕНИЕ", "ЗАКЛЮЧЕНИЕ", "СПИСОК ИСТОЧНИКОВ"],
  masterThesis: ["СОДЕРЖАНИЕ", "ВВЕДЕНИЕ", "ЗАКЛЮЧЕНИЕ", "СПИСОК ИСТОЧНИКОВ"],
  generic: ["СОДЕРЖАНИЕ", "ВВЕДЕНИЕ", "ЗАКЛЮЧЕНИЕ", "СПИСОК ИСТОЧНИКОВ"]
};

const pmAlternativeSectionNames = {
  СОДЕРЖАНИЕ: ["ОГЛАВЛЕНИЕ"],
  АННОТАЦИЯ: ["РЕФЕРАТ"],
  "СПИСОК ИСТОЧНИКОВ": [
    "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ",
    "СПИСОК ИСТОЧНИКОВ И ЛИТЕРАТУРЫ",
    "СПИСОК ЛИТЕРАТУРЫ",
    "БИБЛИОГРАФИЧЕСКИЙ СПИСОК",
    "БИБЛИОГРАФИЧЕСКИЙ СПИСОК ИСТОЧНИКОВ"
  ],
  ПРИЛОЖЕНИЯ: ["ПРИЛОЖЕНИЕ"]
};

const pmCheckCodes = [
  "PM_STRUCTURE_CONTENTS_MISSING",
  "PM_STRUCTURE_INTRODUCTION_MISSING",
  "PM_STRUCTURE_CONCLUSION_MISSING",
  "PM_STRUCTURE_BIBLIOGRAPHY_MISSING",
  "PM_STRUCTURE_WRONG_ORDER",
  "PM_STRUCTURE_CONTENTS_MISMATCH",
  "PM_PAGE_A4_REQUIRED",
  "PM_PAGE_MARGINS_MISMATCH",
  "PM_PAGE_LANDSCAPE_TEXT_FORBIDDEN",
  "PM_PAGE_NUMBERING_POSITION_ERROR",
  "PM_PAGE_NUMBERING_SEQUENCE_ERROR",
  "PM_TEXT_FONT_MISMATCH",
  "PM_TEXT_FONT_SIZE_MISMATCH",
  "PM_TEXT_ALIGNMENT_MISMATCH",
  "PM_TEXT_FIRST_LINE_INDENT_MISMATCH",
  "PM_TEXT_LINE_SPACING_MISMATCH",
  "PM_TEXT_SPACING_BEFORE_AFTER_MISMATCH",
  "PM_TEXT_MANUAL_SPACES_USED",
  "PM_TEXT_TAB_INDENT_USED",
  "PM_TEXT_EMPTY_PARAGRAPHS",
  "PM_TEXT_PUNCTUATION_SPACES_ERROR",
  "PM_TEXT_QUOTES_STYLE_ERROR",
  "PM_HEADING_LEVEL_FORMAT_ERROR",
  "PM_HEADING_TRAILING_DOT",
  "PM_HEADING_WRONG_ALIGNMENT",
  "PM_HEADING_NOT_KEEP_WITH_NEXT",
  "PM_HEADING_LEVEL1_NOT_NEW_PAGE",
  "PM_HEADING_NUMBERING_ERROR",
  "PM_LIST_MARKER_INCONSISTENT",
  "PM_LIST_BULLET_CASE_ERROR",
  "PM_LIST_BULLET_PUNCTUATION_ERROR",
  "PM_LIST_NUMBERED_PUNCTUATION_ERROR",
  "PM_LIST_CONTAINS_TABLE_OR_FIGURE",
  "PM_SECTION_ENDS_WITH_LIST",
  "PM_TABLE_CAPTION_MISSING",
  "PM_TABLE_CAPTION_POSITION_ERROR",
  "PM_TABLE_CAPTION_FORMAT_ERROR",
  "PM_TABLE_REFERENCE_MISSING",
  "PM_TABLE_BROKEN_REFERENCE",
  "PM_TABLE_BEFORE_FIRST_REFERENCE",
  "PM_TABLE_SEVERAL_WITHOUT_TEXT",
  "PM_TABLE_BODY_FORMAT_ERROR",
  "PM_TABLE_BORDERS_MISSING",
  "PM_TABLE_NUMBER_PP_FORBIDDEN",
  "PM_TABLE_NUMBERING_SHOULD_BE_BY_SECTION",
  "PM_TABLE_CONTINUATION_FORMAT_ERROR",
  "PM_TABLE_TOO_LARGE",
  "PM_FIGURE_CAPTION_MISSING",
  "PM_FIGURE_CAPTION_POSITION_ERROR",
  "PM_FIGURE_CAPTION_FORMAT_ERROR",
  "PM_FIGURE_REFERENCE_MISSING",
  "PM_FIGURE_REFERENCE_MISSING_GROUPED",
  "PM_FIGURE_BROKEN_REFERENCE",
  "PM_FIGURE_ABBREVIATION_FORBIDDEN",
  "PM_FIGURE_NOT_CENTERED",
  "PM_FIGURE_TOO_LARGE",
  "PM_FIGURE_LOW_QUALITY",
  "PM_FIGURE_CROP_OR_BORDER_REQUIRED",
  "PM_FIGURE_NUMBERING_SHOULD_BE_BY_SECTION",
  "PM_FORMULA_NOT_EQUATION_OBJECT",
  "PM_FORMULA_RASTER_IMAGE_FORBIDDEN",
  "PM_FORMULA_NUMBER_FORMAT_ERROR",
  "PM_FORMULA_REFERENCE_MISSING",
  "PM_FORMULA_BROKEN_REFERENCE",
  "PM_FORMULA_EXPLANATION_MISSING",
  "PM_FORMULA_WHERE_COLON_ERROR",
  "PM_LISTING_CAPTION_MISSING",
  "PM_LISTING_CAPTION_POSITION_ERROR",
  "PM_LISTING_CAPTION_FORMAT_ERROR",
  "PM_LISTING_FRAME_MISSING",
  "PM_LISTING_CODE_FONT_ERROR",
  "PM_LISTING_TOO_LARGE",
  "PM_LISTING_REFERENCE_MISSING",
  "PM_LISTING_BROKEN_REFERENCE",
  "PM_BIBLIOGRAPHY_TITLE_ERROR",
  "PM_BIBLIOGRAPHY_COUNT_ERROR",
  "PM_BIBLIOGRAPHY_ORDER_ERROR",
  "PM_BIBLIOGRAPHY_SOURCE_TOO_OLD",
  "PM_BIBLIOGRAPHY_ACTIVE_HYPERLINK",
  "PM_SOURCE_REFERENCE_FORMAT_ERROR",
  "PM_SOURCE_REFERENCE_IN_INTRO_CONCLUSION",
  "PM_SOURCE_WITHOUT_REFERENCE",
  "PM_SOURCE_REFERENCE_NOT_FOUND",
  "PM_APPENDIX_REQUIRED_MISSING",
  "PM_APPENDIX_REFERENCE_MISSING",
  "PM_APPENDIX_BROKEN_REFERENCE",
  "PM_APPENDIX_LETTER_FORBIDDEN",
  "PM_APPENDIX_ORDER_ERROR",
  "PM_APPENDIX_NOT_NEW_PAGE",
  "PM_APPENDIX_A_GRAPHIC_MATERIAL_MISSING",
  "PM_APPENDIX_OBJECT_NUMBERING_ERROR"
];

export const pmDepartmentNormcontrolProfile: RuleProfile = {
  ...baseProfile,
  id: "pm-department-normcontrol",
  name: "Кафедра ПМ — нормоконтроль",
  description: "Проверка учебных работ по требованиям кафедры ПМ: курсовые работы, отчёты по практике и ВКР.",
  profileSchemaVersion: 1,
  source: {
    title: "Нормоконтроль.pdf",
    department: "Кафедра ПМ",
    type: "department-methodical-requirements",
    version: "1.0"
  },
  lockedDefault: true,
  profileOrigin: "built-in",
  isLocked: true,
  isDefault: true,
  editableCopyAllowed: true,
  workTypes: ["coursework", "practiceReport", "bachelorThesis", "masterThesis", "generic"],
  defaultWorkType: "coursework",
  activeWorkType: "coursework",
  requiredSections: pmRequiredSectionsByWorkType.coursework ?? [],
  requiredSectionsByWorkType: pmRequiredSectionsByWorkType,
  alternativeSectionNames: pmAlternativeSectionNames,
  structure: {
    requiredSections: pmRequiredSectionsByWorkType,
    alternativeSectionNames: pmAlternativeSectionNames,
    requiredOrder: ["TITLE_PAGE", "TASK", "ANNOTATION", "CONTENTS", "INTRODUCTION", "MAIN_PART", "CONCLUSION", "BIBLIOGRAPHY", "APPENDICES"],
    contentsRequiresPageNumbers: true,
    contentsMustMatchHeadings: true,
    mainPartRequiresSections: true,
    bachelorThesis: { appendixAGraphicMaterialRequired: true },
    masterThesis: { appendixAGraphicMaterialRequired: true }
  },
  pageLayout: {
    pageSize: "A4",
    widthMm: 210,
    heightMm: 297,
    printSide: "one-sided",
    leftMarginMm: 30,
    rightMarginMm: 10,
    topMarginMm: 20,
    bottomMarginMm: 20,
    marginToleranceMm: 0.5,
    allowedRightMarginMm: [10],
    landscapeMargins: {
      leftMm: 20,
      rightMm: 20,
      topMm: 30,
      bottomMm: 10
    },
    allowLandscapePages: true,
    landscapeOnlyFor: ["figures", "tables"],
    forbidMainTextOnLandscapePages: true,
    orientation: "portrait"
  },
  typography: {
    mainFont: "Times New Roman",
    mainFontSizePt: 14,
    lineSpacing: 1.5,
    firstLineIndentCm: 1.25,
    alignment: "justify",
    mainText: {
      fontFamily: "Times New Roman",
      fontSizePt: 14,
      bold: false,
      italic: false,
      underline: false,
      color: "000000",
      alignment: "justify",
      firstLineIndentCm: 1.25,
      leftIndentCm: 0,
      rightIndentCm: 0,
      spacingBeforePt: 0,
      spacingAfterPt: 0,
      lineSpacing: 1.5,
      widowControl: true
    },
    tolerance: {
      fontSizePt: 0.5,
      indentCm: 0.05,
      spacingPt: 1,
      lineSpacing: 0.05
    }
  },
  headingTopLevelStartsPage: true,
  headings: {
    levels: {
      1: { fontFamily: "Times New Roman", fontSizePt: 18, bold: true, uppercase: true, alignment: "left", leftIndentCm: 1.25, spacingAfterPt: 28, lineSpacing: 1.5, pageBreakBefore: true, keepWithNext: true, noTrailingDot: true },
      2: { fontFamily: "Times New Roman", fontSizePt: 16, bold: true, uppercase: false, alignment: "left", leftIndentCm: 1.25, spacingBeforePt: 42, spacingAfterPt: 28, lineSpacing: 1.5, keepWithNext: true, noTrailingDot: true },
      3: { fontFamily: "Times New Roman", fontSizePt: 14, bold: true, uppercase: false, alignment: "left", leftIndentCm: 1.25, spacingBeforePt: 42, spacingAfterPt: 28, lineSpacing: 1.5, keepWithNext: true, noTrailingDot: true }
    }
  },
  headingNumbering: {
    system: "decimal",
    maxDepth: 3,
    requireNoTrailingDotAfterNumber: true,
    requireSpaceAfterNumber: true,
    sectionNumbering: "continuous",
    subsectionPattern: "1.1",
    subsubsectionPattern: "1.1.1"
  },
  numbering: {
    figures: "bySection",
    tables: "bySection",
    formulas: "bySection",
    listings: "bySection",
    schemes: "bySection"
  },
  numberingPolicy: {
    tables: {
      expected: "bySection",
      allowContinuousWhenFew: true,
      continuousAllowedMaxCount: 5,
      continuousNumberingSeverity: "info",
      continuousNumberingSeverityWhenAllowed: "info",
      continuousNumberingSeverityWhenMany: "warning"
    },
    figures: {
      expected: "bySection",
      allowContinuousWhenFew: true,
      continuousAllowedMaxCount: 10,
      continuousNumberingSeverity: "warning",
      continuousNumberingSeverityWhenAllowed: "info",
      continuousNumberingSeverityWhenMany: "warning"
    }
  },
  lists: {
    allowedBulletMarkers: ["•", "—"],
    requireSingleBulletMarkerAcrossDocument: true,
    bulletItemsStartLowercase: true,
    bulletItemsEndWithSemicolonExceptLast: true,
    bulletLastItemEndsWithPeriod: true,
    numberedItemsStartUppercase: true,
    numberedItemsEndWithPeriod: true,
    markerIndentCm: 1.25,
    textTabAfterCm: 2.25,
    forbiddenRussianLetterListLetters: ["е", "ё", "з", "й", "о", "ч", "ъ", "ы", "ь"]
  },
  tables: {
    numbering: "bySection",
    captionPosition: "above",
    captionRequired: true,
    referenceRequired: true,
    requireAfterFirstMention: true,
    allowOnNextPageAfterMention: true,
    maxPageAreaPercent: 75,
    caption: { label: "Таблица", separator: "dash", allowDotSeparatorForCompatibility: true, fontFamily: "Times New Roman", fontSizePt: 12, italic: true, alignment: "left", spacingBeforePt: 17, lineSpacing: 1, noTrailingDot: true },
    body: { fontFamily: "Times New Roman", minFontSizePt: 10, maxFontSizePt: 12, bordersRequired: true },
    continuation: { allowed: true, textPatterns: ["Продолжение Таблицы {number}", "Продолжение таблицы {number}", "Окончание Таблицы {number}", "Окончание таблицы {number}"], repeatHeaderRequired: true }
  },
  figures: {
    numbering: "bySection",
    captionPosition: "below",
    captionRequired: true,
    referenceRequired: true,
    missingReferenceSeverity: "warning",
    aggregateMissingReferencesThreshold: 5,
    allowCaptionOnlyWhenNearbyTextMentionsObject: false,
    imageAlignment: "center",
    maxPageAreaPercent: 75,
    caption: { label: "Рисунок", abbreviationForbidden: true, separator: "dash", allowDotSeparatorForCompatibility: true, fontFamily: "Times New Roman", fontSizePt: 12, bold: true, alignment: "center", lineSpacing: 1, noTrailingDot: true }
  },
  formulas: {
    requireEquationEditor: true,
    forbidRasterFormulaImages: true,
    alignment: "center",
    numbering: "bySection",
    numberFormat: "parentheses",
    numberAlignment: "right",
    requireReferencesForNumberedFormulas: true,
    requireExplanations: true,
    explanationStartsWith: "где",
    explanationColonForbidden: true
  },
  listings: {
    captionPosition: "above",
    captionRequired: true,
    referenceRequired: true,
    frameRequired: true,
    maxPageAreaPercent: 75,
    largeCodeShouldBeAppendix: true,
    caption: { label: "Листинг", separator: "dash", allowDotSeparatorForCompatibility: true, fontFamily: "Times New Roman", fontSizePt: 12, italic: true, alignment: "left", spacingBeforePt: 17, lineSpacing: 1, keepWithNext: true },
    code: { fontFamily: "Courier New", fontSizePt: 10, lineSpacing: 1 },
    continuation: { allowed: true, textPatterns: ["Продолжение Листинга {number}", "Продолжение листинга {number}"], keepFrame: true }
  },
  references: {
    sourceReferences: {
      format: "square-brackets",
      allowedPatterns: ["[1]", "[2, с. 21-25]", "[1, 3, 5]", "[1-3]"],
      numberingByFirstMention: true,
      requireCrossReferences: true,
      sourceReferenceBeforeSentenceDot: true
    },
    objectReferences: {
      figure: { requireCapitalizedWord: true, validExamples: ["Рисунок 2.1", "на Рисунке 2.1"], forbidExamples: ["рис. 2.1", "рисунок выше", "рисунок ниже"] },
      table: { requireCapitalizedWord: true, validExamples: ["Таблица 3.2", "в Таблице 3.2"], forbidExamples: ["таблица ниже", "таблица выше"] },
      formula: { pattern: "формуле (3.1)" },
      appendix: { requireCapitalizedWord: true, pattern: "Приложение А" }
    },
    forbidAboveBelowWithoutNumber: true
  },
  bibliography: {
    sectionTitle: "СПИСОК ИСТОЧНИКОВ",
    alternativeTitles: pmAlternativeSectionNames["СПИСОК ИСТОЧНИКОВ"],
    numbering: "arabic",
    order: "firstMention",
    forbidAlphabeticalOrderIfReferencesExist: true,
    forbidActiveHyperlinks: true,
    maxSourceAgeYears: 5,
    sourceAgeCheckMode: "warning",
    coursework: { minSources: 5, maxSources: 7, splitIntoSections: false },
    practiceReport: { minSources: 5, maxSources: 7, splitIntoSections: false },
    bachelorThesis: { splitIntoSections: true, minSourcesPerSection: 10, maxSourceAgeYears: 5 },
    masterThesis: { splitIntoSections: true, minSourcesPerSection: 10, maxSourceAgeYears: 5 }
  },
  appendices: {
    enabled: true,
    requiredIfReferenced: true,
    singleAppendixTitle: "ПРИЛОЖЕНИЕ",
    multipleAppendicesTitle: "ПРИЛОЖЕНИЯ",
    appendixLabelPattern: "ПРИЛОЖЕНИЕ {letter}",
    allowedLetters: ["А", "Б", "В", "Г", "Д", "Ж", "И", "К", "Л", "М", "Н", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ш", "Щ", "Э", "Ю", "Я"],
    forbiddenLetters: ["Ё", "Е", "З", "Й", "О", "Ч", "Ъ", "Ы", "Ь"],
    eachAppendixStartsNewPage: true,
    bachelorThesis: { requiredAppendixA: true, requiredAppendixATitle: "Графический материал" },
    masterThesis: { requiredAppendixA: true, requiredAppendixATitle: "Графический материал" }
  },
  visualChecks: {
    largeObjectAreaPercent: 75,
    emptySpaceMoreThanLines: 5,
    approximateChecksUseLowConfidence: true
  },
  pageNumbering: {
    continuous: true,
    format: "arabic",
    position: "bottom-center",
    hiddenButCounted: ["titlePage", "task", "contents"],
    annotationCounted: false,
    firstVisibleNumberUsuallyStartsFrom: "introduction",
    forbidRomanNumerals: true
  },
  captionPatterns: {
    ...regexPresets.captionPatterns,
    table: "(?:(Продолжение|Окончание)\\s+)?(?:таблиц[аы]|таблица)\\s+([А-ЯA-Z]?\\.?\\d+(?:\\.\\d+)*)\\s*(?:[.．]|[—–-])?\\s*(.*)"
  },
  referencePatterns: {
    ...regexPresets.referencePatterns,
    appendix: "\\b(?:[Пп]риложени[еяи]|ПРИЛОЖЕНИ[ЕЯИ]|[Пп]рил\\.|ПРИЛ\\.)\\s+([А-ЯA-Z]|\\d+)\\b"
  },
  minSources: 5,
  minSourcesByWorkType: {
    coursework: 5,
    practiceReport: 5,
    bachelorThesis: 10,
    masterThesis: 10,
    generic: 5
  },
  maxSourcesByWorkType: {
    coursework: 7,
    practiceReport: 7
  },
  minSectionWords: 80,
  severityOverrides: {
    HEADING_WITHOUT_TEXT: "info",
    PAGE_MARGIN_MISMATCH: "error",
    BIBLIOGRAPHY_TOO_FEW_SOURCES: "warning"
  },
  pmCheckCodes,
  enabledChecks,
  ocrMode: "auto",
  visualPreference: "auto"
};

function cloneProfile(profile: RuleProfile, patch: Partial<RuleProfile>): RuleProfile {
  return JSON.parse(JSON.stringify({ ...profile, ...patch })) as RuleProfile;
}

export const PRIMARY_PROFILE_ID = "pm-department-normcontrol";

export const hiddenBuiltInProfileIds = new Set(["gost-732-2017", "department-guidelines", "simple", "strict", "custom"]);

export function isUserVisibleProfile(profile: RuleProfile): boolean {
  if (profile.id === PRIMARY_PROFILE_ID) return true;
  if (hiddenBuiltInProfileIds.has(profile.id)) return false;
  return !profile.lockedDefault;
}

export const defaultProfiles: RuleProfile[] = [
  baseProfile,
  pmDepartmentNormcontrolProfile,
  cloneProfile(baseProfile, {
    id: "department-guidelines",
    name: "Методические указания кафедры",
    description: "Профиль с более мягкой проверкой разделов и источников.",
    minSources: 8
  }),
  cloneProfile(baseProfile, {
    id: "simple",
    name: "Упрощённая проверка",
    description: "Основные структурные проверки без строгой типографики.",
    minSources: 5,
    enabledChecks: {
      ...enabledChecks,
      pageLayout: false,
      typography: false,
      paragraphFormatting: false
    } as EnabledChecks
  }),
  cloneProfile(baseProfile, {
    id: "strict",
    name: "Строгая проверка",
    description: "Максимально строгий профиль с проверкой коротких разделов и заголовков с новой страницы.",
    minSources: 15,
    minSectionWords: 120,
    headingTopLevelStartsPage: true
  }),
  cloneProfile(baseProfile, {
    id: "custom",
    name: "Пользовательский профиль",
    description: "Редактируемая копия базового профиля."
  })
];
