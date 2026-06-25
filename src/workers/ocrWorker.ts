import type { OcrMode } from "../types/settings";
import { recognizeImageText } from "../services/visualLayer/ocrService";

type RequestMessage = {
  type: "ocr";
  image: string | Blob;
  mode: OcrMode;
};

self.onmessage = async (event: MessageEvent<RequestMessage>) => {
  if (event.data.type !== "ocr") return;
  try {
    const result = await recognizeImageText(event.data.image, event.data.mode);
    self.postMessage({ type: "complete", result });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "OCR недоступен." });
  }
};

export {};
