import { changelog } from "../data/changelog";

export function UpdatesPage() {
  return (
    <div className="grid">
      <section>
        <p className="eyebrow">История изменений</p>
        <h1 style={{ fontSize: 44 }}>Обновления</h1>
        <p className="lead">Короткий список пользовательских улучшений и изменений интерфейса.</p>
      </section>

      <section className="grid">
        {changelog.map((entry) => (
          <article className="tool-panel" key={`${entry.version}-${entry.date}`}>
            <div className="status-row">
              <strong>Версия {entry.version}</strong>
              <span className="pill">{new Date(entry.date).toLocaleDateString("ru-RU")}</span>
            </div>
            <ul className="compact-list" style={{ marginTop: 14 }}>
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
