import type { DocumentCaption, DocumentParagraph, DocumentReference, ParsedDocument } from "../types/document";
import type { StylesModel } from "../types/styles";
import { createId } from "../utils/id";
import { countWords } from "../utils/text";
import { estimatePagesByText } from "../utils/pageEstimator";

export interface DemoDocument {
  id: string;
  title: string;
  description: string;
  document: ParsedDocument;
}

const styles: StylesModel = {
  styles: {},
  defaults: {
    runFormat: { fontFamily: "Times New Roman", fontSizePt: 14 },
    paragraphFormat: { alignment: "justify", firstLineIndentCm: 1.25, lineSpacing: 1.5 }
  }
};

function paragraph(index: number, text: string, isHeading = false, sectionTitle?: string): DocumentParagraph {
  return {
    index,
    text,
    renderedText: text,
    isHeading,
    headingLevel: isHeading ? 1 : undefined,
    styleName: isHeading ? "Heading 1" : "Normal",
    runs: [{ text, format: { fontFamily: "Times New Roman", fontSizePt: 14 } }],
    format: { alignment: "justify", firstLineIndentCm: 1.25, lineSpacing: 1.5 },
    inheritedRunFormat: { fontFamily: "Times New Roman", fontSizePt: 14 },
    sectionTitle
  };
}

function buildDocument(id: string, title: string, paragraphsInput: Array<{ text: string; heading?: boolean }>, extras: Partial<ParsedDocument> = {}): DemoDocument {
  let currentSection: string | undefined;
  const paragraphs = paragraphsInput.map((item, index) => {
    const p = paragraph(index, item.text, Boolean(item.heading), currentSection);
    if (item.heading) currentSection = item.text;
    return { ...p, sectionTitle: currentSection };
  });
  const plainText = paragraphs.map((item) => item.text).join("\n");
  const headings = paragraphs.filter((item) => item.isHeading);
  const document: ParsedDocument = {
    fileName: `${id}.docx`,
    fileSize: plainText.length,
    metadata: {},
    paragraphs,
    headings,
    styles,
    tables: [],
    images: [],
    captions: [],
    references: [],
    bibliography: [],
    headerTexts: [],
    footerTexts: [],
    footnotes: [],
    endnotes: [],
    relationships: {},
    sectionLayouts: [
      {
        pageSize: "A4",
        orientation: "portrait",
        margins: { leftMm: 30, rightMm: 15, topMm: 20, bottomMm: 20 },
        pageWidthMm: 210,
        pageHeightMm: 297
      }
    ],
    plainText,
    warnings: ["Это встроенный демо-документ, созданный для проверки алгоритмов."],
    stats: {
      words: countWords(plainText),
      paragraphs: paragraphs.length,
      sections: headings.length,
      estimatedPages: estimatePagesByText(plainText),
      detectedPages: null,
      figures: 0,
      tables: 0,
      formulas: 0,
      listings: 0,
      schemes: 0,
      sources: 0,
      sourceReferences: 0,
      figureReferences: 0,
      tableReferences: 0,
      formulaReferences: 0,
      listingReferences: 0
    },
    ...extras
  };
  return {
    id,
    title,
    description: title,
    document
  };
}

function caption(kind: DocumentCaption["kind"], number: string, paragraphIndex: number, text: string): DocumentCaption {
  return {
    id: createId("demo-caption"),
    kind,
    number,
    title: text.replace(/^[^—–-]+[—–-]\s*/u, ""),
    paragraphIndex,
    text,
    validFormat: /[—–-]/u.test(text)
  };
}

function reference(kind: DocumentReference["kind"], number: string, paragraphIndex: number, text: string): DocumentReference {
  return { id: createId("demo-ref"), kind, number, paragraphIndex, text };
}

const baseParagraphs = [
  { text: "РЕФЕРАТ", heading: true },
  { text: "Работа посвящена проектированию информационной системы и содержит основные результаты исследования." },
  { text: "СОДЕРЖАНИЕ", heading: true },
  { text: "1 Введение 2 Проектирование системы 3 Заключение" },
  { text: "ВВЕДЕНИЕ", heading: true },
  { text: "Актуальность темы обусловлена необходимостью автоматизации проверки оформления документов." },
  { text: "1 Проектирование системы", heading: true },
  { text: "В разделе рассматриваются требования, архитектура и пользовательские сценарии." },
  { text: "ЗАКЛЮЧЕНИЕ", heading: true },
  { text: "В результате работы разработан прототип системы и проведена оценка применимости." },
  { text: "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ", heading: true },
  { text: "1. Иванов И.И. Основы проектирования информационных систем. М.: Пример, 2021." },
  { text: "2. Петров П.П. Документирование программных систем. СПб.: Пример, 2022." }
];

