import { Download, RotateCcw, Upload, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AppSettings, RuleProfile, WorkType } from "../types/settings";
import { defaultRules } from "../config/defaultRules";
import { regexPresets } from "../config/regexPresets";
import { downloadBlob } from "../utils/file";
import {
  createProfileFromMain,
  deleteProfile,
  duplicateProfile,
  getActiveProfile,
  getVisibleProfiles,
  importUserProfile,
  isProfileDeletable,
  resetProfileToDefault,
  updateProfile
} from "../services/settings/profileManager";
import { profileFromJson, profileToJson } from "../services/settings/importExportProfile";
import { ProfileSelector } from "./ProfileSelector";
import { RegexEditor } from "./RegexEditor";
import { RuleToggle } from "./RuleToggle";

interface SettingsEditorProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

function updateProfileField<T extends keyof RuleProfile>(profile: RuleProfile, key: T, value: RuleProfile[T]): RuleProfile {
  return { ...profile, [key]: value };
}

const workTypeLabels: Record<WorkType, string> = {
  coursework: "Курсовая работа",
  practiceReport: "Отчёт по практике",
  bachelorThesis: "ВКР бакалавра",
  masterThesis: "ВКР магистра",
  generic: "Универсальная учебная работа"
};

const advancedProfileKeys = [
  "structure",
  "headings",
  "headingNumbering",
  "lists",
  "tables",
  "figures",
  "formulas",
  "listings",
  "references",
  "bibliography",
  "appendices",
  "visualChecks",
  "pageNumbering",
  "severityOverrides"
] as const;

const captionPatternDescriptions: Record<string, string> = {
  figure: "Как программа ищет подписи под рисунками. Например: Рисунок 1 — Название",
  table: "Как программа ищет названия таблиц. Например: Таблица 1 — Название",
  listing: "Например: Листинг 1 — Название",
  scheme: "Например: Схема 1 — Название",
  formula: "Подписи или номера формул. Например: (1) или (2.1)"
};

const referencePatternDescriptions: Record<string, string> = {
  figure: "Как программа ищет ссылки на рисунки в тексте. Например: показано на рисунке 1",
  table: "Как программа ищет ссылки на таблицы. Например: данные представлены в таблице 1",
  listing: "Например: в листинге 1",
  scheme: "Например: на схеме 1",
  formula: "Например: по формуле (1)",
  source: "Например: [1], [2, с. 15], [1–3]",
  appendix: "Например: см. приложение А"
};

