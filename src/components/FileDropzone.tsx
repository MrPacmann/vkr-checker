import { FileText, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { formatFileSize, isDocxFile } from "../utils/file";

interface FileDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export function FileDropzone({ file, onFileChange }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState(false);

  const acceptFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!isDocxFile(nextFile)) {
      alert("Загрузите файл .docx.");
      return;
    }
    onFileChange(nextFile);
  };

  return (
    <div>
      <label
        className={`dropzone ${active ? "active" : ""}`}
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
        <input ref={inputRef} type="file" accept=".docx" onChange={(event) => acceptFile(event.target.files?.[0])} />
        <div>
          <UploadCloud size={38} />
          <div className="dropzone-title">Загрузите DOCX</div>
          <div className="muted">DOCX нужен для максимально точной проверки структуры и оформления</div>
        </div>
      </label>
      {file && (
        <div className="status-row" style={{ marginTop: 12 }}>
          <span>
            <FileText size={18} /> {file.name} · {formatFileSize(file.size)}
          </span>
          <button className="icon-button" type="button" onClick={() => onFileChange(null)} title="Удалить DOCX">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
