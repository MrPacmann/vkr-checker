import { defaultProfiles, isUserVisibleProfile, PRIMARY_PROFILE_ID } from "../../config/defaultProfiles";
import type { AppSettings, RuleProfile, WorkType } from "../../types/settings";
import { createId } from "../../utils/id";

const builtInProfileIds = new Set(defaultProfiles.map((profile) => profile.id));

export function cloneDefaultProfiles(): RuleProfile[] {
  return JSON.parse(JSON.stringify(defaultProfiles)) as RuleProfile[];
}

export function getPrimaryProfile(): RuleProfile {
  return defaultProfiles.find((profile) => profile.id === PRIMARY_PROFILE_ID) ?? defaultProfiles[0];
}

export function getVisibleProfiles(profiles: RuleProfile[]): RuleProfile[] {
  const visible = profiles.filter(isUserVisibleProfile);
  return visible.length > 0 ? visible : [getPrimaryProfile()];
}

export function isMainProfile(profile: RuleProfile): boolean {
  return profile.id === PRIMARY_PROFILE_ID;
}

export function isBuiltInProfile(profile: RuleProfile): boolean {
  return profile.profileOrigin === "built-in" || Boolean(profile.lockedDefault) || Boolean(profile.isLocked) || builtInProfileIds.has(profile.id);
}

export function isProfileDeletable(profile: RuleProfile): boolean {
  return !isMainProfile(profile) && !isBuiltInProfile(profile) && profile.profileOrigin === "user";
}

export function resolveActiveProfileId(profiles: RuleProfile[], activeProfileId?: string | null): string {
  const visibleProfiles = getVisibleProfiles(profiles);
  return activeProfileId && visibleProfiles.some((profile) => profile.id === activeProfileId) ? activeProfileId : PRIMARY_PROFILE_ID;
}

export function createDefaultSettings(): AppSettings {
  const primary = getPrimaryProfile();
  return {
    activeProfileId: primary.id,
    activeWorkType: primary.defaultWorkType ?? "generic",
    profiles: cloneDefaultProfiles(),
    theme: "light"
  };
}

export function getActiveProfile(settings: AppSettings): RuleProfile {
  const activeProfileId = resolveActiveProfileId(settings.profiles, settings.activeProfileId);
  return settings.profiles.find((profile) => profile.id === activeProfileId) ?? getPrimaryProfile();
}

export function updateProfile(settings: AppSettings, profile: RuleProfile): AppSettings {
  if (isBuiltInProfile(profile)) return settings;
  const updatedProfile = {
    ...profile,
    profileOrigin: "user" as const,
    isLocked: false,
    isDefault: false,
    updatedAt: new Date().toISOString()
  };
  return {
    ...settings,
    profiles: settings.profiles.map((item) => (item.id === profile.id ? updatedProfile : item))
  };
}

export function resolveProfileForWorkType(profile: RuleProfile, workType: WorkType): RuleProfile {
  const supportedWorkType = profile.workTypes?.includes(workType) ? workType : profile.defaultWorkType ?? "generic";
  return {
    ...profile,
    activeWorkType: supportedWorkType,
    requiredSections: profile.requiredSectionsByWorkType?.[supportedWorkType] ?? profile.requiredSections,
    minSources: profile.minSourcesByWorkType?.[supportedWorkType] ?? profile.minSources
  };
}

export function mergeDefaultProfiles(profiles: RuleProfile[]): RuleProfile[] {
  const map = new Map(cloneDefaultProfiles().map((profile) => [profile.id, profile]));
  for (const profile of profiles) {
    if (builtInProfileIds.has(profile.id)) continue;
    if (profile.lockedDefault || profile.isLocked) continue;
    map.set(profile.id, {
      ...profile,
      profileOrigin: "user",
      isLocked: false,
      isDefault: false
    });
  }
  return Array.from(map.values());
}

