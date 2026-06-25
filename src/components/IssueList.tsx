import type { CheckIssue } from "../types/report";
import { GroupedIssueCard } from "./GroupedIssueCard";
import { IssueCard } from "./IssueCard";
import type { ReportIssueItem } from "../utils/reportPresentation";
import { isGroupedIssue } from "../utils/reportPresentation";

interface IssueListProps {
  issues: ReportIssueItem[];
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
        isGroupedIssue(issue) ? <GroupedIssueCard group={issue} key={issue.key} /> : <IssueCard issue={issue as CheckIssue} key={issue.id} />
      ))}
    </section>
  );
}
