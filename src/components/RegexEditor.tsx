interface RegexEditorProps {
  title: string;
  patterns: Record<string, string>;
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

export function RegexEditor({ title, patterns, onChange }: RegexEditorProps) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="grid">
        {Object.entries(patterns).map(([key, value]) => (
          <label key={key}>
            <span className="muted">{labels[key] ?? key}</span>
            <input className="field" value={value} onChange={(event) => onChange({ ...patterns, [key]: event.target.value })} />
          </label>
        ))}
      </div>
    </div>
  );
}
