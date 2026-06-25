import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { confidenceLabel } from "../utils/confidence";
import type { GroupedIssue } from "../utils/reportPresentation";

interface GroupedIssueCardProps {
  group: GroupedIssue;
}

const levelLabels: Record<GroupedIssue["level"], string> = {
  critical: "Критическое",
  error: "Ошибка",
  warning: "Предупреждение",
  info: "Информация"
};

function issuePlace(issue: GroupedIssue["occurrences"][number]): string {
  const page = issue.location.page ?? issue.location.estimatedPage;
  const parts = [
    issue.location.section,
    issue.location.paragraphIndex !== undefined ? `абзац ${issue.location.paragraphIndex + 1}` : null,
    page ? `стр. ${page}` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "место не определено";
}

export function GroupedIssueCard({ group }: GroupedIssueCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`issue-card grouped ${group.level}`}>
      <div className="issue-header">
        <div>
          <span className={`pill ${group.level}`}>{levelLabels[group.level]}</span>
          <h3 style={{ marginTop: 10 }}>{group.message}</h3>
        </div>
        <button className="icon-button" type="button" onClick={() => setOpen((value) => !value)} title={open ? "Свернуть" : "Развернуть"}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      <div className="issue-meta">
        <span className="pill">{group.code}</span>
        {group.category && <span className="pill">{group.category}</span>}
        <span className="pill">{group.count} замечаний</span>
        <span className="pill">сгруппировано</span>
      </div>
      <p>
        <strong>Как исправить:</strong> {group.representative.recommendation}
      </p>
      {open && (
        <div className="grouped-occurrences">
          {group.occurrences.map((issue) => (
            <div className="grouped-occurrence" key={issue.id}>
              <strong>{issue.message}</strong>
              <span>{issuePlace(issue)}</span>
              <small>
                {confidenceLabel(issue.confidence)} · {issue.source}
              </small>
              {issue.excerpt && <p className="muted">«{issue.excerpt}»</p>}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
