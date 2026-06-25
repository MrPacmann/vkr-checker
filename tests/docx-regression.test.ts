import { defaultProfiles, pmDepartmentNormcontrolProfile } from "../src/config/defaultProfiles";
import { runChecks } from "../src/services/checkEngine/checkEngine";
import { buildDocumentModel } from "../src/services/documentParser/documentModelBuilder";
import { parseNumbering } from "../src/services/documentParser/numberingParser";
import { parseStyles } from "../src/services/documentParser/stylesParser";
import { profileFromJson, profileToJson } from "../src/services/settings/importExportProfile";
import { resolveProfileForWorkType } from "../src/services/settings/profileManager";
import type { RuleProfile } from "../src/types/settings";
import type { VisualLayerResult } from "../src/types/visualLayer";
import { parseSourceReference } from "../src/utils/sourceReferences";
import { buildMarkdownReport, buildReportSummary, buildShortReportText, groupIssues, isGroupedIssue } from "../src/utils/reportPresentation";
import { parseXml, type XmlNode } from "../src/utils/xml";
import type { CheckIssue, CheckReport } from "../src/types/report";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const profile = defaultProfiles[0];
assert(parseSourceReference("[1]", 8)?.sourceNumbers.join(",") === "1", "[1] должен распознаваться как источник 1.");
assert(parseSourceReference("[1; 2]", 8)?.sourceNumbers.join(",") === "1,2", "[1; 2] должен распознаваться как источники 1 и 2.");
assert(parseSourceReference("[1,2]", 8)?.sourceNumbers.join(",") === "1,2", "[1,2] должен распознаваться как источники 1 и 2.");
const pageReference = parseSourceReference("[2, с. 21-25]", 8);
assert(pageReference?.sourceNumbers.join(",") === "2" && pageReference.pageRange === "21-25", "[2, с. 21-25] должен распознаваться как источник 2 со страницами.");
assert(parseSourceReference("[85; 5100]", 8, "середину диапазона", "") === null, "[85; 5100] должен игнорироваться как числовой диапазон.");
assert(parseSourceReference("[2022; 2024]", 8, "период", "") === null, "[2022; 2024] должен игнорироваться как период/диапазон.");
assert(parseSourceReference("[75,3; 92,9]", 8) === null, "[75,3; 92,9] должен игнорироваться как десятичный интервал.");
assert(parseSourceReference("[0; 1]", 8) === null, "[0; 1] должен игнорироваться как числовой интервал.");

function makePresentationIssue(index: number): CheckIssue {
  return {
    id: `presentation-${index}`,
    level: "warning",
    confidence: "high",
    code: "HEADING_TRAILING_DOT",
    category: "headings",
    message: `У заголовка ${index} есть точка в конце.`,
    location: { section: "Глава 1", paragraphIndex: index },
    recommendation: "Удалите точку в конце заголовка.",
    source: "docx",
    ruleProfile: "test"
  };
}

const presentationIssues = [0, 1, 2, 3].map(makePresentationIssue);
const groupedPresentationIssues = groupIssues(presentationIssues);
assert(groupedPresentationIssues.length === 1, "Четыре однотипных замечания должны группироваться в одну карточку.");
assert(isGroupedIssue(groupedPresentationIssues[0]) && groupedPresentationIssues[0].count === 4, "Группа должна сохранять все исходные замечания.");

const presentationReport: CheckReport = {
  id: "presentation-report",
  fileName: "Курсовая работа.docx",
  optionalPdfFileName: null,
  inputMode: "docxOnly",
  profileName: "Кафедра ПМ — нормоконтроль",
  generatedAt: "2026-06-25T00:00:00.000Z",
  visualLayerMode: "textOnly",
  score: 82,
  scoreReliability: "reliable",
  scoreExplanation: "Тестовая сводка.",
  stats: {
    words: 1000,
    paragraphs: 80,
    sections: 4,
    estimatedPages: 12,
    detectedPages: null,
    figures: 0,
    tables: 0,
    formulas: 0,
    listings: 0,
    schemes: 0,
    sources: 5,
    sourceReferences: 3,
    figureReferences: 0,
    tableReferences: 0,
    formulaReferences: 0,
    listingReferences: 0,
    critical: 0,
    errors: 0,
    warnings: 4,
    info: 0,
    highConfidence: 4,
    mediumConfidence: 0,
    lowConfidence: 0,
    unknownConfidence: 0,
    manualReview: 0
  },
  checks: { total: 1, passed: 0, failed: 1, partial: 0, notAvailable: 0 },
  checkExecutions: [],
  notAvailableChecks: [],
  issues: presentationIssues,
  documentWarnings: [],
  privacyNote: "Локальная проверка.",
  debug: { activeWorkType: "coursework", detectedSections: [], detectedCaptions: [] }
};

