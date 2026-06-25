import type { CheckReport } from "../../types/report";
import { downloadBlob } from "../../utils/file";
import { buildMarkdownReport } from "../../utils/reportPresentation";

export function exportReportMarkdown(report: CheckReport): void {
  const blob = new Blob([buildMarkdownReport(report)], { type: "text/markdown;charset=utf-8" });
  const safeName = report.fileName.replace(/\.(docx|pdf)$/iu, "");
  downloadBlob(blob, `${safeName}-report.md`);
}
