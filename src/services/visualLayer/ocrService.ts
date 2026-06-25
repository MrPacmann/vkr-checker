import type { OcrMode } from "../../types/settings";

export interface OcrResult {
  text: string;
  confidence: number;
}

export async function recognizeImageText(image: string | HTMLCanvasElement | Blob, mode: OcrMode): Promise<OcrResult | null> {
  if (mode === "disabled") return null;
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("rus+eng");
  try {
    const result = await worker.recognize(image);
    return {
      text: result.data.text,
      confidence: result.data.confidence
    };
  } finally {
    await worker.terminate();
  }
}
