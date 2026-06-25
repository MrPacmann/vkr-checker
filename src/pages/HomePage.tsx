import { ArrowRight, ClipboardCheck, FileSearch, Lock, Settings } from "lucide-react";
import type { AppPage } from "../App";
import { PrivacyNotice } from "../components/PrivacyNotice";

interface HomePageProps {
  onNavigate: (page: AppPage) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="hero">
      <section className="hero-layout">
        <div>
          <p className="eyebrow">ГОСТ 7.32-2017 · локально в браузере</p>
          <h1>Проверка ВКР по ГОСТ 7.32-2017</h1>
          <p className="lead">Предварительная автоматизированная проверка оформления выпускных квалификационных работ</p>
          <p>
            Система предназначена для предварительной автоматизированной проверки выпускных квалификационных работ на соответствие основным требованиям оформления. Проверка помогает быстро выявить типовые нарушения в структуре документа, оформлении разделов, ссылках на рисунки, таблицы, формулы, листинги и список использованных источников.
          </p>
          <p>
            Проверка выполняется по правилам оформления отчетной документации, основанным на ГОСТ 7.32-2017. Система не заменяет финальную проверку научным руководителем или нормоконтролером, но позволяет заранее обнаружить распространенные ошибки и сократить количество правок перед сдачей работы.
          </p>
          <p>Документы и результаты проверки обрабатываются локально в браузере и никуда не отправляются.</p>
          <div className="toolbar">
            <button className="button primary" type="button" onClick={() => onNavigate("checker")}>
              Начать проверку <ArrowRight size={18} />
            </button>
            <button className="button" type="button" onClick={() => onNavigate("settings")}>
              <Settings size={18} /> Настройки проверок
            </button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="document-art">
            <div className="status-row">
              <span className="pill success">DOCX</span>
              <span className="pill">OOXML</span>
            </div>
            <div className="status-stack">
              <span className="document-line" />
              <span className="document-line medium" />
              <span className="document-line" />
              <span className="document-line short" />
              <span className="document-line" />
              <span className="document-line medium" />
            </div>
            <div className="status-stack">
              <div className="status-row">
                <span>Рисунки и таблицы</span>
                <span className="pill warning">3 замечания</span>
              </div>
              <div className="status-row">
                <span>Ссылки и источники</span>
                <span className="pill error">2 ошибки</span>
              </div>
              <div className="status-row">
                <span>Структура</span>
                <span className="pill success">пройдена</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PrivacyNotice />

      <section className="grid three">
        <div className="panel">
          <ClipboardCheck size={28} color="var(--primary)" />
          <h2>Как это работает</h2>
          <p className="muted">Загрузите DOCX, при желании добавьте PDF. Система прочитает структуру Word-документа, построит визуальный слой и сформирует отчет с рекомендациями.</p>
        </div>
        <div className="panel">
          <FileSearch size={28} color="var(--primary)" />
          <h2>Что проверяется</h2>
          <p className="muted">Разделы, заголовки, поля, шрифты, интервалы, рисунки, таблицы, формулы, листинги, список источников и перекрестные ссылки.</p>
        </div>
        <div className="panel">
          <Lock size={28} color="var(--primary)" />
          <h2>Ограничения</h2>
          <p className="muted">Автоматическая проверка не заменяет нормоконтроль. Спорные параметры помечаются как предупреждения или требуют ручной проверки.</p>
        </div>
      </section>
    </div>
  );
}
