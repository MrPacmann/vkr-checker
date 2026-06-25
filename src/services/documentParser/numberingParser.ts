import { childrenDeep, directChild, directChildren, getAttr, type XmlNode } from "../../utils/xml";

export interface NumberingLevelDefinition {
  abstractNumId: string;
  ilvl: string;
  numFmt?: string;
  lvlText?: string;
  start?: number;
}

export interface NumberingModel {
  nums: Record<string, string>;
  levels: Record<string, Record<string, NumberingLevelDefinition>>;
  definitions: NumberingLevelDefinition[];
}

export function parseNumbering(document: XmlNode | null): NumberingModel {
  if (!document) return { nums: {}, levels: {}, definitions: [] };
  const nums: Record<string, string> = {};
  const levels: NumberingModel["levels"] = {};
  const definitions: NumberingLevelDefinition[] = [];
  for (const abstractNum of childrenDeep(document, "abstractNum")) {
    const abstractId = getAttr(abstractNum, "abstractNumId");
    if (!abstractId) continue;
    levels[abstractId] = {};
    for (const lvl of directChildren(abstractNum, "lvl")) {
      const ilvl = getAttr(lvl, "ilvl") ?? "0";
      const definition: NumberingLevelDefinition = {
        abstractNumId: abstractId,
        ilvl,
        numFmt: getAttr(directChild(lvl, "numFmt"), "val"),
        lvlText: getAttr(directChild(lvl, "lvlText"), "val"),
        start: getAttr(directChild(lvl, "start"), "val") ? Number(getAttr(directChild(lvl, "start"), "val")) : undefined
      };
      levels[abstractId][ilvl] = definition;
      definitions.push(definition);
    }
  }
  for (const num of childrenDeep(document, "num")) {
    const numId = getAttr(num, "numId");
    const abstractId = getAttr(directChild(num, "abstractNumId"), "val");
    if (numId && abstractId) nums[numId] = abstractId;
  }
  return { nums, levels, definitions };
}
