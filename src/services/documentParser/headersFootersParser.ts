import { normalizeSpaces } from "../../utils/text";
import { getTextFromXmlNode, type XmlNode } from "../../utils/xml";

export function parseHeaderFooterText(documents: Array<XmlNode | null>): string[] {
  return documents
    .filter((document): document is XmlNode => Boolean(document))
    .map((document) => normalizeSpaces(getTextFromXmlNode(document)))
    .filter(Boolean);
}
