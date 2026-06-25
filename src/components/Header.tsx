import { FileCheck2, Moon, Settings, Sun, UploadCloud, Home, BarChart3 } from "lucide-react";
import type { AppPage } from "../App";
import type { AppSettings } from "../types/settings";

interface HeaderProps {
  page: AppPage;
  hasReport: boolean;
  settings: AppSettings;
  onNavigate: (page: AppPage) => void;
  onSettingsChange: (settings: AppSettings) => void;
}

export function Header({ page, hasReport, settings, onNavigate, onSettingsChange }: HeaderProps) {
  const toggleTheme = () => onSettingsChange({ ...settings, theme: settings.theme === "dark" ? "light" : "dark" });
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={() => onNavigate("home")} type="button" aria-label="На главную">
          <span className="brand-mark">
            <FileCheck2 size={22} />
          </span>
          <span>Проверка ВКР</span>
        </button>
        <nav className="nav-actions" aria-label="Основная навигация">
          <button className={`button ${page === "home" ? "primary" : ""}`} type="button" onClick={() => onNavigate("home")}>
            <Home size={18} /> Главная
          </button>
          <button className={`button ${page === "checker" ? "primary" : ""}`} type="button" onClick={() => onNavigate("checker")}>
            <UploadCloud size={18} /> Проверка
          </button>
          <button className={`button ${page === "settings" ? "primary" : ""}`} type="button" onClick={() => onNavigate("settings")}>
            <Settings size={18} /> Настройки
          </button>
          <button className={`button ${page === "report" ? "primary" : ""}`} type="button" onClick={() => onNavigate("report")} disabled={!hasReport}>
            <BarChart3 size={18} /> Отчет
          </button>
          <button className="icon-button" type="button" onClick={toggleTheme} title="Переключить тему" aria-label="Переключить тему">
            {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </div>
    </header>
  );
}
