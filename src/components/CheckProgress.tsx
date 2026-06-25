import { Check, Loader2 } from "lucide-react";

export const checkStages = [
  "Чтение DOCX",
  "Анализ структуры Word-документа",
  "Анализ стилей и оформления",
  "Поиск разделов",
  "Поиск рисунков, таблиц, формул, листингов",
  "Проверка ссылок",
  "Анализ списка источников",
  "Построение визуального слоя",
  "Сопоставление замечаний со страницами",
  "Формирование отчета"
];

interface CheckProgressProps {
  currentStage: number;
  running: boolean;
}

export function CheckProgress({ currentStage, running }: CheckProgressProps) {
  return (
    <div className="progress-list">
      {checkStages.map((stage, index) => {
        const done = currentStage > index;
        const current = currentStage === index && running;
        return (
          <div className={`progress-item ${done ? "done" : ""} ${current ? "current" : ""}`} key={stage}>
            <span className="progress-dot">{done ? <Check size={14} /> : current ? <Loader2 size={14} className="spin" /> : index + 1}</span>
            <span>{stage}</span>
          </div>
        );
      })}
    </div>
  );
}
