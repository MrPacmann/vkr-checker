import type { CheckReport } from "../../types/report";
import { buildShortReportText } from "../../utils/reportPresentation";
import { buildReportHtml } from "./exportHtml";

export function printReport(report: CheckReport): void {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    window.print();
    return;
  }
  win.document.open();
  win.document.write(buildReportHtml(report));
  win.document.close();
  win.focus();
  win.print();
}

export { buildShortReportText };
