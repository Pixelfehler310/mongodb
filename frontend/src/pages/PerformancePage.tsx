import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiClient } from "../api/client";
import { usePerformancePresetsQuery } from "../hooks/queries";
import type {
  PerformanceRunCompletedEvent,
  PerformanceRunPayload,
  PerformanceRunRequest,
  PerformanceRunStartedEvent,
  PerformanceStreamEvent,
  PerformanceSuiteCompletedEvent,
  PerformanceSuiteStartedEvent,
} from "../types";
import { useDatabaseStore, type DatabaseMode } from "../store/database";

const dbColors: Record<DatabaseMode, string> = {
  mongo: "#00ed64",
  postgres: "#1f6feb",
};

type StreamStatus = "idle" | "connecting" | "running" | "completed" | "error";

type ActivityTone = "info" | "running" | "success" | "error";

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: ActivityTone;
};

type LiveState = {
  status: StreamStatus;
  totalRuns: number;
  completedRuns: number;
  pendingRuns: number;
  activeRunLabel: string | null;
  startedAt: string | null;
  error: string | null;
  log: ActivityItem[];
};

type MethodologyCheck = {
  label: string;
  detail: string;
  passed: boolean;
};

type ScenarioAggregate = {
  scenario_id: string;
  scenario_name: string;
  db_mode: DatabaseMode;
  runs: number;
  avg_requests_per_second: number;
  avg_p95_latency_ms: number;
  avg_p99_latency_ms: number;
  avg_success_rate: number;
  rps_spread_pct: number;
  p95_spread_pct: number;
};

type ScenarioPair = {
  scenario_id: string;
  scenario_name: string;
  mongo?: ScenarioAggregate;
  postgres?: ScenarioAggregate;
};

const initialLiveState: LiveState = {
  status: "idle",
  totalRuns: 0,
  completedRuns: 0,
  pendingRuns: 0,
  activeRunLabel: null,
  startedAt: null,
  error: null,
  log: [],
};

const formatStatusCounts = (statusCounts: Record<string, number>): string =>
  Object.entries(statusCounts)
    .map(([status, count]) => `${status}: ${count}`)
    .join(" | ");

const average = (values: number[]): number => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const toFixedNumber = (value: number): number => Number(value.toFixed(2));

const spreadPercent = (values: number[]): number => {
  if (values.length <= 1) {
    return 0;
  }

  const avg = average(values);
  if (avg === 0) {
    return 0;
  }

  return toFixedNumber(((Math.max(...values) - Math.min(...values)) / avg) * 100);
};

const summarizeRunsByScenario = (runs: PerformanceRunPayload["runs"]): ScenarioAggregate[] => {
  const groups = new Map<string, PerformanceRunPayload["runs"]>();

  for (const run of runs) {
    const key = `${run.scenario_id}:${run.db_mode}`;
    const currentRuns = groups.get(key) ?? [];
    currentRuns.push(run);
    groups.set(key, currentRuns);
  }

  return Array.from(groups.values()).map((groupedRuns) => ({
    scenario_id: groupedRuns[0].scenario_id,
    scenario_name: groupedRuns[0].scenario_name,
    db_mode: groupedRuns[0].db_mode,
    runs: groupedRuns.length,
    avg_requests_per_second: toFixedNumber(average(groupedRuns.map((run) => run.requests_per_second))),
    avg_p95_latency_ms: toFixedNumber(average(groupedRuns.map((run) => run.latency_ms.p95))),
    avg_p99_latency_ms: toFixedNumber(average(groupedRuns.map((run) => run.latency_ms.p99))),
    avg_success_rate: toFixedNumber(average(groupedRuns.map((run) => run.success_rate))),
    rps_spread_pct: spreadPercent(groupedRuns.map((run) => run.requests_per_second)),
    p95_spread_pct: spreadPercent(groupedRuns.map((run) => run.latency_ms.p95)),
  }));
};

const buildScenarioPairs = (runs: PerformanceRunPayload["runs"]): ScenarioPair[] => {
  const aggregates = summarizeRunsByScenario(runs);
  const pairs = new Map<string, ScenarioPair>();

  for (const aggregate of aggregates) {
    const currentPair = pairs.get(aggregate.scenario_id) ?? {
      scenario_id: aggregate.scenario_id,
      scenario_name: aggregate.scenario_name,
    };

    currentPair[aggregate.db_mode] = aggregate;
    pairs.set(aggregate.scenario_id, currentPair);
  }

  return Array.from(pairs.values());
};

