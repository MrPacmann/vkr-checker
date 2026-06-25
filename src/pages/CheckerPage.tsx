import { Play, RotateCcw, Square, TestTube2 } from "lucide-react";
import { useRef, useState } from "react";
import { demoDocuments } from "../config/demoDocuments";
import { CheckProgress } from "../components/CheckProgress";
import { FileDropzone } from "../components/FileDropzone";
import { OptionalPdfDropzone } from "../components/OptionalPdfDropzone";
import { PrivacyNotice } from "../components/PrivacyNotice";
import { VisualLayerStatus } from "../components/VisualLayerStatus";
import type { CompletedCheckState } from "../App";
import type { ParsedDocument } from "../types/document";
import type { CheckReport } from "../types/report";
import type { InputMode } from "../types/report";
import type { AppSettings, RuleProfile, WorkType } from "../types/settings";
import type { VisualLayerResult } from "../types/visualLayer";
import { runPdfOnlyCheck } from "../services/pdfOnly/pdfOnlyChecker";
import { buildVisualLayer } from "../services/visualLayer/visualLayerService";
import { getInputMode, inputModeDescription, inputModeTitle } from "../utils/inputMode";

interface CheckerPageProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  activeProfile: RuleProfile;
  onComplete: (result: CompletedCheckState) => void;
}

type DocxWorkerMessage =
  | { type: "progress"; stage: string; progress: number }
  | { type: "complete"; document: ParsedDocument }
  | { type: "error"; message: string };

type CheckWorkerMessage = { type: "complete"; report: CheckReport } | { type: "error"; message: string };

function visualLayerForWorker(visualLayer: VisualLayerResult): VisualLayerResult {
  return {
    ...visualLayer,
    htmlPreview: undefined
  };
}

