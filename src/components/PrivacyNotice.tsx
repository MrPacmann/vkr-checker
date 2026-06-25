import { ShieldCheck } from "lucide-react";

export function PrivacyNotice() {
  return (
    <section className="notice" aria-label="Конфиденциальность">
      <ShieldCheck size={22} />
      <div>
        <strong>Конфиденциальность</strong>
        <p className="muted">
          Файлы не отправляются на сервер. Проверка выполняется локально в вашем браузере. После закрытия страницы документы не сохраняются.
          Не загружайте документы на чужих устройствах, если в них есть персональные данные.
        </p>
      </div>
    </section>
  );
}