export function SettingsEditor({ settings, onSettingsChange }: SettingsEditorProps) {
  const activeProfile = getActiveProfile(settings);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const [advancedDraft, setAdvancedDraft] = useState("");
  const isLocked = Boolean(activeProfile.isLocked || activeProfile.lockedDefault);
  const canDeleteProfile = isProfileDeletable(activeProfile);
  const visibleProfiles = getVisibleProfiles(settings.profiles);
  const selectedProfileId = visibleProfiles.some((profile) => profile.id === settings.activeProfileId) ? settings.activeProfileId : activeProfile.id;

  const setProfile = (profile: RuleProfile) => {
    if (isLocked) {
      setValidationMessage("Встроенный профиль защищён. Создайте копию, чтобы редактировать параметры.");
      return;
    }
    onSettingsChange(updateProfile(settings, profile));
  };

  const exportProfile = () => {
    const blob = new Blob([profileToJson(activeProfile)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `${activeProfile.id}.json`);
  };

  const importProfile = async (file?: File) => {
    if (!file) return;
    try {
      const profile = profileFromJson(await file.text());
      setImportError(null);
      onSettingsChange(importUserProfile(settings, profile));
    } catch {
      setImportError("Не удалось импортировать профиль: неверный формат файла.");
    }
  };

  const createProfileWithName = () => {
    const name = window.prompt("Название нового профиля", "Мой профиль");
    if (name === null) return;
    if (!name.trim()) {
      setValidationMessage("Введите название профиля");
      return;
    }
    onSettingsChange(createProfileFromMain(settings, name));
  };

  const cloneSelectedProfile = (profileId = activeProfile.id) => {
    const sourceProfile = settings.profiles.find((profile) => profile.id === profileId) ?? activeProfile;
    const name = window.prompt("Название копии профиля", `Копия: ${sourceProfile.name}`);
    if (name === null) return;
    if (!name.trim()) {
      setValidationMessage("Введите название профиля");
      return;
    }
    onSettingsChange(duplicateProfile(settings, profileId, name));
  };

  const deleteSelectedProfile = (profileId = activeProfile.id) => {
    const profile = settings.profiles.find((item) => item.id === profileId);
    if (!profile || !isProfileDeletable(profile)) return;
    if (!window.confirm(`Удалить профиль «${profile.name}»? Это действие нельзя отменить.`)) return;
    onSettingsChange(deleteProfile(settings, profileId));
  };

  const advancedRulesJson = JSON.stringify(Object.fromEntries(advancedProfileKeys.map((key) => [key, activeProfile[key]])), null, 2);

  useEffect(() => {
    setAdvancedDraft(advancedRulesJson);
    setAdvancedError(null);
  }, [advancedRulesJson]);

  const updateAdvancedRules = (value: string) => {
    if (isLocked) return;
    try {
      const parsed = JSON.parse(value) as Partial<RuleProfile>;
      setAdvancedError(null);
      setProfile({ ...activeProfile, ...parsed });
    } catch {
      setAdvancedError("Расширенные правила должны быть корректным JSON.");
    }
  };

  const validateActiveProfile = () => {
    try {
      profileFromJson(profileToJson(activeProfile));
      setValidationMessage("Профиль корректен.");
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : "Профиль повреждён.");
    }
  };

  const resetRegexPatterns = () => {
    setProfile({
      ...activeProfile,
      captionPatterns: regexPresets.captionPatterns,
      referencePatterns: regexPresets.referencePatterns
    });
  };

  const selectProfile = (activeProfileId: string) => {
    const profile = settings.profiles.find((item) => item.id === activeProfileId);
    onSettingsChange({
      ...settings,
      activeProfileId,
      activeWorkType: profile?.defaultWorkType ?? settings.activeWorkType
    });
  };

  return (
    <div className="settings-grid">
      <aside className="settings-section">
        <h2>Профили</h2>
        <ProfileSelector profiles={visibleProfiles} activeProfileId={selectedProfileId} onSelect={selectProfile} onClone={cloneSelectedProfile} onDelete={deleteSelectedProfile} />
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="button primary" type="button" onClick={createProfileWithName}>
            Создать профиль
          </button>
          <button className="button" type="button" onClick={() => cloneSelectedProfile(activeProfile.id)}>
            <Copy size={18} /> Создать копию
          </button>
          <button className="button" type="button" onClick={exportProfile} disabled={isLocked}>
            <Download size={18} /> Экспортировать профиль
          </button>
          <button className="button" type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} /> Импорт
          </button>
          {canDeleteProfile && (
            <>
              <button className="button" type="button" onClick={() => onSettingsChange(resetProfileToDefault(settings, activeProfile.id))}>
                <RotateCcw size={18} /> Сбросить изменения
              </button>
              <button className="button danger" type="button" onClick={() => deleteSelectedProfile(activeProfile.id)}>
                Удалить профиль
              </button>
            </>
          )}
          <button className="button" type="button" onClick={() => setValidationMessage("Профиль сохранён локально.")}>
            Сохранить профиль
          </button>
          <button className="button" type="button" onClick={validateActiveProfile}>
            Проверить корректность профиля
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={(event) => importProfile(event.target.files?.[0])} />
        {importError && <p className="pill error">{importError}</p>}
        {validationMessage && <p className="pill info">{validationMessage}</p>}
      </aside>

      <section className="settings-section">
        <h2>{activeProfile.name}</h2>
        {isLocked && (
          <div className="notice" style={{ marginBottom: 14 }}>
            <div>
              <strong>Встроенный профиль защищён</strong>
              <p className="muted">Создайте копию профиля, чтобы изменить кафедральные требования под конкретную работу.</p>
            </div>
          </div>
        )}
        {activeProfile.source && (
          <p className="muted">
            Источник правил: {activeProfile.source.department ? `${activeProfile.source.department}, ` : ""}
            {activeProfile.source.title}
          </p>
        )}
        <label>
          <span className="muted">Название профиля</span>
          <input className="field" value={activeProfile.name} disabled={isLocked} onChange={(event) => setProfile(updateProfileField(activeProfile, "name", event.target.value))} />
        </label>
        <label>
          <span className="muted">Описание</span>
          <textarea className="textarea" value={activeProfile.description} disabled={isLocked} onChange={(event) => setProfile(updateProfileField(activeProfile, "description", event.target.value))} />
        </label>

        <div className="grid two" style={{ marginTop: 18 }}>
          <div>
            <h3>Обязательные разделы</h3>
            <textarea
              className="textarea"
              disabled={isLocked}
              value={activeProfile.requiredSections.join("\n")}
              onChange={(event) => setProfile(updateProfileField(activeProfile, "requiredSections", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean)))}
            />
          </div>
          <div>
            <h3>Режимы</h3>
            <label>
              <span className="muted">Тип работы по умолчанию</span>
              <select
                className="field"
                value={activeProfile.defaultWorkType ?? "generic"}
                disabled={isLocked}
                onChange={(event) => setProfile(updateProfileField(activeProfile, "defaultWorkType", event.target.value as WorkType))}
              >
                {(activeProfile.workTypes ?? ["generic"]).map((workType) => (
                  <option value={workType} key={workType}>
                    {workTypeLabels[workType]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="muted">OCR</span>
              <select className="field" value={activeProfile.ocrMode} disabled={isLocked} onChange={(event) => setProfile(updateProfileField(activeProfile, "ocrMode", event.target.value as RuleProfile["ocrMode"]))}>
                <option value="auto">Использовать при необходимости</option>
                <option value="enabled">Включить</option>
                <option value="disabled">Отключить</option>
              </select>
            </label>
            <label>
              <span className="muted">Визуальный слой</span>
              <select
                className="field"
                value={activeProfile.visualPreference}
                disabled={isLocked}
                onChange={(event) => setProfile(updateProfileField(activeProfile, "visualPreference", event.target.value as RuleProfile["visualPreference"]))}
              >
                <option value="auto">Автоматически</option>
                <option value="uploadedPdf">Загруженный PDF</option>
                <option value="htmlPreview">HTML-превью DOCX</option>
                <option value="textOnly">Только текст</option>
              </select>
            </label>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 18 }}>
          <label>
            <span className="muted">Левое поле, мм</span>
            <input className="field" type="number" disabled={isLocked} value={activeProfile.pageLayout.leftMarginMm} onChange={(event) => setProfile({ ...activeProfile, pageLayout: { ...activeProfile.pageLayout, leftMarginMm: Number(event.target.value) } })} />
          </label>
          <label>
            <span className="muted">Правое поле, мм</span>
            <input className="field" type="number" disabled={isLocked} value={activeProfile.pageLayout.rightMarginMm} onChange={(event) => setProfile({ ...activeProfile, pageLayout: { ...activeProfile.pageLayout, rightMarginMm: Number(event.target.value) } })} />
          </label>
          <label>
            <span className="muted">Верхнее поле, мм</span>
            <input className="field" type="number" disabled={isLocked} value={activeProfile.pageLayout.topMarginMm} onChange={(event) => setProfile({ ...activeProfile, pageLayout: { ...activeProfile.pageLayout, topMarginMm: Number(event.target.value) } })} />
          </label>
          <label>
            <span className="muted">Нижнее поле, мм</span>
            <input className="field" type="number" disabled={isLocked} value={activeProfile.pageLayout.bottomMarginMm} onChange={(event) => setProfile({ ...activeProfile, pageLayout: { ...activeProfile.pageLayout, bottomMarginMm: Number(event.target.value) } })} />
          </label>
          <label>
            <span className="muted">Допуск полей, мм</span>
            <input className="field" type="number" step="0.1" disabled={isLocked} value={activeProfile.pageLayout.marginToleranceMm} onChange={(event) => setProfile({ ...activeProfile, pageLayout: { ...activeProfile.pageLayout, marginToleranceMm: Number(event.target.value) } })} />
          </label>
          <label>
            <span className="muted">Основной шрифт</span>
            <input className="field" disabled={isLocked} value={activeProfile.typography.mainFont} onChange={(event) => setProfile({ ...activeProfile, typography: { ...activeProfile.typography, mainFont: event.target.value } })} />
          </label>
          <label>
            <span className="muted">Размер, пт</span>
            <input className="field" type="number" disabled={isLocked} value={activeProfile.typography.mainFontSizePt} onChange={(event) => setProfile({ ...activeProfile, typography: { ...activeProfile.typography, mainFontSizePt: Number(event.target.value) } })} />
          </label>
          <label>
            <span className="muted">Межстрочный интервал</span>
            <input className="field" type="number" step="0.1" disabled={isLocked} value={activeProfile.typography.lineSpacing} onChange={(event) => setProfile({ ...activeProfile, typography: { ...activeProfile.typography, lineSpacing: Number(event.target.value) } })} />
          </label>
          <label>
            <span className="muted">Абзацный отступ, см</span>
            <input className="field" type="number" step="0.05" disabled={isLocked} value={activeProfile.typography.firstLineIndentCm} onChange={(event) => setProfile({ ...activeProfile, typography: { ...activeProfile.typography, firstLineIndentCm: Number(event.target.value) } })} />
          </label>
          <label>
            <span className="muted">Минимум источников</span>
            <input className="field" type="number" disabled={isLocked} value={activeProfile.minSources} onChange={(event) => setProfile(updateProfileField(activeProfile, "minSources", Number(event.target.value)))} />
          </label>
          <label>
            <span className="muted">Минимум слов в разделе</span>
            <input className="field" type="number" disabled={isLocked} value={activeProfile.minSectionWords} onChange={(event) => setProfile(updateProfileField(activeProfile, "minSectionWords", Number(event.target.value)))} />
          </label>
        </div>

        <details className="advanced-settings" style={{ marginTop: 22 }}>
          <summary className="debug-summary">Расширенные настройки для опытных пользователей</summary>
          <div style={{ marginTop: 18 }}>
            <h3>Расширенные шаблоны распознавания</h3>
            <div className="notice" style={{ marginBottom: 14 }}>
              <div>
                <strong>Редактируйте осторожно</strong>
                <p className="muted">Эти параметры нужны для тонкой настройки распознавания подписей и ссылок. Если вы не знаете, что такое регулярное выражение, лучше не изменяйте их.</p>
              </div>
            </div>
            <button className="button" type="button" disabled={isLocked} onClick={resetRegexPatterns}>
              <RotateCcw size={18} /> Сбросить шаблоны по умолчанию
            </button>
            <div className="grid two" style={{ marginTop: 18 }}>
              <RegexEditor
                title="Подписи объектов"
                patterns={activeProfile.captionPatterns}
                defaultPatterns={regexPresets.captionPatterns}
                descriptions={captionPatternDescriptions}
                disabled={isLocked}
                onChange={(captionPatterns) => setProfile({ ...activeProfile, captionPatterns: captionPatterns as RuleProfile["captionPatterns"] })}
              />
              <RegexEditor
                title="Ссылки в тексте"
                patterns={activeProfile.referencePatterns}
                defaultPatterns={regexPresets.referencePatterns}
                descriptions={referencePatternDescriptions}
                disabled={isLocked}
                onChange={(referencePatterns) => setProfile({ ...activeProfile, referencePatterns: referencePatterns as RuleProfile["referencePatterns"] })}
              />
            </div>
          </div>
        </details>

        <div style={{ marginTop: 22 }}>
          <h3>Расширенные правила кафедры ПМ</h3>
          <textarea className="textarea code-textarea" disabled={isLocked} value={advancedDraft} onChange={(event) => setAdvancedDraft(event.target.value)} onBlur={(event) => updateAdvancedRules(event.target.value)} />
          {advancedError && <p className="pill error">{advancedError}</p>}
        </div>

        <div style={{ marginTop: 22 }}>
          <h3>Проверки</h3>
          {defaultRules.map((rule) => (
            <RuleToggle
              key={rule.code}
              label={rule.title}
              description={rule.description}
              checked={activeProfile.enabledChecks[rule.enabledKey]}
              onChange={(checked) => setProfile({ ...activeProfile, enabledChecks: { ...activeProfile.enabledChecks, [rule.enabledKey]: checked } })}
            />
          ))}
          {Object.entries(activeProfile.enabledChecks)
            .filter(([key]) => !defaultRules.some((rule) => rule.enabledKey === key))
            .map(([key, checked]) => (
              <RuleToggle
                key={key}
                label={key}
                checked={checked}
                onChange={(next) => setProfile({ ...activeProfile, enabledChecks: { ...activeProfile.enabledChecks, [key]: next } })}
              />
            ))}
        </div>
      </section>
    </div>
  );
}
