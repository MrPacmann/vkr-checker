import type { InputMode } from "../types/report";

export type InputModeWithEmpty = InputMode | "empty";

export function getInputMode(docxFile: File | null, pdfFile: File | null): InputModeWithEmpty {
  if (docxFile && pdfFile) return "docxWithPdf";
  if (docxFile) return "docxOnly";
  if (pdfFile) return "pdfOnly";
  return "empty";
}

export function inputModeTitle(mode: InputModeWithEmpty): string {
  switch (mode) {
    case "docxOnly":
      return "DOCX";
    case "docxWithPdf":
      return "DOCX + PDF";
    case "pdfOnly":
      return "PDF-only";
    case "empty":
      return "не выбран";
  }
}

export function inputModeDescription(mode: InputModeWithEmpty): string {
  switch (mode) {
    case "docxOnly":
      return "DOCX используется для проверки. Визуальный слой будет построен автоматически.";
    case "docxWithPdf":
      return "DOCX используется для точной проверки, PDF — для страниц и визуальной привязки.";
    case "pdfOnly":
      return "Источник проверки: PDF + OCR при необходимости.";
    case "empty":
      return "Загрузите DOCX, PDF или оба файла.";
  }
}
