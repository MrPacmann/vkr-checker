import type { RuleProfile } from "../../types/settings";
import { regexPresets } from "../../config/regexPresets";
import { defaultProfiles } from "../../config/defaultProfiles";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateProfile(value: unknown): RuleProfile {
  if (!isRecord(value)) throw new Error("JSON профиля должен быть объектом.");
  const requiredStringFields = ["id", "name", "description"];
  for (const field of requiredStringFields) {
    if (typeof value[field] !== "string" || !value[field]) throw new Error(`В профиле отсутствует строковое поле ${field}.`);
  }
  if (!Array.isArray(value.requiredSections)) throw new Error("Поле requiredSections должно быть массивом.");
  if (!isRecord(value.pageLayout)) throw new Error("Поле pageLayout отсутствует или повреждено.");
  if (!isRecord(value.typography)) throw new Error("Поле typography отсутствует или повреждено.");
  if (!isRecord(value.enabledChecks)) throw new Error("Поле enabledChecks отсутствует или повреждено.");

  const profile = value as unknown as RuleProfile;
  const defaults = defaultProfiles.find((item) => item.id === profile.id) ?? defaultProfiles[0];
  return {
    ...profile,
    profileSchemaVersion: Number(profile.profileSchemaVersion) || 1,
    source: profile.source ?? defaults.source,
    lockedDefault: Boolean(profile.lockedDefault),
    editableCopyAllowed: profile.editableCopyAllowed ?? true,
    workTypes: profile.workTypes ?? defaults.workTypes ?? ["generic"],
    defaultWorkType: profile.defaultWorkType ?? defaults.defaultWorkType ?? "generic",
    activeWorkType: profile.activeWorkType ?? profile.defaultWorkType ?? defaults.defaultWorkType ?? "generic",
    requiredSectionsByWorkType: profile.requiredSectionsByWorkType ?? defaults.requiredSectionsByWorkType,
    alternativeSectionNames: { ...(defaults.alternativeSectionNames ?? {}), ...(profile.alternativeSectionNames ?? {}) },
    pageLayout: { ...defaults.pageLayout, ...(profile.pageLayout ?? {}) },
    typography: { ...defaults.typography, ...(profile.typography ?? {}) },
    numbering: { ...defaults.numbering, ...(profile.numbering ?? {}) },
    captionPatterns: { ...regexPresets.captionPatterns, ...(profile.captionPatterns ?? {}) },
    referencePatterns: { ...regexPresets.referencePatterns, ...(profile.referencePatterns ?? {}) },
    minSourcesByWorkType: profile.minSourcesByWorkType ?? defaults.minSourcesByWorkType,
    maxSourcesByWorkType: profile.maxSourcesByWorkType ?? defaults.maxSourcesByWorkType,
    minSources: Number(profile.minSources) || 0,
    minSectionWords: Number(profile.minSectionWords) || 0,
    ocrMode: profile.ocrMode ?? "auto",
    visualPreference: profile.visualPreference ?? "auto",
    structure: profile.structure ?? defaults.structure,
    headings: profile.headings ?? defaults.headings,
    headingNumbering: profile.headingNumbering ?? defaults.headingNumbering,
    lists: profile.lists ?? defaults.lists,
    tables: profile.tables ?? defaults.tables,
    figures: profile.figures ?? defaults.figures,
    formulas: profile.formulas ?? defaults.formulas,
    listings: profile.listings ?? defaults.listings,
    references: profile.references ?? defaults.references,
    bibliography: profile.bibliography ?? defaults.bibliography,
    appendices: profile.appendices ?? defaults.appendices,
    visualChecks: profile.visualChecks ?? defaults.visualChecks,
    pageNumbering: profile.pageNumbering ?? defaults.pageNumbering,
    severityOverrides: profile.severityOverrides ?? defaults.severityOverrides,
    pmCheckCodes: profile.pmCheckCodes ?? defaults.pmCheckCodes
  };
}

export function profileToJson(profile: RuleProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function profileFromJson(json: string): RuleProfile {
  try {
    return validateProfile(JSON.parse(json));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Не удалось прочитать JSON профиля.");
    throw error;
  }
}
