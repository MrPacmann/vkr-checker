export type VisualLayerMode = "uploadedPdf" | "generatedPdf" | "htmlPreview" | "textOnly";

export interface VisualPage {
  pageNumber: number;
  text?: string;
  canvasUrl?: string;
  width?: number;
  height?: number;
}

export interface VisualLayerResult {
  mode: VisualLayerMode;
  status: "ready" | "partial" | "failed";
  label: string;
  message: string;
  pageCount: number | null;
  pages: VisualPage[];
  htmlPreview?: HTMLElement;
  warnings: string[];
}
