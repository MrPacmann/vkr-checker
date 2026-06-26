import { useEffect, useState } from "react";

interface RegexEditorProps {
  title: string;
  patterns: Record<string, string>;
  defaultPatterns: Record<string, string>;
  descriptions: Record<string, string>;
  disabled?: boolean;
  onChange: (patterns: Record<string, string>) => void;
}

const labels: Record<string, string> = {
  figure: "Рисунки",
  table: "Таблицы",
  listing: "Листинги",
  formula: "Формулы",
  source: "Источники",
  appendix: "Приложения"
};

export function RegexEditor({ title, patterns, defaultPatterns, descriptions, disabled, onChange }: RegexEditorProps) {
  const [drafts, setDrafts] = useState(patterns);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts(patterns);
    setErrors({});
  }, [patterns]);

  const updatePattern = (key: string, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
    try {
      new RegExp(value, key === "appendix" ? "gu" : "giu");
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      onChange({ ...patterns, [key]: value });
    } catch {
      setErrors((current) => ({ ...current, [key]: "Некорректное регулярное выражение." }));
    }
  };

  const resetPattern = (key: string) => {
    const value = defaultPatterns[key];
    if (!value) return;
    setDrafts((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    onChange({ ...patterns, [key]: value });
  };

  return (
    <div>
      <h3>{title}</h3>
      <div className="grid">
        {Object.entries(patterns).map(([key, value]) => (
          <label key={key}>
            <span className="muted">{labels[key] ?? key}</span>
            <small className="muted">{descriptions[key]}</small>
            <input className="field" value={drafts[key] ?? value} disabled={disabled} onChange={(event) => updatePattern(key, event.target.value)} />
            {errors[key] && <span className="pill error">{errors[key]}</span>}
            {!disabled && (
              <button className="button" type="button" onClick={() => resetPattern(key)} style={{ marginTop: 6 }}>
                Сбросить поле
              </button>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