const presentationSummary = buildReportSummary(presentationReport);
assert(presentationSummary.statusText.includes("отдельных замечаний"), "Сводка должна учитывать warning без errors.");
assert(buildShortReportText(presentationReport).includes("Основные замечания"), "Краткий отчёт должен содержать основные замечания.");
assert(buildMarkdownReport(presentationReport).includes("# Отчёт предварительной проверки документа"), "Markdown-отчёт должен содержать заголовок.");
const documentXml = parseXml(`<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:sdt><w:sdtContent><w:p><w:r><w:t>Содержание</w:t></w:r></w:p></w:sdtContent></w:sdt>
    <w:p><w:r><w:t>Аннотация 3</w:t></w:r></w:p>
    <w:p><w:r><w:t>Введение 5</w:t></w:r></w:p>
    <w:p><w:r><w:t>5 Список источников 54</w:t></w:r></w:p>
    <w:p><w:r><w:t>Введение</w:t></w:r></w:p>
    <w:p><w:r><w:t>Теоретическое введение</w:t></w:r></w:p>
    <w:p><w:r><w:t>Таблица 1.1. Технический паспорт исходного набора данных</w:t></w:r></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Данные</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:r><w:t>Визуализация представлена в Таблице 1.1.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Листинг 1. Программная реализация алгоритма очистки на языке Python:</w:t></w:r></w:p>
    <w:p><w:r><w:t>Как показано в Листинге 1, выполняется очистка данных.</w:t></w:r></w:p>
    <w:p><w:r><w:t>В тексте встречается слово приложения, приложения нет, Spark-приложение и приложение на языке Python, но это не ссылки.</w:t></w:r></w:p>
    <w:p><w:r><w:t>СПИСОК ИСТОЧНИКОВ</w:t></w:r></w:p>
    <w:p><w:r><w:t>Учебная и научная литература</w:t></w:r></w:p>
    <w:p><w:r><w:t>1. Клепин, В. С. Анализ больших данных и хранилища данных. М.: Наука, 2021.</w:t></w:r></w:p>
  </w:body>
</w:document>`) as XmlNode;

const styles = parseStyles(null);
const parsed = buildDocumentModel(
  {
    fileName: "regression.docx",
    fileSize: 1,
    documentXml,
    styles,
    relationships: {},
    metadata: {},
    headerTexts: [],
    footerTexts: [],
    footnotes: [],
    endnotes: [],
    warnings: []
  },
  profile
);

const visualLayer: VisualLayerResult = {
  mode: "textOnly",
  status: "partial",
  label: "test",
  message: "test",
  pageCount: null,
  pages: [],
  warnings: []
};

function buildParsedDocument(xml: string, activeProfile: RuleProfile = profile) {
  return buildDocumentModel(
    {
      fileName: "regression.docx",
      fileSize: 1,
      documentXml: parseXml(xml) as XmlNode,
      styles,
      relationships: {},
      metadata: {},
      headerTexts: [],
      footerTexts: [],
      footnotes: [],
      endnotes: [],
      warnings: []
    },
    activeProfile
  );
}

function buildParsedDocumentWithParts(xml: string, activeProfile: RuleProfile, stylesXml: string | null, numberingXml: string | null) {
  return buildDocumentModel(
    {
      fileName: "word-numbering-regression.docx",
      fileSize: 1,
      documentXml: parseXml(xml) as XmlNode,
      styles: parseStyles(stylesXml ? (parseXml(stylesXml) as XmlNode) : null),
      relationships: {},
      numbering: parseNumbering(numberingXml ? (parseXml(numberingXml) as XmlNode) : null),
      metadata: {},
      headerTexts: [],
      footerTexts: [],
      footnotes: [],
      endnotes: [],
      warnings: []
    },
    activeProfile
  );
}

const report = runChecks({ document: parsed, profile, visualLayer, inputMode: "docxOnly" });
const codes = new Set(report.issues.map((issue) => issue.code));

