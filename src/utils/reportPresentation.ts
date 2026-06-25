import type { CheckIssue, CheckReport } from "../types/report";
import type { IssueLevel } from "../types/rules";
import type { WorkType } from "../types/settings";
import { confidenceLabel } from "./confidence";

export interface GroupedIssue {
  key: string;
  code: string;
  level: IssueLevel;
  category?: CheckIssue["category"];
  message: string;
  count: number;
  representative: CheckIssue;
  occurrences: CheckIssue[];
  grouped: true;
}

export type ReportIssueItem = CheckIssue | GroupedIssue;

export interface ReportSummary {
  statusText: string;
  topIssues: string[];
  groupedIssues: ReportIssueItem[];
}

const workTypeLabels: Record<WorkType, string> = {
  coursework: "курсовая работа",
  practiceReport: "отчёт по практике",
  bachelorThesis: "ВКР бакалавра",
  masterThesis: "ВКР магистра",
  generic: "универсальная учебная работа"
};

const levelLabels: Record<IssueLevel, string> = {
  critical: "Критические",
  error: "Ошибки",
  warning: "Предупреждения",
  info: "Информация"
};

const levelWeight: Record<IssueLevel, number> = {
  critical: 4,
  error: 3,
  warning: 2,
  info: 1
};

export function isGroupedIssue(item: ReportIssueItem): item is GroupedIssue {
  return "grouped" in item && item.grouped === true;
}

function groupKey(issue: CheckIssue): string {
  return `${issue.code}::${issue.category}`;
}

function groupedMessage(issue: CheckIssue, count: number): string {
  const code = issue.code.toUpperCase();
  if (code.includes("FIGURE") && code.includes("REFERENCE") && (code.includes("MISSING") || code.includes("WITHOUT"))) {
    return `Найдено ${count} замечаний по ссылкам на рисунки.`;
  }
  if (code.includes("TABLE") && code.includes("REFERENCE") && (code.includes("MISSING") || code.includes("WITHOUT"))) {
    return `Найдено ${count} замечаний по ссылкам на таблицы.`;
  }
  if (code.includes("HEADING") && (code.includes("DOT") || code.includes("PERIOD"))) {
    return `Найдено ${count} заголовков с точкой в конце.`;
  }
  if (code.includes("SOURCE") || code.includes("BIBLIOGRAPHY")) {
    return `Найдено ${count} однотипных замечаний по источникам.`;
  }
  if (code.includes("EMPTY_PARAGRAPH") || code.includes("BLANK_PARAGRAPH")) {
    return `Найдено ${count} лишних пустых абзацев.`;
  }
  if (code.includes("NUMBERING")) {
    return `Найдено ${count} однотипных замечаний по нумерации.`;
  }
  if (issue.category === "formatting" || issue.category === "typography" || issue.category === "pageLayout") {
    return `Найдено ${count} однотипных замечаний по оформлению.`;
  }
  return `Найдено ${count} однотипных замечаний: ${issue.message}`;
}

export function groupIssues(issues: CheckIssue[]): ReportIssueItem[] {
  const buckets = new Map<string, CheckIssue[]>();
  for (const issue of issues) {
    const key = groupKey(issue);
    buckets.set(key, [...(buckets.get(key) ?? []), issue]);
  }

  const grouped: ReportIssueItem[] = [];
  const consumed = new Set<string>();
  for (const issue of issues) {
    const key = groupKey(issue);
    if (consumed.has(key)) continue;
    consumed.add(key);
    const bucket = buckets.get(key) ?? [issue];
    if (bucket.length > 3) {
      grouped.push({
        key,
        code: issue.code,
        level: issue.level,
        category: issue.category,
        message: groupedMessage(issue, bucket.length),
        count: bucket.length,
        representative: issue,
        occurrences: bucket,
        grouped: true
      });
    } else {
      grouped.push(...bucket);
    }
  }
  return grouped;
}

function itemWeight(item: ReportIssueItem): number {
  const count = isGroupedIssue(item) ? item.count : 1;
  return levelWeight[item.level] * 1000 + count;
}

function itemText(item: ReportIssueItem): string {
  if (isGroupedIssue(item)) return item.message;
  return item.message;
}

export function buildReportSummary(report: CheckReport): ReportSummary {
  const groupedIssues = groupIssues(report.issues);
  let statusText = "Замечаний не обнаружено.";
  if (report.stats.critical > 0 || report.stats.errors > 0) {
    statusText = "Документ требует обязательных исправлений.";
  } else if (report.stats.warnings > 0) {
    statusText = "Документ в целом может быть принят, но требует проверки отдельных замечаний.";
  } else if (report.stats.info > 0) {
    statusText = "Критических замечаний не обнаружено.";
  }

  const important = groupedIssues
    .filter((item) => item.level !== "info")
    .sort((a, b) => itemWeight(b) - itemWeight(a))
    .slice(0, 3)
    .map(itemText);
  const fallback = [...groupedIssues]
    .sort((a, b) => itemWeight(b) - itemWeight(a))
    .slice(0, 3)
    .map(itemText);

  return {
    statusText,
    topIssues: important.length > 0 ? important : fallback,
    groupedIssues
  };
}

