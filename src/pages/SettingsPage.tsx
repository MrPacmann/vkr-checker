import { SettingsEditor } from "../components/SettingsEditor";
import type { AppSettings } from "../types/settings";

interface SettingsPageProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function SettingsPage({ settings, onSettingsChange }: SettingsPageProps) {
  return (
    <div className="grid">
      <section>
        <p className="eyebrow">Профили и правила</p>
        <h1 style={{ fontSize: 44 }}>Настройки проверок</h1>
        <p className="lead">Изменяйте правила оформления, регулярные выражения, OCR и режим визуального слоя. Настройки сохраняются локально в браузере.</p>
      </section>
      <SettingsEditor settings={settings} onSettingsChange={onSettingsChange} />
    </div>
  );
}
