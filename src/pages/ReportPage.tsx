import { Clipboard, Download, FileJson2, FileText, Printer, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppPage, CompletedCheckState } from "../App";
import { CheckSummary } from "../components/CheckSummary";
import { DocumentPreview } from "../components/DocumentPreview";
import { IssueFilters, type IssueFilterState } from "../components/IssueFilters";
import { IssueList } from "../components/IssueList";
import { exportReportHtml } from "../services/reportExporter/exportHtml";
import { exportReportJson } from "../services/reportExporter/exportJson";
import { exportReportMarkdown } from "../services/reportExporter/exportMarkdown";
import { buildShortReportText, printReport } from "../services/reportExporter/printReport";
import type { WorkType } from "../types/settings";
import { buildReportSummary, groupIssues } from "../utils/reportPresentation";

interface ReportPageProps {
  result: CompletedCheckState;
  onNavigate: (page: AppPage) => void;
}

const initialFilters: IssueFilterState = {
  level: "all",
  confidence: "all",
  category: "all",
  query: ""
};

const workTypeLabels: Record<WorkType, string> = {
  coursework: "курсовая работа",
  practiceReport: "отчёт по практике",
  bachelorThesis: "ВКР бакалавра",
  masterThesis: "ВКР магистра",
  generic: "универсальная учебная работа"
};

function isTechnicalDiagnosticIssue(code: string): boolean {
  const normalizedCode = code.toUpperCase();
  return normalizedCode.includes("DEBUG") || normalizedCode.includes("DIAGNOSTIC") || normalizedCode.includes("PARSER_TRACE");
}

