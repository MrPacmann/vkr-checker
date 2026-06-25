import type { VisualPage } from "../../types/visualLayer";
import type { PdfDocumentProxy } from "./pdfParser";

export async function renderPdfPageToImage(pdf: PdfDocumentProxy, pageNumber: number, scale = 1.2): Promise<VisualPage> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен в браузере.");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return {
    pageNumber,
    canvasUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height
  };
}

export async function renderFirstPdfPages(pdf: PdfDocumentProxy, limit = 5): Promise<VisualPage[]> {
  const pages: VisualPage[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(limit, pdf.numPages); pageNumber += 1) {
    pages.push(await renderPdfPageToImage(pdf, pageNumber));
  }
  return pages;
}
