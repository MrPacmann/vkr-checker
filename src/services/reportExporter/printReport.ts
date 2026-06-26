import type { CheckReport } from "../../types/report";
import { buildShortReportText } from "../../utils/reportPresentation";

export function printReport(report: CheckReport): void {
  void report;
  window.print();
}

export { buildShortReportText };
