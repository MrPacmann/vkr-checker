import type { DocumentDefaults, ParagraphFormat, RunFormat, StyleDefinition, StylesModel } from "../../types/styles";
import { childrenDeep, directChild, getAttr, halfPointsToPt, localName, twipsToMm, type XmlNode } from "../../utils/xml";

export interface ResolvedStyle {
  isHeading: boolean;
  headingLevel?: number;
}

function inferHeadingLevelFromName(name: string): number | undefined {
  const normalized = name.toLowerCase().replace(/ё/gu, "е");
  const numeric = /(?:heading|заголовок)\s*(\d)/iu.exec(name);
  if (numeric) return Number(numeric[1]);
  if (/заголовок.*перв/u.test(normalized)) return 1;
  if (/заголовок.*втор/u.test(normalized)) return 2;
  if (/заголовок.*трет/u.test(normalized)) return 3;
  if (/heading\s*one/u.test(normalized)) return 1;
  if (/heading\s*two/u.test(normalized)) return 2;
  if (/heading\s*three/u.test(normalized)) return 3;
  return undefined;
}

function parseRunFormat(container: XmlNode | null): RunFormat {
  if (!container) return {};
  const runProps = localName(container) === "rPr" ? container : directChild(container, "rPr");
  if (!runProps) return {};
  const fonts = directChild(runProps, "rFonts");
  const sz = directChild(runProps, "sz");
  return {
    fontFamily: getAttr(fonts, "ascii") ?? getAttr(fonts, "hAnsi") ?? getAttr(fonts, "cs"),
    fontSizePt: halfPointsToPt(getAttr(sz, "val")),
    bold: Boolean(directChild(runProps, "b")),
    italic: Boolean(directChild(runProps, "i")),
    underline: Boolean(directChild(runProps, "u"))
  };
}

function parseParagraphFormat(container: XmlNode | null): ParagraphFormat {
  if (!container) return {};
  const paragraphProps = localName(container) === "pPr" ? container : directChild(container, "pPr");
  if (!paragraphProps) return {};
  const jc = directChild(paragraphProps, "jc");
  const ind = directChild(paragraphProps, "ind");
  const spacing = directChild(paragraphProps, "spacing");
  const lineRaw = getAttr(spacing, "line");
  const lineRule = getAttr(spacing, "lineRule");
  const lineValue = lineRaw ? Number.parseFloat(lineRaw) : undefined;
  const lineSpacing =
    lineValue && lineRule === "auto" ? Math.round((lineValue / 240) * 100) / 100 : lineValue ? Math.round((lineValue / 240) * 100) / 100 : undefined;
  const alignmentRaw = getAttr(jc, "val");
  const alignment =
    alignmentRaw === "both" ? "justify" : alignmentRaw === "center" ? "center" : alignmentRaw === "right" ? "right" : alignmentRaw === "left" ? "left" : undefined;
  return {
    alignment,
    firstLineIndentCm: twipsToMm(getAttr(ind, "firstLine")) ? Math.round((twipsToMm(getAttr(ind, "firstLine"))! / 10) * 100) / 100 : undefined,
    lineSpacing,
    spacingBeforePt: getAttr(spacing, "before") ? Number(getAttr(spacing, "before")) / 20 : undefined,
    spacingAfterPt: getAttr(spacing, "after") ? Number(getAttr(spacing, "after")) / 20 : undefined,
    pageBreakBefore: directChild(paragraphProps, "pageBreakBefore") ? true : undefined
  };
}

function parseStyleNumbering(container: XmlNode | null): StyleDefinition["numbering"] | undefined {
  if (!container) return undefined;
  const pPr = localName(container) === "pPr" ? container : directChild(container, "pPr");
  const numPr = pPr ? directChild(pPr, "numPr") : null;
  if (!numPr) return undefined;
  return {
    numId: getAttr(directChild(numPr, "numId"), "val"),
    level: getAttr(directChild(numPr, "ilvl"), "val") ? Number(getAttr(directChild(numPr, "ilvl"), "val")) : undefined
  };
}

