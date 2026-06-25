import type { CheckReport } from "../types/report";

interface CheckSummaryProps {
  report: CheckReport;
}

const reliabilityLabels: Record<NonNullable<CheckReport["scoreReliability"]>, string> = {
  reliable: "надёжная",
  limited: "ограниченная",
  unreliable: "ненадёжная"
};

export function CheckSummary({ report }: CheckSummaryProps) {
  const metrics = [
    ["Соответствие", `${report.score}%`],
    ["Надёжность score", report.scoreReliability ? reliabilityLabels[report.scoreReliability] : "не определена"],
    ["Критические", report.stats.critical],
    ["Ошибки", report.stats.errors],
    ["Предупреждения", report.stats.warnings],
    ["Информация", report.stats.info],
    ["Точные проверки", report.checks.passed],
    ["Частичные", report.checks.partial],
    ["Ручная проверка", report.stats.manualReview]
  ];
  return (
    <section className="tool-panel">
      <h2>Результат проверки</h2>
      <div className="metrics-grid">
        {metrics.map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="muted">{report.scoreExplanation}</p>
    </section>
  );
}
