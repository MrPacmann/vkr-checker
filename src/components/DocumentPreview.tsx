import { useEffect, useRef, useState } from "react";
import type { VisualLayerResult } from "../types/visualLayer";
import { PagePreview } from "./PagePreview";
import { VisualLayerStatus } from "./VisualLayerStatus";

interface DocumentPreviewProps {
  visualLayer: VisualLayerResult | null;
}

export function DocumentPreview({ visualLayer }: DocumentPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    if (visualLayer?.htmlPreview && showHtmlPreview) {
      host.appendChild(visualLayer.htmlPreview);
    }
  }, [showHtmlPreview, visualLayer]);

  useEffect(() => {
    setShowHtmlPreview(false);
  }, [visualLayer]);

  return (
    <section className="preview-shell">
      <h2>Визуальный слой</h2>
      <VisualLayerStatus visualLayer={visualLayer} />
      {visualLayer?.htmlPreview && (
        <div style={{ marginTop: 14 }}>
          <p className="muted">HTML-превью DOCX может отличаться от отображения в Word и не используется как основной источник проверки.</p>
          <button className="button" type="button" onClick={() => setShowHtmlPreview((value) => !value)}>
            {showHtmlPreview ? "Скрыть экспериментальное HTML-превью DOCX" : "Показать экспериментальное HTML-превью DOCX"}
          </button>
          {showHtmlPreview && <div className="docx-preview-host" ref={hostRef} style={{ marginTop: 14 }} />}
        </div>
      )}
      {visualLayer && !visualLayer.htmlPreview && (
        <div className="preview-pages" style={{ marginTop: 14 }}>
          {visualLayer.pages.length > 0 ? visualLayer.pages.map((page) => <PagePreview page={page} key={page.pageNumber} />) : <p className="muted">Постраничный предпросмотр недоступен.</p>}
        </div>
      )}
    </section>
  );
}
