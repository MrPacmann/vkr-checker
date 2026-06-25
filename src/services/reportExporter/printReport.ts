import type { CheckReport } from "../../types/report";
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

export function buildShortReportText(report: CheckReport): string {
  return [
    `Проверка ВКР: ${report.fileName}`,
    `Режим: ${report.inputMode}`,
    `Профиль: ${report.profileName}`,
    `Соответствие: ${report.score}%`,
    `Надёжность score: ${report.scoreReliability ?? "не определена"}`,
    `Критические: ${report.stats.critical}, ошибки: ${report.stats.errors}, предупреждения: ${report.stats.warnings}, информация: ${report.stats.info}`,
    `Визуальный слой: ${report.visualLayerMode}`,
    `Сформировано: ${new Date(report.generatedAt).toLocaleString("ru-RU")}`
  ].join("\n");
}