assert(!report.issues.some((issue) => issue.code === "REQUIRED_SECTION_MISSING" && issue.message.includes("СОДЕРЖАНИЕ")), "Содержание должно находиться.");
assert(!report.issues.some((issue) => issue.code === "REQUIRED_SECTION_MISSING" && issue.message.includes("СПИСОК")), "Список источников должен находиться как альтернатива.");
assert(parsed.captions.some((caption) => caption.kind === "table" && caption.number === "1.1"), "Таблица 1.1 должна распознаваться.");
assert(parsed.objects?.some((object) => object.type === "table" && object.number === "1.1"), "Объект table 1.1 должен попасть в общую модель.");
assert(parsed.tables[0]?.caption?.number === "1.1", "Подпись таблицы 1.1 должна привязываться к ближайшему w:tbl.");
assert(!codes.has("TABLE_REFERENCE_NOT_FOUND"), "Ссылка на таблицу 1.1 не должна быть битой.");
assert(!codes.has("TABLE_OBJECT_WITHOUT_CAPTION"), "Таблица с ближайшей подписью не должна считаться неподписанной.");
assert(parsed.captions.some((caption) => caption.kind === "listing" && caption.number === "1"), "Листинг 1 должен распознаваться.");
assert(parsed.objects?.some((object) => object.type === "listing" && object.number === "1"), "Объект listing 1 должен попасть в общую модель.");
assert(!codes.has("LISTING_REFERENCE_NOT_FOUND"), "Ссылка на листинг 1 не должна быть битой.");
assert(!codes.has("APPENDIX_REFERENCE_WITHOUT_APPENDIX"), "Обычное слово приложения не должно считаться ссылкой на приложение.");
assert(!codes.has("BIBLIOGRAPHY_MISSING"), "Список источников должен находиться как библиография.");
assert(!parsed.bibliography.some((entry) => entry.text === "Введение"), "Библиография не должна начинаться с Введения.");
assert(!parsed.bibliography.some((entry) => entry.text === "Учебная и научная литература"), "Подзаголовок внутри библиографии не должен считаться источником.");
assert(report.debug?.detectedCaptions.some((caption) => caption.type === "table" && caption.number === "1.1"), "Debug должен содержать найденную подпись таблицы.");
assert(report.score > 0, "Score не должен падать до 0 на регрессионном кейсе.");

const pmProfile = resolveProfileForWorkType(pmDepartmentNormcontrolProfile, "coursework");
assert(defaultProfiles.some((item) => item.id === "pm-department-normcontrol"), "Профиль кафедры ПМ должен быть встроен.");
assert(pmProfile.requiredSections.includes("СПИСОК ИСТОЧНИКОВ"), "Для курсовой работы PM-профиль должен требовать список источников.");
assert(pmProfile.pageLayout.rightMarginMm === 10, "PM-профиль должен требовать правое поле 10 мм.");

const importedPmProfile = profileFromJson(profileToJson(pmProfile));
assert(importedPmProfile.id === pmProfile.id, "PM-профиль должен экспортироваться и импортироваться из JSON.");
assert(importedPmProfile.source?.title === "Нормоконтроль.pdf", "В PM-профиле должен сохраняться источник правил.");

const pmGoodLayoutDocument = buildParsedDocument(
  `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>Содержание</w:t></w:r></w:p>
      <w:p><w:r><w:t>Введение</w:t></w:r></w:p>
      <w:p><w:r><w:t>Таблица 1.1 — Название</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Данные</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>В Таблице 1.1 представлены данные. Обычное приложение не является ссылкой.</w:t></w:r></w:p>
      <w:p><w:r><w:t>Листинг 1.1 — Пример кода</w:t></w:r></w:p>
      <w:p><w:r><w:t>Код показан в Листинге 1.1.</w:t></w:r></w:p>
      <w:p><w:r><w:t>Заключение</w:t></w:r></w:p>
      <w:p><w:r><w:t>СПИСОК ИСТОЧНИКОВ</w:t></w:r></w:p>
      <w:p><w:r><w:t>1. Иванов И. И. Анализ данных. М.: Наука, 2024.</w:t></w:r></w:p>
      <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="1701" w:right="567" w:top="1134" w:bottom="1134"/></w:sectPr>
    </w:body>
  </w:document>`,
  pmProfile
);
const pmGoodReport = runChecks({ document: pmGoodLayoutDocument, profile: pmProfile, visualLayer, inputMode: "docxOnly" });
assert(!pmGoodReport.issues.some((issue) => issue.code === "PM_PAGE_MARGINS_MISMATCH"), "Поля 30/10/20/20 должны быть корректны для PM-профиля.");
assert(pmGoodLayoutDocument.captions.some((caption) => caption.kind === "table" && caption.number === "1.1"), "PM-профиль должен распознавать подпись таблицы через тире.");
assert(!pmGoodReport.issues.some((issue) => issue.code === "PM_TABLE_BROKEN_REFERENCE"), "Ссылка на таблицу 1.1 не должна быть битой в PM-профиле.");
assert(!pmGoodReport.issues.some((issue) => issue.code === "PM_APPENDIX_BROKEN_REFERENCE"), "Обычное слово приложение не должно считаться ссылкой на приложение в PM-профиле.");