function uniqueProfileName(profiles: RuleProfile[], requestedName: string): string {
  const baseName = requestedName.trim();
  if (!profiles.some((profile) => profile.name === baseName)) return baseName;
  let index = 2;
  while (profiles.some((profile) => profile.name === `${baseName} (${index})`)) index += 1;
  return `${baseName} (${index})`;
}

export function cloneProfile(profile: RuleProfile, profiles: RuleProfile[], name?: string): RuleProfile {
  const now = new Date().toISOString();
  const requestedName = name?.trim() || `Копия: ${profile.name}`;
  return {
    ...JSON.parse(JSON.stringify(profile)),
    id: createId("profile"),
    name: uniqueProfileName(profiles, requestedName),
    profileOrigin: "user",
    isLocked: false,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    basedOnProfileId: profile.basedOnProfileId ?? profile.originalProfileId ?? profile.id,
    originalProfileId: profile.originalProfileId ?? profile.id,
    lockedDefault: false,
    editableCopyAllowed: true
  } as RuleProfile;
}

export function duplicateProfile(settings: AppSettings, profileId: string, name?: string): AppSettings {
  const profile = settings.profiles.find((item) => item.id === profileId) ?? getPrimaryProfile();
  const copy = cloneProfile(profile, settings.profiles, name);
  return {
    ...settings,
    profiles: [...settings.profiles, copy],
    activeProfileId: copy.id
  };
}

export function createProfileFromMain(settings: AppSettings, name: string): AppSettings {
  if (!name.trim()) return settings;
  return duplicateProfile(settings, PRIMARY_PROFILE_ID, name);
}

export function importUserProfile(settings: AppSettings, profile: RuleProfile): AppSettings {
  const now = new Date().toISOString();
  const imported = {
    ...JSON.parse(JSON.stringify(profile)),
    id: builtInProfileIds.has(profile.id) || settings.profiles.some((item) => item.id === profile.id) ? createId("profile") : profile.id,
    name: uniqueProfileName(settings.profiles, profile.name || "Импортированный профиль"),
    profileOrigin: "user",
    isLocked: false,
    isDefault: false,
    createdAt: profile.createdAt ?? now,
    updatedAt: now,
    basedOnProfileId: profile.basedOnProfileId ?? profile.originalProfileId ?? (builtInProfileIds.has(profile.id) ? profile.id : undefined),
    originalProfileId: profile.originalProfileId ?? (builtInProfileIds.has(profile.id) ? profile.id : undefined),
    lockedDefault: false,
    editableCopyAllowed: true
  } as RuleProfile;
  return {
    ...settings,
    profiles: [...settings.profiles, imported],
    activeProfileId: imported.id
  };
}

export function deleteProfile(settings: AppSettings, profileId: string): AppSettings {
  const profile = settings.profiles.find((item) => item.id === profileId);
  if (!profile || !isProfileDeletable(profile)) return settings;
  const profiles = settings.profiles.filter((item) => item.id !== profileId);
  return {
    ...settings,
    profiles,
    activeProfileId: settings.activeProfileId === profileId ? PRIMARY_PROFILE_ID : resolveActiveProfileId(profiles, settings.activeProfileId)
  };
}

export function resetProfileToDefault(settings: AppSettings, profileId: string): AppSettings {
  const profile = settings.profiles.find((item) => item.id === profileId);
  if (!profile || !isProfileDeletable(profile)) return settings;
  const fallback = defaultProfiles.find((item) => item.id === (profile.basedOnProfileId ?? profile.originalProfileId ?? profileId)) ?? getPrimaryProfile();
  const now = new Date().toISOString();
  const reset = {
    ...JSON.parse(JSON.stringify(fallback)),
    id: profile.id,
    name: profile.name,
    description: profile.description,
    profileOrigin: "user",
    isLocked: false,
    isDefault: false,
    createdAt: profile.createdAt ?? now,
    updatedAt: now,
    basedOnProfileId: profile.basedOnProfileId ?? profile.originalProfileId ?? fallback.id,
    originalProfileId: profile.originalProfileId ?? fallback.id,
    lockedDefault: false
  };
  return updateProfile(settings, reset as RuleProfile);
}