export function ReportPage({ result, onNavigate }: ReportPageProps) {
  const { report, document, visualLayer } = result;
  const [filters, setFilters] = useState<IssueFilterState>(initialFilters);
  const [importantOnly, setImportantOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualCopyText, setManualCopyText] = useState<string | null>(null);
  const summary = useMemo(() => buildReportSummary(report), [report]);

  const filteredIssues = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const baseIssues = importantOnly ? report.issues.filter((issue) => ["critical", "error", "warning"].includes(issue.level) && !isTechnicalDiagnosticIssue(issue.code)) : report.issues;
    return baseIssues.filter((issue) => {
      if (filters.level !== "all" && issue.level !== filters.level) return false;
      if (filters.category !== "all" && issue.category !== filters.category) return false;
      if (filters.confidence === "manual" && issue.confidence !== "unknown") return false;
      if (filters.confidence !== "all" && filters.confidence !== "manual" && issue.confidence !== filters.confidence) return false;
      if (!query) return true;
      return [issue.message, issue.code, issue.category, issue.excerpt, issue.recommendation, issue.location.section].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [filters, importantOnly, report.issues]);

  const visibleIssues = useMemo(() => groupIssues(filteredIssues), [filteredIssues]);

  const copyShortReport = async () => {
    const text = buildShortReportText(report);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API недоступен.");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setManualCopyText(null);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setManualCopyText(text);
    }
  };

  const stats = [
    ["Страниц", report.stats.detectedPages ?? "не определено"],
    ["Примерно страниц", report.stats.estimatedPages],
    ["Слов", report.stats.words],
    ["Абзацев", report.stats.paragraphs],
    ["Разделов", report.stats.sections],
    ["Рисунков", report.stats.figures],
    ["Таблиц", report.stats.tables],
    ["Формул", report.stats.formulas],
    ["Листингов", report.stats.listings],
    ["Схем", report.stats.schemes],
    ["Источников", report.stats.sources],
    ["Ссылок на источники", report.stats.sourceReferences],
    ["Ссылок на рисунки", report.stats.figureReferences],
    ["Ссылок на таблицы", report.stats.tableReferences],
    ["Ссылок на формулы", report.stats.formulaReferences],
    ["Ссылок на листинги", report.stats.listingReferences]
  ];

  return (
    <div className="grid">
      <section>
        <p className="eyebrow">Отчет сформирован {new Date(report.generatedAt).toLocaleString("ru-RU")}</p>
        <h1 style={{ fontSize: 44 }}>Результаты проверки</h1>
        <p className="lead">
          {report.fileName} · профиль: {report.profileName} · визуальный слой: {visualLayer.label}
        </p>
        {report.debug?.activeWorkType && (
          <p className="muted">
            Тип работы: {workTypeLabels[report.debug.activeWorkType]}{report.debug.activeProfileId === "pm-department-normcontrol" ? " · источник правил: Нормоконтроль кафедры ПМ" : ""}
          </p>
        )}
        <div className="toolbar">
          <button className="button" type="button" onClick={() => exportReportJson(report)}>
            <FileJson2 size={18} /> Экспорт JSON
          </button>
          <button className="button" type="button" onClick={() => exportReportHtml(report)}>
            <Download size={18} /> Экспорт HTML
          </button>
          <button className="button" type="button" onClick={() => exportReportMarkdown(report)}>
            <FileText size={18} /> Скачать Markdown
          </button>
          <button className="button" type="button" onClick={() => printReport(report)} title="В окне печати выберите «Сохранить как PDF»">
            <Printer size={18} /> Скачать PDF / Печать
          </button>
          <button className="button" type="button" onClick={copyShortReport}>
            <Clipboard size={18} /> {copied ? "Краткий отчёт скопирован" : "Скопировать краткий отчёт"}
          </button>
          <button className="button" type="button" onClick={() => onNavigate("checker")}>
            <RotateCcw size={18} /> Загрузить другой файл
          </button>
        </div>
      </section>

      <CheckSummary report={report} />

      <section className="tool-panel">
        <h2>Краткое резюме</h2>
        <p>{summary.statusText}</p>
        {summary.topIssues.length > 0 && (
          <>
            <h3>Основные замечания</h3>
            <ol className="compact-list">
              {summary.topIssues.map((issue, index) => (
                <li key={`${issue}-${index}`}>{issue}</li>
              ))}
            </ol>
          </>
        )}
        <p className="muted">В окне печати выберите «Сохранить как PDF», если нужен PDF-файл отчёта.</p>
      </section>

      {manualCopyText && (
        <section className="tool-panel">
          <h2>Краткий отчёт для ручного копирования</h2>
          <p className="muted">Буфер обмена недоступен в этом браузере или режиме. Выделите текст и скопируйте его вручную.</p>
          <textarea className="textarea code-textarea" readOnly value={manualCopyText} />
        </section>
      )}

      {report.inputMode === "pdfOnly" && (
        <section className="tool-panel">
          <h2>Ограничения PDF-only проверки</h2>
          <p className="muted">
            Проверка выполнена только по PDF. Система может анализировать текст, страницы, подписи, ссылки, список источников и визуальное представление документа. Проверки, требующие внутренней структуры DOCX, недоступны. Для максимально точной проверки оформления загрузите DOCX.
          </p>
          {report.notAvailableChecks.length > 0 && (
            <div className="grid two">
              {report.notAvailableChecks.map((check) => (
                <div className="detail" key={check.code}>
                  <span>{check.code}</span>
                  <strong>{check.title}</strong>
                  <p className="muted" style={{ margin: "6px 0 0" }}>{check.reason}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="tool-panel">
        <h2>Статистика документа</h2>
        <div className="metrics-grid">
          {stats.map(([label, value]) => (
            <div className="metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        {document.warnings.length > 0 && (
          <div className="notice" style={{ marginTop: 14 }}>
            <div>
              <strong>Предупреждения парсера</strong>
              <p className="muted">{document.warnings.join(" ")}</p>
            </div>
          </div>
        )}
      </section>

      {report.debug && (
        <details className="tool-panel">
          <summary className="debug-summary">Диагностика распознавания</summary>
          {report.debug.headingNumbering && (
            <div className="notice" style={{ marginBottom: 14 }}>
              <div>
                <strong>Нумерация заголовков: {report.debug.headingNumbering.reliability}</strong>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Источник: {report.debug.headingNumbering.source}
                  {report.debug.headingNumbering.reliability !== "high"
                    ? " · Нумерация заголовков восстановлена неуверенно. Замечания, зависящие от структуры разделов, могут быть неточными."
                    : ""}
                </p>
                {report.debug.headingNumbering.suspiciousPatterns.length > 0 && (
                  <p className="muted" style={{ margin: "6px 0 0" }}>{report.debug.headingNumbering.suspiciousPatterns.join(" ")}</p>
                )}
              </div>
            </div>
          )}
          <div className="debug-grid">
            <div>
              <h3>Разделы</h3>
              <div className="debug-list">
                {report.debug.detectedSections.map((section) => (
                  <div className="debug-row" key={`${section.paragraphIndex}-${section.rawText}`}>
                    <strong>{section.normalizedText}</strong>
                    <span>Абзац {section.paragraphIndex + 1}</span>
                    <p>{section.rawText}</p>
                    {(section.styleName || section.styleId) && <small>{[section.styleName, section.styleId].filter(Boolean).join(" · ")}</small>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Подписи</h3>
              <div className="debug-list">
                {report.debug.detectedCaptions.map((caption) => (
                  <div className="debug-row" key={`${caption.type}-${caption.number}-${caption.paragraphIndex}`}>
                    <strong>
                      {caption.type} {caption.number}
                    </strong>
                    <span>Абзац {caption.paragraphIndex + 1}</span>
                    <p>{caption.rawText}</p>
                    {caption.source && <small>{caption.source}</small>}
                    {caption.numbering && typeof caption.numbering === "object" ? <small>{JSON.stringify(caption.numbering)}</small> : null}
                  </div>
                ))}
              </div>
            </div>
            {report.debug.sourceReferenceCandidates && report.debug.sourceReferenceCandidates.length > 0 && (
              <div>
                <h3>Кандидаты в ссылки на источники</h3>
                <div className="debug-list">
                  {report.debug.sourceReferenceCandidates.map((candidate, index) => (
                    <div className="debug-row" key={`${candidate.paragraphIndex}-${candidate.raw}-${index}`}>
                      <strong>{candidate.raw}</strong>
                      <span>Абзац {candidate.paragraphIndex + 1} · {candidate.decision}</span>
                      <p>{candidate.reason}</p>
                      <small>{[candidate.contextBefore, candidate.contextAfter].filter(Boolean).join(" ... ")}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      <div className="report-layout">
        <div className="grid">
          <section className="tool-panel">
            <h2>Замечания</h2>
            <div className="toolbar">
              <button className={`button ${importantOnly ? "primary" : ""}`} type="button" onClick={() => setImportantOnly(true)}>
                Показать только важное
              </button>
              <button className={`button ${!importantOnly ? "primary" : ""}`} type="button" onClick={() => setImportantOnly(false)}>
                Показать всё
              </button>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              Показано {visibleIssues.length} карточек из {filteredIssues.length} замечаний после фильтров. Однотипные замечания группируются, исходные данные отчёта не изменяются.
            </p>
          </section>
          <IssueFilters value={filters} onChange={setFilters} />
          <IssueList issues={visibleIssues} />
        </div>
        <div className="grid">
          <DocumentPreview visualLayer={visualLayer} />
        </div>
      </div>
    </div>
  );
}
