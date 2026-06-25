import { childrenDeep, getAttr, type XmlNode } from "../../utils/xml";

export interface DocumentSettings {
  evenAndOddHeaders: boolean;
  updateFields: boolean;
  compatibilityMode?: string;
}

export function parseSettings(document: XmlNode | null): DocumentSettings {
  if (!document) {
    return { evenAndOddHeaders: false, updateFields: false };
  }
  const has = (name: string) => childrenDeep(document, name).length > 0;
  const compatSetting = childrenDeep(document, "compatSetting").find((element) => getAttr(element, "name") === "compatibilityMode");
  return {
    evenAndOddHeaders: has("evenAndOddHeaders"),
    updateFields: has("updateFields"),
    compatibilityMode: getAttr(compatSetting, "val")
  };
}