const pmBadLayoutDocument = buildParsedDocument(
  `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>Содержание</w:t></w:r></w:p>
      <w:p><w:r><w:t>Введение</w:t></w:r></w:p>
      <w:p><w:r><w:t>Заключение</w:t></w:r></w:p>
      <w:p><w:r><w:t>СПИСОК ИСТОЧНИКОВ</w:t></w:r></w:p>
      <w:p><w:r><w:t>1. Иванов И. И. Анализ данных. М.: Наука, 2024.</w:t></w:r></w:p>
      <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="1701" w:right="850" w:top="1134" w:bottom="1134"/></w:sectPr>
    </w:body>
  </w:document>`,
  pmProfile
);
const pmBadReport = runChecks({ document: pmBadLayoutDocument, profile: pmProfile, visualLayer, inputMode: "docxOnly" });
assert(pmBadReport.issues.some((issue) => issue.code === "PM_PAGE_MARGINS_MISMATCH"), "Правое поле 15 мм должно давать PM_PAGE_MARGINS_MISMATCH.");

const bachelorPmProfile = resolveProfileForWorkType(pmDepartmentNormcontrolProfile, "bachelorThesis");
const bachelorWithoutAppendix = runChecks({ document: pmGoodLayoutDocument, profile: bachelorPmProfile, visualLayer, inputMode: "docxOnly" });
assert(bachelorWithoutAppendix.issues.some((issue) => issue.code === "PM_APPENDIX_A_GRAPHIC_MATERIAL_MISSING"), "Для ВКР должно требоваться приложение А «Графический материал».");

const wordNumberingStylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="FigureCaption">
    <w:name w:val="Подпись рисунка"/>
    <w:pPr>
      <w:numPr>
        <w:ilvl w:val="0"/>
        <w:numId w:val="43"/>
      </w:numPr>
    </w:pPr>
  </w:style>
</w:styles>`;

const wordNumberingXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="99">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="Рисунок %1 —"/>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="43">
    <w:abstractNumId w:val="99"/>
  </w:num>
</w:numbering>`;

const wordNumberingDocument = buildParsedDocumentWithParts(
  `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <w:body>
      <w:p><w:r><w:t>Содержание</w:t></w:r></w:p>
      <w:p><w:r><w:t>Введение</w:t></w:r></w:p>
      <w:p><w:r><w:t>На Рисунке 1 показана структура датасета. Значение рассчитывается по формуле (1).</w:t></w:r></w:p>
      <w:p>
        <w:pPr><w:pStyle w:val="FigureCaption"/></w:pPr>
        <w:r><w:t>Структура датасета</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:pStyle w:val="FigureCaption"/></w:pPr>
        <w:r><w:t>Добавление компонента «Excel файл» и выбор листа</w:t></w:r>
      </w:p>
      <w:p><m:oMath><m:r><m:t>y = ax + b</m:t></m:r></m:oMath><w:r><w:t> (1)</w:t></w:r></w:p>
      <w:p><w:r><w:t>Заключение</w:t></w:r></w:p>
      <w:p><w:r><w:t>СПИСОК ИСТОЧНИКОВ</w:t></w:r></w:p>
      <w:p><w:r><w:t>1. Иванов И. И. Анализ данных. М.: Наука, 2024.</w:t></w:r></w:p>
      <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:left="1701" w:right="567" w:top="1134" w:bottom="1134"/></w:sectPr>
    </w:body>
  </w:document>`,
  pmProfile,
  wordNumberingStylesXml,
  wordNumberingXml
);
const wordNumberingReport = runChecks({ document: wordNumberingDocument, profile: pmProfile, visualLayer, inputMode: "docxOnly" });
assert(wordNumberingDocument.captions.some((caption) => caption.kind === "figure" && caption.number === "1" && caption.title === "Структура датасета" && caption.source === "word-numbering"), "Авто-нумерованная подпись Рисунок 1 должна восстановиться из numbering.xml.");
assert(wordNumberingDocument.paragraphs.some((paragraph) => paragraph.role === "figureCaption" && paragraph.renderedText === "Рисунок 1 — Структура датасета"), "Абзац подписи должен получить renderedText и роль figureCaption.");
assert(wordNumberingReport.debug?.detectedCaptions.some((caption) => caption.type === "figure" && caption.source === "word-numbering"), "Debug должен показывать source=word-numbering.");
assert(!wordNumberingReport.issues.some((issue) => issue.code === "PM_FIGURE_BROKEN_REFERENCE"), "Ссылка на Рисунок 1 не должна считаться битой.");
assert(wordNumberingDocument.captions.some((caption) => caption.kind === "formula" && caption.number === "1"), "Номер Office Math формулы (1) должен распознаваться.");
assert(!wordNumberingReport.issues.some((issue) => issue.code === "PM_FORMULA_BROKEN_REFERENCE"), "Ссылка на формулу (1) не должна считаться битой.");
assert(!wordNumberingReport.issues.some((issue) => issue.category === "typography" && issue.location.paragraphIndex === 4), "Подпись с текстом «Excel файл» не должна проверяться как основной текст.");

const headingNumberingStylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="PMHeading1">
    <w:name w:val="Заголовок первого уровня ПМ"/>
    <w:pPr><w:outlineLvl w:val="0"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="77"/></w:numPr></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="PMHeading2">
    <w:name w:val="Заголовок второго уровня ПМ"/>
    <w:pPr><w:outlineLvl w:val="1"/><w:numPr><w:ilvl w:val="1"/><w:numId w:val="77"/></w:numPr></w:pPr>
  </w:style>
</w:styles>`;

const headingNumberingXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="77">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1"/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="77"><w:abstractNumId w:val="77"/></w:num>
</w:numbering>`;

const headingNumberingDocument = buildParsedDocumentWithParts(
  `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>Содержание</w:t></w:r></w:p>
      <w:p><w:r><w:t>1 ГЛАВА. Первая глава 1</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.1 Первый подраздел 2</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.2 Второй подраздел 3</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.3 Третий подраздел 4</w:t></w:r></w:p>
      <w:p><w:r><w:t>2 ГЛАВА. Вторая глава 5</w:t></w:r></w:p>
      <w:p><w:r><w:t>2.1 Первый подраздел второй главы 6</w:t></w:r></w:p>
      <w:p><w:r><w:t>2.2 Второй подраздел второй главы 7</w:t></w:r></w:p>
      <w:p><w:r><w:t>3 ГЛАВА. Третья глава 8</w:t></w:r></w:p>
      <w:p><w:r><w:t>3.1 Первый подраздел третьей главы 9</w:t></w:r></w:p>
      <w:p><w:r><w:t>3.2 Второй подраздел третьей главы 10</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading1"/></w:pPr><w:r><w:t>ГЛАВА. Первая глава</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading2"/></w:pPr><w:r><w:t>Первый подраздел</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading2"/></w:pPr><w:r><w:t>Второй подраздел</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading2"/></w:pPr><w:r><w:t>Третий подраздел</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading1"/></w:pPr><w:r><w:t>ГЛАВА. Вторая глава</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading2"/></w:pPr><w:r><w:t>Первый подраздел второй главы</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading2"/></w:pPr><w:r><w:t>Второй подраздел второй главы</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading1"/></w:pPr><w:r><w:t>ГЛАВА. Третья глава</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading2"/></w:pPr><w:r><w:t>Первый подраздел третьей главы</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="PMHeading2"/></w:pPr><w:r><w:t>Второй подраздел третьей главы</w:t></w:r></w:p>
    </w:body>
  </w:document>`,
  pmProfile,
  headingNumberingStylesXml,
  headingNumberingXml
);
const reconstructedHeadings = headingNumberingDocument.headings.filter((heading) => heading.parsedHeading?.numberingSource === "word-numbering");
assert(reconstructedHeadings[1]?.parsedHeading?.finalNumber === "1.1", "Первый подраздел первой главы должен иметь номер 1.1.");
assert(reconstructedHeadings[2]?.parsedHeading?.finalNumber === "1.2", "Второй подраздел первой главы должен иметь номер 1.2.");
assert(reconstructedHeadings[3]?.parsedHeading?.finalNumber === "1.3", "Третий подраздел первой главы должен иметь номер 1.3.");
assert(reconstructedHeadings[5]?.parsedHeading?.finalNumber === "2.1", "Первый подраздел второй главы должен иметь номер 2.1.");
assert(headingNumberingDocument.headingNumbering?.reliability === "high", "Иерархическая нумерация заголовков должна быть надёжной.");
const headingNumberingReport = runChecks({ document: headingNumberingDocument, profile: pmProfile, visualLayer, inputMode: "docxOnly" });
assert(!headingNumberingReport.issues.some((issue) => issue.code === "SINGLE_SUBSECTION"), "Корректная иерархия не должна давать ложный SINGLE_SUBSECTION.");

