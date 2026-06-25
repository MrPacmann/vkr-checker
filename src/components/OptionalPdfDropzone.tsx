import { FileText, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { formatFileSize, isPdfFile } from "../utils/file";

interface OptionalPdfDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export function OptionalPdfDropzone({ file, onFileChange }: OptionalPdfDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState(false);

  const acceptFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!isPdfFile(nextFile)) {
      alert("Загрузите файл .pdf.");
      return;
    }
    onFileChange(nextFile);
  };

  return (
    <div>
      <label
        className={`dropzone small ${active ? "active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setActive(false);
          acceptFile(event.dataTransfer.files[0]);
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf" onChange={(event) => acceptFile(event.target.files?.[0])} />
        <div>
          <UploadCloud size={28} />
          <div className="dropzone-title">PDF — необязательно</div>
          <div className="muted">Можно загрузить дополнительно или проверить только PDF</div>
        </div>
      </label>
      {file && (
        <div className="status-row" style={{ marginTop: 12 }}>
          <span>
            <FileText size={18} /> {file.name} · {formatFileSize(file.size)}
          </span>
          <button className="icon-button" type="button" onClick={() => onFileChange(null)} title="Удалить PDF">
            <X size={18} />
          </button>
        </div>
      )}
      <p className="muted">
        PDF загружать не обязательно. Можно проверить DOCX, DOCX вместе с PDF или только PDF. DOCX дает наиболее точную проверку оформления. PDF помогает определить страницы и может использоваться для отдельной PDF-проверки.
      </p>
      <p className="muted">Для самой точной проверки загрузите DOCX. Для быстрой проверки готового документа можно загрузить только PDF.</p>
    </div>
  );
}
