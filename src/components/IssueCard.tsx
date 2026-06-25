import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { CheckIssue } from "../types/report";
import { confidenceLabel } from "../utils/confidence";

interface IssueCardProps {
  issue: CheckIssue;
}

const levelLabels: Record<CheckIssue["level"], string> = {
  critical: "Критическое",
  error: "Ошибка",
  warning: "Предупреждение",
  info: "Информация"
};

export function IssueCard({ issue }: IssueCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`issue-card ${issue.level}`}>
      <div className="issue-header">
        <div>
          <span className={`pill ${issue.level}`}>{levelLabels[issue.level]}</span>
          <h3 style={{ marginTop: 10 }}>{issue.message}</h3>
        </div>
        <button className="icon-button" type="button" onClick={() => setOpen((value) => !value)} title={open ? "Свернуть" : "Развернуть"}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      <div className="issue-meta">
        <span className="pill">{issue.code}</span>
        <span className="pill">{issue.category}</span>
        <span className="pill">{confidenceLabel(issue.confidence)}</span>
        <span className="pill">{issue.source}</span>
        {issue.occurrences && issue.occurrences.length > 1 && <span className="pill">{issue.occurrences.length} упоминания</span>}
        {issue.canBeFalsePositive && <span className="pill">требует проверки</span>}
      </div>
      {issue.excerpt && <p className="muted">«{issue.excerpt}»</p>}
      <p>
        <strong>Как исправить:</strong> {issue.recommendation}
      </p>
      {open && (
        <div className="details-grid">
          <div className="detail">
            <span>Раздел</span>
            {issue.location.section ?? "Не определен"}
          </div>
          <div className="detail">
            <span>Абзац</span>
            {issue.location.paragraphIndex !== undefined ? issue.location.paragraphIndex + 1 : "Не определен"}
          </div>
          <div className="detail">
            <span>Примерная страница</span>
            {issue.location.estimatedPage ?? "Не определена"}
          </div>
          <div className="detail">
            <span>Точная страница PDF</span>
            {issue.location.page ?? "Не сопоставлена"}
          </div>
          <div className="detail">
            <span>Профиль правил</span>
            {issue.ruleProfile}
          </div>
          <div className="detail">
            <span>Почему найдено</span>
            {issue.whyDetected ?? issue.reason ?? "Замечание сформировано по данным DOCX и активному профилю правил."}
          </div>
          {issue.parserEvidence && (
            <div className="detail">
              <span>Данные парсера</span>
              {issue.parserEvidence}
            </div>
          )}
          {issue.expected && (
            <div className="detail">
              <span>Ожидается</span>
              {issue.expected}
            </div>
          )}
          {issue.actual && (
            <div className="detail">
              <span>Фактически</span>
              {issue.actual}
            </div>
          )}
          {issue.occurrences && issue.occurrences.length > 0 && (
            <div className="detail">
              <span>Упоминания</span>
              {issue.occurrences.length}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
