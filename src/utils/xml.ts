import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  allowBooleanAttributes: true
});

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAttributes(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, attrValue]) => [key, attrValue === true ? "true" : String(attrValue ?? "")]));
}

function convertOrderedItem(item: unknown): XmlNode[] {
  if (!isRecord(item)) return [];
  if ("#text" in item) {
    return [
      {
        name: "#text",
        attributes: {},
        children: [],
        text: String(item["#text"] ?? "")
      }
    ];
  }

  const attributes = normalizeAttributes(item[":@"]);
  const nodes: XmlNode[] = [];
  for (const [key, value] of Object.entries(item)) {
    if (key === ":@" || key.startsWith("?")) continue;
    nodes.push({
      name: key,
      attributes,
      children: convertOrderedItems(asArray(value))
    });
  }
  return nodes;
}

function convertOrderedItems(items: unknown[]): XmlNode[] {
  return items.flatMap(convertOrderedItem);
}

export function parseXml(xml: string): unknown {
  const validation = XMLValidator.validate(xml, {
    allowBooleanAttributes: true
  });
  if (validation !== true) {
    throw new Error("XML внутри DOCX поврежден.");
  }

  const parsed = parser.parse(xml);
  return {
    name: "#document",
    attributes: {},
    children: convertOrderedItems(asArray(parsed))
  } satisfies XmlNode;
}

export function localName(nodeOrName: XmlNode | string | null | undefined): string {
  const name = typeof nodeOrName === "string" ? nodeOrName : nodeOrName?.name ?? "";
  return name.includes(":") ? name.slice(name.lastIndexOf(":") + 1) : name;
}

export function getAttr(node: XmlNode | null | undefined, localAttrName: string): string | undefined {
  if (!node) return undefined;
  for (const [name, value] of Object.entries(node.attributes)) {
    if (name === localAttrName || localName(name) === localAttrName) return value;
  }
  return undefined;
}

export function directChild(node: XmlNode | null | undefined, name: string): XmlNode | null {
  return directChildren(node, name)[0] ?? null;
}

export function directChildren(node: XmlNode | null | undefined, name: string): XmlNode[] {
  if (!node) return [];
  return node.children.filter((child) => localName(child) === name);
}

export function childrenDeep(node: XmlNode | null | undefined, name: string): XmlNode[] {
  if (!node) return [];
  const result: XmlNode[] = [];
  for (const child of node.children) {
    if (localName(child) === name) result.push(child);
    result.push(...childrenDeep(child, name));
  }
  return result;
}

export function getTextFromXmlNode(node: XmlNode | null | undefined): string {
  if (!node) return "";
  if (node.name === "#text") return node.text ?? "";
  if (localName(node) === "tab") return "\t";
  if (localName(node) === "br") return "\n";
  return node.children.map(getTextFromXmlNode).join("");
}

export function twipsToMm(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round((parsed / 56.6929) * 10) / 10;
}

export function halfPointsToPt(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed / 2;
}