function parseDefaults(document: XmlNode): DocumentDefaults {
  const docDefaults = childrenDeep(document, "docDefaults")[0] ?? null;
  return {
    runFormat: parseRunFormat(docDefaults),
    paragraphFormat: parseParagraphFormat(docDefaults)
  };
}

export function parseStyles(document: XmlNode | null): StylesModel {
  if (!document) {
    return {
      styles: {},
      defaults: { runFormat: {}, paragraphFormat: {} }
    };
  }
  const styles: Record<string, StyleDefinition> = {};
  for (const style of childrenDeep(document, "style")) {
    const id = getAttr(style, "styleId");
    if (!id) continue;
    const name = getAttr(directChild(style, "name"), "val") ?? id;
    const typeRaw = getAttr(style, "type");
    const basedOn = getAttr(directChild(style, "basedOn"), "val");
    const next = getAttr(directChild(style, "next"), "val");
    const outlineLvl = getAttr(directChild(directChild(style, "pPr") ?? style, "outlineLvl"), "val");
    const headingLevel = outlineLvl ? Number(outlineLvl) + 1 : inferHeadingLevelFromName(name);
    styles[id] = {
      id,
      name,
      type: typeRaw === "paragraph" || typeRaw === "character" || typeRaw === "table" || typeRaw === "numbering" ? typeRaw : "unknown",
      basedOn,
      next,
      isHeading: headingLevel !== undefined,
      headingLevel,
      runFormat: parseRunFormat(style),
      paragraphFormat: parseParagraphFormat(style),
      numbering: parseStyleNumbering(style)
    };
  }

  for (const style of Object.values(styles)) {
    const resolved = resolveStyleInheritance(style.id, { styles, defaults: parseDefaults(document) });
    style.isHeading = resolved.isHeading;
    style.headingLevel = resolved.headingLevel;
  }

  return {
    styles,
    defaults: parseDefaults(document)
  };
}

export function resolveStyleInheritance(styleId: string | undefined, styles: StylesModel): ResolvedStyle {
  const visited = new Set<string>();
  let currentId = styleId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const style = styles.styles[currentId];
    if (!style) break;
    const inferred = style.headingLevel ?? inferHeadingLevelFromName(style.name);
    if (style.isHeading || inferred !== undefined) {
      return { isHeading: true, headingLevel: inferred ?? style.headingLevel };
    }
    currentId = style.basedOn;
  }
  return { isHeading: false };
}

export function resolveRunFormat(styleId: string | undefined, styles: StylesModel, direct: RunFormat): RunFormat {
  const chain: RunFormat[] = [styles.defaults.runFormat];
  const visited = new Set<string>();
  let currentId = styleId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const style = styles.styles[currentId];
    if (!style) break;
    chain.push(style.runFormat);
    currentId = style.basedOn;
  }
  chain.push(direct);
  return Object.assign({}, ...chain.filter(Boolean));
}

export function resolveParagraphFormat(styleId: string | undefined, styles: StylesModel, direct: ParagraphFormat): ParagraphFormat {
  const chain: ParagraphFormat[] = [styles.defaults.paragraphFormat];
  const visited = new Set<string>();
  let currentId = styleId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const style = styles.styles[currentId];
    if (!style) break;
    chain.push(style.paragraphFormat);
    currentId = style.basedOn;
  }
  chain.push(direct);
  return Object.assign({}, ...chain.filter(Boolean));
}

export function resolveStyleNumbering(styleId: string | undefined, styles: StylesModel): StyleDefinition["numbering"] | undefined {
  const visited = new Set<string>();
  let currentId = styleId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const style = styles.styles[currentId];
    if (!style) break;
    if (style.numbering?.numId) return style.numbering;
    currentId = style.basedOn;
  }
  return undefined;
}

export { parseParagraphFormat, parseRunFormat };
