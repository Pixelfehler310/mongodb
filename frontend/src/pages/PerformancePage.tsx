import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePerformancePresetsQuery, useRunPerformanceMutation } from "../hooks/queries";
import type { PerformanceRunPayload } from "../types";
import { useDatabaseStore, type DatabaseMode } from "../store/database";

const dbColors: Record<DatabaseMode, string> = {
  mongo: "#00ed64",
  postgres: "#1f6feb",
};

const formatStatusCounts = (statusCounts: Record<string, number>): string =>
  Object.entries(statusCounts)
    .map(([status, count]) => `${status}: ${count}`)
    .join(" | ");

const mergeDbTrends = (payload: PerformanceRunPayload | undefined) => {
  const rows = new Map<number, Record<string, number | string>>();

  for (const trend of payload?.analytics.db_trends ?? []) {
    for (const point of trend.timeline) {
      const existing = rows.get(point.second) ?? { second: point.second };
      existing[`${trend.db_mode}_rps`] = point.requests_per_second;
      existing[`${trend.db_mode}_latency`] = point.avg_latency_ms;
      existing[`${trend.db_mode}_success`] = point.success_rate;
      rows.set(point.second, existing);
    }
  }

  return Array.from(rows.values()).sort((left, right) => Number(left.second) - Number(right.second));
};

