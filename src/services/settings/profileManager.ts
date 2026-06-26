import { defaultProfiles, isUserVisibleProfile, PRIMARY_PROFILE_ID } from "../../config/defaultProfiles";
import type { AppSettings, RuleProfile, WorkType } from "../../types/settings";
import { createId } from "../../utils/id";

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
  return {
    ...settings,
    profiles: settings.profiles.map((item) => (item.id === profile.id ? profile : item))
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
  const map = new Map(profiles.map((profile) => [profile.id, profile]));
  for (const defaultProfile of cloneDefaultProfiles()) {
    if (!map.has(defaultProfile.id)) map.set(defaultProfile.id, defaultProfile);
  }
  return Array.from(map.values());
}

export function duplicateProfile(settings: AppSettings, profileId: string): AppSettings {
  const profile = settings.profiles.find((item) => item.id === profileId);
  if (!profile) return settings;
  const copy = {
    ...JSON.parse(JSON.stringify(profile)),
    id: createId("profile"),
    name: `${profile.name} (копия)`,
    originalProfileId: profile.originalProfileId ?? profile.id,
    lockedDefault: false,
    editableCopyAllowed: true
  } as RuleProfile;
  return {
    ...settings,
    profiles: [...settings.profiles, copy],
    activeProfileId: copy.id
  };
}

export function resetProfileToDefault(settings: AppSettings, profileId: string): AppSettings {
  const profile = settings.profiles.find((item) => item.id === profileId);
  const fallback = defaultProfiles.find((item) => item.id === (profile?.originalProfileId ?? profileId)) ?? defaultProfiles[0];
  const reset = profile?.originalProfileId ? { ...JSON.parse(JSON.stringify(fallback)), id: profile.id, name: profile.name, originalProfileId: profile.originalProfileId, lockedDefault: false } : JSON.parse(JSON.stringify(fallback));
  return updateProfile(settings, reset as RuleProfile);
}
