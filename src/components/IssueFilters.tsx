import type { IssueCategory, IssueLevel, Confidence } from "../types/rules";

export interface IssueFilterState {
  level: "all" | IssueLevel;
  confidence: "all" | Confidence | "manual";
  category: "all" | IssueCategory;
  query: string;
}

interface IssueFiltersProps {
  value: IssueFilterState;
  onChange: (value: IssueFilterState) => void;
}

const levels: Array<IssueFilterState["level"]> = ["all", "critical", "error", "warning", "info"];
const confidences: Array<IssueFilterState["confidence"]> = ["all", "high", "medium", "manual"];
const categories: Array<IssueFilterState["category"]> = [
  "all",
  "structure",
  "formatting",
  "headings",
  "figures",
  "tables",
  "formulas",
  "listings",
  "bibliography",
  "references",
  "visual",
  "ocr"
];

const labels: Record<string, string> = {
  all: "Все",
  critical: "critical",
  error: "error",
  warning: "warning",
  info: "info",
  high: "Высокая достоверность",
  medium: "Средняя достоверность",
  manual: "Требует ручной проверки",
  structure: "Структура",
  formatting: "Оформление",
  headings: "Заголовки",
  figures: "Рисунки",
  tables: "Таблицы",
  formulas: "Формулы",
  listings: "Листинги",
  bibliography: "Источники",
  references: "Ссылки",
  visual: "Визуальный слой",
  ocr: "OCR"
};

export function IssueFilters({ value, onChange }: IssueFiltersProps) {
  return (
    <section className="tool-panel">
      <h3>Фильтры</h3>
      <input className="search-input" value={value.query} onChange={(event) => onChange({ ...value, query: event.target.value })} placeholder="Поиск по замечаниям" />
      <div className="filters" style={{ marginTop: 12 }}>
        {levels.map((level) => (
          <button className={`filter-button ${value.level === level ? "active" : ""}`} type="button" key={level} onClick={() => onChange({ ...value, level })}>
            {labels[level]}
          </button>
        ))}
      </div>
      <div className="filters" style={{ marginTop: 12 }}>
        {confidences.map((confidence) => (
          <button
            className={`filter-button ${value.confidence === confidence ? "active" : ""}`}
            type="button"
            key={confidence}
            onClick={() => onChange({ ...value, confidence })}
          >
            {labels[confidence]}
          </button>
        ))}
      </div>
      <div className="filters" style={{ marginTop: 12 }}>
        {categories.map((category) => (
          <button
            className={`filter-button ${value.category === category ? "active" : ""}`}
            type="button"
            key={category}
            onClick={() => onChange({ ...value, category })}
          >
            {labels[category]}
          </button>
        ))}
      </div>
    </section>
  );
}
