import type { ParsedDocument } from "../types/document";
import type { InputMode } from "../types/report";
import type { RuleProfile } from "../types/settings";
import type { VisualLayerResult } from "../types/visualLayer";
import { runChecks } from "../services/checkEngine/checkEngine";

type RequestMessage = {
  type: "check";
  document: ParsedDocument;
  profile: RuleProfile;
  visualLayer: VisualLayerResult;
  optionalPdfFileName?: string | null;
  inputMode?: Extract<InputMode, "docxOnly" | "docxWithPdf">;
};

self.onmessage = (event: MessageEvent<RequestMessage>) => {
  if (event.data.type !== "check") return;
  try {
    const report = runChecks({
      document: event.data.document,
      profile: event.data.profile,
      visualLayer: event.data.visualLayer,
      optionalPdfFileName: event.data.optionalPdfFileName,
      inputMode: event.data.inputMode
    });
    self.postMessage({ type: "complete", report });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Не удалось выполнить проверки." });
  }
};

export {};
