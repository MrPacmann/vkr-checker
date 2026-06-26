import { createDefaultSettings, mergeDefaultProfiles, resolveActiveProfileId } from "./profileManager";
import type { AppSettings, WorkType } from "../../types/settings";
import { validateProfile } from "./importExportProfile";

const STORAGE_KEY = "vkr-gost-checker-settings-v1";
const workTypes: WorkType[] = ["coursework", "practiceReport", "bachelorThesis", "masterThesis", "generic"];

export function loadSettings(): AppSettings {
  const defaults = createDefaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const profiles = Array.isArray(parsed.profiles) ? mergeDefaultProfiles(parsed.profiles.map(validateProfile)) : defaults.profiles;
    const activeProfileId = resolveActiveProfileId(profiles, parsed.activeProfileId);
    return {
      activeProfileId,
      activeWorkType: workTypes.includes(parsed.activeWorkType as WorkType) ? (parsed.activeWorkType as WorkType) : defaults.activeWorkType,
      profiles,
      theme: parsed.theme === "dark" ? "dark" : "light"
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  const payload: AppSettings = {
    activeProfileId: settings.activeProfileId,
    activeWorkType: settings.activeWorkType,
    profiles: settings.profiles,
    theme: settings.theme
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}
