import type { VisualPage } from "../types/visualLayer";

interface PagePreviewProps {
  page: VisualPage;
}

export function PagePreview({ page }: PagePreviewProps) {
  return (
    <article className="page-preview">
      <div className="status-row">
        <strong>Страница {page.pageNumber}</strong>
        {page.text && <span className="pill">{page.text.length} символов текста</span>}
      </div>
      {page.canvasUrl && <img src={page.canvasUrl} alt={`Страница ${page.pageNumber}`} />}
      {!page.canvasUrl && page.text && <div className="page-text">{page.text}</div>}
      {!page.canvasUrl && !page.text && <div className="page-text">Нет текстового слоя для предпросмотра.</div>}
    </article>
  );
}