const compareHigherIsBetter = (left: number | undefined, right: number | undefined): string => {
  if (left === undefined || right === undefined) {
    return "-";
  }

  if (left === right) {
    return "Gleichstand";
  }

  const winner = left > right ? "MongoDB" : "PostgreSQL";
  const delta = ((Math.max(left, right) - Math.min(left, right)) / Math.max(Math.min(left, right), 0.0001)) * 100;
  return `${winner} +${delta.toFixed(1)}%`;
};

const compareLowerIsBetter = (left: number | undefined, right: number | undefined): string => {
  if (left === undefined || right === undefined) {
    return "-";
  }

  if (left === right) {
    return "Gleichstand";
  }

  const winner = left < right ? "MongoDB" : "PostgreSQL";
  const delta = ((Math.max(left, right) - Math.min(left, right)) / Math.max(Math.max(left, right), 0.0001)) * 100;
  return `${winner} ${delta.toFixed(1)}% niedriger`;
};

const getMethodologyTone = (checks: MethodologyCheck[]): "good" | "warning" | "poor" => {
  const passedCount = checks.filter((check) => check.passed).length;

  if (passedCount === checks.length) {
    return "good";
  }

  if (passedCount >= Math.ceil(checks.length / 2)) {
    return "warning";
  }

  return "poor";
};

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

const appendLog = (current: ActivityItem[], entry: ActivityItem): ActivityItem[] => [entry, ...current].slice(0, 18);

const toActivityItem = (event: PerformanceStreamEvent): ActivityItem => {
  if (event.type === "suite-started") {
    return {
      id: `${event.type}-${event.timestamp}`,
      title: "Suite gestartet",
      detail: `${event.total_runs} geplante Runs bei ${event.plan.concurrency} parallelen Requests.`,
      timestamp: event.timestamp,
      tone: "info",
    };
  }

  if (event.type === "run-started") {
    return {
      id: `${event.type}-${event.label}-${event.timestamp}`,
      title: `Aktiv: ${event.scenario_name}`,
      detail: `${event.db_mode.toUpperCase()} | Run ${event.iteration} startet jetzt.`,
      timestamp: event.timestamp,
      tone: "running",
    };
  }

  if (event.type === "run-completed") {
    return {
      id: `${event.type}-${event.run.run_id}-${event.timestamp}`,
      title: `${event.run.scenario_name} abgeschlossen`,
      detail: `${event.run.db_mode.toUpperCase()} mit ${event.run.requests_per_second} RPS und ${event.run.latency_ms.p95} ms P95.`,
      timestamp: event.timestamp,
      tone: "success",
    };
  }

  return {
    id: `${event.type}-${event.timestamp}`,
    title: "Suite abgeschlossen",
    detail: `${event.completed_runs}/${event.total_runs} Runs beendet. Gesamtauswertung ist bereit.`,
    timestamp: event.timestamp,
    tone: "success",
  };
};

const upsertRun = (runs: PerformanceRunPayload["runs"], incomingRun: PerformanceRunPayload["runs"][number]) => {
  const nextRuns = runs.filter((run) => run.run_id !== incomingRun.run_id);
  nextRuns.push(incomingRun);
  return nextRuns;
};

const buildPartialPayload = (event: PerformanceRunCompletedEvent, currentPayload: PerformanceRunPayload | undefined): PerformanceRunPayload => ({
  success: true,
  plan: event.plan,
  started_at: event.started_at,
  completed_at: event.completed_at,
  runs: upsertRun(currentPayload?.runs ?? [], event.run).sort((left, right) => left.run_id.localeCompare(right.run_id)),
  analytics: event.analytics,
  timestamp: event.timestamp,
});

const buildFinalPayload = (event: PerformanceSuiteCompletedEvent): PerformanceRunPayload => ({
  success: true,
  plan: event.plan,
  started_at: event.suite.started_at,
  completed_at: event.suite.completed_at,
  runs: event.suite.runs,
  analytics: event.suite.analytics,
  timestamp: event.timestamp,
});