export const PerformancePage = () => {
  const currentDbMode = useDatabaseStore((state) => state.mode);
  const presetsQuery = usePerformancePresetsQuery();
  const runMutation = useRunPerformanceMutation();

  const [durationSeconds, setDurationSeconds] = useState(6);
  const [concurrency, setConcurrency] = useState(20);
  const [iterations, setIterations] = useState(1);
  const [selectedDbModes, setSelectedDbModes] = useState<DatabaseMode[]>([currentDbMode]);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [didInitialize, setDidInitialize] = useState(false);

  useEffect(() => {
    if (!presetsQuery.data || didInitialize) {
      return;
    }

    setDurationSeconds(presetsQuery.data.defaults.duration_seconds);
    setConcurrency(presetsQuery.data.defaults.concurrency);
    setIterations(presetsQuery.data.defaults.iterations);
    setSelectedDbModes(presetsQuery.data.defaults.db_modes.length > 0 ? presetsQuery.data.defaults.db_modes : [currentDbMode]);
    setSelectedScenarioIds(presetsQuery.data.defaults.scenario_ids);
    setDidInitialize(true);
  }, [currentDbMode, didInitialize, presetsQuery.data]);

  const availableDbModes = presetsQuery.data?.available_db_modes ?? [];
  const estimatedTotalSeconds = durationSeconds * Math.max(iterations, 1) * Math.max(selectedDbModes.length, 1) * Math.max(selectedScenarioIds.length, 1);
  const trendData = mergeDbTrends(runMutation.data);
  const dbComparison = [...(runMutation.data?.analytics.db_comparison ?? [])].sort((left, right) => right.avg_requests_per_second - left.avg_requests_per_second);
  const fastestDb = dbComparison[0];
  const lowestLatencyDb = [...dbComparison].sort((left, right) => left.avg_p95_latency_ms - right.avg_p95_latency_ms)[0];

  const toggleDbMode = (mode: DatabaseMode) => {
    setSelectedDbModes((currentModes) => (currentModes.includes(mode) ? currentModes.filter((entry) => entry !== mode) : [...currentModes, mode]));
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarioIds((currentIds) => (currentIds.includes(scenarioId) ? currentIds.filter((entry) => entry !== scenarioId) : [...currentIds, scenarioId]));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedDbModes.length === 0 || selectedScenarioIds.length === 0) {
      return;
    }

    runMutation.mutate({
      duration_seconds: durationSeconds,
      concurrency,
      iterations,
      db_modes: selectedDbModes,
      scenario_ids: selectedScenarioIds,
    });
  };

  if (presetsQuery.isLoading) {
    return <p>Lade Performance-Konfiguration...</p>;
  }

  if (presetsQuery.error) {
    return <p className="error">{(presetsQuery.error as Error).message}</p>;
  }

  if (!presetsQuery.data) {
    return <p>Keine Performance-Konfiguration vorhanden.</p>;
  }

  return (
    <section className="performance-layout">
      <article className="card performance-hero">
        <div>
          <p className="badge">Performance Lab</p>
          <h2>Vergleichbare Lasttests fuer API und Analytics</h2>
          <p className="performance-copy">
            Der View orchestriert die ausgewaehlten Szenarien serverseitig, misst Durchsatz, Latenz und Erfolgsquote und stellt die Ergebnisse direkt fuer MongoDB und PostgreSQL gegenueber.
          </p>
        </div>
        <div className="performance-estimate">
          <span>Geschaetzte Suite-Dauer</span>
          <strong>{estimatedTotalSeconds}s</strong>
        </div>
      </article>

      <div className="performance-shell">
        <form className="card performance-config" onSubmit={handleSubmit}>
          <div className="performance-config-head">
            <h3>Suite konfigurieren</h3>
            <button type="submit" className="primary-action" disabled={runMutation.isPending}>
              {runMutation.isPending ? "Suite laeuft..." : "Suite starten"}
            </button>
          </div>

          <div className="form-two-col">
            <label>
              Dauer je Run (Sek.)
              <input type="number" min={3} max={20} value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value) || 0)} />
            </label>

            <label>
              Parallelitaet
              <input type="number" min={1} max={100} value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value) || 0)} />
            </label>

            <label>
              Wiederholungen
              <input type="number" min={1} max={3} value={iterations} onChange={(event) => setIterations(Number(event.target.value) || 0)} />
            </label>

            <label>
              Aktive Datenbanken
              <div className="performance-option-row db-selector">
                {(["mongo", "postgres"] as DatabaseMode[]).map((mode) => (
                  <label key={mode} className={`toggle-pill ${selectedDbModes.includes(mode) ? "selected" : ""}`}>
                    <input type="checkbox" checked={selectedDbModes.includes(mode)} disabled={!availableDbModes.includes(mode)} onChange={() => toggleDbMode(mode)} />
                    <span>{mode === "mongo" ? "MongoDB" : "PostgreSQL"}</span>
                  </label>
                ))}
              </div>
            </label>
          </div>

          <div>
            <div className="performance-config-head compact">
              <h3>Szenarien</h3>
              <span className="small">{selectedScenarioIds.length} ausgewaehlt</span>
            </div>
            <div className="scenario-grid">
              {presetsQuery.data.scenarios.map((scenario) => {
                const selected = selectedScenarioIds.includes(scenario.id);
                return (
                  <button key={scenario.id} type="button" className={`scenario-option ${selected ? "selected" : ""}`} onClick={() => toggleScenario(scenario.id)}>
                    <div className="scenario-head">
                      <strong>{scenario.name}</strong>
                      <span>{scenario.method}</span>
                    </div>
                    <p>{scenario.description}</p>
                    <div className="chips">
                      {scenario.tags.map((tag) => (
                        <span key={tag} className="chip tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <small>{scenario.path}</small>
                  </button>
                );
              })}
            </div>
          </div>

          {runMutation.error ? <p className="error">{(runMutation.error as Error).message}</p> : null}
          {selectedDbModes.length === 0 ? <p className="error">Mindestens eine Datenbank auswaehlen.</p> : null}
          {selectedScenarioIds.length === 0 ? <p className="error">Mindestens ein Szenario auswaehlen.</p> : null}
        </form>

        <div className="performance-results">
          {!runMutation.data ? (
            <article className="card empty-state">
              <h3>Noch keine Ergebnisse</h3>
              <p>Starte eine Suite, um Durchsatz, P95/P99-Latenzen, Erfolgsraten und DB-Vergleiche fuer deine API-Pfade zu sehen.</p>
            </article>
          ) : (
            <>
              <div className="summary-grid">
                <article className="card stat-card">
                  <h3>Runs gesamt</h3>
                  <p>{runMutation.data.analytics.totals.total_runs}</p>
                </article>
                <article className="card stat-card">
                  <h3>Requests</h3>
                  <p>{runMutation.data.analytics.totals.total_requests}</p>
                </article>
                <article className="card stat-card">
                  <h3>Ø RPS</h3>
                  <p>{runMutation.data.analytics.totals.avg_requests_per_second}</p>
                </article>
                <article className="card stat-card">
                  <h3>Ø P95</h3>
                  <p>{runMutation.data.analytics.totals.avg_p95_latency_ms} ms</p>
                </article>
              </div>

              <div className="performance-comparison-grid">
                <article className="card performance-callout">
                  <h3>Schnellste DB</h3>
                  <p>{fastestDb ? fastestDb.db_mode.toUpperCase() : "-"}</p>
                  <small>{fastestDb ? `${fastestDb.avg_requests_per_second} RPS im Mittel` : "Keine Daten"}</small>
                </article>
                <article className="card performance-callout">
                  <h3>Niedrigste P95</h3>
                  <p>{lowestLatencyDb ? lowestLatencyDb.db_mode.toUpperCase() : "-"}</p>
                  <small>{lowestLatencyDb ? `${lowestLatencyDb.avg_p95_latency_ms} ms im Mittel` : "Keine Daten"}</small>
                </article>
                <article className="card performance-callout">
                  <h3>Top Run</h3>
                  <p>{runMutation.data.analytics.highlights.fastest_run_label ?? "-"}</p>
                  <small>Bester Durchsatz ueber alle Szenarien</small>
                </article>
                <article className="card performance-callout">
                  <h3>Stabilster P95 Run</h3>
                  <p>{runMutation.data.analytics.highlights.lowest_p95_run_label ?? "-"}</p>
                  <small>Niedrigste P95-Latenz ueber alle Runs</small>
                </article>
              </div>

              <div className="performance-chart-grid">
                <article className="card chart-card">
                  <h3>Durchsatz pro Run</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={runMutation.data.runs}>
                      <CartesianGrid strokeDasharray="4 4" />
                      <XAxis dataKey="run_id" hide />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="requests_per_second" fill="#00ed64" />
                    </BarChart>
                  </ResponsiveContainer>
                </article>

                <article className="card chart-card">
                  <h3>P95-Latenz pro Run</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={runMutation.data.runs}>
                      <CartesianGrid strokeDasharray="4 4" />
                      <XAxis dataKey="run_id" hide />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="latency_ms.p95" fill="#108f50" />
                    </BarChart>
                  </ResponsiveContainer>
                </article>

                <article className="card chart-card">
                  <h3>Durchsatz-Trend je DB</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="4 4" />
                      <XAxis dataKey="second" />
                      <YAxis />
                      <Tooltip />
                      {availableDbModes.includes("mongo") ? <Line type="monotone" dataKey="mongo_rps" stroke={dbColors.mongo} strokeWidth={3} dot={false} /> : null}
                      {availableDbModes.includes("postgres") ? <Line type="monotone" dataKey="postgres_rps" stroke={dbColors.postgres} strokeWidth={3} dot={false} /> : null}
                    </LineChart>
                  </ResponsiveContainer>
                </article>

                <article className="card chart-card">
                  <h3>Latenz-Trend je DB</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="4 4" />
                      <XAxis dataKey="second" />
                      <YAxis />
                      <Tooltip />
                      {availableDbModes.includes("mongo") ? <Line type="monotone" dataKey="mongo_latency" stroke={dbColors.mongo} strokeWidth={3} dot={false} /> : null}
                      {availableDbModes.includes("postgres") ? <Line type="monotone" dataKey="postgres_latency" stroke={dbColors.postgres} strokeWidth={3} dot={false} /> : null}
                    </LineChart>
                  </ResponsiveContainer>
                </article>
              </div>

              <article className="card">
                <h3>DB Vergleich</h3>
                <div className="performance-db-grid">
                  {dbComparison.map((entry) => (
                    <article key={entry.db_mode} className="performance-db-card">
                      <div className="scenario-head">
                        <strong>{entry.db_mode === "mongo" ? "MongoDB" : "PostgreSQL"}</strong>
                        <span className={`run-badge ${entry.db_mode}`}>{entry.runs} Runs</span>
                      </div>
                      <p>{entry.total_requests} Requests</p>
                      <p>{entry.avg_requests_per_second} RPS im Mittel</p>
                      <p>{entry.avg_p95_latency_ms} ms P95</p>
                      <p>{entry.avg_success_rate}% Erfolgsquote</p>
                      <small>{entry.best_run_label}</small>
                    </article>
                  ))}
                </div>
              </article>

              <article className="card">
                <h3>Szenario Vergleich</h3>
                <table className="top-products performance-table">
                  <thead>
                    <tr>
                      <th>Szenario</th>
                      <th>DB</th>
                      <th>Runs</th>
                      <th>Ø RPS</th>
                      <th>Ø P95</th>
                      <th>Erfolg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runMutation.data.analytics.scenario_comparison.map((entry) => (
                      <tr key={`${entry.scenario_id}-${entry.db_mode}`}>
                        <td>{entry.scenario_name}</td>
                        <td>{entry.db_mode}</td>
                        <td>{entry.runs}</td>
                        <td>{entry.avg_requests_per_second}</td>
                        <td>{entry.avg_p95_latency_ms} ms</td>
                        <td>{entry.avg_success_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="card">
                <h3>Run Details</h3>
                <table className="top-products performance-table">
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Requests</th>
                      <th>RPS</th>
                      <th>P50</th>
                      <th>P95</th>
                      <th>P99</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runMutation.data.runs.map((run) => (
                      <tr key={run.run_id}>
                        <td>
                          <div className="performance-run-title">
                            <span className={`run-badge ${run.db_mode}`}>{run.db_mode}</span>
                            <strong>{run.scenario_name}</strong>
                          </div>
                          <small>Run {run.iteration}</small>
                        </td>
                        <td>{run.requests}</td>
                        <td>{run.requests_per_second}</td>
                        <td>{run.latency_ms.p50} ms</td>
                        <td>{run.latency_ms.p95} ms</td>
                        <td>{run.latency_ms.p99} ms</td>
                        <td>{formatStatusCounts(run.status_counts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