function safeWorkType(report: CheckReport): string {
  return report.debug?.activeWorkType ? workTypeLabels[report.debug.activeWorkType] : "не указан";
}

function safeLine(value: string | number | null | undefined): string {
  return String(value ?? "не указано").replace(/\s+/g, " ").trim();
}

function markdownEscape(value: string | number | null | undefined): string {
  return safeLine(value).replace(/[\\`*_{}\[\]()#+.!|-]/g, "\\$&");
}

function issueLocation(issue: CheckIssue): string {
  const page = issue.location.page ?? issue.location.estimatedPage;
  const parts = [
    issue.location.section,
    issue.location.paragraphIndex !== undefined ? `абзац ${issue.location.paragraphIndex + 1}` : null,
    page ? `страница ${page}` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "место не определено";
}

export function buildShortReportText(report: CheckReport): string {
  const summary = buildReportSummary(report);
  const topIssues = summary.topIssues.length > 0 ? summary.topIssues.map((item, index) => `${index + 1}. ${item}`).join("\n") : "Нет важных замечаний.";

  return [
    "Предварительная проверка оформления",
    "",
    `Файл: ${report.fileName}`,
    `Профиль: ${report.profileName}`,
    `Тип работы: ${safeWorkType(report)}`,
    `Соответствие: ${report.score}%`,
    `Критические: ${report.stats.critical}`,
    `Ошибки: ${report.stats.errors}`,
    `Предупреждения: ${report.stats.warnings}`,
    `Информация: ${report.stats.info}`,
    "",
    "Краткое резюме:",
    summary.statusText,
    "",
    "Основные замечания:",
    topIssues,
    "",
    "Примечание: автоматическая проверка не заменяет ручной нормоконтроль."
  ].join("\n");
}

export function buildMarkdownReport(report: CheckReport): string {
  const summary = buildReportSummary(report);
  const importantIssues = summary.topIssues.length > 0 ? summary.topIssues.map((item, index) => `${index + 1}. ${markdownEscape(item)}`).join("\n") : "Важных замечаний не найдено.";
  const allIssues = summary.groupedIssues
    .map((item) => {
      if (isGroupedIssue(item)) {
        const occurrences = item.occurrences
          .slice(0, 20)
          .map((issue) => `  - ${markdownEscape(issue.message)} (${markdownEscape(issueLocation(issue))})`)
          .join("\n");
        const tail = item.occurrences.length > 20 ? `\n  - ... ещё ${item.occurrences.length - 20}` : "";
        return `### ${markdownEscape(item.level)} — ${markdownEscape(item.category ?? item.code)}\n\n${markdownEscape(item.message)}\n\nКоличество: ${item.count}\n\n${occurrences}${tail}`;
      }
      return `### ${markdownEscape(item.level)} — ${markdownEscape(item.category)}\n\n${markdownEscape(item.message)}\n\n- Код: ${markdownEscape(item.code)}\n- Достоверность: ${markdownEscape(confidenceLabel(item.confidence))}\n- Место: ${markdownEscape(issueLocation(item))}\n- Рекомендация: ${markdownEscape(item.recommendation)}`;
    })
    .join("\n\n");

  return [
    "# Отчёт предварительной проверки документа",
    "",
    `Файл: ${markdownEscape(report.fileName)}`,
    `Дата проверки: ${markdownEscape(new Date(report.generatedAt).toLocaleString("ru-RU"))}`,
    `Профиль: ${markdownEscape(report.profileName)}`,
    `Тип работы: ${markdownEscape(safeWorkType(report))}`,
    `Соответствие: ${report.score}%`,
    "",
    "## Сводка",
    "",
    `- Критические: ${report.stats.critical}`,
    `- Ошибки: ${report.stats.errors}`,
    `- Предупреждения: ${report.stats.warnings}`,
    `- Информация: ${report.stats.info}`,
    `- Надёжность score: ${markdownEscape(report.scoreReliability ?? "не определена")}`,
    "",
    "## Краткое резюме",
    "",
    markdownEscape(summary.statusText),
    "",
    "## Основные замечания",
    "",
    importantIssues,
    "",
    "## Все замечания",
    "",
    allIssues || "Замечаний не найдено.",
    "",
    "## Примечание",
    "",
    "Проверка предварительная и не заменяет ручной нормоконтроль."
  ].join("\n");
}

export { workTypeLabels, levelLabels };
