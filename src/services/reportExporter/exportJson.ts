import type { CheckReport } from "../../types/report";
import { downloadBlob } from "../../utils/file";
import { groupIssues } from "../../utils/reportPresentation";

export function exportReportJson(report: CheckReport): void {
  const exportPayload = {
    ...report,
    groupedIssues: groupIssues(report.issues)
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json;charset=utf-8" });
  const safeName = report.fileName.replace(/\.docx$/iu, "");
  downloadBlob(blob, `${safeName}-report.json`);
}
