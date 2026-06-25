import type { RuleProfile } from "../../types/settings";
import type { VisualLayerResult } from "../../types/visualLayer";
import { renderDocxHtmlPreview } from "./docxHtmlPreview";
import { tryCreatePdfFromDocxLocally } from "./docxToPdfAttempt";
import { loadPdf } from "./pdfParser";
import { renderFirstPdfPages } from "./pdfPageRenderer";
import { extractPdfTextPages } from "./pdfTextExtractor";

export interface VisualLayerOptions {
  docxFile: File;
  pdfFile?: File | null;
  profile: RuleProfile;
  onProgress?: (message: string, progress: number) => void;
  signal?: AbortSignal;
}

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Проверка отменена пользователем.", "AbortError");
}

export async function buildVisualLayer(options: VisualLayerOptions): Promise<VisualLayerResult> {
  const warnings: string[] = [];
  ensureNotAborted(options.signal);

  if (options.pdfFile && options.profile.visualPreference !== "htmlPreview" && options.profile.visualPreference !== "textOnly") {
    try {
      options.onProgress?.("Загрузка PDF-визуального слоя", 72);
      const pdf = await loadPdf(options.pdfFile);
      ensureNotAborted(options.signal);
      const [textPages, imagePages] = await Promise.all([extractPdfTextPages(pdf), renderFirstPdfPages(pdf, 4)]);
      const imageMap = new Map(imagePages.map((page) => [page.pageNumber, page]));
      return {
        mode: "uploadedPdf",
        status: "ready",
        label: "Используется загруженный PDF",
        message: "PDF используется как приоритетный визуальный слой для просмотра и сопоставления страниц.",
        pageCount: pdf.numPages,
        pages: textPages.map((page) => ({ ...page, ...imageMap.get(page.pageNumber) })),
        warnings
      };
    } catch (error) {
      warnings.push(error instanceof Error ? `Не удалось прочитать PDF: ${error.message}` : "Не удалось прочитать PDF.");
    }
  }

  if (options.profile.visualPreference !== "textOnly") {
    const pdfAttempt = await tryCreatePdfFromDocxLocally();
    warnings.push(pdfAttempt.reason);
    try {
      options.onProgress?.("Построение HTML-превью DOCX", 78);
      const htmlPreview = await renderDocxHtmlPreview(options.docxFile);
      const pages = Array.from(htmlPreview.querySelectorAll(".docx-wrapper > section, section.docx")).map((section, index) => ({
        pageNumber: index + 1,
        text: section.textContent?.replace(/\s+/g, " ").trim() ?? ""
      }));
      return {
        mode: "htmlPreview",
        status: pages.length > 0 ? "ready" : "partial",
        label: "Используется HTML-превью DOCX",
        message: "Номера страниц могут немного отличаться от Microsoft Word, так как постраничная разметка формируется браузером.",
        pageCount: pages.length || null,
        pages,
        htmlPreview,
        warnings
      };
    } catch (error) {
      warnings.push(error instanceof Error ? `HTML-превью DOCX недоступно: ${error.message}` : "HTML-превью DOCX недоступно.");
    }
  }

  return {
    mode: "textOnly",
    status: "partial",
    label: "Доступна только текстово-структурная проверка",
    message: "Визуальный слой построить не удалось. Замечания привязаны к абзацам и примерным страницам.",
    pageCount: null,
    pages: [],
    warnings
  };
}
