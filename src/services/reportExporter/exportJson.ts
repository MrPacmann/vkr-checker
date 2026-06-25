import type { CheckReport } from "../../types/report";
import { downloadBlob } from "../../utils/file";

export function exportReportJson(report: CheckReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
  const safeName = report.fileName.replace(/\.docx$/iu, "");
  downloadBlob(blob, `${safeName}-report.json`);
}