function parseDocxInWorker(file: File, profile: RuleProfile, onStage: (stage: number) => void): Promise<ParsedDocument> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/docxWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<DocxWorkerMessage>) => {
      if (event.data.type === "progress") {
        const stageMap: Record<string, number> = { openZip: 0, readXml: 0, parseStyles: 2, parseDocument: 3, extractObjects: 4, complete: 5 };
        onStage(stageMap[event.data.stage] ?? 0);
      }
      if (event.data.type === "complete") {
        worker.terminate();
        resolve(event.data.document);
      }
      if (event.data.type === "error") {
        worker.terminate();
        reject(new Error(event.data.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({ type: "parse", file, profile });
  });
}

function runChecksInWorker(
  document: ParsedDocument,
  profile: RuleProfile,
  visualLayer: VisualLayerResult,
  optionalPdfFileName: string | null,
  inputMode: Extract<InputMode, "docxOnly" | "docxWithPdf">
): Promise<CheckReport> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/checkWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<CheckWorkerMessage>) => {
      if (event.data.type === "complete") {
        worker.terminate();
        resolve(event.data.report);
      }
      if (event.data.type === "error") {
        worker.terminate();
        reject(new Error(event.data.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({ type: "check", document, profile, visualLayer: visualLayerForWorker(visualLayer), optionalPdfFileName, inputMode });
  });
}

const workTypeLabels: Record<WorkType, string> = {
  coursework: "Курсовая работа",
  practiceReport: "Отчёт по практике",
  bachelorThesis: "ВКР бакалавра",
  masterThesis: "ВКР магистра",
  generic: "Универсальная учебная работа"
};

export function CheckerPage({ settings, onSettingsChange, activeProfile, onComplete }: CheckerPageProps) {
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visualLayer, setVisualLayer] = useState<VisualLayerResult | null>(null);
  const [demoId, setDemoId] = useState(demoDocuments[0]?.id ?? "");
  const cancelledRef = useRef(false);
  const inputMode = getInputMode(docxFile, pdfFile);
  const canStartCheck = Boolean(docxFile || pdfFile);
  const supportedWorkTypes = activeProfile.workTypes?.length ? activeProfile.workTypes : (["generic"] as WorkType[]);

  const selectProfile = (profileId: string) => {
    const profile = settings.profiles.find((item) => item.id === profileId);
    onSettingsChange({
      ...settings,
      activeProfileId: profileId,
      activeWorkType: profile?.defaultWorkType ?? settings.activeWorkType
    });
  };

  const reset = () => {
    setDocxFile(null);
    setPdfFile(null);
    setError(null);
    setStage(0);
    setProgressMessage(null);
    setVisualLayer(null);
  };

  const cancel = () => {
    cancelledRef.current = true;
    setRunning(false);
    setError("Проверка отменена пользователем.");
  };

  const runUploadedCheck = async () => {
    const currentMode = getInputMode(docxFile, pdfFile);
    if (currentMode === "empty") {
      setError("Загрузите DOCX или PDF для проверки.");
      return;
    }
    cancelledRef.current = false;
    setRunning(true);
    setError(null);
    setProgressMessage(null);
    setStage(0);
    try {
      if (currentMode === "pdfOnly") {
        if (!pdfFile) return;
        const result = await runPdfOnlyCheck({
          pdfFile,
          profile: activeProfile,
          onProgress: (progress) => {
            setStage(progress.stage);
            setProgressMessage(progress.message);
          }
        });
        if (cancelledRef.current) return;
        setVisualLayer(result.visualLayer);
        setStage(10);
        onComplete({ report: result.report, document: result.document, visualLayer: result.visualLayer });
        return;
      }

      if (!docxFile) return;
      const document = await parseDocxInWorker(docxFile, activeProfile, setStage);
      if (cancelledRef.current) return;
      setStage(7);
      const nextVisualLayer = await buildVisualLayer({
        docxFile,
        pdfFile,
        profile: activeProfile,
        onProgress: () => setStage(7)
      });
      setVisualLayer(nextVisualLayer);
      if (cancelledRef.current) return;
      setStage(8);
      const report = await runChecksInWorker(document, activeProfile, nextVisualLayer, pdfFile?.name ?? null, currentMode);
      if (cancelledRef.current) return;
      setStage(10);
      onComplete({ report, document, visualLayer: nextVisualLayer });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось выполнить проверку.");
    } finally {
      setRunning(false);
    }
  };

  const runDemoCheck = async () => {
    const demo = demoDocuments.find((item) => item.id === demoId) ?? demoDocuments[0];
    if (!demo) return;
    cancelledRef.current = false;
    setRunning(true);
    setError(null);
    setProgressMessage(null);
    setStage(5);
    const demoVisualLayer: VisualLayerResult = {
      mode: "textOnly",
      status: "partial",
      label: "Демо-документ: текстово-структурная проверка",
      message: "Демо-документ уже представлен как ParsedDocument, поэтому визуальный слой не строится.",
      pageCount: demo.document.stats.estimatedPages,
      pages: [],
      warnings: ["Демо-режим не использует реальные файлы и визуальную конвертацию."]
    };
    try {
      setVisualLayer(demoVisualLayer);
      setStage(9);
      const report = await runChecksInWorker(demo.document, activeProfile, demoVisualLayer, null, "docxOnly");
      if (cancelledRef.current) return;
      onComplete({ report, document: demo.document, visualLayer: demoVisualLayer });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось выполнить демо-проверку.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid">
      <section>
        <p className="eyebrow">Локальная проверка</p>
        <h1 style={{ fontSize: 44 }}>Проверить документ</h1>
        <p className="lead">Загрузите DOCX, PDF или оба файла. DOCX дает наиболее точную проверку, PDF подходит для быстрой проверки готового документа.</p>
      </section>

      <div className="checker-layout">
        <section className="tool-panel">
          <h2>Файлы</h2>
          <div className="grid two" style={{ marginBottom: 16 }}>
            <label>
              <span className="muted">Профиль проверки</span>
              <select className="field" value={settings.activeProfileId} onChange={(event) => selectProfile(event.target.value)} disabled={running}>
                {settings.profiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="muted">Тип работы</span>
              <select className="field" value={activeProfile.activeWorkType ?? settings.activeWorkType} onChange={(event) => onSettingsChange({ ...settings, activeWorkType: event.target.value as WorkType })} disabled={running}>
                {supportedWorkTypes.map((workType) => (
                  <option value={workType} key={workType}>
                    {workTypeLabels[workType]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FileDropzone file={docxFile} onFileChange={setDocxFile} />
          <div style={{ height: 16 }} />
          <OptionalPdfDropzone file={pdfFile} onFileChange={setPdfFile} />
          <div className="status-stack" style={{ marginTop: 16 }}>
            <div className="status-row">
              <span>Активный профиль</span>
              <strong>{activeProfile.name}</strong>
            </div>
            <div className="status-row">
              <span>Тип работы</span>
              <strong>{workTypeLabels[activeProfile.activeWorkType ?? settings.activeWorkType]}</strong>
            </div>
            {activeProfile.source && (
              <div className="status-row">
                <span>Источник правил</span>
                <strong>{activeProfile.source.department ? `${activeProfile.source.department}: ${activeProfile.source.title}` : activeProfile.source.title}</strong>
              </div>
            )}
            <div className="status-row">
              <span>OCR</span>
              <strong>{activeProfile.ocrMode === "disabled" ? "отключен" : activeProfile.ocrMode === "enabled" ? "включен" : "при необходимости"}</strong>
            </div>
            <div className="status-row">
              <span>Режим проверки</span>
              <strong>{inputModeTitle(inputMode)}</strong>
            </div>
            <div className="notice">
              <div>
                <strong>{inputMode === "pdfOnly" ? "Загружен только PDF" : "Источник проверки"}</strong>
                <p className="muted">
                  {inputMode === "pdfOnly"
                    ? "Загружен только PDF. Будет выполнена PDF-проверка. Проверки, требующие структуры DOCX, будут недоступны: стили Word, наследование стилей, точные параметры абзацев и часть параметров оформления."
                    : inputModeDescription(inputMode)}
                </p>
              </div>
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: 18 }}>
            <button className="button primary" type="button" onClick={runUploadedCheck} disabled={running || !canStartCheck}>
              <Play size={18} /> Проверить документ
            </button>
            <button className="button" type="button" onClick={reset} disabled={running}>
              <RotateCcw size={18} /> Очистить
            </button>
            {running && (
              <button className="button danger" type="button" onClick={cancel}>
                <Square size={18} /> Отменить
              </button>
            )}
          </div>
          {error && <p className="pill error" style={{ marginTop: 14 }}>{error}</p>}
        </section>

        <aside className="tool-panel">
          <h2>Ход проверки</h2>
          <CheckProgress currentStage={stage} running={running} />
          {progressMessage && <p className="pill info" style={{ marginTop: 12 }}>{progressMessage}</p>}
          <div style={{ marginTop: 18 }}>
            <VisualLayerStatus visualLayer={visualLayer} />
          </div>
        </aside>
      </div>

      <PrivacyNotice />

      <section className="tool-panel">
        <h2>Демо-документы</h2>
        <p className="muted">Режим нужен для проверки алгоритмов без загрузки файла. Используются встроенные ParsedDocument без сохранения данных.</p>
        <div className="toolbar">
          <select className="field" value={demoId} onChange={(event) => setDemoId(event.target.value)} style={{ maxWidth: 420 }}>
            {demoDocuments.map((demo) => (
              <option key={demo.id} value={demo.id}>
                {demo.title}
              </option>
            ))}
          </select>
          <button className="button" type="button" onClick={runDemoCheck} disabled={running}>
            <TestTube2 size={18} /> Запустить демо
          </button>
        </div>
      </section>
    </div>
  );
}
