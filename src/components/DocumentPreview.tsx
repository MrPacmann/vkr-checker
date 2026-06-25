import { useEffect, useRef } from "react";
import type { VisualLayerResult } from "../types/visualLayer";
import { PagePreview } from "./PagePreview";
import { VisualLayerStatus } from "./VisualLayerStatus";

interface DocumentPreviewProps {
  visualLayer: VisualLayerResult | null;
}

export function DocumentPreview({ visualLayer }: DocumentPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    if (visualLayer?.htmlPreview) {
      host.appendChild(visualLayer.htmlPreview);
    }
  }, [visualLayer]);

  return (
    <section className="preview-shell">
      <h2>Визуальный слой</h2>
      <VisualLayerStatus visualLayer={visualLayer} />
      {visualLayer?.htmlPreview && <div className="docx-preview-host" ref={hostRef} style={{ marginTop: 14 }} />}
      {visualLayer && !visualLayer.htmlPreview && (
        <div className="preview-pages" style={{ marginTop: 14 }}>
          {visualLayer.pages.length > 0 ? visualLayer.pages.map((page) => <PagePreview page={page} key={page.pageNumber} />) : <p className="muted">Постраничный предпросмотр недоступен.</p>}
        </div>
      )}
    </section>
  );
}
