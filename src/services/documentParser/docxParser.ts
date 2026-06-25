import JSZip from "jszip";
import type { ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { normalizeSpaces } from "../../utils/text";
import { childrenDeep, getTextFromXmlNode, type XmlNode } from "../../utils/xml";
import { buildDocumentModel } from "./documentModelBuilder";
import { readXml, parseRelationships } from "./docxXmlReader";
import { parseHeaderFooterText } from "./headersFootersParser";
import { parseNotes } from "./footnotesParser";
import { parseNumbering } from "./numberingParser";
import { parseSettings } from "./settingsParser";
import { parseStyles } from "./stylesParser";
import { parseTheme } from "./themeParser";

export type DocxParseStage =
  | "openZip"
  | "readXml"
  | "parseStyles"
  | "parseDocument"
  | "extractObjects"
  | "complete";

export interface DocxParseOptions {
  profile?: RuleProfile;
  onProgress?: (stage: DocxParseStage, progress: number) => void;
  signal?: AbortSignal;
}

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Проверка отменена пользователем.", "AbortError");
}

const DOCX_PARSE_ERROR = "Не удалось разобрать DOCX. Проверьте, что файл сохранён в формате .docx и не повреждён";

function readCoreMetadata(document: XmlNode | null): ParsedDocument["metadata"] {
  if (!document) return {};
  const value = (name: string) => {
    const element = childrenDeep(document, name)[0];
    return normalizeSpaces(getTextFromXmlNode(element));
  };
  return {
    title: value("title") || undefined,
    subject: value("subject") || undefined,
    creator: value("creator") || value("lastModifiedBy") || undefined,
    created: value("created") || undefined,
    modified: value("modified") || undefined
  };
}

function readAppMetadata(document: XmlNode | null): Partial<ParsedDocument["metadata"]> {
  if (!document) return {};
  const value = (name: string) => {
    const element = childrenDeep(document, name)[0];
    return normalizeSpaces(getTextFromXmlNode(element));
  };
  const pages = Number(value("Pages"));
  const words = Number(value("Words"));
  return {
    pages: Number.isFinite(pages) && pages > 0 ? pages : undefined,
    words: Number.isFinite(words) && words > 0 ? words : undefined
  };
}

async function readMatchingXml(zip: JSZip, regex: RegExp): Promise<Array<XmlNode | null>> {
  const paths = Object.keys(zip.files).filter((path) => regex.test(path));
  return Promise.all(paths.map((path) => readXml(zip, path)));
}

export async function parseDocxFile(file: File, options: DocxParseOptions = {}): Promise<ParsedDocument> {
  const warnings: string[] = [];
  try {
    ensureNotAborted(options.signal);
    options.onProgress?.("openZip", 8);
    const zip = await JSZip.loadAsync(file);
    ensureNotAborted(options.signal);

    options.onProgress?.("readXml", 20);
    const [documentXml, stylesXml, numberingXml, settingsXml, themeXml, relsXml, coreXml, appXml, footnotesXml, endnotesXml] = await Promise.all([
      readXml(zip, "word/document.xml"),
      readXml(zip, "word/styles.xml"),
      readXml(zip, "word/numbering.xml"),
      readXml(zip, "word/settings.xml"),
      readXml(zip, "word/theme/theme1.xml"),
      readXml(zip, "word/_rels/document.xml.rels"),
      readXml(zip, "docProps/core.xml"),
      readXml(zip, "docProps/app.xml"),
      readXml(zip, "word/footnotes.xml"),
      readXml(zip, "word/endnotes.xml")
    ]);

    if (!documentXml) {
      throw new Error(DOCX_PARSE_ERROR);
    }

    options.onProgress?.("parseStyles", 38);
    const styles = parseStyles(stylesXml);
    const numbering = parseNumbering(numberingXml);
    parseSettings(settingsXml);
    parseTheme(themeXml);

    const metadata = {
      ...readCoreMetadata(coreXml),
      ...readAppMetadata(appXml)
    };

    options.onProgress?.("extractObjects", 55);
    const [headers, footers] = await Promise.all([readMatchingXml(zip, /^word\/header\d+\.xml$/u), readMatchingXml(zip, /^word\/footer\d+\.xml$/u)]);
    const relationships = parseRelationships(relsXml);
    const headerTexts = parseHeaderFooterText(headers);
    const footerTexts = parseHeaderFooterText(footers);
    const footnotes = parseNotes(footnotesXml);
    const endnotes = parseNotes(endnotesXml);

    if (!stylesXml) warnings.push("В DOCX не найден word/styles.xml. Часть проверок оформления выполнена с меньшей точностью.");
    if (!numberingXml) warnings.push("В DOCX не найден word/numbering.xml. Нумерация списков может быть определена приблизительно.");
    if (!settingsXml) warnings.push("В DOCX не найден word/settings.xml. Некоторые параметры документа недоступны.");

    options.onProgress?.("parseDocument", 78);
    const parsed = buildDocumentModel(
      {
        fileName: file.name,
        fileSize: file.size,
        documentXml,
        styles,
        relationships,
        numbering,
        metadata,
        headerTexts,
        footerTexts,
        footnotes,
        endnotes,
        warnings
      },
      options.profile
    );

    if (!parsed.plainText) {
      parsed.warnings.push("Не удалось извлечь текст из DOCX. Возможно, документ состоит из изображений или поврежден.");
    }

    options.onProgress?.("complete", 100);
    return parsed;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(DOCX_PARSE_ERROR);
  }
}

export async function extractDocxPlainText(file: File): Promise<string> {
  const document = await parseDocxFile(file);
  return document.plainText;
}
