export interface DocxToPdfAttemptResult {
  ok: false;
  reason: string;
}

export async function tryCreatePdfFromDocxLocally(): Promise<DocxToPdfAttemptResult> {
  return {
    ok: false,
    reason:
      "Надежная конвертация DOCX в настоящий PDF в браузере без Microsoft Office, LibreOffice или серверного процесса недоступна. Используется HTML-превью DOCX."
  };
}
