import JSZip from "jszip";
import { childrenDeep, getAttr, parseXml, type XmlNode } from "../../utils/xml";

export async function readXml(zip: JSZip, path: string): Promise<XmlNode | null> {
  const file = zip.file(path);
  if (!file) return null;
  const content = await file.async("string");
  if (!content.trim()) return null;
  return parseXml(content) as XmlNode;
}

export async function readText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  return file.async("string");
}

export function parseRelationships(document: XmlNode | null): Record<string, string> {
  if (!document) return {};
  const relationships: Record<string, string> = {};
  for (const relationship of childrenDeep(document, "Relationship")) {
    const id = getAttr(relationship, "Id");
    const target = getAttr(relationship, "Target");
    if (id && target) relationships[id] = target;
  }
  return relationships;
}
