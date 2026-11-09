export function StudentPageLoading() {
  return (
    <main className="app-shell">
      <section className="screen student-page-loading" aria-live="polite" aria-busy="true">
        <span className="student-loading-dot" aria-hidden="true" />
        <p>正在加载…</p>
      </section>
    </main>
  );
}
