import { useEffect, useMemo, useState } from "react";
import type { ParsedDocument } from "./types/document";
import type { CheckReport } from "./types/report";
import type { AppSettings } from "./types/settings";
import type { VisualLayerResult } from "./types/visualLayer";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { CheckerPage } from "./pages/CheckerPage";
import { HelpPage } from "./pages/HelpPage";
import { HomePage } from "./pages/HomePage";
import { ReportPage } from "./pages/ReportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UpdatesPage } from "./pages/UpdatesPage";
import { getActiveProfile, resolveProfileForWorkType } from "./services/settings/profileManager";
import { loadSettings, saveSettings } from "./services/settings/settingsStorage";

export type AppPage = "home" | "checker" | "settings" | "report" | "help" | "updates";

export interface CompletedCheckState {
  report: CheckReport;
  document: ParsedDocument;
  visualLayer: VisualLayerResult;
}

export default function App() {
  const [page, setPage] = useState<AppPage>("home");
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [completedCheck, setCompletedCheck] = useState<CompletedCheckState | null>(null);
  const activeProfile = useMemo(() => resolveProfileForWorkType(getActiveProfile(settings), settings.activeWorkType), [settings]);

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  const goToReport = (result: CompletedCheckState) => {
    setCompletedCheck(result);
    setPage("report");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <Header page={page} onNavigate={setPage} settings={settings} onSettingsChange={setSettings} hasReport={Boolean(completedCheck)} />
      <main className="main-shell">
        {page === "home" && <HomePage onNavigate={setPage} />}
        {page === "checker" && <CheckerPage settings={settings} onSettingsChange={setSettings} activeProfile={activeProfile} onComplete={goToReport} />}
        {page === "help" && <HelpPage />}
        {page === "updates" && <UpdatesPage />}
        {page === "settings" && <SettingsPage settings={settings} onSettingsChange={setSettings} />}
        {page === "report" && completedCheck && <ReportPage result={completedCheck} onNavigate={setPage} />}
        {page === "report" && !completedCheck && <CheckerPage settings={settings} onSettingsChange={setSettings} activeProfile={activeProfile} onComplete={goToReport} />}
      </main>
      <Footer />
    </div>
  );
}
