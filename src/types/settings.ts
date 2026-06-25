import type { EnabledChecks } from "./rules";
import type { IssueLevel } from "./rules";

export type NumberingMode = "continuous" | "bySection";
export type VisualPreference = "auto" | "uploadedPdf" | "htmlPreview" | "textOnly";
export type OcrMode = "auto" | "enabled" | "disabled";
export type ThemeMode = "light" | "dark";
export type WorkType = "coursework" | "practiceReport" | "bachelorThesis" | "masterThesis" | "generic";
export type SourceAgeCheckMode = "strict" | "warning" | "disabled";
export type ContinuousNumberingSeverity = "info" | "warning" | "error";

export interface ProfileSource {
  title: string;
  department?: string;
  type?: string;
  version?: string;
}

export type RuleSettingsBlock = Record<string, unknown>;

export interface PageLayoutProfile {
  pageSize: "A4" | "custom";
  widthMm?: number;
  heightMm?: number;
  printSide?: "one-sided" | "two-sided";
  leftMarginMm: number;
  rightMarginMm: number;
  topMarginMm: number;
  bottomMarginMm: number;
  marginToleranceMm: number;
  allowedRightMarginMm?: number[];
  landscapeMargins?: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
  allowLandscapePages?: boolean;
  landscapeOnlyFor?: string[];
  forbidMainTextOnLandscapePages?: boolean;
  orientation: "portrait" | "landscape";
}

export interface TypographyProfile {
  mainFont: string;
  mainFontSizePt: number;
  lineSpacing: number;
  firstLineIndentCm: number;
  alignment: "justify" | "left" | "center" | "right";
  mainText?: RuleSettingsBlock;
  tolerance?: RuleSettingsBlock;
}

export interface RuleProfile {
  id: string;
  name: string;
  description: string;
  profileSchemaVersion?: number;
  source?: ProfileSource;
  lockedDefault?: boolean;
  editableCopyAllowed?: boolean;
  originalProfileId?: string;
  workTypes?: WorkType[];
  defaultWorkType?: WorkType;
  activeWorkType?: WorkType;
  requiredSections: string[];
  requiredSectionsByWorkType?: Partial<Record<WorkType, string[]>>;
  alternativeSectionNames: Record<string, string[]>;
  structure?: RuleSettingsBlock;
  pageLayout: PageLayoutProfile;
  typography: TypographyProfile;
  headings?: RuleSettingsBlock;
  headingNumbering?: RuleSettingsBlock;
  numbering: {
    figures: NumberingMode;
    tables: NumberingMode;
    formulas: NumberingMode;
    listings: NumberingMode;
    schemes: NumberingMode;
  };
  numberingPolicy?: {
    tables?: {
      expected: NumberingMode;
      allowContinuousWhenFew?: boolean;
      continuousAllowedMaxCount?: number;
      continuousNumberingSeverity?: ContinuousNumberingSeverity;
      continuousNumberingSeverityWhenAllowed?: ContinuousNumberingSeverity;
      continuousNumberingSeverityWhenMany?: ContinuousNumberingSeverity;
    };
    figures?: {
      expected: NumberingMode;
      allowContinuousWhenFew?: boolean;
      continuousAllowedMaxCount?: number;
      continuousNumberingSeverity?: ContinuousNumberingSeverity;
      continuousNumberingSeverityWhenAllowed?: ContinuousNumberingSeverity;
      continuousNumberingSeverityWhenMany?: ContinuousNumberingSeverity;
    };
  };
  minSources: number;
  minSourcesByWorkType?: Partial<Record<WorkType, number>>;
  maxSourcesByWorkType?: Partial<Record<WorkType, number>>;
  minSectionWords: number;
  headingTopLevelStartsPage: boolean;
  forbidHeadingTrailingDot: boolean;
  forbidSingleSubsection: boolean;
  captionPatterns: {
    figure: string;
    table: string;
    listing: string;
    scheme: string;
    formula: string;
  };
  referencePatterns: {
    figure: string;
    table: string;
    listing: string;
    scheme: string;
    formula: string;
    source: string;
    appendix: string;
  };
  enabledChecks: EnabledChecks;
  ocrMode: OcrMode;
  visualPreference: VisualPreference;
  lists?: RuleSettingsBlock;
  tables?: RuleSettingsBlock;
  figures?: RuleSettingsBlock & {
    referenceRequired?: boolean;
    missingReferenceSeverity?: IssueLevel;
    aggregateMissingReferencesThreshold?: number;
    allowCaptionOnlyWhenNearbyTextMentionsObject?: boolean;
  };
  formulas?: RuleSettingsBlock;
  listings?: RuleSettingsBlock;
  references?: RuleSettingsBlock;
  bibliography?: RuleSettingsBlock & { sourceAgeCheckMode?: SourceAgeCheckMode };
  appendices?: RuleSettingsBlock;
  visualChecks?: RuleSettingsBlock;
  pageNumbering?: RuleSettingsBlock;
  severityOverrides?: Record<string, IssueLevel>;
  pmCheckCodes?: string[];
}

export type RulesProfile = RuleProfile;

export interface AppSettings {
  activeProfileId: string;
  activeWorkType: WorkType;
  profiles: RuleProfile[];
  theme: ThemeMode;
}
