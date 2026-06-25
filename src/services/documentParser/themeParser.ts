import { childrenDeep, getAttr, type XmlNode } from "../../utils/xml";

export interface ThemeModel {
  majorFont?: string;
  minorFont?: string;
}

export function parseTheme(document: XmlNode | null): ThemeModel {
  if (!document) return {};
  const latinFonts = childrenDeep(document, "latin");
  return {
    majorFont: getAttr(latinFonts[0], "typeface"),
    minorFont: getAttr(latinFonts[1], "typeface")
  };
}
