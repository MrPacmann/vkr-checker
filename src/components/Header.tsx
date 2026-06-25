import { BarChart3, BookOpen, FileCheck2, History, Home, Moon, Settings, Sun, UploadCloud } from "lucide-react";
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
          <span>Проверка оформления</span>
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
          <button className={`button ${page === "help" ? "primary" : ""}`} type="button" onClick={() => onNavigate("help")}>
            <BookOpen size={18} /> Как исправить
          </button>
          <button className={`button ${page === "updates" ? "primary" : ""}`} type="button" onClick={() => onNavigate("updates")}>
            <History size={18} /> Обновления
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