export const demoDocuments: DemoDocument[] = [
  buildDocument("demo-no-introduction", "Документ без введения", baseParagraphs.filter((item) => item.text !== "ВВЕДЕНИЕ")),
  buildDocument("demo-no-bibliography", "Документ без списка источников", baseParagraphs.filter((item) => item.text !== "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ" && !/^\d\./u.test(item.text))),
  buildDocument(
    "demo-broken-figure-ref",
    "Неправильная ссылка на рисунок",
    [...baseParagraphs.slice(0, 8), { text: "Архитектура показана на рисунке 5, однако подпись отсутствует." }, ...baseParagraphs.slice(8)],
    { references: [reference("figure", "5", 8, "рисунке 5")] }
  ),
  buildDocument(
    "demo-table-without-ref",
    "Таблица без ссылки",
    [...baseParagraphs.slice(0, 8), { text: "Таблица 1 — Сравнение решений" }, { text: "Критерий Значение" }, ...baseParagraphs.slice(8)],
    { captions: [caption("table", "1", 8, "Таблица 1 — Сравнение решений")] }
  ),
  buildDocument(
    "demo-bad-source-numbering",
    "Нарушенная нумерация источников",
    baseParagraphs,
    {
      bibliography: [
        { number: 1, text: "1. Иванов И.И. Источник.", paragraphIndex: 11 },
        { number: 3, text: "3. Петров П.П. Источник.", paragraphIndex: 12 }
      ],
      references: [reference("source", "1", 7, "[1]")]
    }
  ),
  buildDocument(
    "demo-formula-without-ref",
    "Формула без ссылки",
    [...baseParagraphs.slice(0, 8), { text: "E = mc2 (1)" }, ...baseParagraphs.slice(8)],
    { captions: [caption("formula", "1", 8, "E = mc2 (1)")] }
  ),
  buildDocument("demo-wrong-font", "Неправильный шрифт", baseParagraphs, {
    paragraphs: baseParagraphs.map((item, index) => ({
      ...paragraph(index, item.text, Boolean(item.heading)),
      inheritedRunFormat: { fontFamily: "Arial", fontSizePt: 14 },
      sectionTitle: item.heading ? item.text : undefined
    }))
  }),
  buildDocument("demo-wrong-margins", "Неправильные поля", baseParagraphs, {
    sectionLayouts: [{ pageSize: "A4", orientation: "portrait", margins: { leftMm: 20, rightMm: 20, topMm: 20, bottomMm: 20 }, pageWidthMm: 210, pageHeightMm: 297 }]
  }),
  buildDocument("demo-empty-heading", "Пустой заголовок", [...baseParagraphs.slice(0, 6), { text: "", heading: true }, ...baseParagraphs.slice(6)]),
  buildDocument(
    "demo-duplicate-figures",
    "Повторяющиеся номера рисунков",
    [...baseParagraphs.slice(0, 8), { text: "Рисунок 1 — Архитектура" }, { text: "Рисунок 1 — Интерфейс" }, ...baseParagraphs.slice(8)],
    { captions: [caption("figure", "1", 8, "Рисунок 1 — Архитектура"), caption("figure", "1", 9, "Рисунок 1 — Интерфейс")] }
  )
].map((demo) => {
  const document = demo.document;
  document.stats = {
    ...document.stats,
    words: countWords(document.plainText),
    paragraphs: document.paragraphs.length,
    sections: document.headings.length,
    figures: document.captions.filter((item) => item.kind === "figure").length,
    tables: document.captions.filter((item) => item.kind === "table").length,
    formulas: document.captions.filter((item) => item.kind === "formula").length,
    listings: document.captions.filter((item) => item.kind === "listing").length,
    schemes: document.captions.filter((item) => item.kind === "scheme").length,
    sources: document.bibliography.length,
    sourceReferences: document.references.filter((item) => item.kind === "source").length,
    figureReferences: document.references.filter((item) => item.kind === "figure").length,
    tableReferences: document.references.filter((item) => item.kind === "table").length,
    formulaReferences: document.references.filter((item) => item.kind === "formula").length,
    listingReferences: document.references.filter((item) => item.kind === "listing").length
  };
  return demo;
});
