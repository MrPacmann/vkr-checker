import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export type PdfDocumentProxy = pdfjsLib.PDFDocumentProxy;

export async function loadPdf(file: File): Promise<PdfDocumentProxy> {
  const data = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data }).promise;
}
