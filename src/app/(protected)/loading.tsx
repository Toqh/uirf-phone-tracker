export default function Loading() {
  return (
    <section className="panel" aria-label="Loading page">
      <div className="panel-body" role="status">
        <span className="loading-spinner" aria-hidden="true" />
        Loading records…
      </div>
    </section>
  );
}
