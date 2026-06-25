import type { RuleProfile } from "../types/settings";
import { parseDocxFile } from "../services/documentParser/docxParser";

type RequestMessage = {
  type: "parse";
  file: File;
  profile: RuleProfile;
};

self.onmessage = async (event: MessageEvent<RequestMessage>) => {
  if (event.data.type !== "parse") return;
  try {
    const document = await parseDocxFile(event.data.file, {
      profile: event.data.profile,
      onProgress: (stage, progress) => {
        self.postMessage({ type: "progress", stage, progress });
      }
    });
    self.postMessage({ type: "complete", document });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Не удалось разобрать DOCX." });
  }
};

export {};
