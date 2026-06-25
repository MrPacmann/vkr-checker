import { Search } from "lucide-react";
import { useMemo, useState } from "react";

interface HelpSection {
  title: string;
  items: string[];
}

const helpSections: HelpSection[] = [
  {
    title: "Заголовки",
    items: [
      "Было: «1.1 Название раздела.»",
      "Нужно: «1.1 Название раздела»",
      "Точка в конце заголовка не ставится."
    ]
  },
  {
    title: "Рисунки",
    items: [
      "Перед рисунком должна быть ссылка в тексте: «Результат представлен на рисунке 3.»",
      "Подпись оформляется так: «Рисунок 3 — Название рисунка».",
      "Если рисунок находится в приложении, обычно используется номер вида «Рисунок А.1»."
    ]
  },
  {
    title: "Таблицы",
    items: [
      "Перед таблицей должна быть ссылка: «Данные представлены в таблице 2.»",
      "Подпись размещается над таблицей.",
      "Типовая подпись: «Таблица 2 — Название таблицы»."
    ]
  },
  {
    title: "Источники",
    items: [
      "Если источник есть в списке, на него должна быть ссылка в тексте.",
      "Пример ссылки: «[1]».",
      "Если источник не используется, его лучше удалить из списка или добавить корректную ссылку."
    ]
  },
  {
    title: "Приложения",
    items: [
      "Ссылка в тексте: «см. приложение А».",
      "Заголовок приложения: «ПРИЛОЖЕНИЕ А».",
      "Для объектов в приложениях желательно использовать нумерацию вида «Рисунок А.1»."
    ]
  },
  {
    title: "Формулы",
    items: [
      "Перед формулой или после неё должна быть ссылка в тексте: «по формуле (1)».",
      "Номер формулы указывается в круглых скобках.",
      "Не используйте один и тот же номер для разных формул."
    ]
  },
  {
    title: "Листинги",
    items: [
      "Ссылка в тексте: «в листинге 1».",
      "Подпись оформляется так: «Листинг 1 — Название».",
      "Нумерация листингов должна быть последовательной."
    ]
  },
  {
    title: "Поля и основной текст",
    items: [
      "Проверьте формат A4, поля, шрифт, размер, межстрочный интервал и абзацный отступ.",
      "Не выравнивайте текст вручную большим количеством пробелов.",
      "Удалите лишние пустые абзацы, если они не нужны для структуры документа."
    ]
  }
];

export function HelpPage() {
  const [query, setQuery] = useState("");
  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return helpSections;
    return helpSections.filter((section) => [section.title, ...section.items].join(" ").toLowerCase().includes(normalizedQuery));
  }, [query]);

  return (
    <div className="grid">
      <section>
        <p className="eyebrow">Справочник</p>
        <h1 style={{ fontSize: 44 }}>Как исправить ошибки</h1>
        <p className="lead">Краткие подсказки по типовым замечаниям, которые появляются в отчёте проверки.</p>
      </section>

      <section className="tool-panel">
        <label>
          <span className="muted">Поиск по ошибкам</span>
          <span className="search-field">
            <Search size={18} />
            <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например: рисунки, источники, заголовки" />
          </span>
        </label>
      </section>

      <section className="help-grid">
        {filteredSections.map((section) => (
          <article className="tool-panel" key={section.title}>
            <h2>{section.title}</h2>
            <ul className="compact-list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
