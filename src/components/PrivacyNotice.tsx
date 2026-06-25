import { ShieldCheck } from "lucide-react";

export function PrivacyNotice() {
  return (
    <section className="notice" aria-label="Конфиденциальность">
      <ShieldCheck size={22} />
      <div>
        <strong>Все обрабатывается локально</strong>
        <p className="muted">
          Документы и результаты проверки никуда не отправляются, не сохраняются на сервере и остаются только на устройстве пользователя. В
          localStorage сохраняются только настройки профилей и тема интерфейса.
        </p>
      </div>
    </section>
  );
}
