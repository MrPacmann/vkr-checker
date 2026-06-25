import type { CheckIssue } from "../types/report";
import { IssueCard } from "./IssueCard";

interface IssueListProps {
  issues: CheckIssue[];
}

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <section className="tool-panel">
        <h3>Замечаний по выбранным фильтрам нет</h3>
        <p className="muted">Измените фильтры или проверьте полный отчет.</p>
      </section>
    );
  }
  return (
    <section className="issue-list">
      {issues.map((issue) => (
        <IssueCard issue={issue} key={issue.id} />
      ))}
    </section>
  );
}