const formatClock = (timestamp: string | null): string => {
  if (!timestamp) {
    return "-";
  }

  return new Date(timestamp).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const PerformancePage = () => {
  const currentDbMode = useDatabaseStore((state) => state.mode);
  const presetsQuery = usePerformancePresetsQuery();
  const streamRef = useRef<EventSource | null>(null);

  const [durationSeconds, setDurationSeconds] = useState(6);
  const [concurrency, setConcurrency] = useState(20);
  const [iterations, setIterations] = useState(1);
  const [selectedDbModes, setSelectedDbModes] = useState<DatabaseMode[]>([currentDbMode]);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [didInitialize, setDidInitialize] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceRunPayload>();
  const [liveState, setLiveState] = useState<LiveState>(initialLiveState);

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

  useEffect(
    () => () => {
      streamRef.current?.close();
    },
    []
  );

  const availableDbModes = presetsQuery.data?.available_db_modes ?? [];
  const recommendedScenarioIds = presetsQuery.data?.scenarios.map((scenario) => scenario.id) ?? [];
  const estimatedTotalSeconds = durationSeconds * Math.max(iterations, 1) * Math.max(selectedDbModes.length, 1) * Math.max(selectedScenarioIds.length, 1);
  const trendData = mergeDbTrends(performanceData);
  const scenarioPairs = performanceData ? buildScenarioPairs(performanceData.runs) : [];
  const dbComparison = [...(performanceData?.analytics.db_comparison ?? [])].sort((left, right) => right.avg_requests_per_second - left.avg_requests_per_second);
  const fastestDb = dbComparison[0];
  const lowestLatencyDb = [...dbComparison].sort((left, right) => left.avg_p95_latency_ms - right.avg_p95_latency_ms)[0];
  const isStreaming = liveState.status === "connecting" || liveState.status === "running";
  const progressPercent = liveState.totalRuns > 0 ? Math.round((liveState.completedRuns / liveState.totalRuns) * 100) : 0;
  const remainingSeconds = liveState.pendingRuns * durationSeconds;
  const methodologyChecks: MethodologyCheck[] = [
    {
      label: "Beide Datenbanken aktiv",
      detail: "Nur ein echter Paarvergleich erlaubt belastbare Aussagen.",
      passed: selectedDbModes.includes("mongo") && selectedDbModes.includes("postgres"),
    },
    {
      label: "Mindestens 3 Iterationen",
      detail: "Ein einzelner Lauf ist nur explorativ und zu instabil fuer harte Schlussfolgerungen.",
      passed: iterations >= 3,
    },
    {
      label: "Mindestens 10 Sekunden je Run",
      detail: "Kurze Runs verzerren Ausreisser und Startartefakte ueberproportional.",
      passed: durationSeconds >= 10,
    },
    {
      label: "Gesamte Szenarioabdeckung",
      detail: "Alle In-App-Szenarien sollten aktiv sein, damit der Vergleich nicht selektiv wird.",
      passed: recommendedScenarioIds.length > 0 && recommendedScenarioIds.every((scenarioId) => selectedScenarioIds.includes(scenarioId)),
    },
  ];
  const methodologyTone = getMethodologyTone(methodologyChecks);
  const executedMethodologyChecks: MethodologyCheck[] = performanceData
    ? [
        {
          label: "Beide Datenbanken gemessen",
          detail: "Die Suite muss MongoDB und PostgreSQL im selben Lauf enthalten.",
          passed: performanceData.plan.db_modes.includes("mongo") && performanceData.plan.db_modes.includes("postgres"),
        },
        {
          label: "3 Iterationen ausgefuehrt",
          detail: "Nur dann lassen sich Ausreisser und Streuung sinnvoll lesen.",
          passed: performanceData.plan.iterations >= 3,
        },
        {
          label: "Run-Laenge >= 10s",
          detail: "Zu kurze Runs sind eher eine Demo als ein Vergleichsdesign.",
          passed: performanceData.plan.duration_seconds >= 10,
        },
        {
          label: "Alle Frontend-Szenarien enthalten",
          detail: "Selektive Szenarien koennen die Stärken einer Seite kuenstlich hervorheben.",
          passed: recommendedScenarioIds.length > 0 && recommendedScenarioIds.every((scenarioId) => performanceData.plan.scenario_ids.includes(scenarioId)),
        },
      ]
    : [];
  const executedMethodologyTone = performanceData ? getMethodologyTone(executedMethodologyChecks) : "poor";

  const applyComparisonDefaults = () => {
    setDurationSeconds(10);
    setConcurrency(Math.max(concurrency, 20));
    setIterations(3);
    setSelectedDbModes(availableDbModes.includes("mongo") && availableDbModes.includes("postgres") ? ["mongo", "postgres"] : availableDbModes);
    setSelectedScenarioIds(recommendedScenarioIds);
  };

  const toggleDbMode = (mode: DatabaseMode) => {
    setSelectedDbModes((currentModes) => (currentModes.includes(mode) ? currentModes.filter((entry) => entry !== mode) : [...currentModes, mode]));
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarioIds((currentIds) => (currentIds.includes(scenarioId) ? currentIds.filter((entry) => entry !== scenarioId) : [...currentIds, scenarioId]));
  };

  const closeStream = () => {
    streamRef.current?.close();
    streamRef.current = null;
  };

  const handleSuiteStarted = (event: PerformanceSuiteStartedEvent) => {
    setLiveState((current) => ({
      ...current,
      status: "running",
      totalRuns: event.total_runs,
      completedRuns: 0,
      pendingRuns: event.total_runs,
      activeRunLabel: null,
      startedAt: event.started_at,
      error: null,
      log: appendLog(current.log, toActivityItem(event)),
    }));
  };

  const handleRunStarted = (event: PerformanceRunStartedEvent) => {
    setLiveState((current) => ({
      ...current,
      status: "running",
      totalRuns: event.total_runs,
      completedRuns: event.completed_runs,
      pendingRuns: event.pending_runs,
      activeRunLabel: event.label,
      error: null,
      log: appendLog(current.log, toActivityItem(event)),
    }));
  };

  const handleRunCompleted = (event: PerformanceRunCompletedEvent) => {
    setPerformanceData((current) => buildPartialPayload(event, current));
    setLiveState((current) => ({
      ...current,
      status: "running",
      totalRuns: event.total_runs,
      completedRuns: event.completed_runs,
      pendingRuns: event.pending_runs,
      activeRunLabel: event.pending_runs > 0 ? current.activeRunLabel : null,
      error: null,
      log: appendLog(current.log, toActivityItem(event)),
    }));
  };

  const handleSuiteCompleted = (event: PerformanceSuiteCompletedEvent) => {
    setPerformanceData(buildFinalPayload(event));
    setLiveState((current) => ({
      ...current,
      status: "completed",
      totalRuns: event.total_runs,
      completedRuns: event.completed_runs,
      pendingRuns: event.pending_runs,
      activeRunLabel: null,
      error: null,
      log: appendLog(current.log, toActivityItem(event)),
    }));
    closeStream();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedDbModes.length === 0 || selectedScenarioIds.length === 0) {
      return;
    }

    closeStream();

    const payload: PerformanceRunRequest = {
      duration_seconds: durationSeconds,
      concurrency,
      iterations,
      db_modes: selectedDbModes,
      scenario_ids: selectedScenarioIds,
    };

    setPerformanceData(undefined);
    setLiveState({
      status: "connecting",
      totalRuns: 0,
      completedRuns: 0,
      pendingRuns: 0,
      activeRunLabel: null,
      startedAt: null,
      error: null,
      log: [],
    });

    const source = new EventSource(apiClient.getPerformanceStreamUrl(payload));
    streamRef.current = source;

    source.addEventListener("suite-started", (message) => {
      handleSuiteStarted(JSON.parse(message.data) as PerformanceSuiteStartedEvent);
    });

    source.addEventListener("run-started", (message) => {
      handleRunStarted(JSON.parse(message.data) as PerformanceRunStartedEvent);
    });

    source.addEventListener("run-completed", (message) => {
      handleRunCompleted(JSON.parse(message.data) as PerformanceRunCompletedEvent);
    });

    source.addEventListener("suite-completed", (message) => {
      handleSuiteCompleted(JSON.parse(message.data) as PerformanceSuiteCompletedEvent);
    });

    source.addEventListener("suite-error", (message) => {
      const errorPayload = JSON.parse(message.data) as { message?: string };
      setLiveState((current) => ({
        ...current,
        status: "error",
        error: errorPayload.message ?? "Performance stream failed",
        activeRunLabel: null,
        log: appendLog(current.log, {
          id: `suite-error-${Date.now()}`,
          title: "Suite abgebrochen",
          detail: errorPayload.message ?? "Performance stream failed",
          timestamp: new Date().toISOString(),
          tone: "error",
        }),
      }));
      closeStream();
    });

    source.onerror = () => {
      setLiveState((current) => {
        if (current.status === "completed" || current.status === "error") {
          return current;
        }

        return {
          ...current,
          status: "error",
          error: "Die Live-Verbindung wurde unterbrochen.",
          activeRunLabel: null,
          log: appendLog(current.log, {
            id: `stream-disconnected-${Date.now()}`,
            title: "Verbindung unterbrochen",
            detail: "Der Browser hat keine weiteren Live-Daten vom Backend erhalten.",
            timestamp: new Date().toISOString(),
            tone: "error",
          }),
        };
      });
      closeStream();
    };
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
          <p className="badge">Performance Comparison Lab</p>
          <h2>Explorativer In-App-Vergleich mit methodischen Leitplanken</h2>
          <p className="performance-copy">
            Die Seite orchestriert serverseitige API-Lasttests fuer beide Datenbanken und visualisiert Durchsatz, Tail-Latenzen und Erfolgsquoten. Fuer den Bericht ist sie als explorativer Vergleichspfad geeignet, waehrend reproduzierbare Endwerte weiterhin aus dem k6- und Grafana-Pfad kommen sollten.
          </p>
        </div>
        <div className="performance-estimate">
          <span>Geschaetzte Suite-Dauer</span>
          <strong>{estimatedTotalSeconds}s</strong>
        </div>
      </article>

      <article className="card methodology-card">
        <div className="methodology-copy">
          <div className="performance-config-head compact">
            <h3>Methodische Leitplanken</h3>
            <span className={`methodology-badge ${methodologyTone}`}>{methodologyTone === "good" ? "vergleichsbereit" : methodologyTone === "warning" ? "teilweise belastbar" : "nur explorativ"}</span>
          </div>
          <p className="small">
            Wissenschaftlich belastbar wird der Vergleich erst dann, wenn beide Datenbanken innerhalb derselben Suite, mit mehreren Wiederholungen, ausreichender Laufzeit und voller Szenarioabdeckung gegeneinander laufen. Die Seite macht diese Voraussetzungen jetzt explizit sichtbar.
          </p>
          <div className="methodology-actions">
            <button type="button" onClick={applyComparisonDefaults} disabled={isStreaming}>
              Vergleichsmodus laden
            </button>
            <span className="small">Empfohlen: 10s, 3 Iterationen, beide DBs, alle Frontend-Szenarien.</span>
          </div>
        </div>

        <div className="methodology-checklist">
          {methodologyChecks.map((check) => (
            <article key={check.label} className={`methodology-check ${check.passed ? "passed" : "failed"}`}>
              <div>
                <strong>{check.label}</strong>
                <span>{check.passed ? "OK" : "Fehlt"}</span>
              </div>
              <p>{check.detail}</p>
            </article>
          ))}
        </div>
      </article>

      <div className="performance-shell">
        <form className="card performance-config" onSubmit={handleSubmit}>
          <div className="performance-config-head">
            <h3>Suite konfigurieren</h3>
            <button type="submit" className="primary-action" disabled={isStreaming}>
              {isStreaming ? "Live-Suite laeuft..." : "Live-Suite starten"}
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
                    <input type="checkbox" checked={selectedDbModes.includes(mode)} disabled={!availableDbModes.includes(mode) || isStreaming} onChange={() => toggleDbMode(mode)} />
                    <span>{mode === "mongo" ? "MongoDB" : "PostgreSQL"}</span>
                  </label>
                ))}
              </div>
            </label>
          </div>

          <article className="config-note">
            <strong>Interpretationsregel</strong>
            <p>
              Nutze die Frontend-Seite fuer schnelle Hypothesen und paarweise Vergleiche. Fuer Abschlusszahlen, Warm-up-Trennung und zitierfaehige Zeitreihen bleibt der k6- und Grafana-Pfad der Referenzstandard.
            </p>
          </article>

          <div>
            <div className="performance-config-head compact">
              <h3>Szenarien</h3>
              <span className="small">{selectedScenarioIds.length} ausgewaehlt</span>
            </div>
            <div className="scenario-grid">
              {presetsQuery.data.scenarios.map((scenario) => {
                const selected = selectedScenarioIds.includes(scenario.id);
                return (
                  <button key={scenario.id} type="button" className={`scenario-option ${selected ? "selected" : ""}`} onClick={() => toggleScenario(scenario.id)} disabled={isStreaming}>
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

          {liveState.error ? <p className="error">{liveState.error}</p> : null}
          {selectedDbModes.length === 0 ? <p className="error">Mindestens eine Datenbank auswaehlen.</p> : null}
          {selectedScenarioIds.length === 0 ? <p className="error">Mindestens ein Szenario auswaehlen.</p> : null}
        </form>

        <div className="performance-results">
          <div className="performance-live-grid">
            <article className="card live-progress-card">
              <div className="performance-config-head compact">
                <h3>Live Monitor</h3>
                <span className={`live-status ${liveState.status}`}>{liveState.status}</span>
              </div>

              <div className="summary-grid live-summary-grid">
                <article className="stat-card live-stat-card">
                  <h3>Fortschritt</h3>
                  <p>{liveState.completedRuns}/{liveState.totalRuns || 0}</p>
                </article>
                <article className="stat-card live-stat-card">
                  <h3>Aktiver Run</h3>
                  <p>{liveState.activeRunLabel ? "1" : "0"}</p>
                </article>
                <article className="stat-card live-stat-card">
                  <h3>ETA</h3>
                  <p>{isStreaming ? `${remainingSeconds}s` : "-"}</p>
                </article>
                <article className="stat-card live-stat-card">
                  <h3>Start</h3>
                  <p>{formatClock(liveState.startedAt)}</p>
                </article>
              </div>

              <div className="live-progress-bar" aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </div>

              <div className="live-progress-copy">
                <strong>{progressPercent}% abgeschlossen</strong>
                <span>{liveState.activeRunLabel ?? (liveState.status === "completed" ? "Suite ist fertig ausgewertet." : "Warte auf Start...")}</span>
              </div>
            </article>

            <article className="card live-log-card">
              <div className="performance-config-head compact">
                <h3>Aktivitaetsfeed</h3>
                <span className="small">live</span>
              </div>
              {liveState.log.length === 0 ? (
                <p className="small">Nach dem Start erscheinen hier Statuswechsel und Zwischenergebnisse.</p>
              ) : (
                <div className="live-log-list">
                  {liveState.log.map((entry) => (
                    <article key={entry.id} className={`live-log-item ${entry.tone}`}>
                      <div>
                        <strong>{entry.title}</strong>
                        <span>{formatClock(entry.timestamp)}</span>
                      </div>
                      <p>{entry.detail}</p>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </div>

          {!performanceData ? (
            <article className="card empty-state">
              <h3>Noch keine Ergebnisse</h3>
              <p>Starte eine Live-Suite, um Durchsatz, P95/P99-Latenzen, Erfolgsraten und DB-Vergleiche direkt waehrend des Laufs zu sehen.</p>
            </article>
          ) : (
            <>
              <div className="performance-results-head">
                <div>
                  <p className="badge">{liveState.status === "completed" ? "Finale Auswertung" : "Live Zwischenstand"}</p>
                  <h3>{liveState.status === "completed" ? "Benchmark abgeschlossen" : "Benchmark laeuft"}</h3>
                </div>
                <p className="small">Letztes Update: {formatClock(performanceData.timestamp)}</p>
              </div>

              <div className="summary-grid">
                <article className="card stat-card">
                  <h3>Runs gesamt</h3>
                  <p>{performanceData.analytics.totals.total_runs}</p>
                </article>
                <article className="card stat-card">
                  <h3>Requests</h3>
                  <p>{performanceData.analytics.totals.total_requests}</p>
                </article>
                <article className="card stat-card">
                  <h3>O RPS</h3>
                  <p>{performanceData.analytics.totals.avg_requests_per_second}</p>
                </article>
                <article className="card stat-card">
                  <h3>O P95</h3>
                  <p>{performanceData.analytics.totals.avg_p95_latency_ms} ms</p>
                </article>
              </div>

              <article className="card methodology-card compact-card">
                <div className="performance-config-head compact">
                  <h3>Auswertungsstatus</h3>
                  <span className={`methodology-badge ${executedMethodologyTone}`}>{executedMethodologyTone === "good" ? "vergleichsbereit" : executedMethodologyTone === "warning" ? "vorsichtig interpretieren" : "explorativ"}</span>
                </div>
                <div className="methodology-checklist executed">
                  {executedMethodologyChecks.map((check) => (
                    <article key={check.label} className={`methodology-check ${check.passed ? "passed" : "failed"}`}>
                      <div>
                        <strong>{check.label}</strong>
                        <span>{check.passed ? "OK" : "Schwachstelle"}</span>
                      </div>
                      <p>{check.detail}</p>
                    </article>
                  ))}
                </div>
              </article>

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
                  <p>{performanceData.analytics.highlights.fastest_run_label ?? "-"}</p>
                  <small>Bester Durchsatz ueber alle Szenarien</small>
                </article>
                <article className="card performance-callout">
                  <h3>Stabilster P95 Run</h3>
                  <p>{performanceData.analytics.highlights.lowest_p95_run_label ?? "-"}</p>
                  <small>Niedrigste P95-Latenz ueber alle Runs</small>
                </article>
              </div>

              <div className="performance-chart-grid">
                <article className="card chart-card">
                  <h3>Durchsatz pro Run</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={performanceData.runs}>
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
                    <BarChart data={performanceData.runs}>
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
                <h3>Paarweise Szenarioauswertung</h3>
                <table className="top-products performance-table">
                  <thead>
                    <tr>
                      <th>Szenario</th>
                      <th>Mongo RPS</th>
                      <th>Postgres RPS</th>
                      <th>Durchsatz</th>
                      <th>Mongo P95</th>
                      <th>Postgres P95</th>
                      <th>Latenz</th>
                      <th>Streuung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioPairs.map((pair) => (
                      <tr key={pair.scenario_id}>
                        <td>
                          <strong>{pair.scenario_name}</strong>
                          <small>{pair.mongo?.runs ?? pair.postgres?.runs ?? 0} Iterationen je DB</small>
                        </td>
                        <td>{pair.mongo?.avg_requests_per_second ?? "-"}</td>
                        <td>{pair.postgres?.avg_requests_per_second ?? "-"}</td>
                        <td>{compareHigherIsBetter(pair.mongo?.avg_requests_per_second, pair.postgres?.avg_requests_per_second)}</td>
                        <td>{pair.mongo?.avg_p95_latency_ms ? `${pair.mongo.avg_p95_latency_ms} ms` : "-"}</td>
                        <td>{pair.postgres?.avg_p95_latency_ms ? `${pair.postgres.avg_p95_latency_ms} ms` : "-"}</td>
                        <td>{compareLowerIsBetter(pair.mongo?.avg_p95_latency_ms, pair.postgres?.avg_p95_latency_ms)}</td>
                        <td>
                          <small>Mongo RPS-Spanne: {pair.mongo?.rps_spread_pct ?? 0}%</small>
                          <small>Postgres RPS-Spanne: {pair.postgres?.rps_spread_pct ?? 0}%</small>
                          <small>Mongo P95-Spanne: {pair.mongo?.p95_spread_pct ?? 0}%</small>
                          <small>Postgres P95-Spanne: {pair.postgres?.p95_spread_pct ?? 0}%</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="card">
                <h3>Szenario Vergleich</h3>
                <table className="top-products performance-table">
                  <thead>
                    <tr>
                      <th>Szenario</th>
                      <th>DB</th>
                      <th>Runs</th>
                      <th>O RPS</th>
                      <th>O P95</th>
                      <th>O P99</th>
                      <th>Erfolg</th>
                      <th>RPS-Streuung</th>
                      <th>P95-Streuung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summarizeRunsByScenario(performanceData.runs).map((entry) => (
                      <tr key={`${entry.scenario_id}-${entry.db_mode}`}>
                        <td>{entry.scenario_name}</td>
                        <td>{entry.db_mode}</td>
                        <td>{entry.runs}</td>
                        <td>{entry.avg_requests_per_second}</td>
                        <td>{entry.avg_p95_latency_ms} ms</td>
                        <td>{entry.avg_p99_latency_ms} ms</td>
                        <td>{entry.avg_success_rate}%</td>
                        <td>{entry.rps_spread_pct}%</td>
                        <td>{entry.p95_spread_pct}%</td>
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
                    {performanceData.runs.map((run) => (
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
