export interface RunFormat {
  fontFamily?: string;
  fontSizePt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface ParagraphFormat {
  alignment?: "justify" | "left" | "center" | "right";
  firstLineIndentCm?: number;
  lineSpacing?: number;
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  pageBreakBefore?: boolean;
}

export interface StyleDefinition {
  id: string;
  name: string;
  type: "paragraph" | "character" | "table" | "numbering" | "unknown";
  basedOn?: string;
  next?: string;
  isHeading?: boolean;
  headingLevel?: number;
  runFormat: RunFormat;
  paragraphFormat: ParagraphFormat;
  numbering?: {
    numId?: string;
    level?: number;
  };
}

export interface DocumentDefaults {
  runFormat: RunFormat;
  paragraphFormat: ParagraphFormat;
}

export interface StylesModel {
  styles: Record<string, StyleDefinition>;
  defaults: DocumentDefaults;
}
