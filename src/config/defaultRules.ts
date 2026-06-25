import type { RuleDefinition } from "../types/rules";

export const defaultRules: RuleDefinition[] = [
  {
    code: "REQUIRED_SECTIONS",
    title: "Обязательные разделы",
    description: "Проверяет наличие обязательных разделов и допустимых альтернатив.",
    category: "structure",
    enabledKey: "requiredSections"
  },
  {
    code: "SECTION_ORDER",
    title: "Порядок разделов",
    description: "Проверяет, что обязательные разделы идут в ожидаемом порядке.",
    category: "structure",
    enabledKey: "sectionOrder"
  },
  {
    code: "HEADING_NUMBERING",
    title: "Нумерация заголовков",
    description: "Проверяет разрывы, пустые и повторяющиеся заголовки.",
    category: "headings",
    enabledKey: "headingNumbering"
  },
  {
    code: "PAGE_LAYOUT",
    title: "Параметры страницы",
    description: "Проверяет формат, ориентацию и поля страниц по данным DOCX.",
    category: "pageLayout",
    enabledKey: "pageLayout"
  },
  {
    code: "TYPOGRAPHY",
    title: "Типографика основного текста",
    description: "Проверяет шрифт, размер, интервал, отступ и выравнивание.",
    category: "typography",
    enabledKey: "typography"
  },
  {
    code: "CAPTIONS_REFERENCES",
    title: "Подписи и ссылки",
    description: "Проверяет рисунки, таблицы, формулы, листинги и ссылки на них.",
    category: "references",
    enabledKey: "brokenReferences"
  },
  {
    code: "BIBLIOGRAPHY",
    title: "Список источников",
    description: "Проверяет наличие, нумерацию, минимальное количество и ссылки.",
    category: "bibliography",
    enabledKey: "bibliographyPresence"
  }
];
