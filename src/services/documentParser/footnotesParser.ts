import { normalizeSpaces } from "../../utils/text";
import { childrenDeep, getTextFromXmlNode, type XmlNode } from "../../utils/xml";

export function parseNotes(document: XmlNode | null): string[] {
  if (!document) return [];
  return [...childrenDeep(document, "footnote"), ...childrenDeep(document, "endnote")]
    .map((element) => normalizeSpaces(getTextFromXmlNode(element)))
    .filter(Boolean);
}
