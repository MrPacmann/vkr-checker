import type { VisualPage } from "../../types/visualLayer";
import type { PdfDocumentProxy } from "./pdfParser";

export async function extractPdfTextPages(pdf: PdfDocumentProxy): Promise<VisualPage[]> {
  const pages: VisualPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ pageNumber, text });
  }
  return pages;
}
