import { useHealthQuery } from "../hooks/queries";

export const HealthPage = () => {
  const healthQuery = useHealthQuery();

  if (healthQuery.isLoading) {
    return <p>Lade Health-Status...</p>;
  }

  if (healthQuery.error) {
    return (
      <section className="card health-layout">
        <h2>DB Health</h2>
        <p className="error">{(healthQuery.error as Error).message}</p>
        <p>
          Der Backend-Health-Endpunkt ist aktuell nicht erreichbar. Pruefe, ob das Backend laeuft
          und die API-URL korrekt gesetzt ist.
        </p>
      </section>
    );
  }

  if (!healthQuery.data) {
    return <p>Kein Health-Status vorhanden.</p>;
  }

  const payload = healthQuery.data;
  const isHealthy = payload.status === "ok" && payload.dependencies.mongodb === "connected";

  return (
    <section className="card health-layout">
      <h2>DB Health</h2>
      <p>
        Live-Check fuer <strong>Backend + MongoDB Atlas</strong> (Auto-Refresh alle 10 Sekunden).
      </p>

      <div className={isHealthy ? "status-pill healthy" : "status-pill unhealthy"}>
        {isHealthy ? "Healthy" : "Not Healthy"}
      </div>

      <div className="health-grid">
        <article>
          <h3>Service-Status</h3>
          <p>{payload.status}</p>
        </article>
        <article>
          <h3>MongoDB</h3>
          <p>{payload.dependencies.mongodb}</p>
        </article>
        <article>
          <h3>Letzter Check</h3>
          <p>{new Date(payload.timestamp).toLocaleString()}</p>
        </article>
      </div>

      <button type="button" onClick={() => void healthQuery.refetch()}>
        Jetzt neu pruefen
      </button>
    </section>
  );
};