const tableAccusativeDocument = buildParsedDocument(
  `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>Содержание</w:t></w:r></w:p>
      <w:p><w:r><w:t>Введение</w:t></w:r></w:p>
      <w:p><w:r><w:t>Также результаты расчета сведены в Таблицу 4.</w:t></w:r></w:p>
      <w:p><w:r><w:t>Таблица 4 — Описательные статистики</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Данные</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:r><w:t>Заключение</w:t></w:r></w:p>
      <w:p><w:r><w:t>СПИСОК ИСТОЧНИКОВ</w:t></w:r></w:p>
      <w:p><w:r><w:t>1. Иванов И. И. Анализ данных. М.: Наука, 2024.</w:t></w:r></w:p>
    </w:body>
  </w:document>`,
  pmProfile
);
const tableAccusativeReport = runChecks({ document: tableAccusativeDocument, profile: pmProfile, visualLayer, inputMode: "docxOnly" });
assert(tableAccusativeDocument.references.some((reference) => reference.kind === "table" && reference.number === "4"), "Форма «Таблицу 4» должна распознаваться как ссылка на таблицу 4.");
assert(!tableAccusativeReport.issues.some((issue) => issue.code === "PM_TABLE_REFERENCE_MISSING" && issue.objectNumber === "4"), "Для таблицы 4 не должно быть PM_TABLE_REFERENCE_MISSING.");

const numericRangeSourceDocument = buildParsedDocument(
  `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>Содержание</w:t></w:r></w:p>
      <w:p><w:r><w:t>Введение</w:t></w:r></w:p>
      <w:p><w:r><w:t>Среднее арифметическое число спортивных клубов равно 1704,25. Это значение почти в полтора раза превышает середину диапазона [85; 5100].</w:t></w:r></w:p>
      <w:p><w:r><w:t>Заключение</w:t></w:r></w:p>
      <w:p><w:r><w:t>СПИСОК ИСТОЧНИКОВ</w:t></w:r></w:p>
      <w:p><w:r><w:t>1. Иванов И. И. Анализ данных. М.: Наука, 2024.</w:t></w:r></w:p>
      <w:p><w:r><w:t>2. Петров П. П. Статистика. М.: Наука, 2024.</w:t></w:r></w:p>
      <w:p><w:r><w:t>3. Сидоров С. С. Информационные системы. М.: Наука, 2024.</w:t></w:r></w:p>
      <w:p><w:r><w:t>4. Кузнецов К. К. Базы данных. М.: Наука, 2024.</w:t></w:r></w:p>
      <w:p><w:r><w:t>5. Смирнов С. С. Аналитика. М.: Наука, 2024.</w:t></w:r></w:p>
    </w:body>
  </w:document>`,
  pmProfile
);
const numericRangeSourceReport = runChecks({ document: numericRangeSourceDocument, profile: pmProfile, visualLayer, inputMode: "docxOnly" });
assert(!numericRangeSourceDocument.references.some((reference) => reference.kind === "source" && (reference.number === "85" || reference.number === "5100")), "[85; 5100] не должен попадать в ссылки на источники.");
assert(!numericRangeSourceReport.issues.some((issue) => issue.code === "PM_SOURCE_REFERENCE_NOT_FOUND" && /85|5100/u.test(issue.message)), "Для [85; 5100] не должно быть PM_SOURCE_REFERENCE_NOT_FOUND.");
assert(numericRangeSourceReport.debug?.sourceReferenceCandidates?.some((candidate) => candidate.raw === "[85; 5100]" && candidate.decision === "ignored" && candidate.reason === "numeric_range_context"), "Debug должен содержать ignored-кандидат [85; 5100].");

console.log("DOCX regression test passed");
