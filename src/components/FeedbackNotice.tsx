import { ExternalLink, MessageCircle } from "lucide-react";

export function FeedbackNotice() {
  return (
    <section className="notice feedback-notice" aria-label="Сообщить об ошибке">
      <MessageCircle size={22} />
      <div>
        <strong>Нашли ошибку?</strong>
        <p className="muted">
          Если программа неправильно определила оформление, пропустила ошибку или сайт работает некорректно, напишите автору в Telegram.
        </p>
        <p className="muted">По возможности приложите: документ, отчёт проверки и краткое описание проблемы.</p>
        <p className="muted">Автор: mrpacmann — Трушин Степан</p>
        <a className="button" href="https://t.me/mr_pacman" target="_blank" rel="noopener noreferrer">
          Написать в Telegram <ExternalLink size={16} />
        </a>
      </div>
    </section>
  );
}
