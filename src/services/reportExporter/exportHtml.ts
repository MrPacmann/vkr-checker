import type { CheckReport } from "../../types/report";
import { confidenceLabel } from "../../utils/confidence";
import { downloadBlob } from "../../utils/file";
import { buildReportSummary, isGroupedIssue } from "../../utils/reportPresentation";
import { escapeHtml } from "../../utils/regex";
import type { WorkType } from "../../types/settings";

const workTypeLabels: Record<WorkType, string> = {
  coursework: "курсовая работа",
  practiceReport: "отчёт по практике",
  bachelorThesis: "ВКР бакалавра",
  masterThesis: "ВКР магистра",
  generic: "универсальная учебная работа"
};

function reportHeading(report: CheckReport): string {
  const workType = report.debug?.activeWorkType;
  if (workType === "coursework") return "Отчёт предварительной проверки курсовой работы";
  if (workType === "practiceReport") return "Отчёт предварительной проверки отчёта по практике";
  if (workType === "bachelorThesis" || workType === "masterThesis") return "Отчёт предварительной проверки ВКР";
  return "Отчёт предварительной проверки документа";
}

export function buildReportHtml(report: CheckReport): string {
  const summary = buildReportSummary(report);
  const summaryItems = summary.topIssues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("");
  const rows = summary.groupedIssues
    .map((item) => {
      if (isGroupedIssue(item)) {
        const occurrences = item.occurrences
          .map(
            (issue) => `<li>
              ${escapeHtml(issue.message)}
              <span class="meta"> · ${escapeHtml(issue.location.section ?? "раздел не определен")}, абзац ${
                issue.location.paragraphIndex !== undefined ? issue.location.paragraphIndex + 1 : "?"
              }, страница ${issue.location.page ?? issue.location.estimatedPage ?? "?"}</span>
            </li>`
          )
          .join("");
        return `<article class="issue ${item.level}">
          <div class="meta">${escapeHtml(item.level)} · ${escapeHtml(item.category ?? "")} · ${escapeHtml(item.code)} · сгруппировано</div>
          <h2>${escapeHtml(item.message)}</h2>
          <p><strong>Количество:</strong> ${item.count}</p>
          <p><strong>Рекомендация:</strong> ${escapeHtml(item.representative.recommendation)}</p>
          <details><summary>Показать места</summary><ul>${occurrences}</ul></details>
        </article>`;
      }
      const issue = item;
      return `<article class="issue ${issue.level}">
        <div class="meta">${escapeHtml(issue.level)} · ${escapeHtml(issue.category)} · ${escapeHtml(issue.code)} · ${escapeHtml(confidenceLabel(issue.confidence))}</div>
        <h2>${escapeHtml(issue.message)}</h2>
        <p><strong>Где:</strong> ${escapeHtml(issue.location.section ?? "раздел не определен")}, абзац ${issue.location.paragraphIndex !== undefined ? issue.location.paragraphIndex + 1 : "?"}, страница ${
          issue.location.page ?? issue.location.estimatedPage ?? "?"
        }</p>
        ${issue.excerpt ? `<p><strong>Фрагмент:</strong> ${escapeHtml(issue.excerpt)}</p>` : ""}
        <p><strong>Рекомендация:</strong> ${escapeHtml(issue.recommendation)}</p>
        <p><strong>Источник:</strong> ${escapeHtml(issue.source)} · <strong>Профиль:</strong> ${escapeHtml(issue.ruleProfile)}</p>
      </article>`;
    })
    .join("");
  const notAvailable = report.notAvailableChecks
    .map(
      (check) => `<li><strong>${escapeHtml(check.title)}</strong> (${escapeHtml(check.code)}): ${escapeHtml(check.reason)}</li>`
    )
    .join("");
  const debugSections = report.debug?.detectedSections
    .map(
      (section) =>
        `<tr><td>${section.paragraphIndex + 1}</td><td>${escapeHtml(section.normalizedText)}</td><td>${escapeHtml(section.rawText)}</td><td>${escapeHtml(
          [section.styleName, section.styleId].filter(Boolean).join(" · ")
        )}</td></tr>`
    )
    .join("");
  const debugCaptions = report.debug?.detectedCaptions
    .map(
      (caption) =>
        `<tr><td>${caption.paragraphIndex + 1}</td><td>${escapeHtml(caption.type)}</td><td>${escapeHtml(caption.number)}</td><td>${escapeHtml(caption.title)}</td><td>${escapeHtml(
          caption.rawText
        )}</td></tr>`
    )
    .join("");
  const sourceReferenceCandidates = report.debug?.sourceReferenceCandidates
    ?.map(
      (candidate) =>
        `<tr><td>${candidate.paragraphIndex + 1}</td><td>${escapeHtml(candidate.raw)}</td><td>${escapeHtml(candidate.decision)}</td><td>${escapeHtml(
          candidate.reason
        )}</td><td>${escapeHtml([candidate.contextBefore, candidate.contextAfter].filter(Boolean).join(" ... "))}</td></tr>`
    )
    .join("");
  const headingNumbering = report.debug?.headingNumbering;
  const headingNumberingBlock = headingNumbering
    ? `<h2>Нумерация заголовков</h2>
        <p><strong>Надёжность:</strong> ${escapeHtml(headingNumbering.reliability)} · <strong>Источник:</strong> ${escapeHtml(headingNumbering.source)}</p>
        ${
          headingNumbering.reliability !== "high"
            ? "<p>Нумерация заголовков восстановлена неуверенно. Замечания, зависящие от структуры разделов, могут быть неточными.</p>"
            : ""
        }
        ${headingNumbering.suspiciousPatterns.length > 0 ? `<p>${escapeHtml(headingNumbering.suspiciousPatterns.join(" "))}</p>` : ""}`
    : "";

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(reportHeading(report))}: ${escapeHtml(report.fileName)}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #172033; background: #f5f7fb; }
    main { max-width: 1040px; margin: 0 auto; padding: 32px; }
    header, .summary, .issue, details { background: #fff; border: 1px solid #dce3ef; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 8px 0; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .metric { background: #f2f6ff; border-radius: 8px; padding: 12px; }
    .metric strong { display: block; font-size: 24px; }
    .meta { color: #59657a; font-size: 13px; }
    .critical { border-left: 5px solid #c62828; }
    .error { border-left: 5px solid #d94c1a; }
    .warning { border-left: 5px solid #b7791f; }
    .info { border-left: 5px solid #2563eb; }
    summary { cursor: pointer; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { border: 1px solid #dce3ef; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f2f6ff; }
    @media print { body { background: white; } main { padding: 0; } .issue, header, .summary { break-inside: avoid; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>${escapeHtml(reportHeading(report))}</h1>
    <p>${escapeHtml(report.fileName)} · режим: ${escapeHtml(report.inputMode)} · профиль: ${escapeHtml(report.profileName)} · ${escapeHtml(new Date(report.generatedAt).toLocaleString("ru-RU"))}</p>
    ${
      report.debug?.activeWorkType
        ? `<p>Тип работы: ${escapeHtml(workTypeLabels[report.debug.activeWorkType])}${
            report.debug.activeProfileId === "pm-department-normcontrol" ? " · источник правил: Нормоконтроль кафедры ПМ" : ""
          }</p>`
        : ""
    }
    <p>${escapeHtml(report.privacyNote)}</p>
  </header>
  <section class="summary">
    <div class="grid">
      <div class="metric"><span>Соответствие</span><strong>${report.score}%</strong></div>
      <div class="metric"><span>Надёжность score</span><strong>${escapeHtml(report.scoreReliability ?? "не определена")}</strong></div>
      <div class="metric"><span>Критические</span><strong>${report.stats.critical}</strong></div>
      <div class="metric"><span>Ошибки</span><strong>${report.stats.errors}</strong></div>
      <div class="metric"><span>Предупреждения</span><strong>${report.stats.warnings}</strong></div>
      <div class="metric"><span>Информация</span><strong>${report.stats.info}</strong></div>
      <div class="metric"><span>Слов</span><strong>${report.stats.words}</strong></div>
    </div>
    <p>${escapeHtml(report.scoreExplanation)}</p>
  </section>
  <section class="summary">
    <h2>Краткое резюме</h2>
    <p>${escapeHtml(summary.statusText)}</p>
    ${summaryItems ? `<h2>Основные замечания</h2><ol>${summaryItems}</ol>` : ""}
    <p class="meta">Проверка предварительная и не заменяет ручной нормоконтроль.</p>
  </section>
  ${
    report.inputMode === "pdfOnly"
      ? `<section class="summary"><h2>Ограничения PDF-only проверки</h2><p>Проверка выполнена только по PDF. Проверки, требующие внутренней структуры DOCX, недоступны.</p>${
          notAvailable ? `<ul>${notAvailable}</ul>` : ""
        }</section>`
      : ""
  }
  ${
    report.debug
      ? `<details>
        <summary>Диагностика распознавания</summary>
        ${headingNumberingBlock}
        <h2>Разделы</h2>
        <table><thead><tr><th>Абзац</th><th>Нормализовано</th><th>Текст</th><th>Стиль</th></tr></thead><tbody>${debugSections || ""}</tbody></table>
        <h2>Подписи</h2>
        <table><thead><tr><th>Абзац</th><th>Тип</th><th>Номер</th><th>Название</th><th>Текст</th></tr></thead><tbody>${debugCaptions || ""}</tbody></table>
        <h2>Кандидаты в ссылки на источники</h2>
        <table><thead><tr><th>Абзац</th><th>Фрагмент</th><th>Решение</th><th>Причина</th><th>Контекст</th></tr></thead><tbody>${sourceReferenceCandidates || ""}</tbody></table>
      </details>`
      : ""
  }
  ${rows || "<p>Замечаний не найдено.</p>"}
</main>
</body>
</html>`;
}

export function exportReportHtml(report: CheckReport): void {
  const blob = new Blob([buildReportHtml(report)], { type: "text/html;charset=utf-8" });
  const safeName = report.fileName.replace(/\.docx$/iu, "");
  downloadBlob(blob, `${safeName}-report.html`);
}
