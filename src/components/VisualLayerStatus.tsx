import { Eye, FileImage, FileText } from "lucide-react";
import type { VisualLayerResult } from "../types/visualLayer";

interface VisualLayerStatusProps {
  visualLayer?: VisualLayerResult | null;
}

export function VisualLayerStatus({ visualLayer }: VisualLayerStatusProps) {
  if (!visualLayer) {
    return (
      <div className="notice">
        <Eye size={22} />
        <div>
          <strong>Визуальный слой еще не построен</strong>
          <p className="muted">После проверки здесь появится режим просмотра документа.</p>
        </div>
      </div>
    );
  }
  const Icon = visualLayer.mode === "uploadedPdf" || visualLayer.mode === "generatedPdf" ? FileImage : FileText;
  return (
    <div className="notice">
      <Icon size={22} />
      <div>
        <strong>{visualLayer.label}</strong>
        <p className="muted">{visualLayer.message}</p>
        <span className={`pill ${visualLayer.status === "ready" ? "success" : "warning"}`}>
          {visualLayer.pageCount ? `${visualLayer.pageCount} стр.` : "страницы приблизительно"}
        </span>
      </div>
    </div>
  );
}
